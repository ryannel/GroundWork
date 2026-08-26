package journal

import (
	"os"
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

// ChangedFiles is what tells a waiver the run can trust from one that was
// edited, staged or never committed at all. The waiver machinery leans on the
// two-letter code, because those are three different things and reporting one
// as another tells the reader something untrue.
//
// This package never proved it either. The deletion test found the gap when the
// battery moved to 7.0: blanking ChangedFiles to nil left all 159 tests here
// green, the same shape as F29. The three codes, and one changed file outside
// the directory that must not be named.
func TestChangedFilesNamesEachWayAFileDisagreesWithTheCommit(t *testing.T) {
	dir := newRepo(t)

	writeFile(t, filepath.Join(dir, "other.txt"), "outside\n")
	if err := os.MkdirAll(filepath.Join(dir, "notes"), 0o750); err != nil {
		t.Fatalf("could not make the notes directory: %v", err)
	}
	writeFile(t, filepath.Join(dir, "notes", "tracked.txt"), "one\n")
	runGit(t, dir, "add", "notes/tracked.txt", "other.txt")
	runGit(t, dir, "commit", "-m", "second")

	writeFile(t, filepath.Join(dir, "notes", "tracked.txt"), "one, edited\n")
	writeFile(t, filepath.Join(dir, "notes", "staged.txt"), "two\n")
	runGit(t, dir, "add", "notes/staged.txt")
	writeFile(t, filepath.Join(dir, "notes", "new.txt"), "three\n")
	writeFile(t, filepath.Join(dir, "other.txt"), "outside, edited\n")

	got, err := ChangedFiles(dir, "notes")
	if err != nil {
		t.Fatalf("ChangedFiles failed: %v", err)
	}

	want := map[string]string{
		"notes/tracked.txt": " M",
		"notes/staged.txt":  "A ",
		"notes/new.txt":     "??",
	}
	if len(got) != len(want) {
		t.Fatalf("ChangedFiles returned %v, want %v", got, want)
	}
	for path, code := range want {
		if got[path] != code {
			t.Errorf("ChangedFiles gave %s the code %q, want %q", path, got[path], code)
		}
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

// The deletion test caught the gap this fills: ParentsOf had no test in this
// package, so blanking it to nil left the whole suite green — while the waiver
// machinery's merge refusal stands on exactly this answer. The three shapes a
// repo can put in front of it: a root commit has no parent, an ordinary commit
// has one, and a merge has two.
func TestParentsOfCountsWhatTheCommitHas(t *testing.T) {
	dir := newRepo(t)
	root := runGit(t, dir, "rev-parse", "HEAD")

	writeFile(t, filepath.Join(dir, "a.txt"), "a\n")
	runGit(t, dir, "add", "a.txt")
	runGit(t, dir, "commit", "-m", "ordinary")
	ordinary := runGit(t, dir, "rev-parse", "HEAD")

	runGit(t, dir, "checkout", "-q", "-b", "side", root)
	writeFile(t, filepath.Join(dir, "b.txt"), "b\n")
	runGit(t, dir, "add", "b.txt")
	runGit(t, dir, "commit", "-m", "side work")
	side := runGit(t, dir, "rev-parse", "HEAD")

	runGit(t, dir, "checkout", "-q", "main")
	runGit(t, dir, "merge", "--no-ff", "-m", "merge side", "side")
	merge := runGit(t, dir, "rev-parse", "HEAD")

	for _, c := range []struct {
		name   string
		commit string
		want   []string
	}{
		{"a root commit has no parent", root, nil},
		{"an ordinary commit has one", ordinary, []string{root}},
		{"a merge has both, first parent first", merge, []string{ordinary, side}},
	} {
		t.Run(c.name, func(t *testing.T) {
			got, err := ParentsOf(dir, c.commit)
			if err != nil {
				t.Fatalf("ParentsOf failed: %v", err)
			}
			if !slices.Equal(got, c.want) {
				t.Errorf("ParentsOf returned %v, want %v", got, c.want)
			}
		})
	}
}
