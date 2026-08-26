package main

import (
	"bytes"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"testing"
	"unicode"

	"github.com/ryannel/groundwork/internal/journal"
	"github.com/ryannel/groundwork/internal/seal"
)

// commitAt writes a file under the repo and commits it.
func commitAt(t *testing.T, dir, path, content string) {
	t.Helper()

	full := filepath.Join(dir, filepath.FromSlash(path))
	if err := os.MkdirAll(filepath.Dir(full), 0o750); err != nil {
		t.Fatalf("could not make %s: %v", filepath.Dir(full), err)
	}
	if err := os.WriteFile(full, []byte(content), 0o600); err != nil {
		t.Fatalf("could not write %s: %v", full, err)
	}
	runGit(t, dir, "add", "--", path)
	runGit(t, dir, "commit", "-m", "add "+path)
}

// runGitStdin runs one git command with stdin and returns its trimmed stdout.
// A tag object carrying a hostile message cannot be made through git tag, so
// this builds one through plumbing.
func runGitStdin(t *testing.T, dir, stdin string, args ...string) string {
	t.Helper()

	cmd := exec.Command("git", append([]string{"-C", dir}, args...)...)
	cmd.Stdin = strings.NewReader(stdin)

	var out, errOut bytes.Buffer
	cmd.Stdout = &out
	cmd.Stderr = &errOut

	if err := cmd.Run(); err != nil {
		t.Fatalf("git %s failed: %v: %s", strings.Join(args, " "), err, errOut.String())
	}

	return strings.TrimSpace(out.String())
}

// greenRun records one all-green battery run, which is what a grant reads the
// version pair off.
func greenRun(t *testing.T, dir string) {
	t.Helper()

	if _, err := journal.WriteBattery(dir, journal.Battery{
		RunID:   "run-20260826T120000Z-abcd",
		Version: "8.0+r1234567",
		Counts: map[string]int{
			"green": 10, "red": 0, "waived": 0, "quarantined": 0, "unrunnable": 0,
		},
		DurationMS: 1,
	}); err != nil {
		t.Fatalf("could not record a battery run: %v", err)
	}
}

// sealedRepo makes a repo holding one design seal over one covered path.
func sealedRepo(t *testing.T) string {
	t.Helper()

	dir := newRepo(t)
	t.Setenv("GROUNDWORK_SESSION", "s-seal")
	commitAt(t, dir, "docs/one.md", "one\n")

	// Committed, and empty of keys — the state this repo is in, so the fixture
	// walks the branch a real run here walks (F63).
	commitAt(t, dir, seal.AllowedSignersFile, "# committed, and empty of keys\n")
	greenRun(t, dir)

	code, out, errOut := call(t, "seal", "grant", "--kind", "design", "--subject", "b3s3",
		"--path", "docs/one.md")
	if code != exitOK {
		t.Fatalf("seal grant exited %d: %s%s", code, out, errOut)
	}

	return dir
}

func TestSealRejectsBadUsage(t *testing.T) {
	cases := []struct {
		name string
		args []string
	}{
		{"no subcommand", []string{"seal"}},
		{"unknown subcommand", []string{"seal", "granted"}},
		{"grant with no kind", []string{"seal", "grant", "--subject", "b3s3", "--path", "a"}},
		{"grant with no subject", []string{"seal", "grant", "--kind", "design", "--path", "a"}},
		{"grant with no path", []string{"seal", "grant", "--kind", "design", "--subject", "b3s3"}},
		{"amend with no reason", []string{"seal", "amend", "--kind", "design", "--subject", "b3s3", "--path", "a"}},
		{"verify with two tags", []string{"seal", "verify", "one", "two"}},
		{"restore with an argument", []string{"seal", "restore", "spare"}},
	}

	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			newRepo(t)

			code, out, errOut := call(t, c.args...)
			if code != exitUsage {
				t.Fatalf("%v exited %d, want %d: %s%s", c.args, code, exitUsage, out, errOut)
			}
			if errOut == "" {
				t.Error("nothing was said about what was wrong")
			}
		})
	}
}

// The verb is on the tool's own usage. A verb nobody is told about is a verb
// nobody uses.
func TestTheUsageNamesTheSealVerb(t *testing.T) {
	code, _, errOut := call(t)
	if code != exitUsage {
		t.Fatalf("running with no verb exited %d", code)
	}
	if !strings.Contains(errOut, "seal") {
		t.Errorf("the usage does not name the seal verb:\n%s", errOut)
	}
}

func TestSealGrantSaysWhatItGranted(t *testing.T) {
	dir := newRepo(t)
	t.Setenv("GROUNDWORK_SESSION", "s-seal")
	commitAt(t, dir, "docs/one.md", "one\n")
	commitAt(t, dir, "docs/two.md", "two\n")
	greenRun(t, dir)

	code, out, errOut := call(t, "seal", "grant", "--kind", "design", "--subject", "b3s3",
		"--path", "docs/one.md", "--path", "docs/two.md")
	if code != exitOK {
		t.Fatalf("seal grant exited %d: %s%s", code, out, errOut)
	}

	for _, want := range []string{
		"seal/design/b3s3",
		"2 paths",
		"8.0+r1234567",
		"run-20260826T120000Z-abcd",
		"unsigned",
		seal.Branch,
	} {
		if !strings.Contains(out, want) {
			t.Errorf("the output does not say %q:\n%s", want, out)
		}
	}
}

// R4: unsigned is printed loudly. The grant says plainly that what it just made
// is no one's authority, because the tool that made it holds no key.
func TestSealGrantSaysTheSealItMadeIsNobodysAuthority(t *testing.T) {
	dir := newRepo(t)
	t.Setenv("GROUNDWORK_SESSION", "s-seal")
	commitAt(t, dir, "docs/one.md", "one\n")
	greenRun(t, dir)

	_, out, _ := call(t, "seal", "grant", "--kind", "design", "--subject", "b3s3",
		"--path", "docs/one.md")

	if !strings.Contains(out, "authority") {
		t.Errorf("the output never says what an unsigned seal is worth:\n%s", out)
	}
}

func TestSealVerifyGreenExitsZero(t *testing.T) {
	sealedRepo(t)

	code, out, errOut := call(t, "seal", "verify")
	if code != exitOK {
		t.Fatalf("seal verify exited %d: %s%s", code, out, errOut)
	}

	for _, want := range []string{"seal/design/b3s3", "docs/one.md", "unsigned"} {
		if !strings.Contains(out, want) {
			t.Errorf("the output does not say %q:\n%s", want, out)
		}
	}
	if !strings.Contains(out, "1 seal, 1 path, 0 moved, 1 unsigned, 0 unverified, 0 problems\n") {
		t.Errorf("the summary line is not there:\n%s", out)
	}
}

func TestSealVerifyRedExitsOne(t *testing.T) {
	dir := sealedRepo(t)
	commitAt(t, dir, "docs/one.md", "one, edited\n")

	code, out, errOut := call(t, "seal", "verify")
	if code != exitFailed {
		t.Fatalf("seal verify exited %d, want %d: %s%s", code, exitFailed, out, errOut)
	}
	if !strings.Contains(out, "docs/one.md moved") {
		t.Errorf("the output does not name the path that moved:\n%s", out)
	}
	if !strings.Contains(out, "1 seal, 1 path, 1 moved, 1 unsigned, 0 unverified, 1 problem\n") {
		t.Errorf("the summary line is not there:\n%s", out)
	}
}

// A repo with no seal has nothing to verify, and saying so is not a failure.
func TestSealVerifyOnARepoWithNoSeal(t *testing.T) {
	newRepo(t)

	code, out, errOut := call(t, "seal", "verify")
	if code != exitOK {
		t.Fatalf("seal verify exited %d: %s%s", code, out, errOut)
	}
	if !strings.Contains(out, "no seal") {
		t.Errorf("the output does not say the repo holds no seal:\n%s", out)
	}
}

// R4's third state: missing. A seal that was asked for and is not there is red,
// because a seal nobody can find proves nothing.
func TestSealVerifyOneSealThatIsMissingExitsOne(t *testing.T) {
	newRepo(t)

	code, out, errOut := call(t, "seal", "verify", "seal/design/b3s3")
	if code != exitFailed {
		t.Fatalf("verifying a missing seal exited %d, want %d: %s%s", code, exitFailed, out, errOut)
	}
	if !strings.Contains(errOut, "missing") {
		t.Errorf("the output does not say the seal is missing:\n%s", errOut)
	}
}

func TestSealRestoreRebuildsTheTag(t *testing.T) {
	dir := sealedRepo(t)

	was := runGit(t, dir, "rev-parse", "refs/tags/seal/design/b3s3")
	runGit(t, dir, "update-ref", "-d", "refs/tags/seal/design/b3s3")

	code, out, errOut := call(t, "seal", "restore")
	if code != exitOK {
		t.Fatalf("seal restore exited %d: %s%s", code, out, errOut)
	}
	if !strings.Contains(out, "1 tag: restored 1, already there 0, mismatched 0\n") {
		t.Errorf("the summary line is not there:\n%s", out)
	}
	if now := runGit(t, dir, "rev-parse", "refs/tags/seal/design/b3s3"); now != was {
		t.Fatalf("the restored tag is %s, and it was %s", now, was)
	}
}

func TestSealRestoreWithNoMirror(t *testing.T) {
	newRepo(t)

	code, out, errOut := call(t, "seal", "restore")
	if code != exitOK {
		t.Fatalf("seal restore exited %d: %s%s", code, out, errOut)
	}
	if !strings.Contains(out, seal.Branch) {
		t.Errorf("the output does not name the branch it looked for:\n%s", out)
	}
}

// R6: amend prints the before and the after, and refuses without a reason.
func TestSealAmendPrintsTheBeforeAndTheAfter(t *testing.T) {
	dir := sealedRepo(t)
	commitAt(t, dir, "docs/two.md", "two\n")

	code, out, errOut := call(t, "seal", "amend", "--kind", "design", "--subject", "b3s3",
		"--path", "docs/one.md", "--path", "docs/two.md",
		"--reason", "the design docs were split in two")
	if code != exitOK {
		t.Fatalf("seal amend exited %d: %s%s", code, out, errOut)
	}

	for _, want := range []string{
		"before", "after", "1 path", "2 paths",
		"the design docs were split in two",
		"agent",
	} {
		if !strings.Contains(out, want) {
			t.Errorf("the output does not say %q:\n%s", want, out)
		}
	}
	if strings.Contains(strings.ToLower(out), "approved") {
		t.Errorf("the output reads as an approval, and an unsigned amendment is not one:\n%s", out)
	}
}

// F49 and D49 ruling 2, at the verb. Every value the verb prints off a tag is
// forger-controlled, so a tag carrying a control character must not draw a row
// of its own in the output.
func TestNothingTheSealVerbPrintsCarriesAControlCharacter(t *testing.T) {
	dir := newRepo(t)
	commitAt(t, dir, "docs/one.md", "one\n")

	commit := runGit(t, dir, "rev-parse", "HEAD")
	raw := "object " + commit + "\ntype commit\ntag seal/design/hostile\n" +
		"tagger Test Person <test@example.com> 1755000000 +0000\n\n" +
		"seal: design hostile\nand\nseal/design/other\tverified\tthe seal holds\n"
	oid := runGitStdin(t, dir, raw, "hash-object", "-t", "tag", "-w", "--stdin")
	runGit(t, dir, "update-ref", "refs/tags/seal/design/hostile", oid)

	code, out, errOut := call(t, "seal", "verify")
	if code != exitFailed {
		t.Fatalf("a tag that is not a seal exited %d: %s%s", code, out, errOut)
	}

	for _, r := range out {
		if !unicode.IsPrint(r) && r != '\n' {
			t.Errorf("the output holds the unprintable character %q:\n%s", r, out)
		}
	}
	if strings.Contains(out, "\tverified\t") {
		t.Errorf("the output carries a forged row:\n%s", out)
	}
}

// plain is the verb's own half of D49 ruling 2: every value it takes off a tag
// goes through it before it is printed.
//
// Nothing that reaches the verb today can carry a control character — the seal
// package clips every value it takes off a tag, and git will not hold a control
// character in a ref name. So no run of the verb can exercise this, and it is
// proved directly rather than left as a guard with no test behind it. D50
// ruling 1 is the warning it answers: one %q changed to %s and this is what
// still stands between a forged tag and the reader.
func TestThePlainRenderingMakesForgedTextSafe(t *testing.T) {
	got := plain("a\nseal/design/other\tverified\tthe seal holds")

	for _, r := range got {
		if !unicode.IsPrint(r) {
			t.Errorf("plain gave %q, and it holds the unprintable character %q", got, r)
		}
	}
	if strings.Contains(got, "\n") || strings.Contains(got, "\t") {
		t.Errorf("plain gave %q, and it would draw a line of its own", got)
	}
	if !strings.Contains(got, "seal/design/other") {
		t.Errorf("plain gave %q, and it lost the words", got)
	}
}

// F60 and D52.3: the reviewer's probe. A tag carrying a signature nothing could
// check must come out "1 unverified", never "1 unsigned".
func TestSealVerifyCountsUnverifiedApartFromUnsigned(t *testing.T) {
	dir := sealedRepo(t)
	signSealTag(t, dir, "seal/design/signed")

	code, out, errOut := call(t, "seal", "verify")
	if code != exitOK {
		t.Fatalf("seal verify exited %d: %s%s", code, out, errOut)
	}

	if !strings.Contains(out, "2 seals, 2 paths, 0 moved, 1 unsigned, 1 unverified, 0 problems\n") {
		t.Errorf("the summary does not count the two states apart:\n%s", out)
	}
	if !strings.Contains(out, "signature unverified") {
		t.Errorf("the signed tag does not print as unverified:\n%s", out)
	}
	if !strings.Contains(out, "no verifier ran") {
		t.Errorf("the note does not say which of the three situations this is:\n%s", out)
	}
}

// signSealTag makes a real SSH-signed seal tag over the fixture's covered path.
// F62: this host signs and cannot verify, which is the state the probe needs.
func signSealTag(t *testing.T, dir, tag string) {
	t.Helper()

	blob := runGit(t, dir, "rev-parse", "HEAD:docs/one.md")
	message := "seal: design signed\n\ncovers:\n  " + blob + " docs/one.md\n\n" +
		"Battery: 8.0+r1234567\nBattery-Run: run-20260826T120000Z-abcd\n"

	cmd := exec.Command("git", "-C", dir, "tag", "-s", "--cleanup=verbatim", "-F", "-", tag)
	cmd.Stdin = strings.NewReader(message)

	var out, errOut bytes.Buffer
	cmd.Stdout = &out
	cmd.Stderr = &errOut

	if err := cmd.Run(); err != nil {
		t.Fatalf("could not sign %s: %v: %s", tag, err, errOut.String())
	}
}

// F66 and D52.9: the verb read any annotated tag, so a release tag's text came
// back quoted through seal machinery. A name that is not a seal tag's is
// refused before anything reads it.
func TestSealVerifyRefusesATagThatIsNotASealByName(t *testing.T) {
	dir := newRepo(t)
	runGit(t, dir, "tag", "-a", "-m", "the first release", "v1.0")

	code, out, errOut := call(t, "seal", "verify", "v1.0")
	if code == exitOK {
		t.Fatalf("a release tag was read as a seal:\n%s", out)
	}
	if !strings.Contains(errOut, "v1.0") {
		t.Errorf("the refusal does not name the tag:\n%s", errOut)
	}
	if strings.Contains(out, "the first release") {
		t.Errorf("the release tag's own text came back through seal machinery:\n%s", out)
	}
	_ = dir
}

// R6 asks amend to print the before and the after. Counts are not that: two
// paths before and two after says nothing about which one moved.
func TestSealAmendPrintsThePathsThatDiffer(t *testing.T) {
	dir := sealedRepo(t)
	commitAt(t, dir, "docs/two.md", "two\n")

	code, out, errOut := call(t, "seal", "amend", "--kind", "design", "--subject", "b3s3",
		"--path", "docs/two.md",
		"--reason", "the design moved to the other file")
	if code != exitOK {
		t.Fatalf("seal amend exited %d: %s%s", code, out, errOut)
	}

	if !strings.Contains(out, "docs/one.md") {
		t.Errorf("the output does not name the path that went:\n%s", out)
	}
	if !strings.Contains(out, "docs/two.md") {
		t.Errorf("the output does not name the path that came:\n%s", out)
	}
}

// F59 and D52.1: the junk is reported, loudly, rather than stopping the
// restore. A file on the mirror that is not a seal tag is a thing somebody has
// to go and look at.
func TestSealRestoreReportsWhatItWouldNotRead(t *testing.T) {
	dir := sealedRepo(t)

	tree := runGit(t, dir, "rev-parse", seal.Branch+"^{tree}")
	blob := runGitStdin(t, dir, "not a tag object\n", "hash-object", "-w", "-t", "blob", "--stdin")
	index := filepath.Join(t.TempDir(), "index")
	t.Setenv("GIT_INDEX_FILE", index)
	runGit(t, dir, "read-tree", tree)
	runGit(t, dir, "update-index", "--add", "--cacheinfo", "100644,"+blob+","+seal.TagDir+"evil")
	planted := runGit(t, dir, "write-tree")
	commit := runGit(t, dir, "commit-tree", planted, "-m", "planted")
	t.Setenv("GIT_INDEX_FILE", "")
	runGit(t, dir, "update-ref", "refs/heads/"+seal.Branch, commit)

	code, out, errOut := call(t, "seal", "restore")
	if code != exitOK {
		t.Fatalf("seal restore exited %d: %s%s", code, out, errOut)
	}
	if !strings.Contains(out, "evil") {
		t.Errorf("the output does not name the file it would not read:\n%s", out)
	}
	if !strings.Contains(out, "1 tag: restored 0, already there 1, mismatched 0\n") {
		t.Errorf("the summary line is not there:\n%s", out)
	}
}
