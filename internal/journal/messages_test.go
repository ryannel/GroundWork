package journal

import (
	"errors"
	"os"
	"path/filepath"
	"slices"
	"strings"
	"testing"
)

// The four readers slice 7 adds. Each one asks git a question the rows of that
// slice need, and each is tested here because a reader nobody proves in its own
// package is a reader the deletion test finds later (F29).

// Messages hands back what a commit's message holds, so a row can ask whether
// git's trailer parser read everything the message said. A squash is exactly
// that gap: the trailer text is in the message and git reads none of it.
func TestMessagesReadsEveryCommitsWholeBody(t *testing.T) {
	dir := newRepo(t)
	commitWith(t, dir, "one\n\nBet: bet 3\nSlice: b3s1\nTests: yes")
	commitWith(t, dir, "two, one line and nothing else")

	got, err := Messages(dir)
	if err != nil {
		t.Fatalf("Messages did not read the history: %v", err)
	}
	if len(got) != 3 {
		t.Fatalf("Messages read %d commits, want 3", len(got))
	}

	// Newest first, the same order Trailers reads in, so a caller can join the
	// two by commit id without sorting either.
	if !strings.HasPrefix(got[0].Body, "two, one line and nothing else") {
		t.Errorf("the newest body came back %q", got[0].Body)
	}
	if !strings.Contains(got[1].Body, "Slice: b3s1") {
		t.Errorf("the trailer body came back %q", got[1].Body)
	}
	if got[1].Parents != 1 {
		t.Errorf("the commit %s reads %d parents, want 1", got[1].ID, got[1].Parents)
	}
}

// A merge's parents are what tells it from an ordinary commit, and the history
// row does not read a merge's message at all.
func TestMessagesCountsAMergeCommitsParents(t *testing.T) {
	dir := newRepo(t)
	runGit(t, dir, "checkout", "-q", "-b", "side")
	commitWith(t, dir, "side work")
	runGit(t, dir, "checkout", "-q", "-")
	commitWith(t, dir, "main work")
	runGit(t, dir, "merge", "--no-ff", "-m", "the merge", "side")

	got, err := Messages(dir)
	if err != nil {
		t.Fatalf("Messages did not read the history: %v", err)
	}
	if len(got) == 0 {
		t.Fatal("Messages read no commits")
	}
	if got[0].Parents != 2 {
		t.Fatalf("the merge reads %d parents, want 2", got[0].Parents)
	}
}

// A message body that opens with something shaped like a record head must not
// be read as a second commit. The framing is git's NUL, not the line breaks in
// somebody's message.
func TestMessagesIsNotFooledByABodyThatLooksLikeARecord(t *testing.T) {
	dir := newRepo(t)
	fake := strings.Repeat("a", 40) + " " + strings.Repeat("b", 40)
	commitWith(t, dir, "one\n\n"+fake+"\nSlice: b3s1")

	got, err := Messages(dir)
	if err != nil {
		t.Fatalf("Messages did not read the history: %v", err)
	}
	if len(got) != 2 {
		t.Fatalf("Messages read %d commits, want 2", len(got))
	}
	if !strings.Contains(got[0].Body, fake) {
		t.Errorf("the body came back without its own text: %q", got[0].Body)
	}
}

func TestMessagesOutsideARepoSaysSo(t *testing.T) {
	if _, err := Messages(t.TempDir()); err == nil {
		t.Fatal("Messages read a directory that is not a repository")
	}
}

// TrailersFor is Trailers narrowed to the commits that changed one path. The
// waiver counter needs the grants of one waiver file and the bet each landed
// in, and asking git for that is one call rather than one call plus a filter.
func TestTrailersForReadsOnlyTheCommitsThatChangedThePath(t *testing.T) {
	dir := newRepo(t)
	writeFile(t, filepath.Join(dir, "one.txt"), "one\n")
	runGit(t, dir, "add", "one.txt")
	runGit(t, dir, "commit", "-m", "grant one\n\nBet: bet_3")
	writeFile(t, filepath.Join(dir, "two.txt"), "two\n")
	runGit(t, dir, "add", "two.txt")
	runGit(t, dir, "commit", "-m", "something else\n\nBet: bet_3")
	writeFile(t, filepath.Join(dir, "one.txt"), "one, again\n")
	runGit(t, dir, "add", "one.txt")
	runGit(t, dir, "commit", "-m", "grant one again\n\nBet: bet_4")

	got, err := TrailersFor(dir, "Bet", "one.txt")
	if err != nil {
		t.Fatalf("TrailersFor did not read the history: %v", err)
	}
	if len(got) != 2 {
		t.Fatalf("TrailersFor read %d commits, want 2", len(got))
	}
	if strings.Join(got[0].Values, "|") != "bet_4" {
		t.Errorf("the newest commit's bet came back %v", got[0].Values)
	}
	if strings.Join(got[1].Values, "|") != "bet_3" {
		t.Errorf("the older commit's bet came back %v", got[1].Values)
	}
}

// Trailers is TrailersFor with no path, so the two can never disagree about
// what a trailer is.
func TestTrailersIsTrailersForWithNoPath(t *testing.T) {
	dir := newRepo(t)
	commitWith(t, dir, "one\n\nSlice: b3s1")

	whole, err := Trailers(dir, "Slice")
	if err != nil {
		t.Fatalf("Trailers did not read the history: %v", err)
	}
	narrowed, err := TrailersFor(dir, "Slice")
	if err != nil {
		t.Fatalf("TrailersFor did not read the history: %v", err)
	}
	if len(whole) != len(narrowed) {
		t.Fatalf("Trailers read %d commits and TrailersFor read %d", len(whole), len(narrowed))
	}
	for i := range whole {
		if whole[i].ID != narrowed[i].ID {
			t.Fatalf("the two readers disagree at %d: %s and %s", i, whole[i].ID, narrowed[i].ID)
		}
	}
}

// IsAncestor is what "predates" means in git. Commit dates are writable and
// they run backwards on any repo where somebody set one by hand, so the record
// row asks about ancestry instead.
func TestIsAncestorAnswersInBothDirectionsAndAboutItself(t *testing.T) {
	dir := newRepo(t)
	first := runGit(t, dir, "rev-parse", "HEAD")
	commitWith(t, dir, "second")
	second := runGit(t, dir, "rev-parse", "HEAD")

	cases := []struct {
		name       string
		older, new string
		want       bool
	}{
		{"an older commit", first, second, true},
		{"a newer commit", second, first, false},
		{"the same commit", second, second, true},
	}

	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			got, err := IsAncestor(dir, c.older, c.new)
			if err != nil {
				t.Fatalf("IsAncestor did not answer: %v", err)
			}
			if got != c.want {
				t.Fatalf("IsAncestor said %v, want %v", got, c.want)
			}
		})
	}
}

// Two commits on branches that parted are neither one's ancestor. The record
// row reads that as not stale, which is the direction that never invents a red.
func TestIsAncestorSaysNoAboutTwoBranches(t *testing.T) {
	dir := newRepo(t)
	runGit(t, dir, "checkout", "-q", "-b", "side")
	commitWith(t, dir, "side work")
	side := runGit(t, dir, "rev-parse", "HEAD")
	runGit(t, dir, "checkout", "-q", "-")
	commitWith(t, dir, "main work")
	main := runGit(t, dir, "rev-parse", "HEAD")

	got, err := IsAncestor(dir, side, main)
	if err != nil {
		t.Fatalf("IsAncestor did not answer: %v", err)
	}
	if got {
		t.Fatal("IsAncestor called a commit on another branch an ancestor")
	}
}

// BlobAt reads committed content. R15 moves the battery lock file onto it: an
// uncommitted version is not one anybody can be held to.
func TestBlobAtReadsTheCommittedContentAndNotTheWorkingTree(t *testing.T) {
	dir := newRepo(t)
	writeFile(t, filepath.Join(dir, "lock.json"), "committed\n")
	runGit(t, dir, "add", "lock.json")
	runGit(t, dir, "commit", "-m", "commit the lock")
	writeFile(t, filepath.Join(dir, "lock.json"), "edited since\n")

	raw, err := BlobAt(dir, "HEAD", "lock.json")
	if err != nil {
		t.Fatalf("BlobAt did not read the blob: %v", err)
	}
	if string(raw) != "committed\n" {
		t.Fatalf("BlobAt read %q, want the committed content", raw)
	}
}

// A path HEAD does not hold, and a repo with no commit at all, are the same
// answer: nothing is committed there. Both come back as ErrNoBlob so a caller
// says one plain thing rather than passing on git's.
func TestBlobAtSaysSoWhenNothingIsCommittedThere(t *testing.T) {
	t.Run("a path HEAD does not hold", func(t *testing.T) {
		dir := newRepo(t)
		if _, err := BlobAt(dir, "HEAD", "nowhere.json"); err == nil {
			t.Fatal("BlobAt read a path HEAD does not hold")
		} else if !errors.Is(err, ErrNoBlob) {
			t.Fatalf("BlobAt said %v, want ErrNoBlob", err)
		}
	})

	t.Run("a repo with no commit", func(t *testing.T) {
		dir := t.TempDir()
		runGit(t, dir, "init", "-b", "main")
		runGit(t, dir, "config", "commit.gpgsign", "false")
		if _, err := BlobAt(dir, "HEAD", "lock.json"); err == nil {
			t.Fatal("BlobAt read a repo with no commit")
		} else if !errors.Is(err, ErrNoBlob) {
			t.Fatalf("BlobAt said %v, want ErrNoBlob", err)
		}
	})
}

// A directory is not a blob, and reading one as text would hand the caller a
// tree listing to parse as JSON.
func TestBlobAtRefusesADirectory(t *testing.T) {
	dir := newRepo(t)
	if err := os.MkdirAll(filepath.Join(dir, "notes"), 0o750); err != nil {
		t.Fatalf("could not make the notes directory: %v", err)
	}
	writeFile(t, filepath.Join(dir, "notes", "one.txt"), "one\n")
	runGit(t, dir, "add", "notes/one.txt")
	runGit(t, dir, "commit", "-m", "a directory")

	if _, err := BlobAt(dir, "HEAD", "notes"); err == nil {
		t.Fatal("BlobAt read a directory as a blob")
	}
}

// FileHistory follows a rename and stops at a copy. A waiver moved with git mv
// is the same file; one made out of an old one that is still there is not.
func TestFileHistoryFollowsARenameAndNotACopy(t *testing.T) {
	dir := newRepo(t)
	writeFile(t, filepath.Join(dir, "one.txt"), "the same content, near enough\n")
	runGit(t, dir, "add", "one.txt")
	runGit(t, dir, "commit", "-m", "the first file")

	writeFile(t, filepath.Join(dir, "two.txt"), "the same content, near enough\n")
	runGit(t, dir, "add", "two.txt")
	runGit(t, dir, "commit", "-m", "a second file that looks like the first")

	runGit(t, dir, "mv", "two.txt", "three.txt")
	runGit(t, dir, "commit", "-m", "move the second file")

	paths, changes, err := FileHistory(dir, "three.txt")
	if err != nil {
		t.Fatalf("FileHistory did not read the history: %v", err)
	}

	want := []string{"three.txt", "two.txt"}
	if !slices.Equal(paths, want) {
		t.Fatalf("FileHistory named %v, want %v: a copy is not a rename", paths, want)
	}
	// The move, then the commit that made the file as a copy of the first, then
	// the first file's own add. The copy is why the names stop where they do.
	if len(changes) != 3 || changes[0].Status != "R100" || changes[1].Status[0] != 'C' {
		t.Fatalf("FileHistory read the changes %+v, want a pure rename then a copy", changes)
	}
}

// A file nobody moved has one name, and FileHistory says so rather than nothing.
func TestFileHistoryNamesAFileNobodyMoved(t *testing.T) {
	dir := newRepo(t)
	writeFile(t, filepath.Join(dir, "one.txt"), "one\n")
	runGit(t, dir, "add", "one.txt")
	runGit(t, dir, "commit", "-m", "the first file")

	paths, changes, err := FileHistory(dir, "one.txt")
	if err != nil {
		t.Fatalf("FileHistory did not read the history: %v", err)
	}
	if !slices.Equal(paths, []string{"one.txt"}) {
		t.Fatalf("FileHistory named %v, want just the one name", paths)
	}
	if len(changes) != 1 || !strings.HasPrefix(changes[0].Status, "A") {
		t.Fatalf("FileHistory read the changes %+v, want one add", changes)
	}
}

// A path reused after a deletion carries both files' history, and the statuses
// say where one ends and the other begins: the newest add is the newer file's.
func TestFileHistoryShowsWhereAReusedPathWasReborn(t *testing.T) {
	dir := newRepo(t)
	writeFile(t, filepath.Join(dir, "one.txt"), "the first file\n")
	runGit(t, dir, "add", "one.txt")
	runGit(t, dir, "commit", "-m", "the first file")

	runGit(t, dir, "rm", "-q", "one.txt")
	runGit(t, dir, "commit", "-m", "delete it")

	writeFile(t, filepath.Join(dir, "one.txt"), "a different file at the same path\n")
	runGit(t, dir, "add", "one.txt")
	runGit(t, dir, "commit", "-m", "a new file at the old path")

	_, changes, err := FileHistory(dir, "one.txt")
	if err != nil {
		t.Fatalf("FileHistory did not read the history: %v", err)
	}
	if len(changes) != 3 {
		t.Fatalf("FileHistory read %d changes, want the add, the delete and the first add", len(changes))
	}

	want := []string{"A", "D", "A"}
	for i, status := range want {
		if !strings.HasPrefix(changes[i].Status, status) {
			t.Fatalf("FileHistory read the statuses %+v, want %v", changes, want)
		}
	}
}

// A list of paths that is all empty is refused. Narrowing to nothing and
// reading everything are opposite answers, and a caller that asked for the
// first must not silently get the second.
func TestTrailersForRefusesAnAllEmptyPathList(t *testing.T) {
	dir := newRepo(t)
	commitWith(t, dir, "one\n\nSlice: b3s1")

	if _, err := TrailersFor(dir, "Slice", "", ""); err == nil {
		t.Fatal("TrailersFor read the whole history for a list of empty paths")
	}
}

// A message past the reader's cap comes back cut, and says so. A caller that
// judges a message has to know it read one.
func TestMessagesCapsALongMessageAndSaysSo(t *testing.T) {
	dir := newRepo(t)
	commitWith(t, dir, "long\n\n"+strings.Repeat("padding padding\n", MaxMessageBytes/15))

	got, err := Messages(dir)
	if err != nil {
		t.Fatalf("Messages did not read the history: %v", err)
	}
	if !got[0].Cut {
		t.Fatal("a message past the cap did not come back cut")
	}
	if len(got[0].Body) != MaxMessageBytes {
		t.Fatalf("the cut body is %d bytes, want the cap of %d", len(got[0].Body), MaxMessageBytes)
	}
	if got[1].Cut {
		t.Error("an ordinary message came back cut")
	}
}
