package journal

import (
	"bytes"
	"errors"
	"fmt"
	"os"
	"os/exec"
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
