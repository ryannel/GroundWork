package journal

import (
	"bytes"
	"errors"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
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
