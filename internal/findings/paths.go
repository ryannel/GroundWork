package findings

import (
	"bytes"
	"errors"
	"fmt"
	"os/exec"
	"path/filepath"
	"strings"
)

// ErrNotARepo says the directory the caller gave is not inside a git
// repository, so there is no repo root to find the ledgers under.
var ErrNotARepo = errors.New("not in a git repository")

// The two ledgers, named from the repo root. CLAUDE.md fixes both paths.
const (
	ledgerFile    = "docs/findings.md"
	decisionsFile = "docs/decisions.md"
)

// LedgerPath returns the absolute path of the findings ledger for the repo
// dir sits in. dir may be any directory inside the repo, however deep: the
// ledger lives at the root, and a command run from a subdirectory has to read
// the same file as one run from the top.
func LedgerPath(dir string) (string, error) {
	return pathUnderRoot(dir, ledgerFile)
}

// DecisionsPath returns the absolute path of the decisions ledger, found the
// same way as LedgerPath.
func DecisionsPath(dir string) (string, error) {
	return pathUnderRoot(dir, decisionsFile)
}

// pathUnderRoot joins a slash-separated path to the root of the repo dir sits
// in.
//
// This package asks git for the root itself rather than reaching into the
// journal package, which finds the same root for its own reasons. Neither
// package is the other's home for repository plumbing, and one small call is
// cheaper than a dependency between them.
func pathUnderRoot(dir, path string) (string, error) {
	root, err := repoRoot(dir)
	if err != nil {
		return "", err
	}

	return filepath.Join(root, filepath.FromSlash(path)), nil
}

// repoRoot returns the absolute path to the root of the repo dir sits in.
func repoRoot(dir string) (string, error) {
	cmd := exec.Command("git", "-C", dir, "rev-parse", "--show-toplevel")

	var out, errOut bytes.Buffer
	cmd.Stdout = &out
	cmd.Stderr = &errOut

	if err := cmd.Run(); err != nil {
		var exit *exec.ExitError
		if errors.As(err, &exit) {
			return "", ErrNotARepo
		}
		return "", fmt.Errorf("could not find the repository root: %w: %s",
			err, strings.TrimSpace(errOut.String()))
	}

	return strings.TrimSpace(out.String()), nil
}
