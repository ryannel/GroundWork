package journal

import (
	"path/filepath"
	"slices"
	"testing"
)

// FilesIn is what tells a waiver commit from a commit that carried something
// else with it. Its own package never proved it, so deleting it left the
// journal's 140 tests green (F29).

func TestFilesInNamesWhatACommitChanged(t *testing.T) {
	dir := newRepo(t)
	writeFile(t, filepath.Join(dir, "one.txt"), "one\n")
	writeFile(t, filepath.Join(dir, "two.txt"), "two\n")
	runGit(t, dir, "add", "one.txt", "two.txt")
	runGit(t, dir, "commit", "-m", "second")

	got, err := FilesIn(dir, runGit(t, dir, "rev-parse", "HEAD"))
	if err != nil {
		t.Fatalf("FilesIn did not read the commit: %v", err)
	}

	slices.Sort(got)
	want := []string{"one.txt", "two.txt"}
	if !slices.Equal(got, want) {
		t.Errorf("FilesIn named %v, want %v", got, want)
	}
}

// A commit with no parent is read against the empty tree, so the first commit
// of a repo lists what it added rather than nothing at all.
func TestFilesInReadsTheFirstCommitAgainstTheEmptyTree(t *testing.T) {
	dir := newRepo(t)

	got, err := FilesIn(dir, runGit(t, dir, "rev-parse", "HEAD"))
	if err != nil {
		t.Fatalf("FilesIn did not read the first commit: %v", err)
	}

	want := []string{"README.md"}
	if !slices.Equal(got, want) {
		t.Errorf("FilesIn named %v for the first commit, want %v", got, want)
	}
}
