package journal

import (
	"path/filepath"
	"strings"
	"testing"
)

// Trailers reads a commit's trailers with git's own trailer parser. A scan of
// commit bodies written here would be a second definition of what a trailer is,
// and it would drift from the one git and its hooks already agree on.

func TestTrailersReadsWhatGitReadsAsATrailer(t *testing.T) {
	dir := newRepo(t)
	commitWith(t, dir, "one\n\nBet: bet 3\nSlice: b3s1\nTests: yes")
	commitWith(t, dir, "two, with no trailer at all")
	commitWith(t, dir, "three\n\nSlice: b3s2\n  and more")

	got, err := Trailers(dir, "Slice")
	if err != nil {
		t.Fatalf("Trailers did not read the history: %v", err)
	}
	if len(got) != 4 {
		t.Fatalf("Trailers read %d commits, want 4", len(got))
	}

	// Newest first, a folded value unfolded onto one line, and a commit with no
	// trailer holding no value.
	if strings.Join(got[0].Values, "|") != "b3s2 and more" {
		t.Errorf("the folded value came back %v", got[0].Values)
	}
	if len(got[1].Values) != 0 {
		t.Errorf("a commit with no trailer came back with %v", got[1].Values)
	}
	if strings.Join(got[2].Values, "|") != "b3s1" {
		t.Errorf("the plain value came back %v", got[2].Values)
	}
	for _, commit := range got[:3] {
		if commit.Parents != 1 {
			t.Errorf("the commit %s reads %d parents, want 1", commit.ID, commit.Parents)
		}
	}
}

// A merge commit's parents are what tells it from an ordinary one, and the
// waiver machinery already stands on that answer (F34).
func TestTrailersCountsAMergeCommitsParents(t *testing.T) {
	dir := newRepo(t)
	runGit(t, dir, "checkout", "-q", "-b", "side")
	commitWith(t, dir, "side work")
	runGit(t, dir, "checkout", "-q", "main")
	commitWith(t, dir, "main work")
	runGit(t, dir, "merge", "--no-ff", "-m", "merge side\n\nSlice: b3s1", "side")

	got, err := Trailers(dir, "Slice")
	if err != nil {
		t.Fatalf("Trailers did not read the history: %v", err)
	}
	if got[0].Parents != 2 {
		t.Errorf("the merge commit reads %d parents, want 2", got[0].Parents)
	}
	if strings.Join(got[0].Values, "|") != "b3s1" {
		t.Errorf("the merge commit's trailer came back %v", got[0].Values)
	}
}

// A repo with no commit has no history to read, which is an answer and not a
// failure.
func TestTrailersOnARepoWithNoCommits(t *testing.T) {
	dir := t.TempDir()
	runGit(t, dir, "init", "-b", "main")

	got, err := Trailers(dir, "Slice")
	if err != nil {
		t.Fatalf("Trailers failed on a repo with no commits: %v", err)
	}
	if len(got) != 0 {
		t.Errorf("a repo with no commits read %d commits", len(got))
	}
}

// Outside a repository the caller gets this package's own plain sentence.
func TestTrailersOutsideARepo(t *testing.T) {
	if _, err := Trailers(t.TempDir(), "Slice"); err == nil {
		t.Fatal("Trailers outside a repo did not fail")
	}
}

// The key is written into git's own format string, so a key that is not a
// trailer token would change which atom git renders rather than which trailer
// it looks for.
func TestTrailersRefusesAKeyThatIsNotATrailerToken(t *testing.T) {
	dir := newRepo(t)

	for _, key := range []string{"", "Slice,valueonly", "Slice)", "Sli ce", "Slice:"} {
		if _, err := Trailers(dir, key); err == nil {
			t.Errorf("Trailers accepted the key %q", key)
		}
	}
}

// The framing is parsed rather than believed. A record whose head is not a
// commit id means the framing broke, which is the one shape a commit message
// could reach in with — and it is refused rather than read.
func TestParsingTheTrailerLogRefusesARecordThatIsNotACommit(t *testing.T) {
	cases := []struct {
		name string
		out  string
	}{
		{"a head that is not a hash", "not-a-hash \nb3s1\n\x00"},
		{"a head that is too short", "abc123 \nb3s1\n\x00"},
		{"an empty head", " \nb3s1\n\x00"},
		{"a record with no line in it", strings.Repeat("0", 40) + "\x00"},
	}

	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			if _, err := parseTrailerLog(c.out); err == nil {
				t.Fatalf("the parser accepted %q", c.out)
			}
		})
	}
}

// The shapes git's own output takes, read straight. An empty value is one of
// them: a trailer with nothing after its colon names nothing, and losing it
// would let the plainest misstatement pass unseen.
func TestParsingTheTrailerLogReadsGitsOwnShapes(t *testing.T) {
	const (
		one   = "1111111111111111111111111111111111111111"
		two   = "2222222222222222222222222222222222222222"
		three = "3333333333333333333333333333333333333333"
	)

	out := one + " " + two + "\nb3s1\n\x00\n" +
		two + " " + three + " " + one + "\nb3s2\n\x00\n" +
		three + " \n\n\x00\n"

	got, err := parseTrailerLog(out)
	if err != nil {
		t.Fatalf("the parser refused git's own output: %v", err)
	}
	if len(got) != 3 {
		t.Fatalf("the parser read %d commits, want 3", len(got))
	}

	if got[0].ID != one || got[0].Parents != 1 || strings.Join(got[0].Values, "|") != "b3s1" {
		t.Errorf("the first commit read %+v", got[0])
	}
	if got[1].Parents != 2 {
		t.Errorf("the merge commit read %d parents, want 2", got[1].Parents)
	}
	if len(got[2].Values) != 1 || got[2].Values[0] != "" {
		t.Errorf("the empty trailer value read %+v, want one empty value", got[2].Values)
	}
}

// A commit with no trailer at all holds no value, which is not the same as one
// empty value.
func TestParsingTheTrailerLogTellsNoTrailerFromAnEmptyOne(t *testing.T) {
	const id = "1111111111111111111111111111111111111111"

	got, err := parseTrailerLog(id + " \n\x00\n")
	if err != nil {
		t.Fatalf("the parser refused git's own output: %v", err)
	}
	if len(got) != 1 {
		t.Fatalf("the parser read %d commits, want 1", len(got))
	}
	if len(got[0].Values) != 0 {
		t.Errorf("a commit with no trailer read %+v", got[0].Values)
	}
}

// commitWith writes one file and commits it with the given message.
func commitWith(t *testing.T, dir, message string) {
	t.Helper()

	name := strings.Fields(message)[0] + ".txt"
	writeFile(t, filepath.Join(dir, name), message+"\n")
	runGit(t, dir, "add", "-A")
	runGit(t, dir, "commit", "-m", message)
}
