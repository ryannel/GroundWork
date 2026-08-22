package main

import (
	"fmt"
	"path/filepath"
	"strings"
	"testing"

	"github.com/ryannel/groundwork/internal/journal"
)

// otherClone makes a clone of the repo at src, writes one dispatch into the
// clone's journal, and fetches that journal back into src under the ref
// refs/groundwork/incoming. It returns that ref name.
//
// This is the shape a real caller is in: another clone wrote journal lines,
// and its ref has been fetched here to be merged.
func otherClone(t *testing.T, src, session, outcome string) string {
	t.Helper()

	dir := filepath.Join(t.TempDir(), "other")
	runGit(t, src, "clone", "--quiet", src, dir)

	t.Setenv("GROUNDWORK_SESSION", session)
	if _, err := journal.WriteDispatch(dir, journal.Dispatch{
		Role:         "worker",
		Tier:         "execution",
		TokensIn:     10,
		TokensOut:    5,
		TokensSource: "unset",
		DurationMS:   100,
		Outcome:      outcome,
	}); err != nil {
		t.Fatalf("the write in the other clone returned an error: %v", err)
	}

	const into = "refs/groundwork/incoming"
	runGit(t, src, "fetch", "--quiet", dir, "+"+journal.Ref+":"+into)

	return into
}

func TestRunMergesAnotherClonesJournal(t *testing.T) {
	dir := newRepo(t)

	// Two lines here and one there, so the sentence has to get three
	// different counts right, and both the singular and the plural.
	t.Setenv("GROUNDWORK_SESSION", "s-alpha")
	for _, outcome := range []string{"ok", "ok again"} {
		if code, _, errOut := call(t, dispatchArgs("--outcome", outcome)...); code != 0 {
			t.Fatalf("the local dispatch exited %d. stderr: %s", code, errOut)
		}
	}

	incoming := otherClone(t, dir, "s-beta", "from there")

	t.Setenv("GROUNDWORK_SESSION", "s-alpha")
	code, out, errOut := call(t, "journal", "merge", incoming)
	if code != 0 {
		t.Fatalf("exit code is %d, want 0. stderr: %s", code, errOut)
	}

	want := "merged: 2 lines from this journal, 1 line from the other, 3 lines in total\n"
	if out != want {
		t.Errorf("stdout is %q, want %q", out, want)
	}

	paths := strings.Split(runGit(t, dir, "ls-tree", "-r", "--name-only", journal.Ref), "\n")
	if len(paths) != 3 {
		t.Fatalf("the merged journal holds %d lines, want 3: %v", len(paths), paths)
	}

	outcomes := map[string]bool{}
	for _, path := range paths {
		outcome, ok := eventAt(t, dir, path)["outcome"].(string)
		if !ok {
			t.Fatalf("the event at %s has no outcome", path)
		}
		outcomes[outcome] = true
	}
	for _, want := range []string{"ok", "ok again", "from there"} {
		if !outcomes[want] {
			t.Errorf("the merged journal has no line with outcome %q: %v", want, outcomes)
		}
	}
}

func TestRunSaysAMergeIsAlreadyDone(t *testing.T) {
	dir := newRepo(t)

	t.Setenv("GROUNDWORK_SESSION", "s-alpha")
	if code, _, errOut := call(t, dispatchArgs()...); code != 0 {
		t.Fatalf("the local dispatch exited %d. stderr: %s", code, errOut)
	}

	incoming := otherClone(t, dir, "s-beta", "from there")

	t.Setenv("GROUNDWORK_SESSION", "s-alpha")
	if code, _, errOut := call(t, "journal", "merge", incoming); code != 0 {
		t.Fatalf("the first merge exited %d. stderr: %s", code, errOut)
	}
	tip := runGit(t, dir, "rev-parse", journal.Ref)

	code, out, errOut := call(t, "journal", "merge", incoming)
	if code != 0 {
		t.Fatalf("the second merge exited %d. stderr: %s", code, errOut)
	}
	want := "already merged: the journal already holds that commit\n"
	if out != want {
		t.Errorf("stdout is %q, want %q", out, want)
	}
	if got := runGit(t, dir, "rev-parse", journal.Ref); got != tip {
		t.Errorf("the second merge moved the ref from %s to %s", tip, got)
	}
}

func TestRunSaysAMergeFastForwarded(t *testing.T) {
	dir := newRepo(t)

	incoming := otherClone(t, dir, "s-beta", "from there")
	tip := runGit(t, dir, "rev-parse", incoming)

	t.Setenv("GROUNDWORK_SESSION", "s-alpha")
	code, out, errOut := call(t, "journal", "merge", incoming)
	if code != 0 {
		t.Fatalf("exit code is %d, want 0. stderr: %s", code, errOut)
	}
	want := "fast-forwarded: 1 line in total\n"
	if out != want {
		t.Errorf("stdout is %q, want %q", out, want)
	}
	if got := runGit(t, dir, "rev-parse", journal.Ref); got != tip {
		t.Errorf("the journal ref is %s, want the other tip %s", got, tip)
	}
}

func TestRunRejectsBadMergeUsage(t *testing.T) {
	cases := []struct {
		name string
		args []string
	}{
		{"no commit", []string{"journal", "merge"}},
		{"two commits", []string{"journal", "merge", "HEAD", "HEAD"}},
		{"an unknown flag", []string{"journal", "merge", "--onto", "HEAD"}},
	}

	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			newRepo(t)
			t.Setenv("GROUNDWORK_SESSION", "s-alpha")

			code, out, errOut := call(t, c.args...)
			if code != 2 {
				t.Errorf("exit code is %d, want 2", code)
			}
			if errOut == "" {
				t.Errorf("bad usage should say something on stderr")
			}
			if out != "" {
				t.Errorf("bad usage should print nothing on stdout, got %q", out)
			}
		})
	}
}

func TestRunSaysWhenTheMergeArgumentIsNotAJournal(t *testing.T) {
	cases := []struct {
		name string
		rev  func(t *testing.T, dir string) string
	}{
		{"not a commit", func(t *testing.T, dir string) string {
			return runGit(t, dir, "rev-parse", "HEAD^{tree}")
		}},
		{"a commit with no journal in it", func(t *testing.T, dir string) string {
			return "HEAD"
		}},
	}

	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			dir := newRepo(t)
			t.Setenv("GROUNDWORK_SESSION", "s-alpha")

			code, out, errOut := call(t, "journal", "merge", c.rev(t, dir))
			if code != 1 {
				t.Errorf("exit code is %d, want 1", code)
			}
			if errOut == "" {
				t.Errorf("a failed merge should say something on stderr")
			}
			if out != "" {
				t.Errorf("a failed merge should print nothing on stdout, got %q", out)
			}
		})
	}
}

func TestRunSaysWhenAMergeIsNotInARepo(t *testing.T) {
	t.Chdir(t.TempDir())
	t.Setenv("GROUNDWORK_SESSION", "s-alpha")

	code, out, errOut := call(t, "journal", "merge", "HEAD")
	if code != 1 {
		t.Errorf("exit code is %d, want 1", code)
	}
	if !strings.Contains(errOut, "not in a git repository") {
		t.Errorf("stderr is %q, want it to say it is not in a git repository", errOut)
	}
	if out != "" {
		t.Errorf("a failed merge should print nothing on stdout, got %q", out)
	}
}

func TestRunDoesNotReadAMergeArgumentAsAFlag(t *testing.T) {
	newRepo(t)
	t.Setenv("GROUNDWORK_SESSION", "s-alpha")

	// After --, the argument is a name to resolve, whatever it looks like.
	// It must reach git as a name and come back refused, not be read as an
	// option by the flag set or by git itself.
	code, out, errOut := call(t, "journal", "merge", "--", "--evil")
	if code != 1 {
		t.Errorf("exit code is %d, want 1", code)
	}
	if !strings.Contains(errOut, "--evil is not a commit this repo holds") {
		t.Errorf("stderr is %q, want it to refuse --evil by name", errOut)
	}
	if out != "" {
		t.Errorf("a failed merge should print nothing on stdout, got %q", out)
	}
}

func TestMergeSentenceSaysEachOutcome(t *testing.T) {
	cases := []struct {
		name string
		res  journal.MergeResult
		want string
	}{
		{
			"merged",
			journal.MergeResult{Outcome: journal.Merged, Local: 2, Other: 1, Total: 3},
			"merged: 2 lines from this journal, 1 line from the other, 3 lines in total",
		},
		{
			"merged, one line each way",
			journal.MergeResult{Outcome: journal.Merged, Local: 1, Other: 1, Total: 1},
			"merged: 1 line from this journal, 1 line from the other, 1 line in total",
		},
		{
			"fast-forwarded",
			journal.MergeResult{Outcome: journal.FastForwarded, Local: 0, Other: 4, Total: 4},
			"fast-forwarded: 4 lines in total",
		},
		{
			"already merged",
			journal.MergeResult{Outcome: journal.AlreadyMerged, Local: 3, Other: 1, Total: 3},
			"already merged: the journal already holds that commit",
		},
	}

	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			if got := mergeSentence(c.res); got != c.want {
				t.Errorf("the sentence is %q, want %q", got, c.want)
			}
		})
	}
}

func TestMergeSentenceStopsOnAnOutcomeItDoesNotKnow(t *testing.T) {
	// A new outcome with no sentence of its own must be loud. Printing a
	// vague sentence would hide that the switch was never updated.
	defer func() {
		got := recover()
		if got == nil {
			t.Fatalf("mergeSentence gave a sentence for an outcome it does not know")
		}
		if !strings.Contains(fmt.Sprint(got), "rebased") {
			t.Errorf("the panic says %v, want it to name the outcome", got)
		}
	}()

	mergeSentence(journal.MergeResult{Outcome: "rebased"})
}
