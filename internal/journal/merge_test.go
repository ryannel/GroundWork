package journal

import (
	"bytes"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"slices"
	"strings"
	"sync"
	"testing"
)

// clone makes a clone of the repo at src and returns the clone's path.
//
// A clone does not carry the journal. Git fetches branches and tags, and the
// journal ref lives outside both, so every clone starts with none of it. That
// is why two clones diverge in the first place.
func clone(t *testing.T, src, name string) string {
	t.Helper()

	dir := filepath.Join(t.TempDir(), name)
	runGit(t, src, "clone", "--quiet", src, dir)

	return dir
}

// fetchJournal copies the journal ref of the repo at src into the repo at dst,
// under the ref name into. This is how a real caller gets another clone's
// journal in front of the merge.
func fetchJournal(t *testing.T, dst, src, into string) {
	t.Helper()

	runGit(t, dst, "fetch", "--quiet", src, "+"+Ref+":"+into)
}

// writeAs writes one dispatch with the given session and outcome, so a test
// can tell the two sides of a merge apart.
func writeAs(t *testing.T, dir, session, outcome string) string {
	t.Helper()

	t.Setenv("GROUNDWORK_SESSION", session)

	d := sampleDispatch()
	d.Outcome = outcome

	path, err := WriteDispatch(dir, d)
	if err != nil {
		t.Fatalf("the write of %q in %s returned an error: %v", outcome, dir, err)
	}

	return path
}

// plantCommit builds a journal-shaped commit by hand, from paths to contents.
// A test uses it for a shape the writer would never produce: it is how the
// hostile side of a merge is made. base is a tree-ish to start from, or an
// empty string for a commit that holds only the given paths.
//
// A commit with no parent sits outside the local journal's history, so a merge
// of it takes the union path. Give it the local tip as its parent to reach the
// fast-forward path instead.
func plantCommit(t *testing.T, dir, base, parent string, files map[string]string) string {
	t.Helper()

	// An index of the test's own, so building a hostile shape cannot disturb
	// the repo being tested.
	env := []string{"GIT_INDEX_FILE=" + filepath.Join(t.TempDir(), "index")}

	if base != "" {
		if _, err := gitOut(dir, env, nil, "read-tree", base); err != nil {
			t.Fatalf("could not read the base tree: %v", err)
		}
	}

	for path, content := range files {
		blob, err := gitOut(dir, nil, []byte(content), "hash-object", "-w", "-t", "blob", "--stdin")
		if err != nil {
			t.Fatalf("could not store a planted blob: %v", err)
		}

		cacheinfo := "100644," + strings.TrimSpace(blob) + "," + path
		if _, err := gitOut(dir, env, nil, "update-index", "--add", "--cacheinfo", cacheinfo); err != nil {
			t.Fatalf("could not add %s to the planted tree: %v", path, err)
		}
	}

	tree, err := gitOut(dir, env, nil, "write-tree")
	if err != nil {
		t.Fatalf("could not build the planted tree: %v", err)
	}
	tree = strings.TrimSpace(tree)

	args := []string{"commit-tree", tree}
	if parent != "" {
		args = append(args, "-p", parent)
	}
	args = append(args, "-m", "planted")

	commit, err := gitOut(dir, identity(), nil, args...)
	if err != nil {
		t.Fatalf("could not build the planted commit: %v", err)
	}

	return strings.TrimSpace(commit)
}

// TestMergeKeepsBothSidesOfADivergedJournal is the clause this slice
// discharges: two clones that both wrote journal lines can merge, and both
// lines survive.
func TestMergeKeepsBothSidesOfADivergedJournal(t *testing.T) {
	origin := newRepo(t)
	here := clone(t, origin, "here")
	there := clone(t, origin, "there")

	herePath := writeAs(t, here, "s-alpha", "from here")
	therePath := writeAs(t, there, "s-beta", "from there")

	fetchJournal(t, here, there, "refs/groundwork/incoming")

	res, err := Merge(here, "refs/groundwork/incoming")
	if err != nil {
		t.Fatalf("Merge returned an error: %v", err)
	}
	if res.Outcome != Merged {
		t.Errorf("the merge says %q, want %q", res.Outcome, Merged)
	}

	paths := journalPaths(t, here)
	if len(paths) != 2 {
		t.Fatalf("the merged journal holds %d lines, want 2: %v", len(paths), paths)
	}
	if !slices.Contains(paths, herePath) {
		t.Errorf("the merged journal lost this clone's line %q", herePath)
	}
	if !slices.Contains(paths, therePath) {
		t.Errorf("the merged journal lost the other clone's line %q", therePath)
	}

	// Both lines still read back as events, not just as bytes.
	wantString(t, decodeEvent(t, here, herePath), "outcome", "from here")
	wantString(t, decodeEvent(t, here, herePath), "session", "s-alpha")
	wantString(t, decodeEvent(t, here, therePath), "outcome", "from there")
	wantString(t, decodeEvent(t, here, therePath), "session", "s-beta")
}

func TestMergeCountsBothSides(t *testing.T) {
	origin := newRepo(t)
	here := clone(t, origin, "here")
	there := clone(t, origin, "there")

	writeAs(t, here, "s-alpha", "first here")
	writeAs(t, here, "s-alpha", "second here")
	writeAs(t, there, "s-beta", "only there")

	fetchJournal(t, here, there, "refs/groundwork/incoming")

	res, err := Merge(here, "refs/groundwork/incoming")
	if err != nil {
		t.Fatalf("Merge returned an error: %v", err)
	}

	if res.Local != 2 {
		t.Errorf("the merge counted %d local lines, want 2", res.Local)
	}
	if res.Other != 1 {
		t.Errorf("the merge counted %d lines on the other side, want 1", res.Other)
	}
	if res.Total != 3 {
		t.Errorf("the merge counted %d lines in total, want 3", res.Total)
	}
	if res.Tip != runGit(t, here, "rev-parse", Ref) {
		t.Errorf("the merge reports tip %s, but the ref holds %s", res.Tip, runGit(t, here, "rev-parse", Ref))
	}
}

func TestMergeASecondTimeChangesNothing(t *testing.T) {
	origin := newRepo(t)
	here := clone(t, origin, "here")
	there := clone(t, origin, "there")

	writeAs(t, here, "s-alpha", "from here")
	writeAs(t, there, "s-beta", "from there")

	fetchJournal(t, here, there, "refs/groundwork/incoming")

	if _, err := Merge(here, "refs/groundwork/incoming"); err != nil {
		t.Fatalf("the first merge returned an error: %v", err)
	}
	tip := runGit(t, here, "rev-parse", Ref)

	res, err := Merge(here, "refs/groundwork/incoming")
	if err != nil {
		t.Fatalf("the second merge returned an error: %v", err)
	}
	if res.Outcome != AlreadyMerged {
		t.Errorf("the second merge says %q, want %q", res.Outcome, AlreadyMerged)
	}

	if got := runGit(t, here, "rev-parse", Ref); got != tip {
		t.Errorf("the second merge moved the ref from %s to %s", tip, got)
	}
	if paths := journalPaths(t, here); len(paths) != 2 {
		t.Errorf("the journal holds %d lines after the second merge, want 2: %v", len(paths), paths)
	}
}

func TestMergeOfTheJournalIntoItselfChangesNothing(t *testing.T) {
	dir := newRepo(t)
	writeAs(t, dir, "s-alpha", "only line")

	tip := runGit(t, dir, "rev-parse", Ref)

	res, err := Merge(dir, Ref)
	if err != nil {
		t.Fatalf("Merge returned an error: %v", err)
	}
	if res.Outcome != AlreadyMerged {
		t.Errorf("merging the journal into itself says %q, want %q", res.Outcome, AlreadyMerged)
	}
	if got := runGit(t, dir, "rev-parse", Ref); got != tip {
		t.Errorf("the merge moved the ref from %s to %s", tip, got)
	}
}

func TestMergeFastForwardsAJournalThatIsNotThereYet(t *testing.T) {
	origin := newRepo(t)
	here := clone(t, origin, "here")
	there := clone(t, origin, "there")

	therePath := writeAs(t, there, "s-beta", "from there")
	thereTip := runGit(t, there, "rev-parse", Ref)

	fetchJournal(t, here, there, "refs/groundwork/incoming")

	if refExists(t, here) {
		t.Fatalf("this clone should have no journal of its own before the merge")
	}

	res, err := Merge(here, "refs/groundwork/incoming")
	if err != nil {
		t.Fatalf("Merge returned an error: %v", err)
	}
	if res.Outcome != FastForwarded {
		t.Errorf("the merge says %q, want %q", res.Outcome, FastForwarded)
	}

	// No merge commit is needed, so none is made.
	if got := runGit(t, here, "rev-parse", Ref); got != thereTip {
		t.Errorf("the journal ref is %s, want the other tip %s", got, thereTip)
	}
	wantString(t, decodeEvent(t, here, therePath), "outcome", "from there")
}

func TestMergeFastForwardsAnAncestor(t *testing.T) {
	origin := newRepo(t)
	here := clone(t, origin, "here")
	there := clone(t, origin, "there")

	// Both clones share the first line. Only the other one writes the second.
	writeAs(t, there, "s-beta", "shared")
	fetchJournal(t, here, there, Ref)

	writeAs(t, there, "s-beta", "only there")
	thereTip := runGit(t, there, "rev-parse", Ref)

	fetchJournal(t, here, there, "refs/groundwork/incoming")

	res, err := Merge(here, "refs/groundwork/incoming")
	if err != nil {
		t.Fatalf("Merge returned an error: %v", err)
	}
	if res.Outcome != FastForwarded {
		t.Errorf("the merge says %q, want %q", res.Outcome, FastForwarded)
	}
	if got := runGit(t, here, "rev-parse", Ref); got != thereTip {
		t.Errorf("the journal ref is %s, want the other tip %s", got, thereTip)
	}
	if paths := journalPaths(t, here); len(paths) != 2 {
		t.Errorf("the journal holds %d lines, want 2: %v", len(paths), paths)
	}
}

func TestMergeCommitCarriesBothTipsLocalFirst(t *testing.T) {
	origin := newRepo(t)
	here := clone(t, origin, "here")
	there := clone(t, origin, "there")

	writeAs(t, here, "s-alpha", "from here")
	writeAs(t, there, "s-beta", "from there")

	hereTip := runGit(t, here, "rev-parse", Ref)
	fetchJournal(t, here, there, "refs/groundwork/incoming")
	thereTip := runGit(t, here, "rev-parse", "refs/groundwork/incoming")

	if _, err := Merge(here, "refs/groundwork/incoming"); err != nil {
		t.Fatalf("Merge returned an error: %v", err)
	}

	parents := strings.Fields(runGit(t, here, "rev-list", "--no-walk", "--parents", Ref))
	if len(parents) != 3 {
		t.Fatalf("the merge commit has %d parents, want 2: %v", len(parents)-1, parents)
	}
	if parents[1] != hereTip {
		t.Errorf("the first parent is %s, want this clone's tip %s", parents[1], hereTip)
	}
	if parents[2] != thereTip {
		t.Errorf("the second parent is %s, want the other clone's tip %s", parents[2], thereTip)
	}
}

func TestSeqCountsAcrossAMergedSession(t *testing.T) {
	origin := newRepo(t)
	here := clone(t, origin, "here")
	there := clone(t, origin, "there")

	// One session that ran in both clones. Each side numbered its own lines
	// from 1, so the union holds seq 1 and 2 twice over.
	writeAs(t, here, "s-alpha", "here one")
	writeAs(t, here, "s-alpha", "here two")
	writeAs(t, there, "s-alpha", "there one")
	writeAs(t, there, "s-alpha", "there two")
	writeAs(t, there, "s-alpha", "there three")

	fetchJournal(t, here, there, "refs/groundwork/incoming")

	if _, err := Merge(here, "refs/groundwork/incoming"); err != nil {
		t.Fatalf("Merge returned an error: %v", err)
	}
	if paths := journalPaths(t, here); len(paths) != 5 {
		t.Fatalf("the merged journal holds %d lines, want 5: %v", len(paths), paths)
	}

	next := writeAs(t, here, "s-alpha", "after the merge")
	if got := seqOf(t, here, next); got != 4 {
		t.Errorf("the line written after the merge has seq %d, want 4: one more than the highest in the union", got)
	}
}

func TestMergeRejectsSomethingThatIsNotACommit(t *testing.T) {
	cases := []struct {
		name string
		rev  func(t *testing.T, dir string) string
	}{
		{"a blob", func(t *testing.T, dir string) string {
			return runGit(t, dir, "rev-parse", "HEAD:README.md")
		}},
		{"a tree", func(t *testing.T, dir string) string {
			return runGit(t, dir, "rev-parse", "HEAD^{tree}")
		}},
		{"a name the repo does not hold", func(t *testing.T, dir string) string {
			return "refs/groundwork/nothing"
		}},
	}

	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			dir := newRepo(t)
			writeAs(t, dir, "s-alpha", "only line")
			tip := runGit(t, dir, "rev-parse", Ref)

			rev := c.rev(t, dir)

			res, err := Merge(dir, rev)
			if err == nil {
				t.Fatalf("Merge accepted %s and said %q", c.name, res.Outcome)
			}
			if !strings.Contains(err.Error(), rev) {
				t.Errorf("the error is %q, want it to name %q", err, rev)
			}
			if got := runGit(t, dir, "rev-parse", Ref); got != tip {
				t.Errorf("the journal ref moved from %s to %s", tip, got)
			}
		})
	}
}

func TestMergeRejectsACommitThatHoldsNoEvents(t *testing.T) {
	dir := newRepo(t)
	writeAs(t, dir, "s-alpha", "only line")
	tip := runGit(t, dir, "rev-parse", Ref)

	// The repo's own HEAD is a commit, but it is not a journal.
	if _, err := Merge(dir, "HEAD"); err == nil {
		t.Fatalf("Merge took an ordinary commit for a journal")
	}

	if got := runGit(t, dir, "rev-parse", Ref); got != tip {
		t.Errorf("the journal ref moved from %s to %s", tip, got)
	}
	if paths := journalPaths(t, dir); len(paths) != 1 {
		t.Errorf("the journal holds %d lines, want 1: %v", len(paths), paths)
	}
}

func TestMergeMakesNoJournalFromACommitThatHoldsNoEvents(t *testing.T) {
	dir := newRepo(t)

	if _, err := Merge(dir, "HEAD"); err == nil {
		t.Fatalf("Merge took an ordinary commit for a journal")
	}
	if refExists(t, dir) {
		t.Errorf("Merge made the journal ref out of a commit that holds no events")
	}
}

func TestMergeLeavesTheWorkingTreeAlone(t *testing.T) {
	origin := newRepo(t)
	here := clone(t, origin, "here")
	there := clone(t, origin, "there")

	writeAs(t, here, "s-alpha", "from here")
	writeAs(t, there, "s-beta", "from there")
	fetchJournal(t, here, there, "refs/groundwork/incoming")

	// Make the tree dirty. A merge must not care, and must not tidy it.
	writeFile(t, filepath.Join(here, "README.md"), "changed\n")
	writeFile(t, filepath.Join(here, "scratch.txt"), "untracked\n")

	before := runGit(t, here, "status", "--porcelain")
	if before == "" {
		t.Fatalf("the clone should be dirty before the merge")
	}

	// Read the index after status, so any refresh status does has happened.
	indexBefore := readIndex(t, here)
	head := runGit(t, here, "rev-parse", "HEAD")
	branch := runGit(t, here, "rev-parse", "--abbrev-ref", "HEAD")

	if _, err := Merge(here, "refs/groundwork/incoming"); err != nil {
		t.Fatalf("Merge returned an error in a dirty repo: %v", err)
	}

	if indexAfter := readIndex(t, here); !bytes.Equal(indexBefore, indexAfter) {
		t.Errorf("Merge changed the repo index")
	}
	if after := runGit(t, here, "status", "--porcelain"); after != before {
		t.Errorf("the working tree changed.\nbefore:\n%s\nafter:\n%s", before, after)
	}
	if got := runGit(t, here, "rev-parse", "HEAD"); got != head {
		t.Errorf("HEAD moved from %s to %s", head, got)
	}
	if got := runGit(t, here, "rev-parse", "--abbrev-ref", "HEAD"); got != branch {
		t.Errorf("the branch changed from %s to %s", branch, got)
	}
	if got := readFile(t, filepath.Join(here, "README.md")); got != "changed\n" {
		t.Errorf("README.md now holds %q, want %q", got, "changed\n")
	}
	if _, err := os.Stat(filepath.Join(here, "scratch.txt")); err != nil {
		t.Errorf("the untracked file is gone: %v", err)
	}
}

func TestMergeMovesOnlyTheJournalRef(t *testing.T) {
	origin := newRepo(t)
	here := clone(t, origin, "here")
	there := clone(t, origin, "there")

	writeAs(t, here, "s-alpha", "from here")
	writeAs(t, there, "s-beta", "from there")
	fetchJournal(t, here, there, "refs/groundwork/incoming")

	before := runGit(t, here, "show-ref")

	if _, err := Merge(here, "refs/groundwork/incoming"); err != nil {
		t.Fatalf("Merge returned an error: %v", err)
	}

	after := runGit(t, here, "show-ref")

	beforeLines := strings.Split(before, "\n")
	afterLines := strings.Split(after, "\n")
	if len(beforeLines) != len(afterLines) {
		t.Fatalf("the merge changed which refs exist.\nbefore:\n%s\nafter:\n%s", before, after)
	}

	moved := 0
	for i := range beforeLines {
		if beforeLines[i] != afterLines[i] {
			moved++
			if !strings.HasSuffix(afterLines[i], Ref) {
				t.Errorf("the merge moved %q, which is not the journal", afterLines[i])
			}
		}
	}
	if moved != 1 {
		t.Errorf("the merge moved %d refs, want only the journal", moved)
	}
}

func TestMergeOutsideARepo(t *testing.T) {
	dir := t.TempDir()

	if _, err := Merge(dir, "HEAD"); !errors.Is(err, ErrNotARepo) {
		t.Errorf("Merge returned %v, want ErrNotARepo", err)
	}
}

func TestMergeRefusesAnIncomingLineThatRewritesOneWeHold(t *testing.T) {
	dir := newRepo(t)
	path := writeAs(t, dir, "s-alpha", "the recorded line")
	tip := runGit(t, dir, "rev-parse", Ref)
	line := readEvent(t, dir, path)

	// The other side carries our own path with something else at it. A union
	// would quietly rewrite a line this repo already recorded.
	hostile := plantCommit(t, dir, tip, "", map[string]string{
		path: "{\"v\":1,\"kind\":\"dispatch\",\"outcome\":\"tampered\"}\n",
	})

	res, err := Merge(dir, hostile)
	if err == nil {
		t.Fatalf("Merge took a commit that rewrites a line, and said %q", res.Outcome)
	}
	if !strings.Contains(err.Error(), path) {
		t.Errorf("the error is %q, want it to name the path %q", err, path)
	}

	if got := runGit(t, dir, "rev-parse", Ref); got != tip {
		t.Errorf("the journal ref moved from %s to %s", tip, got)
	}
	if got := readEvent(t, dir, path); !bytes.Equal(got, line) {
		t.Errorf("the line at %s now reads %q, want %q", path, got, line)
	}
	if paths := journalPaths(t, dir); len(paths) != 1 {
		t.Errorf("the journal holds %d lines, want 1: %v", len(paths), paths)
	}
}

func TestMergeRefusesAnIncomingLineThatWouldDropASession(t *testing.T) {
	dir := newRepo(t)
	path := writeAs(t, dir, "s-alpha", "the recorded line")
	tip := runGit(t, dir, "rev-parse", Ref)

	// The other side carries a line where this repo keeps a whole session's
	// directory. Laid over ours, it would take every line in that session
	// with it.
	hostile := plantCommit(t, dir, "", "", map[string]string{
		"events/s-alpha": "not a journal line\n",
	})

	res, err := Merge(dir, hostile)
	if err == nil {
		t.Fatalf("Merge took a commit that drops a session, and said %q", res.Outcome)
	}
	if !strings.Contains(err.Error(), "events/s-alpha") {
		t.Errorf("the error is %q, want it to name the path it refused", err)
	}

	if got := runGit(t, dir, "rev-parse", Ref); got != tip {
		t.Errorf("the journal ref moved from %s to %s", tip, got)
	}
	if paths := journalPaths(t, dir); len(paths) != 1 {
		t.Fatalf("the journal holds %d lines, want 1: %v", len(paths), paths)
	}
	wantString(t, decodeEvent(t, dir, path), "outcome", "the recorded line")
}

func TestMergeRefusesARewriteThatCallsItselfAFastForward(t *testing.T) {
	dir := newRepo(t)
	path := writeAs(t, dir, "s-alpha", "the recorded line")
	tip := runGit(t, dir, "rev-parse", Ref)
	line := readEvent(t, dir, path)

	// This one descends from our own tip, so it is a fast-forward by the
	// history. Its tree still rewrites the line. Descending from a commit is
	// not the same as keeping what it held.
	hostile := plantCommit(t, dir, tip, tip, map[string]string{
		path: "{\"v\":1,\"kind\":\"dispatch\",\"outcome\":\"tampered\"}\n",
	})

	res, err := Merge(dir, hostile)
	if err == nil {
		t.Fatalf("Merge fast-forwarded onto a rewritten line, and said %q", res.Outcome)
	}
	if !strings.Contains(err.Error(), path) {
		t.Errorf("the error is %q, want it to name the path %q", err, path)
	}
	if got := runGit(t, dir, "rev-parse", Ref); got != tip {
		t.Errorf("the journal ref moved from %s to %s", tip, got)
	}
	if got := readEvent(t, dir, path); !bytes.Equal(got, line) {
		t.Errorf("the line at %s now reads %q, want %q", path, got, line)
	}
}

func TestMergeKeepsEveryLineWrittenWhileItRuns(t *testing.T) {
	origin := newRepo(t)
	here := clone(t, origin, "here")
	there := clone(t, origin, "there")

	before := writeAs(t, here, "s-alpha", "before the merge")
	therePath := writeAs(t, there, "s-beta", "from there")
	fetchJournal(t, here, there, "refs/groundwork/incoming")

	// The merge and the writers race for the same ref. Whoever loses reads
	// the winner's tip and tries again, so nothing may be dropped.
	t.Setenv("GROUNDWORK_SESSION", "s-alpha")

	const writers = 4

	paths := make([]string, writers)
	errs := make([]error, writers)

	var res MergeResult
	var mergeErr error

	var wg sync.WaitGroup

	wg.Add(1)
	go func() {
		defer wg.Done()
		res, mergeErr = Merge(here, "refs/groundwork/incoming")
	}()

	for i := range writers {
		wg.Add(1)
		go func() {
			defer wg.Done()

			d := sampleDispatch()
			d.Outcome = fmt.Sprintf("racing-%d", i)
			paths[i], errs[i] = WriteDispatch(here, d)
		}()
	}
	wg.Wait()

	if mergeErr != nil {
		t.Fatalf("the merge returned an error: %v", mergeErr)
	}
	if res.Outcome != Merged {
		t.Errorf("the merge says %q, want %q", res.Outcome, Merged)
	}
	for i, err := range errs {
		if err != nil {
			t.Fatalf("writer %d returned an error: %v", i, err)
		}
	}

	stored := journalPaths(t, here)
	want := writers + 2
	if len(stored) != want {
		t.Fatalf("the journal holds %d lines, want %d: %v", len(stored), want, stored)
	}
	if !slices.Contains(stored, before) {
		t.Errorf("the journal lost the line written before the merge")
	}
	if !slices.Contains(stored, therePath) {
		t.Errorf("the journal lost the other clone's line %q", therePath)
	}
	for i, path := range paths {
		if !slices.Contains(stored, path) {
			t.Errorf("the journal lost the line writer %d wrote at %q", i, path)
		}
	}
}

func TestMergeFromASubdirectory(t *testing.T) {
	origin := newRepo(t)
	here := clone(t, origin, "here")
	there := clone(t, origin, "there")

	herePath := writeAs(t, here, "s-alpha", "from here")
	therePath := writeAs(t, there, "s-beta", "from there")
	fetchJournal(t, here, there, "refs/groundwork/incoming")

	sub := filepath.Join(here, "internal", "deeper")
	if err := os.MkdirAll(sub, 0o750); err != nil {
		t.Fatalf("could not make a subdirectory: %v", err)
	}

	res, err := Merge(sub, "refs/groundwork/incoming")
	if err != nil {
		t.Fatalf("Merge from a subdirectory returned an error: %v", err)
	}
	if res.Outcome != Merged {
		t.Errorf("the merge says %q, want %q", res.Outcome, Merged)
	}

	paths := journalPaths(t, here)
	if len(paths) != 2 {
		t.Fatalf("the merged journal holds %d lines, want 2: %v", len(paths), paths)
	}
	if !slices.Contains(paths, herePath) || !slices.Contains(paths, therePath) {
		t.Errorf("the merged journal holds %v, want both sides", paths)
	}
}

func TestMergeOfTwoClonesThatShareAJournalAncestor(t *testing.T) {
	origin := newRepo(t)
	here := clone(t, origin, "here")

	// One line written before the two sides part. Both carry it, so the
	// union must hold it once, not twice.
	sharedPath := writeAs(t, here, "s-base", "before they parted")

	there := clone(t, origin, "there")
	fetchJournal(t, there, here, Ref)

	herePath := writeAs(t, here, "s-alpha", "from here")
	therePath := writeAs(t, there, "s-beta", "from there")

	fetchJournal(t, here, there, "refs/groundwork/incoming")

	res, err := Merge(here, "refs/groundwork/incoming")
	if err != nil {
		t.Fatalf("Merge returned an error: %v", err)
	}
	if res.Outcome != Merged {
		t.Errorf("the merge says %q, want %q", res.Outcome, Merged)
	}
	if res.Local != 2 || res.Other != 2 || res.Total != 3 {
		t.Errorf("the merge counted %d local, %d other and %d in total, want 2, 2 and 3",
			res.Local, res.Other, res.Total)
	}

	paths := journalPaths(t, here)
	if len(paths) != 3 {
		t.Fatalf("the merged journal holds %d lines, want 3: %v", len(paths), paths)
	}
	for _, want := range []string{sharedPath, herePath, therePath} {
		if !slices.Contains(paths, want) {
			t.Errorf("the merged journal lost the line at %q", want)
		}
	}

	// The shared line has one parent on each side, so the merge commit must
	// join them rather than sit on one.
	parents := strings.Fields(runGit(t, here, "rev-list", "--no-walk", "--parents", Ref))
	if len(parents) != 3 {
		t.Errorf("the merge commit has %d parents, want 2: %v", len(parents)-1, parents)
	}
}
