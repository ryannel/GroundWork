package battery

import (
	"strings"
	"testing"

	"github.com/ryannel/groundwork/internal/journal"
)

// The history row's fixture: a bet built on a branch, brought back either by a
// merge or by a squash. Nothing else about the two repos differs.

// closeABet builds two slice commits on a branch and brings them back to the
// trunk, squashing them when asked to.
func closeABet(t *testing.T, dir string, squash bool) {
	t.Helper()

	runGit(t, dir, "checkout", "-q", "-b", "demo_bet")
	writeSource(t, dir, "alpha/one.go", "package alpha\n")
	commitAll(t, dir, "slice one\n\nBet: demo_bet\nSlice: demo_s1\nTests: yes")
	writeSource(t, dir, "alpha/two.go", "package alpha\n\nvar Two = 2\n")
	commitAll(t, dir, "slice two\n\nBet: demo_bet\nSlice: demo_s2\nTests: yes")
	runGit(t, dir, "checkout", "-q", "-")

	if squash {
		runGit(t, dir, "merge", "--squash", "demo_bet")
		runGit(t, dir, "commit", "--no-edit")

		return
	}

	runGit(t, dir, "merge", "--no-ff", "-m", "close demo_bet\n\nBet: demo_bet\nTests: yes", "demo_bet")
}

func TestHistoryRowIsRegistered(t *testing.T) {
	registered(t, "history", "history")
}

// TestProof_b3s7_history_a_bet_closed_on_a_squash_is_red is R14's history
// shape: a bet closes on a merge commit, never a squash, because a squash
// erases every Slice trailer the board reads.
//
// The squash is not guessed at. git writes the squashed commit as one
// single-parent commit quoting every message it swallowed, so the Slice lines
// are still in the message and git's own trailer parser returns none of them.
// That gap is what the row reads.
func TestProof_b3s7_history_a_bet_closed_on_a_squash_is_red(t *testing.T) {
	t.Run("a bet closed on a merge commit", func(t *testing.T) {
		dir := newRepo(t)
		closeABet(t, dir, false)

		res := runRow(t, dir, "history")
		if res.Outcome != Green {
			t.Fatalf("a bet closed on a merge came out %s: %s", res.Outcome, res.Evidence)
		}
		mustFit(t, res.Evidence, "0 squashed")
	})

	t.Run("a bet closed on a squash", func(t *testing.T) {
		dir := newRepo(t)
		closeABet(t, dir, true)

		res := runRow(t, dir, "history")
		if res.Outcome != Red {
			t.Fatalf("a bet closed on a squash came out %s: %s", res.Outcome, res.Evidence)
		}
		// git quotes the messages it swallowed newest first, so the first Slice
		// line the squashed commit writes is the second slice's.
		mustFit(t, res.Evidence, "1 squashed", "2 Slice lines", "demo_s2")
	})
}

// The two repos hold the same work. What the board can read of it is the whole
// difference, and this pins that the fixture is honest about it rather than
// resting on the row's own answer.
func TestASquashLeavesTheBoardWithNoTrailerToRead(t *testing.T) {
	merged, squashed := newRepo(t), newRepo(t)
	closeABet(t, merged, false)
	closeABet(t, squashed, true)

	if got := runGit(t, merged, "log", "--format=%(trailers:key=Slice,valueonly,unfold)"); !strings.Contains(got, "demo_s1") {
		t.Fatalf("the merged history holds no readable Slice trailer: %q", got)
	}
	if got := runGit(t, squashed, "log", "--format=%(trailers:key=Slice,valueonly,unfold)"); strings.Contains(got, "demo_s1") {
		t.Fatalf("the squashed history still holds a readable Slice trailer: %q", got)
	}
	if got := runGit(t, squashed, "log", "--format=%B"); !strings.Contains(got, "Slice: demo_s1") {
		t.Fatalf("the squashed message does not hold the trailer text at all: %q", got)
	}
}

// D56 ruling 4: merges never govern landed-ness, and this row does not read one
// either. A merge commit that quotes its branch's messages is a merge doing its
// job, not a squash.
func TestHistoryRowDoesNotReadAMergeCommitsMessage(t *testing.T) {
	dir := newRepo(t)
	runGit(t, dir, "checkout", "-q", "-b", "side")
	writeSource(t, dir, "alpha/one.go", "package alpha\n")
	commitAll(t, dir, "slice one\n\nBet: demo_bet\nSlice: demo_s1\nTests: yes")
	runGit(t, dir, "checkout", "-q", "-")
	runGit(t, dir, "merge", "--no-ff", "-m", "the merge\n\nquoting the branch:\n\n    Slice: demo_s1\n    Slice: demo_s2", "side")

	res := runRow(t, dir, "history")
	if res.Outcome != Green {
		t.Fatalf("a merge quoting its branch came out %s: %s", res.Outcome, res.Evidence)
	}
	mustFit(t, res.Evidence, "1 merge")
}

// D64 ruling 7: a lone quoted Slice line in a paragraph of prose is somebody
// writing about a slice, not a squash. This repo's own ledger commits write
// exactly that shape, so reading it as a squash was a red nothing could clear.
func TestHistoryRowReadsALoneQuotedSliceLineAsProse(t *testing.T) {
	dir := newRepo(t)
	writeSource(t, dir, "docs/findings.md", "# Findings\n")
	commitAll(t, dir, "Record the review\n\nThe entry says the commit carrying\n"+
		"Slice: demo_s1\nwas the one that landed it, which is what the board reads.\n\n"+
		"Bet: demo_bet\nTests: none")

	res := runRow(t, dir, "history")
	if res.Outcome != Green {
		t.Fatalf("a quoted line in prose came out %s: %s", res.Outcome, res.Evidence)
	}
	mustFit(t, res.Evidence, "0 squashed")
}

// D65 ruling 4: a prose label is not a trailer key. A bare word above a
// sentence starting "Slice:" formed a cluster of two and read as a squash,
// permanently red on history nobody can change.
func TestHistoryRowDoesNotReadAProseLabelAsATrailer(t *testing.T) {
	dir := newRepo(t)
	writeSource(t, dir, "docs/findings.md", "# Findings\n")
	commitAll(t, dir, "Record the review\n\nNotes:\n"+
		"Slice: demo_s1 was the one that broke.\n\nBet: demo_bet\nTests: none")

	res := runRow(t, dir, "history")
	if res.Outcome != Green {
		t.Fatalf("a prose label over a quoted line came out %s: %s", res.Outcome, res.Evidence)
	}
	mustFit(t, res.Evidence, "0 squashed")
}

// And two real trailer keys quoted together still read as a squash. That is the
// shape a squash leaves, and the board cannot read either of them — so the red
// stands even when the commit meant well.
func TestHistoryRowReadsTwoQuotedTrailerKeysAsASquash(t *testing.T) {
	dir := newRepo(t)
	writeSource(t, dir, "docs/findings.md", "# Findings\n")
	commitAll(t, dir, "Correct the record\n\nThe commit we are correcting carried\n"+
		"Bet: demo_bet\nSlice: demo_s1\n")

	res := runRow(t, dir, "history")
	if res.Outcome != Red {
		t.Fatalf("two quoted trailer keys came out %s: %s", res.Outcome, res.Evidence)
	}
	mustFit(t, res.Evidence, "1 squashed", "demo_s1")
}

// And a quoted block still reads as one. Two trailer-shaped lines together are
// the shape a squash quotes, and one line of prose is not.
func TestHistoryRowReadsAQuotedTrailerBlockAsASquash(t *testing.T) {
	dir := newRepo(t)
	writeSource(t, dir, "alpha/one.go", "package alpha\n")
	commitAll(t, dir, "Squashed commit of the following:\n\n    slice one\n\n"+
		"    Bet: demo_bet\n    Slice: demo_s1\n    Tests: yes\n")

	res := runRow(t, dir, "history")
	if res.Outcome != Red {
		t.Fatalf("a quoted trailer block came out %s: %s", res.Outcome, res.Evidence)
	}
	mustFit(t, res.Evidence, "1 squashed", "demo_s1")
}

// The limit, named rather than implied: a squash whose message was rewritten to
// drop the quoted trailers leaves nothing to find, and reads as an ordinary
// commit. The page says so beside the check.
func TestHistoryRowCannotSeeASquashThatKeptNoTrailers(t *testing.T) {
	dir := newRepo(t)
	runGit(t, dir, "checkout", "-q", "-b", "side")
	writeSource(t, dir, "alpha/one.go", "package alpha\n")
	commitAll(t, dir, "slice one\n\nBet: demo_bet\nSlice: demo_s1\nTests: yes")
	runGit(t, dir, "checkout", "-q", "-")
	runGit(t, dir, "merge", "--squash", "side")
	runGit(t, dir, "commit", "-m", "close the bet")

	res := runRow(t, dir, "history")
	if res.Outcome != Green {
		t.Fatalf("a squash with no quoted trailers came out %s, and nothing can see it: %s",
			res.Outcome, res.Evidence)
	}
}

// A repo whose history names no slice at all has nothing to erase. The row says
// what it read rather than what is so of the repo (F87).
func TestHistoryRowIsGreenOnAHistoryWithNoSliceTrailer(t *testing.T) {
	res := runRow(t, newRepo(t), "history")
	if res.Outcome != Green {
		t.Fatalf("a history with no slice trailer came out %s: %s", res.Outcome, res.Evidence)
	}
	mustFit(t, res.Evidence, "0 squashed")
}

// A short history is named, not refused. Each commit this clone holds is judged
// whole, so what a shallow clone costs is commits left unjudged rather than
// commits misjudged — which is why this row goes the board's way (D56 ruling 3)
// and not the waiver counter's.
func TestHistoryRowNamesAShallowCloneAndKeepsJudging(t *testing.T) {
	dir := newRepo(t)
	closeABet(t, dir, true)
	clone := shallowClone(t, dir)

	res := runRow(t, clone, "history")
	if res.Outcome != Red {
		t.Fatalf("a squash at the tip of a shallow clone came out %s: %s", res.Outcome, res.Evidence)
	}
	mustFit(t, res.Evidence, "shallow", "1 squashed")
}

// A repo with no commit at all has no history to read. That is unrunnable, not
// a pass on nothing (D17).
func TestHistoryRowIsUnrunnableOnARepoWithNoCommit(t *testing.T) {
	dir := t.TempDir()
	runGit(t, dir, "init", "-b", "main")
	runGit(t, dir, "config", "commit.gpgsign", "false")

	res := runRow(t, dir, "history")
	if res.Outcome != Unrunnable {
		t.Fatalf("a repo with no commit came out %s: %s", res.Outcome, res.Evidence)
	}
}

// A message longer than the reader's cap comes back cut, and the row says so
// rather than judging the part it read. The cap is one number in two places, so
// a test holds them together (F98).
func TestHistoryRowSaysWhenAMessageWasCut(t *testing.T) {
	dir := newRepo(t)
	writeSource(t, dir, "alpha/one.go", "package alpha\n")
	commitAll(t, dir, "a message nobody wrote\n\n"+strings.Repeat("padding padding\n", journal.MaxMessageBytes/15))

	res := runRow(t, dir, "history")
	if res.Outcome != Green {
		t.Fatalf("a long message came out %s: %s", res.Outcome, res.Evidence)
	}
	mustFit(t, res.Evidence, "1 cut")
}

// Every count is in the head, where no cut reaches it (D33), and the widest
// line is searched rather than fed the maximum in every field at once (F81).
func TestTheHistoryRowsCountsAlwaysFitTheLine(t *testing.T) {
	widest := 0
	for _, n := range []int{0, 1, 9, 10, 1 << 30, 1<<63 - 1} {
		for _, shallow := range []bool{false, true} {
			rep := historyReport{Commits: n, Merges: n, Squashed: n, Cut: n, Shallow: shallow}
			if got := len(rep.head()); got > widest {
				widest = got
			}
		}
	}

	// The constant certifies nothing on its own: a comment claiming 500 bytes
	// would pass a test that only held the head to it. So it is held to the
	// journal's own cap too (F115).
	if historyHeadBytes > journal.MaxTextBytes {
		t.Fatalf("the head's bound is %d bytes, over the journal's cap of %d",
			historyHeadBytes, journal.MaxTextBytes)
	}
	if widest > historyHeadBytes {
		t.Fatalf("the history row's head reaches %d bytes, and the comment claims at most %d",
			widest, historyHeadBytes)
	}
}

// The dogfood. This repo's bets have closed on merges, and every slice commit
// carries its own trailer, so the row is green here — and it would not be if
// any of them had been squashed.
func TestHistoryRowIsGreenAndHonestOnThisRepo(t *testing.T) {
	res := runRow(t, ".", "history")
	if res.Outcome != Green {
		t.Fatalf("this repo's own history row came out %s: %s", res.Outcome, res.Evidence)
	}
	mustFit(t, res.Evidence, "0 squashed")
}
