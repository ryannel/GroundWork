package journal

import (
	"bytes"
	"errors"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"slices"
	"strings"
)

// gitOut runs one git command in the repo at dir and returns its stdout.
//
// extraEnv is added to this process's environment. stdin may be nil. The
// output is returned exactly as git wrote it, so callers that want a single
// value trim it themselves.
func gitOut(dir string, extraEnv []string, stdin []byte, args ...string) (string, error) {
	cmd := exec.Command("git", append([]string{"-C", dir}, args...)...)

	if len(extraEnv) > 0 {
		cmd.Env = append(os.Environ(), extraEnv...)
	}
	if stdin != nil {
		cmd.Stdin = bytes.NewReader(stdin)
	}

	var out, errOut bytes.Buffer
	cmd.Stdout = &out
	cmd.Stderr = &errOut

	if err := cmd.Run(); err != nil {
		return "", fmt.Errorf("git %s: %w: %s",
			strings.Join(args, " "), err, strings.TrimSpace(errOut.String()))
	}

	return out.String(), nil
}

// gitLine runs one git command and returns its stdout without surrounding
// whitespace. Use it for commands that print a single value.
func gitLine(dir string, args ...string) (string, error) {
	out, err := gitOut(dir, nil, nil, args...)
	if err != nil {
		return "", err
	}

	return strings.TrimSpace(out), nil
}

// inTempIndex builds a git tree in an index of its own and returns the tree.
//
// fill runs the git commands that put the entries in place. It is handed the
// environment that points git at the temporary index, and must pass that on to
// every call it makes. The repo's own index and working tree are never
// touched, so this is safe to run at any moment.
func inTempIndex(dir string, fill func(env []string) error) (string, error) {
	indexDir, err := os.MkdirTemp("", "groundwork-index-")
	if err != nil {
		return "", fmt.Errorf("make a temporary index: %w", err)
	}
	defer os.RemoveAll(indexDir)

	env := []string{"GIT_INDEX_FILE=" + filepath.Join(indexDir, "index")}

	if err := fill(env); err != nil {
		return "", err
	}

	tree, err := gitOut(dir, env, nil, "write-tree")
	if err != nil {
		return "", err
	}

	return strings.TrimSpace(tree), nil
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

// checkRepo reports whether dir sits inside a git repository.
// It returns ErrNotARepo when it does not, so callers can say so plainly
// instead of passing on git's own words.
func checkRepo(dir string) error {
	if _, err := gitLine(dir, "rev-parse", "--git-dir"); err != nil {
		var exit *exec.ExitError
		if errors.As(err, &exit) {
			return ErrNotARepo
		}
		return err
	}

	return nil
}

// resolve returns the object id a revision points at.
// It returns an empty string if the revision does not exist.
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

// headCommit returns the commit HEAD points at.
// It returns an empty string in a repo with no commits.
func headCommit(dir string) (string, error) {
	return resolve(dir, "HEAD^{commit}")
}

// RepoRoot returns the absolute path to the root of the repo dir sits in,
// regardless of how deep inside it dir is.
//
// It is exported for the packages that already depend on this one and need a
// file at the repo root — the battery's lock file, say. They get this one
// rather than each shelling out to git themselves.
//
// Outside a repository it returns ErrNotARepo, the same as every other entry
// point here, so a caller says "not in a git repository" in its own words
// instead of passing on git's.
func RepoRoot(dir string) (string, error) {
	out, err := gitLine(dir, "rev-parse", "--show-toplevel")
	if err != nil {
		var exit *exec.ExitError
		if errors.As(err, &exit) {
			return "", ErrNotARepo
		}
		return "", err
	}

	return out, nil
}

// The four calls below are read-only questions about the repo's own history.
// They are exported for the same reason RepoRoot is: the packages that already
// depend on this one need them, and one place that shells out to git beats
// four. None of them writes anything.

// TrackedFiles returns the paths git tracks under a directory, named from the
// repo root. dir must be the repo root, and under is a path from it.
func TrackedFiles(dir, under string) ([]string, error) {
	out, err := gitOut(dir, nil, nil, "ls-files", "-z", "--", under)
	if err != nil {
		return nil, err
	}

	return splitNUL(out), nil
}

// ChangedFiles returns the paths under a directory that do not match what git
// has committed, each with the two-letter status code git gave it: untracked,
// staged but not committed, or edited since. The code is returned because
// those are three different things, and a caller that reports one as another
// is telling the reader something untrue.
func ChangedFiles(dir, under string) (map[string]string, error) {
	out, err := gitOut(dir, nil, nil,
		"status", "--porcelain", "-z", "--untracked-files=all", "--", under)
	if err != nil {
		return nil, err
	}

	// Each record is "XY <path>". A rename or a copy adds a second record
	// holding where the file came from, which is a path in the same directory
	// and is skipped rather than read as a record of its own.
	changed := map[string]string{}
	records := splitNUL(out)
	for i := 0; i < len(records); i++ {
		record := records[i]
		if len(record) < 4 {
			return nil, fmt.Errorf("git status gave the record %q", record)
		}

		code := record[:2]
		changed[record[3:]] = code

		if strings.ContainsAny(code, "RC") {
			i++
		}
	}

	return changed, nil
}

// LastChanged returns the most recent commit that changed a path. It returns
// an empty string when this clone holds no commit that touches it.
//
// The last commit, not the first: what a file holds now is what its most
// recent commit put there, so that commit is the one a reader has to judge.
func LastChanged(dir, path string) (string, error) {
	return gitLine(dir, "log", "--format=%H", "-1", "--", path)
}

// ParentsOf returns the commits a commit was built on. A commit with no
// parents is either the first commit of a repo or the edge of a shallow
// clone, and the caller has to know which.
func ParentsOf(dir, commit string) ([]string, error) {
	out, err := gitLine(dir, "log", "--format=%P", "-1", commit)
	if err != nil {
		return nil, err
	}

	return strings.Fields(out), nil
}

// FilesIn returns the paths one commit changed, named from the repo root.
//
// A commit with no parent is read against the empty tree, so the first commit
// of a repo lists what it added rather than nothing at all.
func FilesIn(dir, commit string) ([]string, error) {
	out, err := gitOut(dir, nil, nil,
		"diff-tree", "--no-commit-id", "--name-only", "-r", "-z", "--root", commit)
	if err != nil {
		return nil, err
	}

	return splitNUL(out), nil
}

// TrailerCommit is one commit of the repo's own history: its id, how many
// parents it has, and the values git's own trailer parser found on it for one
// trailer key.
//
// The parent count rather than the parents themselves, because the one question
// a reader of trailers asks about a commit's parents is whether it is a merge.
type TrailerCommit struct {
	ID      string
	Parents int
	Values  []string
}

// Trailers returns every commit reachable from HEAD, newest first, with the
// values git found for the trailer key on each of them.
//
// git's own trailer parser does the reading. A scan of a commit body written
// here would be a second definition of what a trailer is, and it would drift
// from the one git, its hooks and every other tool already agree on.
//
// The framing is git's too. Each record ends with a NUL and each value is
// unfolded onto one line, so nothing in a commit message can end a value or a
// record — and a record whose head is not a commit id is refused rather than
// read, which is the one shape a message could reach in with.
func Trailers(dir, key string) ([]TrailerCommit, error) {
	return TrailersFor(dir, key)
}

// TrailersFor is Trailers narrowed to the commits that changed any of some
// paths. No path narrows nothing, which is what Trailers passes.
//
// One implementation, two entry points, because two readers of a trailer would
// be two definitions of what a trailer is (D54 ruling 1). The waiver counter
// wants the commits that touched one waiver file and the bet each of them
// landed in, and that is one question for git rather than a whole history
// filtered here.
//
// git's own history simplification applies to the path. A merge that matches
// one of its parents is not listed against a path, which is the same answer
// LastChanged gives about the same file — so a caller counting grants and a
// caller finding the governing commit read one history, not two.
//
// Renames are followed by naming every path, not by git's --follow: --follow
// drops merges, and a caller that has to count merges apart cannot lose them.
// PathsOf is where a file's own names come from.
func TrailersFor(dir, key string, paths ...string) ([]TrailerCommit, error) {
	if err := checkRepo(dir); err != nil {
		return nil, err
	}
	if err := checkTrailerKey(key); err != nil {
		return nil, err
	}

	head, err := headCommit(dir)
	if err != nil {
		return nil, err
	}
	if head == "" {
		// A repo with no commit has no history to read, which is an answer and
		// not a failure.
		return nil, nil
	}

	format := "--format=%H %P%n%(trailers:key=" + key + ",valueonly,unfold)%x00"

	// An empty path is dropped rather than passed on: git reads one as a
	// pathspec that matches nothing and refuses the whole read.
	//
	// A list that was all empty is refused outright. Narrowing to nothing and
	// reading everything are opposite answers, and the caller asked for the
	// first — reading the whole history there would inflate every count taken
	// off it (D65's list of smalls).
	args := []string{"log", format, "HEAD"}
	if len(paths) > 0 {
		named := slices.DeleteFunc(slices.Clone(paths), func(p string) bool { return p == "" })
		if len(named) == 0 {
			return nil, errors.New("every path given to narrow this read is empty, and no path is not the same as every path")
		}

		args = append(args, "--")
		args = append(args, named...)
	}

	out, err := gitOut(dir, nil, nil, args...)
	if err != nil {
		return nil, err
	}

	return parseTrailerLog(out)
}

// FileChange is what one commit did to one file: git's own status letter, with
// the similarity score it carries on a rename or a copy.
type FileChange struct {
	Commit string
	Status string
}

// FileHistory returns the names one file has had and what each commit did to
// it, newest first.
//
// git's own rename detection does the reading, through --follow. Only a rename
// record joins two names. git also reports a copy, where a new file was made
// out of an old one that is still there, and folding those together would count
// one file's history as another's.
//
// Merges are not here. git does not diff a merge by default, so a caller that
// has to see one reads the ordinary log beside this. The names are framed with
// NUL, so a path holding a newline cannot split into two.
func FileHistory(dir, path string) ([]string, []FileChange, error) {
	if err := checkRepo(dir); err != nil {
		return nil, nil, err
	}

	out, err := gitOut(dir, nil, nil,
		"log", "--follow", "--name-status", "-z", "--format=%x01%H", "HEAD", "--", path)
	if err != nil {
		return nil, nil, err
	}

	renamed, changes, err := readFileLog(out, path)
	if err != nil {
		return nil, nil, err
	}

	// git walks newest first, so the chain is followed from the name the caller
	// gave back through each rename that made it.
	paths := []string{path}
	for at := path; ; {
		was, moved := renamed[at]
		if !moved || slices.Contains(paths, was) {
			break
		}

		paths = append(paths, was)
		at = was
	}

	return paths, changes, nil
}

// readFileLog reads a --name-status -z log into the renames it holds and what
// each commit did to the file the caller asked about.
//
// Every record is read, not only the interesting ones, because a status is what
// says how many paths follow it: a rename and a copy carry two, everything else
// carries one. Miscounting one record would misread every record after it.
func readFileLog(out, path string) (map[string]string, []FileChange, error) {
	renamed := map[string]string{}

	var changes []FileChange

	for _, commit := range strings.Split(out, "\x01") {
		fields := splitNUL(commit)
		if len(fields) == 0 {
			continue
		}

		// The head of a record is the commit id, on its own line before the
		// statuses. A commit that changed nothing under the path is not listed
		// at all, so a record with only a head is one git framed and left empty.
		id := strings.TrimSpace(fields[0])
		if !isObjectID(id) {
			return nil, nil, fmt.Errorf("git log printed the record head %q, which is not a commit id", short(id))
		}

		for i := 1; i < len(fields); {
			status := strings.TrimSpace(fields[i])
			if status == "" {
				i++

				continue
			}

			// A rename and a copy carry two paths; everything else carries one.
			paths := 1
			if status[0] == 'R' || status[0] == 'C' {
				paths = 2
			}
			if i+paths > len(fields)-1 {
				return nil, nil, fmt.Errorf("git log printed the status %q with %d paths after it, want %d",
					short(status), len(fields)-1-i, paths)
			}

			if status[0] == 'R' {
				renamed[fields[i+paths]] = fields[i+1]
			}

			changes = append(changes, FileChange{Commit: id, Status: status})
			i += paths + 1
		}
	}

	return renamed, changes, nil
}

// MaxMessageBytes caps one commit message. A message past it comes back cut,
// with Cut set, so a caller never reads part of a message as the whole of one.
//
// 64 KiB. A squash of a hundred commits quoting every message it swallowed runs
// to a few tens of kilobytes, so the cap holds every real one with room. A
// message past it is a paste or an attack, not something a person wrote. The
// whole log is still one read, and its size is bounded by this repo's own
// history. What the cap stops is one commit dominating it.
const MaxMessageBytes = 64 << 10

// MessageCommit is one commit of the repo's own history with its whole message:
// its id, how many parents it has, and the message body exactly as git holds it.
type MessageCommit struct {
	ID      string
	Parents int
	Body    string

	// Cut says the message was longer than MaxMessageBytes, so Body holds only
	// its first part. A caller that judges a message has to know it read one.
	Cut bool
}

// Messages returns every commit reachable from HEAD, newest first, with the
// whole of each one's message.
//
// It exists so a caller can ask whether git's trailer parser read everything a
// message said. A squash is exactly that gap: git writes the squashed commit as
// one commit quoting every message it swallowed, so the trailer text is still
// in the message and the parser returns none of it.
//
// The order is Trailers' order, so the two can be joined by commit id without
// either being sorted. The framing is git's NUL, so nothing anybody writes in a
// message can end a record — a body opening with something shaped like a record
// head is body text and stays body text.
func Messages(dir string) ([]MessageCommit, error) {
	if err := checkRepo(dir); err != nil {
		return nil, err
	}

	head, err := headCommit(dir)
	if err != nil {
		return nil, err
	}
	if head == "" {
		return nil, nil
	}

	out, err := gitOut(dir, nil, nil, "log", "--format=%H %P%n%B%x00", "HEAD")
	if err != nil {
		return nil, err
	}

	return parseMessageLog(out)
}

// parseMessageLog reads the records Messages asks git for: the commit id, a
// space, its parents, a newline, then the whole message, then a NUL.
func parseMessageLog(out string) ([]MessageCommit, error) {
	var commits []MessageCommit

	for _, record := range strings.Split(out, "\x00") {
		// git log writes a newline after each record, which lands at the front
		// of the next one.
		record = strings.TrimPrefix(record, "\n")
		if record == "" {
			continue
		}

		head, body, found := strings.Cut(record, "\n")
		if !found {
			return nil, fmt.Errorf("git log printed the record %q, which holds no line", short(record))
		}

		fields := strings.Fields(head)
		if len(fields) == 0 || !isObjectID(fields[0]) {
			return nil, fmt.Errorf("git log printed the record head %q, which does not open with a commit id",
				short(head))
		}

		cut := len(body) > MaxMessageBytes
		if cut {
			body = body[:MaxMessageBytes]
		}

		commits = append(commits, MessageCommit{
			ID:      fields[0],
			Parents: len(fields) - 1,
			Body:    body,
			Cut:     cut,
		})
	}

	return commits, nil
}

// IsAncestor reports whether one commit is reachable from another. It is what
// "predates" means in git.
//
// Commit dates are writable and they run backwards on any history somebody
// rebased or set a date on by hand, so a check that compared them would be
// resting on a number anybody can choose. Reachability is the thing git itself
// means by before, and a commit is reachable from itself — so a record written
// in the same commit as the code it describes does not predate it.
func IsAncestor(dir, older, newer string) (bool, error) {
	_, err := gitLine(dir, "merge-base", "--is-ancestor", older, newer)
	if err != nil {
		if missing(err) {
			return false, nil
		}

		return false, err
	}

	return true, nil
}

// ErrNoBlob says the revision holds nothing at that path: the path is not in
// the tree, or there is no commit to read a tree from at all. Both mean the
// same thing to a caller — nothing is committed there — so both say it in one
// word.
var ErrNoBlob = errors.New("nothing is committed at that path")

// BlobAt returns the committed content of one path at one revision.
//
// R15 puts the battery lock file on this read: an uncommitted version is not a
// version anybody can be held to.
//
// The revision is resolved to a commit first, and the path is then read as
// <commit>:<path>. Everything after that colon is a path to git, so revision
// syntax written into a path reaches nothing, and the whole argument opens with
// a hex commit id, so it can never be read as an option.
func BlobAt(dir, rev, path string) ([]byte, error) {
	if err := checkRepo(dir); err != nil {
		return nil, err
	}

	commit, err := resolve(dir, rev+"^{commit}")
	if err != nil {
		return nil, err
	}
	if commit == "" {
		return nil, ErrNoBlob
	}

	// resolve rather than cat-file, because a path the tree does not hold is a
	// fatal error to cat-file and an ordinary empty answer to rev-parse. The
	// object is then read by its own id, so the name is resolved once.
	object, err := resolve(dir, commit+":"+path)
	if err != nil {
		return nil, err
	}
	if object == "" {
		return nil, ErrNoBlob
	}

	kind, err := gitLine(dir, "cat-file", "-t", object)
	if err != nil {
		return nil, err
	}
	if kind != "blob" {
		return nil, fmt.Errorf("%s holds a %s at %s, not a file", rev, kind, short(path))
	}

	out, err := gitOut(dir, nil, nil, "cat-file", "blob", object)
	if err != nil {
		return nil, err
	}

	return []byte(out), nil
}

// checkTrailerKey rejects a key that is not a trailer token.
//
// The key is written into git's own format string, so a key holding a comma or
// a parenthesis would change which atom git renders rather than which trailer
// it looks for.
func checkTrailerKey(key string) error {
	if key == "" {
		return errors.New("a trailer key is empty")
	}

	for _, r := range key {
		switch {
		case r >= 'a' && r <= 'z':
		case r >= 'A' && r <= 'Z':
		case r >= '0' && r <= '9':
		case r == '-':
		default:
			return fmt.Errorf("the trailer key %q holds %q, which is not a letter, a digit or a dash",
				short(key), r)
		}
	}

	return nil
}

// parseTrailerLog reads the records Trailers asks git for.
//
// One record per commit: the commit id, a space, its parents, a newline, then
// one line per trailer value, then a NUL. A value can be empty — a trailer with
// nothing after its colon names nothing, and losing it would let the plainest
// misstatement pass unseen — so the values are counted off the framing rather
// than by dropping blank lines.
func parseTrailerLog(out string) ([]TrailerCommit, error) {
	var commits []TrailerCommit

	for _, record := range strings.Split(out, "\x00") {
		// git log writes a newline after each record, which lands at the front
		// of the next one.
		record = strings.TrimPrefix(record, "\n")
		if record == "" {
			continue
		}

		head, rest, found := strings.Cut(record, "\n")
		if !found {
			return nil, fmt.Errorf("git log printed the record %q, which holds no line", short(record))
		}

		fields := strings.Fields(head)
		if len(fields) == 0 || !isObjectID(fields[0]) {
			return nil, fmt.Errorf("git log printed the record head %q, which does not open with a commit id",
				short(head))
		}

		commit := TrailerCommit{ID: fields[0], Parents: len(fields) - 1}
		if rest != "" {
			values := strings.Split(rest, "\n")
			commit.Values = values[:len(values)-1]
		}

		commits = append(commits, commit)
	}

	return commits, nil
}

// isObjectID reports whether a word is a whole git object id, in either of the
// two lengths git hashes with.
func isObjectID(word string) bool {
	if len(word) != 40 && len(word) != 64 {
		return false
	}

	for _, r := range word {
		switch {
		case r >= '0' && r <= '9':
		case r >= 'a' && r <= 'f':
		default:
			return false
		}
	}

	return true
}

// Shallow reports whether this clone holds only part of its history. A caller
// that could not find a commit says so differently when the history is not all
// here.
func Shallow(dir string) (bool, error) {
	out, err := gitLine(dir, "rev-parse", "--is-shallow-repository")
	if err != nil {
		return false, err
	}

	return out == "true", nil
}

// splitNUL splits git's -z output into its records, dropping the empty one
// after the last separator.
func splitNUL(out string) []string {
	var records []string
	for _, record := range strings.Split(out, "\x00") {
		if record != "" {
			records = append(records, record)
		}
	}

	return records
}

// tagCommit returns the commit a tag points at. An annotated tag is peeled
// down to its commit; a lightweight tag names the commit already.
//
// It looks only under refs/tags/, so a branch of the same name is never taken
// for a tag, and a name starting with a dash is never read as an option.
func tagCommit(dir, tag string) (string, error) {
	// The name must be a ref that exists, exactly as written. rev-parse alone
	// would not do: it reads revision syntax, so "v1~1" would resolve to the
	// parent of v1 and the seal would name a commit no tag holds. show-ref
	// --verify takes the name literally and knows nothing of ~ or ^.
	if _, err := gitLine(dir, "show-ref", "--verify", "--quiet", "--", "refs/tags/"+tag); err != nil {
		if missing(err) {
			return "", fmt.Errorf("this repo has no tag named %q", tag)
		}
		return "", err
	}

	commit, err := resolve(dir, "refs/tags/"+tag+"^{commit}")
	if err != nil {
		return "", err
	}
	if commit == "" {
		return "", fmt.Errorf("the tag %q does not point at a commit", tag)
	}

	return commit, nil
}

// branchName returns the name of the branch HEAD is on.
// It returns an empty string when HEAD is detached.
func branchName(dir string) (string, error) {
	out, err := gitLine(dir, "symbolic-ref", "--short", "--quiet", "HEAD")
	if err != nil {
		if missing(err) {
			return "", nil
		}
		return "", err
	}

	return out, nil
}
