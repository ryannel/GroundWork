package battery

import (
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"slices"

	"github.com/ryannel/groundwork/internal/board"
	"github.com/ryannel/groundwork/internal/journal"
	"github.com/ryannel/groundwork/internal/plan"
)

// The record row judges the records a plan declares.
//
// R14 and D39: a slice plan declares `records`, a list of paths it owes. The
// row fails when one is missing, and when one's last commit predates the
// slice's last code commit.
//
// Two words in that rule are decided here.
//
// A slice's landing commit is the oldest commit carrying its `Slice` trailer,
// per D57 ruling 4: history lands a thing once and what comes after is
// commentary. The claim is read through the board's own machinery, so the two
// rows cannot disagree about one commit (D64 ruling 3, after they did).
//
// Predates is ancestry, not clock time. Commit dates are writable and run
// backwards on any rebased history, and a commit reaches itself — so a record
// written in the slice's own commit does not predate it.
//
// Three reds, counted apart because they are three different fixes (D52 ruling
// 3). A declared record that is not in the tree. One no commit in this clone
// ever changed. One older than the work it describes.
//
// The never-committed count is exactly that: a path git holds no commit for.
//
// A record edited since it landed is not counted there, and it is not red. Its
// committed copy is still current. The head would mislead if the count read as
// "every record's content is committed".
//
// A slice with no claim is not judged. In a whole clone that means it has not
// landed, and the count reads waiting. In a shallow one the tool cannot tell
// that from a landing past the edge, so the count reads unseen and claims the
// weaker thing (D64 ruling 2). Either way the row's green covers the records it
// read and no others.
//
// R14 also says the row judges declared records only: a row that invents
// obligations becomes the friction-waived class. A slice declaring no record is
// green whatever it wrote.
//
// The battery's shallow-clone posture is written once, on checkWaiverCount.
// What it costs here is records left unjudged, never misjudged: a record dated
// to the edge of a shallow clone is counted rather than believed.
func recordRow() Row {
	return Row{
		ID:       "record",
		Kind:     "record",
		Severity: Blocking,
		Check:    checkRecord,
	}
}

func checkRecord(c Context) Result {
	root, err := journal.RepoRoot(c.RepoDir)
	if err != nil {
		return Result{Outcome: Unrunnable, Evidence: cut(err.Error())}
	}

	set, err := plan.Load(root)
	switch {
	case errors.Is(err, plan.ErrNoPlanDir):
		return Result{
			Outcome: Green,
			Evidence: fmt.Sprintf(
				"there is no %s directory, so this repo declares no record and can owe none", plan.Dir),
		}
	case errors.Is(err, plan.ErrNoUnits):
		return Result{Outcome: Unrunnable, Evidence: cut(err.Error())}
	case err != nil:
		// The plan row is the one that judges a plan, and it goes red on this
		// same file. Two rows red for one fault is two reds for one fix.
		return Result{
			Outcome:  Unrunnable,
			Evidence: cut("the record row has no plan to read: " + err.Error()),
		}
	}

	rep, err := readRecords(root, set)
	if err != nil {
		return Result{Outcome: Unrunnable, Evidence: cut("the record row could not read this repo: " + err.Error())}
	}

	return rep.verdict()
}

// recordReport is what one reading of a plan's records came to.
//
// The counts are apart on purpose. Missing, never-committed and stale are three
// different faults with three different fixes, and one count covering them
// could not tell a reader which one they have (D52 ruling 3).
type recordReport struct {
	// Records is the declared paths judged: the denominator every other count
	// here is read against. A reader told "0 missing" and not how many records
	// were read cannot tell a clean plan from an unread one.
	Records int

	// Waiting is the slices that declare a record and whose landing this row
	// found no claim for. On a shallow clone the head prints it as unseen, for
	// the reason JudgeValue's caller gives below.
	Waiting int

	Missing int
	Stale   int

	// NeverCommitted is a record git holds no commit for. It is not the count of
	// records with uncommitted edits, which the row does not judge — see the
	// row's own comment.
	NeverCommitted int

	// Unjudged is the records whose history this clone does not hold, so their
	// age could not be read. It is loud and never red.
	Unjudged int

	// Shallow says the history behind the ages was not all here.
	Shallow bool

	// hits are the records that made this row red, and loud the ones it could
	// not judge. Reds lead every line, every row — D64 ruling 8 is not per-row
	// advice (D65 ruling 3), and this row buried its lead the same way the
	// counter had.
	hits []hit
	loud []hit
}

// Sound reports whether every record read is there and current.
func (r recordReport) Sound() bool {
	return r.Missing+r.NeverCommitted+r.Stale == 0
}

// readRecords judges every record a landed slice declares.
func readRecords(root string, set plan.Set) (recordReport, error) {
	history, err := board.ReadHistory(root)
	if err != nil {
		return recordReport{}, err
	}

	rep := recordReport{Shallow: history.Shallow}

	// The board's own reading of the same trailers: oldest claim first, merges
	// unread, and the four validity shapes applied. One rule, one place.
	landed := board.Landings(set, history).At

	for _, slice := range set.Slices {
		if len(slice.Records) == 0 {
			continue
		}

		commit, held := landed[slice.ID]
		if !held {
			rep.Waiting++

			continue
		}

		for _, path := range slice.Records {
			rep.Records++
			if err := rep.judge(root, slice.ID, path, commit); err != nil {
				return recordReport{}, err
			}
		}
	}

	return rep, nil
}

// judge reads one record against the commit its slice landed in.
func (r *recordReport) judge(root, slice, path, commit string) error {
	full := filepath.Join(root, filepath.FromSlash(path))

	// Lstat, not Stat: a symlink where a record should be is a path pointing
	// wherever it likes, and following it would judge a file the plan never
	// named. It is not there as a record, so it is missing.
	info, err := os.Lstat(full)
	if err != nil || !info.Mode().IsRegular() {
		r.Missing++
		r.note(path, slice, "is not a file in this tree")

		return nil
	}

	last, err := journal.LastChanged(root, path)
	if err != nil {
		return err
	}
	if last == "" {
		r.NeverCommitted++
		r.note(path, slice, "is committed by nothing")

		return nil
	}

	// A record dated to the edge has a real last commit out of reach. Its age is
	// unjudged rather than believed. atTheEdge is the waiver authority's own
	// test, shared rather than copied.
	parents, err := journal.ParentsOf(root, last)
	if err != nil {
		return err
	}
	if atTheEdge(len(parents), r.Shallow) {
		r.Unjudged++
		r.loudly(path, slice, "was last changed at the edge of this shallow clone, in "+brief(last))

		return nil
	}

	older, err := journal.IsAncestor(root, last, commit)
	if err != nil {
		return err
	}
	if older && last != commit {
		r.Stale++
		r.note(path, slice, "last changed in "+brief(last)+", before the slice's own "+brief(commit))
	}

	return nil
}

// briefCommitBytes is how much of a commit id a line of evidence carries here.
// A commit is recognisable in its first few characters, and this line has three
// other things to say. The waiver machinery shortens to the same width.
const briefCommitBytes = 7

// brief shortens a commit id for a line of evidence.
func brief(commit string) string {
	if len(commit) <= briefCommitBytes {
		return commit
	}

	return commit[:briefCommitBytes]
}

// note records one thing the row found about one record.
//
// The path comes off a plan file, and the slice id off the same. Both go
// through printable before the line's own clip (D49 ruling 2). A newline in
// either would draw a row of its own in the verify table.
func (r *recordReport) note(path, slice, why string) {
	r.hits = append(r.hits, hit{file: printable(path), subject: "for " + printable(slice), shape: why})
}

// loudly records something the row could not judge. It is worth seeing and it
// is nobody's next move, so it follows every red.
func (r *recordReport) loudly(path, slice, why string) {
	r.loud = append(r.loud, hit{file: printable(path), subject: "for " + printable(slice), shape: why})
}

// found is everything the row has to name, reds first.
//
// hitEvidence shows as many whole hits as fit and counts the rest, so this
// order decides what a narrow line keeps. A stale record is somebody's next
// move; one this clone could not date is not.
func (r recordReport) found() []hit {
	return append(slices.Clone(r.hits), r.loud...)
}

// recordHeadBytes is the widest the head can print, and a test searches the
// count space for it rather than feeding the maximum into every field at once
// (F54, F61, F81). The fixed words come to 83 bytes at their widest — the
// plural spelling, the shallow note, and "waiting" over "unseen" — and six
// counts print at most 19 digits each. The journal's cap is 200, so a head at
// its widest leaves no room for a hit, which is the right way round: the counts
// are the part no cut may reach.
const recordHeadBytes = 197

// verdict turns the report into the row's outcome and its one line.
//
// Every count is in the head, where no cut can reach it. D33 rules that words
// give way and counts never do, and F61 is what happens when a loud count rides
// in a clause instead.
func (r recordReport) verdict() Result {
	outcome := Green
	if !r.Sound() {
		outcome = Red
	}

	head := r.head()

	found := r.found()
	if len(found) == 0 {
		return Result{Outcome: outcome, Evidence: cutTo(head+r.say(), journal.MaxTextBytes)}
	}

	return Result{Outcome: outcome, Evidence: hitEvidence(head, found, nil)}
}

// head is every count, in the order a reader needs them: what was read, then
// what was wrong with it, then what could not be judged, then what is not due
// yet.
//
// The widest spelling is the plural of each noun, so the bound is measured
// there and a line that reads singular is always narrower.
//
// The count of landed slices is not here, and the count of records is: the
// records are what was judged, and a reader who wants the slices behind them
// reads the plan. Six counts is what fits.
func (r recordReport) head() string {
	return fmt.Sprintf("%s read%s: %d missing, %d never committed, %d stale, %d unjudged, %d %s: ",
		counted(r.Records, "record", "records"),
		r.shallowNote(),
		r.Missing, r.NeverCommitted, r.Stale, r.Unjudged, r.Waiting, r.waitingWord())
}

// waitingWord names the state of a slice this row found no claim for.
//
// One count, two words, because the two states are one reading. In a whole
// clone no claim means the slice has not landed. In a shallow one it means that
// or a landing past the edge, and nothing in git tells the two apart.
//
// So the word says the weaker thing (D64 ruling 2). The shallow note beside it
// says which clone a reader is looking at.
func (r recordReport) waitingWord() string {
	if r.Shallow {
		return "unseen"
	}

	return "waiting"
}

// shallowNote qualifies the reading when the history behind the ages was short.
func (r recordReport) shallowNote() string {
	if r.Shallow {
		return " (shallow)"
	}

	return ""
}

// say is what a line with nothing to name says instead.
//
// It says what was read and what was found in it, never what is so of the repo
// (F87). "Every record read" is a claim about this row's own reading and
// nothing wider.
//
// It is only ever reached with nothing to name, and every record this row could
// not date is named — so the sentence is never printed over a record whose age
// went unread. The head carries the unjudged count either way.
func (r recordReport) say() string {
	return "every record read is in the tree and no older than the work it describes"
}
