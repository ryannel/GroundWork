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

// repoRoot returns the absolute path to the root of the repo dir sits in,
// regardless of how deep inside it dir is.
func repoRoot(dir string) (string, error) {
	return gitLine(dir, "rev-parse", "--show-toplevel")
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
