package battery

import (
	"fmt"
	"slices"
	"strings"

	"github.com/ryannel/groundwork/internal/board"
	"github.com/ryannel/groundwork/internal/journal"
)

// The history row reads the shape of this repo's own commits.
//
// R14: a bet closes on a merge commit, never a squash, because a squash erases
// every `Slice` trailer the board reads.
//
// What a squash actually does was measured rather than assumed. git writes a
// squashed merge as one single-parent commit. Its message quotes every message
// it swallowed, indented.
//
// The `Slice` lines are still in that message, and git's trailer parser returns
// none of them. A trailer is read from a message's last paragraph, and a quoted
// block is not it.
//
// So the readable fingerprint is a gap: a commit whose message holds `Slice`
// lines that git's trailer parser does not read. It is asked of the parser the
// board reads with, so the two can never disagree about what a trailer is.
//
// A quoted line counts only inside a cluster: two or more trailer-shaped lines
// next to each other (D64 ruling 7). That is the shape a squash quotes, because
// a squash quotes a whole trailer block.
//
// A lone `Slice:` line in a paragraph of prose is somebody writing about a
// slice. This repo's own ledger commits write exactly that. Reading it as a
// squash was a red nothing could ever clear.
//
// The check is wider than squashes by one step, and deliberately. A commit that
// buried a whole trailer block under a later paragraph has the same fault: the
// board cannot read it, so the slice it names is not landed as far as anything
// here can tell.
//
// One flavour is invisible, and the page says so rather than claiming the check
// is complete. A squash whose message dropped its quoted trailers leaves no
// evidence at all. Nothing tells it from an ordinary commit. R4's seals are the
// eventual answer.
//
// A merge's message is not read at all. D38, D40 and D56 ruling 4 all say the
// same thing: a merge is not the act, so it never governs.
//
// A merge that quotes its branch's messages is a merge doing its job. `git
// merge --log` writes that by default on some setups, and reading it would red
// every repo with that setting. Merges are counted and named instead.
//
// A short clone is named rather than refused, on the posture checkWaiverCount
// writes out: what this row cannot see it leaves unread, and every commit it
// does hold carries its own real message.
//
// A repo with no commit is unrunnable. There is no history to read, and D17
// rules that a verifier may never pass on nothing.
func historyRow() Row {
	return Row{
		ID:       "history",
		Kind:     "history",
		Severity: Blocking,
		Check:    checkHistory,
	}
}

func checkHistory(c Context) Result {
	root, err := journal.RepoRoot(c.RepoDir)
	if err != nil {
		return Result{Outcome: Unrunnable, Evidence: cut(err.Error())}
	}

	rep, err := readHistoryShape(root)
	if err != nil {
		return Result{Outcome: Unrunnable, Evidence: cut("the history row could not read this repo: " + err.Error())}
	}
	if rep.Commits == 0 {
		return Result{
			Outcome:  Unrunnable,
			Evidence: "this repo holds no commit, so there is no history to read",
		}
	}

	return rep.verdict()
}

// historyReport is what one reading of a repo's own commits came to.
type historyReport struct {
	// Commits is every commit read, and Merges the ones that were merges and so
	// were not read.
	Commits int
	Merges  int

	// Squashed is the commits holding Slice trailer text git's parser does not
	// read.
	Squashed int

	// Cut is the commits whose message was longer than the journal reader's cap,
	// so only its first part was read. The row says so rather than claiming
	// something about a message it read half of.
	Cut int

	// Shallow says the history read was not all of it.
	Shallow bool

	// hits are the commits that swallowed a trailer.
	hits []hit
}

// Sound reports whether every commit read kept the trailers its message wrote.
func (r historyReport) Sound() bool {
	return r.Squashed == 0
}

// readHistoryShape reads every commit's message and every commit's trailers,
// and reports where the two disagree.
func readHistoryShape(root string) (historyReport, error) {
	messages, err := journal.Messages(root)
	if err != nil {
		return historyReport{}, err
	}

	// The same key the board reads landed-ness with. A second spelling here
	// would be a second answer about which trailer this is (D54 ruling 1).
	read, err := journal.Trailers(root, board.TrailerKey)
	if err != nil {
		return historyReport{}, err
	}

	shallow, err := journal.Shallow(root)
	if err != nil {
		return historyReport{}, err
	}

	byCommit := map[string]int{}
	for _, commit := range read {
		byCommit[commit.ID] = len(commit.Values)
	}

	rep := historyReport{Commits: len(messages), Shallow: shallow}

	for _, commit := range messages {
		if commit.Parents > 1 {
			rep.Merges++

			continue
		}

		if commit.Cut {
			rep.Cut++
		}

		quoted := quotedSlices(commit.Body)
		if len(quoted) <= byCommit[commit.ID] {
			continue
		}

		rep.Squashed++
		rep.hits = append(rep.hits, hit{
			file: brief(commit.ID),
			shape: fmt.Sprintf("quotes %s that git reads as %d, which is what a squash leaves behind: %s",
				counted(len(quoted), board.TrailerKey+" line", board.TrailerKey+" lines"),
				byCommit[commit.ID],
				printable(quoted[0])),
		})
	}

	return rep, nil
}

// clusterSize is how many trailer-shaped lines must sit together before a Slice
// line among them is read as a quoted trailer block.
//
// Two. A squash quotes a whole block — Bet, Slice, Tests — and a person writing
// about a slice in prose writes one line. One would read every mention as a
// squash; three would miss a block of two.
const clusterSize = 2

// quotedSlices returns the Slice lines a message writes inside a cluster of
// trailer-shaped lines, in the order it writes them.
//
// Leading whitespace is trimmed, because git indents every message it quotes
// into a squash.
func quotedSlices(body string) []string {
	var (
		found   []string
		cluster []string
	)

	flush := func() {
		if len(cluster) >= clusterSize {
			for _, line := range cluster {
				if key, value, _ := strings.Cut(line, ":"); key == board.TrailerKey {
					found = append(found, strings.TrimSpace(value))
				}
			}
		}
		cluster = nil
	}

	for _, line := range strings.Split(body, "\n") {
		line = strings.TrimSpace(line)
		if !trailerShaped(line) {
			flush()

			continue
		}

		cluster = append(cluster, line)
	}
	flush()

	return found
}

// trailerShaped reports whether a line is written the way this repo writes a
// trailer: one of the keys its own commits use, a colon, and whatever follows.
//
// The keys, not the charset. Any word before a colon is trailer-shaped by
// charset, so a prose label above a sentence starting "Slice:" formed a cluster
// and read as a squash — a permanent red on history nobody can change, which is
// the worst false positive this battery can make (D65 ruling 4).
//
// The set comes from the package that spells a trailer key, so this is not a
// second list.
func trailerShaped(line string) bool {
	key, _, found := strings.Cut(line, ":")
	if !found {
		return false
	}

	return slices.Contains(board.TrailerKeys(), key)
}

// historyHeadBytes is the widest the head can print. A test searches the count
// space for it rather than feeding the maximum into every field at once (F54,
// F61, F81).
//
// The fixed words come to 66 bytes at their widest: the plural spelling, and
// the shallow note. Four counts print at most 19 digits each. So the head is at
// most 142 bytes, however large the counts get.
const historyHeadBytes = 142

// verdict turns the report into the row's outcome and its one line.
//
// Every count is in the head, where no cut can reach it (D33, F61).
func (r historyReport) verdict() Result {
	outcome := Green
	if !r.Sound() {
		outcome = Red
	}

	head := r.head()

	if len(r.hits) == 0 {
		return Result{Outcome: outcome, Evidence: cutTo(head+r.say(), journal.MaxTextBytes)}
	}

	return Result{Outcome: outcome, Evidence: hitEvidence(head, r.hits, nil)}
}

// head is every count, in the order a reader needs them.
func (r historyReport) head() string {
	return fmt.Sprintf("%s read%s, %s not read: %d squashed, %d cut: ",
		counted(r.Commits, "commit", "commits"),
		r.shallowNote(),
		counted(r.Merges, "merge", "merges"),
		r.Squashed, r.Cut)
}

// shallowNote qualifies the reading when the history was short.
func (r historyReport) shallowNote() string {
	if r.Shallow {
		return " (shallow)"
	}

	return ""
}

// say is what a line with nothing to name says instead. It claims only what was
// read, never what is so of the repo (F87) — and reading is all this can do
// about a squash whose message kept no trailers to find.
func (r historyReport) say() string {
	return "every commit read keeps the " + board.TrailerKey + " trailers its own message quotes"
}
