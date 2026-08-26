package seal

import (
	"bytes"
	"errors"
	"fmt"
	"os"
	"os/exec"
	"strings"

	"github.com/ryannel/groundwork/internal/journal"
)

// Everything here shells out to git and reads what comes back. Nothing in this
// file holds a key, and nothing signs.

// gitOut runs one git command in the repo at dir and returns its stdout,
// exactly as git wrote it.
//
// stdin may be empty. A caller that wants one value trims it itself: a tag's
// own bytes are what the mirror stores, and trimming them would change the
// object id.
func gitOut(dir string, stdin []byte, args ...string) (string, error) {
	return gitEnv(dir, nil, stdin, args...)
}

// gitEnv is gitOut with extra environment. The mirror builds its tree in an
// index of its own, and the variable that points git at it goes through here.
func gitEnv(dir string, extraEnv []string, stdin []byte, args ...string) (string, error) {
	out, _, err := gitBoth(dir, extraEnv, stdin, args...)

	return out, err
}

// gitBoth runs one git command and returns its stdout and its stderr, whether
// it succeeded or not.
//
// Verification needs both. Git writes its GPG status lines to stdout and its
// SSH wording to stderr, and the reason a verification failed is in git's own
// words rather than in its exit code.
func gitBoth(dir string, extraEnv []string, stdin []byte, args ...string) (string, string, error) {
	cmd := exec.Command("git", append([]string{"-C", dir}, args...)...)

	if len(extraEnv) > 0 {
		cmd.Env = append(os.Environ(), extraEnv...)
	}
	if len(stdin) > 0 {
		cmd.Stdin = bytes.NewReader(stdin)
	}

	var out, errOut bytes.Buffer
	cmd.Stdout = &out
	cmd.Stderr = &errOut

	if err := cmd.Run(); err != nil {
		return out.String(), errOut.String(), fmt.Errorf("git %s: %w: %s",
			strings.Join(args, " "), err, strings.TrimSpace(errOut.String()))
	}

	return out.String(), errOut.String(), nil
}

// gitLine runs one git command and returns its stdout without the surrounding
// whitespace. Use it for commands that print a single value.
func gitLine(dir string, args ...string) (string, error) {
	out, err := gitOut(dir, nil, args...)
	if err != nil {
		return "", err
	}

	return strings.TrimSpace(out), nil
}

// missing reports whether a git command failed only because the thing it was
// asked about is not there. Those commands exit 1. Real trouble exits higher.
func missing(err error) bool {
	var exit *exec.ExitError
	if !errors.As(err, &exit) {
		return false
	}

	return exit.ExitCode() == 1
}

// root returns the repo root for a directory anywhere inside it. Every read
// here is named from the root, so a call from a subdirectory asks the same
// question as one from the top.
func root(dir string) (string, error) {
	return journal.RepoRoot(dir)
}

// resolve returns the object id a revision points at, or an empty string when
// the revision is not there.
func resolve(dir, rev string) (string, error) {
	out, err := gitLine(dir, "rev-parse", "--verify", "--quiet", rev)
	if err != nil {
		if missing(err) {
			return "", nil
		}

		return "", err
	}

	return out, nil
}

// sealTags returns the names of every tag under seal/, sorted.
//
// It asks for-each-ref rather than git tag -l, because for-each-ref takes the
// pattern as a ref path and never as a shell glob over something else.
func sealTags(dir string) ([]string, error) {
	out, err := gitOut(dir, nil,
		"for-each-ref", "--format=%(refname:strip=2)", "refs/tags/"+tagPrefix+"**")
	if err != nil {
		return nil, err
	}

	var names []string
	for _, name := range strings.Split(strings.TrimSpace(out), "\n") {
		if name != "" {
			names = append(names, name)
		}
	}

	return names, nil
}

// rawTag returns the bytes of one annotated tag object.
//
// A lightweight tag is not a tag object at all — it is a ref pointing straight
// at a commit — so it comes back as an error saying so. A seal has to be
// annotated, because the message is where a seal says what it covers.
func rawTag(dir, tag string) (string, error) {
	kind, err := gitLine(dir, "cat-file", "-t", "refs/tags/"+tag)
	if err != nil {
		return "", err
	}
	if kind != "tag" {
		return "", fmt.Errorf("the tag %q is a %s, and a seal is an annotated tag", clip(tag), clip(kind))
	}

	return gitOut(dir, nil, "cat-file", "tag", "refs/tags/"+tag)
}

// splitTag cuts a raw tag object into its message and its signature block.
//
// The signature, when there is one, is appended to the message inside the same
// object. That is how git stores it, and it is why the two come apart here
// rather than through a second git call.
func splitTag(raw string) (message, signature string) {
	_, body, found := strings.Cut(raw, "\n\n")
	if !found {
		return "", ""
	}

	lines := strings.SplitAfter(body, "\n")
	for at, line := range lines {
		if strings.HasPrefix(line, "-----BEGIN ") && strings.Contains(line, "SIGNATURE") {
			return strings.Join(lines[:at], ""), strings.Join(lines[at:], "")
		}
	}

	return body, ""
}

// blobsAt returns the blob hash of each path at a revision. A path the
// revision does not hold as a file is left out of the map.
//
// Every path is asked in one call. The paths are charset-checked before they
// get here, so none of them can carry pathspec magic and turn into a different
// question.
func blobsAt(dir, rev string, paths []string) (map[string]string, error) {
	if len(paths) == 0 {
		return map[string]string{}, nil
	}

	args := append([]string{"ls-tree", "-z", "--full-tree", rev, "--"}, paths...)

	out, err := gitOut(dir, nil, args...)
	if err != nil {
		return nil, err
	}

	at := map[string]string{}
	for _, entry := range strings.Split(out, "\x00") {
		if entry == "" {
			continue
		}

		head, path, found := strings.Cut(entry, "\t")
		if !found {
			return nil, fmt.Errorf("git ls-tree gave the entry %q", clip(entry))
		}

		fields := strings.Fields(head)
		if len(fields) != 3 {
			return nil, fmt.Errorf("git ls-tree gave the entry %q", clip(entry))
		}
		// A directory is a tree, not a blob. A seal covers files, so a path
		// that names a directory is a path this cannot hash — and leaving it
		// out is what makes verify call it gone rather than held.
		if fields[1] != "blob" {
			continue
		}

		at[path] = fields[2]
	}

	return at, nil
}

// verifySignature asks git whether a tag's signature is good, against the
// committed allowed-signers file.
//
// It returns the principal git named, git's own words, and whether git said the
// signature was good. It never returns a key, and it never makes one: this tool
// only verifies (R4).
//
// Git's own words are returned because the exit code says only that it failed.
// Which of three things went wrong — no verifier, an unlisted key, a bad
// signature — is in what git said, and D52.5 rules that the reader is told
// which.
func verifySignature(dir, tag, signers string) (signer, said string, err error) {
	out, errOut, err := gitBoth(dir, nil, nil,
		"-c", "gpg.ssh.allowedSignersFile="+signers,
		"verify-tag", "--raw", "refs/tags/"+tag)

	said = out + errOut
	if err != nil {
		return "", said, err
	}

	return signerFrom(said), said, nil
}

// signerFrom reads who signed out of git's verification output.
//
// Git says it two ways, and both are read here. The SSH path writes
// `Good "git" signature for <principal> with <keytype> key ...`. The GPG path
// writes status lines of the form `[GNUPG:] GOODSIG <key> <name>`.
//
// F60 is why both. This started with the GPG line alone, and git's SSH path
// never produces it. On the owner's machine a verified seal would have recorded
// no signer at all.
//
// The host limit stands (F62). The signing shim here only signs, so no run in
// this container reaches a good signature. This is proved on git's own wording
// instead.
//
// A good signature can come from a key that matches no principal. That names
// nobody, and nobody is what gets reported. Guessing would be worse.
func signerFrom(said string) string {
	for _, line := range strings.Split(said, "\n") {
		if rest, found := strings.CutPrefix(line, "[GNUPG:] GOODSIG "); found {
			fields := strings.Fields(rest)
			if len(fields) > 0 {
				return clip(fields[0])
			}
		}

		rest, found := strings.CutPrefix(line, `Good "git" signature for `)
		if !found {
			continue
		}

		principal, _, found := strings.Cut(rest, " with ")
		if found && principal != "" {
			return clip(principal)
		}
	}

	return ""
}

// whyNotVerified turns git's own words into the one sentence that says which
// situation the reader is in.
//
// D52.5 names three: no verifier on this machine, a key nobody listed, and a
// bad signature. There is a fourth shape — something none of the three — and it
// passes git's own first line on rather than guessing. Saying "it did not
// verify" to all four is what F60 caught, because the situation every run in
// this container is in is the first one, and it read like the third.
func whyNotVerified(said string) string {
	lower := strings.ToLower(said)

	switch {
	case has(lower, "cannot run", "no such file", "not found", "unsupported", "needs to be configured"):
		return "no verifier ran on this machine, so nothing here could check it"
	case has(lower, "no principal matched", "no principal"):
		return AllowedSignersFile + " lists no key that matches the one that signed it"
	case has(lower, "signature verification failed", "bad signature", "incorrect signature"):
		return "the signature does not check out"
	default:
		return "git could not verify it, and said: " + clip(firstLine(said))
	}
}

// has reports whether text holds any of the words.
func has(text string, words ...string) bool {
	for _, word := range words {
		if strings.Contains(text, word) {
			return true
		}
	}

	return false
}

// firstLine returns the first line of text that says anything.
func firstLine(text string) string {
	for _, line := range strings.Split(text, "\n") {
		if strings.TrimSpace(line) != "" {
			return strings.TrimSpace(line)
		}
	}

	return ""
}

// signers is the committed allowed-signers file, put where git can read it.
type signers struct {
	// path is a file on disk holding what HEAD says. It is empty when HEAD
	// holds no signers file.
	path string

	// present says whether HEAD holds the file at all.
	present bool
}

// openSigners reads the allowed-signers file from HEAD and writes it somewhere
// git can be pointed at. The second return puts it away again.
//
// From HEAD, never from the working tree. R4 says the file is committed, and a
// file an agent can swap on disk without a commit is not committed — F65. Git
// only takes a path, so the committed bytes are laid down in a file of their
// own for the length of one run.
func openSigners(dir string) (signers, func(), error) {
	nothing := func() {}

	raw, err := gitOut(dir, nil, "show", "HEAD:"+AllowedSignersFile)
	if err != nil {
		// HEAD holds no such file. That is a state, not a fault: most repos
		// have never written one.
		return signers{}, nothing, nil
	}

	file, err := os.CreateTemp("", "groundwork-signers-")
	if err != nil {
		return signers{}, nothing, fmt.Errorf("write out the committed signers file: %w", err)
	}

	if _, err := file.WriteString(raw); err != nil {
		file.Close()
		os.Remove(file.Name())

		return signers{}, nothing, fmt.Errorf("write out the committed signers file: %w", err)
	}
	if err := file.Close(); err != nil {
		os.Remove(file.Name())

		return signers{}, nothing, fmt.Errorf("write out the committed signers file: %w", err)
	}

	return signers{path: file.Name(), present: true}, func() { os.Remove(file.Name()) }, nil
}
