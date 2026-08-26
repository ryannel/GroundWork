package battery

import (
	"fmt"

	"github.com/ryannel/groundwork/internal/journal"
	"github.com/ryannel/groundwork/internal/seal"
)

// The seal-verify row asks one question of every seal in the repo: does the
// work still match what was sealed?
//
// R3 makes that a hash comparison rather than a reading. A seal names each path
// it covers with that path's blob hash at the sealed commit, and this row
// recomputes every one of them at HEAD. A path that moved, or went missing, is
// red — and stays red until the tag moves through groundwork seal amend, which
// prints what changed and demands a reason.
//
// Three verdicts, and the two that are not red are worth stating plainly.
//
// A repo with no seal tag is green. It states no seal, so it can misstate none,
// and a red there would be this tool telling every repo it has to seal
// something before it can verify anything. That is the plan row's shape, ruled
// in D45. The line says only that: it never claims a seal held, because none
// was read.
//
// A seal that is not signed is green too, and loud. R4 rules why: there is no
// key in this environment that the agents cannot read, so a blocking rule would
// either put the key inside their reach or stop every run. Unsigned is on every
// line this row prints, and it never turns the run red. When the owner's key
// signs seals, that flips, and the flip is a major battery bump.
//
// Everything else about a seal is red: a tag under seal/ that does not read as
// a seal, a name that disagrees with its own message, and a battery trailer
// that disagrees with the seal's own journal line — which is the check D23
// asked a later bet for.
func sealRow() Row {
	return Row{
		ID:       "seal-verify",
		Kind:     "seal-verify",
		Severity: Blocking,
		Check:    checkSealVerify,
	}
}

func checkSealVerify(c Context) Result {
	rep, err := seal.Verify(c.RepoDir)
	if err != nil {
		// The row could not reach the thing it checks. Unrunnable is visible,
		// counted, and somebody's problem — and it is the honest answer when
		// git itself could not be asked.
		return Result{Outcome: Unrunnable, Evidence: cut(err.Error())}
	}

	return sealTotals{
		seals:      rep.Seals,
		paths:      rep.Paths,
		moved:      rep.Moved,
		unsigned:   rep.Unsigned,
		unverified: rep.Unverified,
		problems:   rep.Problems,
		first:      rep.FirstProblem(),
	}.verdict()
}

// sealTotals is what one run of the row found, in the numbers its line is built
// from.
//
// The line is built from these rather than from the report itself, so the
// arithmetic that proves it fits can be handed the widest counts an int can
// print. F54: the bound has to measure the branch that prints everything.
type sealTotals struct {
	seals      int
	paths      int
	moved      int
	unsigned   int
	unverified int
	problems   int

	// first is the first problem any seal reported. It is somebody else's text
	// — every word of it comes off a tag — so verdict makes it safe before it
	// puts it on a line.
	first string
}

// verdict turns the totals into the row's outcome and its one line.
//
// Every fixed part of the line comes first, and the problem — the one part
// written by somebody else — gets whatever is left. That is what makes the
// counts guaranteed rather than best-effort (D52.4). The fixed part is at most
// 136 bytes however large the counts get, which is inside the journal's cap, so
// no count is ever the half that is lost. F61 is the defect this shape closes:
// the counts used to ride in a clause that dropped off at scale, taking R4's
// loud unsigned with it.
func (t sealTotals) verdict() Result {
	if t.seals == 0 {
		return Result{
			Outcome:  Green,
			Evidence: "this repo holds no seal tag, so nothing is sealed and no covered path can have moved",
		}
	}

	if t.problems > 0 {
		head := fmt.Sprintf("%s across %s, %s, the first: ",
			counted(t.problems, "problem", "problems"),
			counted(t.seals, "seal", "seals"),
			t.authorityCounts())

		return Result{Outcome: Red, Evidence: head + clipProblem(t.first, journal.MaxTextBytes-len(head))}
	}

	return Result{
		Outcome: Green,
		Evidence: fmt.Sprintf("%s over %s, %s: every hash still matches at HEAD",
			counted(t.seals, "seal", "seals"),
			counted(t.paths, "path", "paths"),
			t.authorityCounts()),
	}
}

// authorityCounts is what the row says about the seals that are nobody's word.
//
// Both counts, on every line, in the head where nothing can push them off. R4
// asks that unsigned be loud, and D52.3 asks that unverified be kept apart from
// it: a signature nothing could check is not the same as no signature, and one
// number covering both would let a forged block read as an honest absence.
func (t sealTotals) authorityCounts() string {
	return fmt.Sprintf("%d unsigned, %d unverified", t.unsigned, t.unverified)
}

// clipProblem renders a problem safe to put on a line of evidence, in the bytes
// the line has left.
//
// Every word of it comes off a tag, and a tag message is written by whoever can
// write a tag — which in this environment is any agent. So it goes through
// printable before it goes through the clip, per D38 ruling 4 and D49 ruling 2.
// A newline in a tag would otherwise draw a row of its own in the verify table,
// and a run that prints a forged row is worse than one that prints nothing.
//
// The budget is passed in rather than fixed, because what is left depends on
// how wide the counts printed. A problem is what gives way; a count is not.
func clipProblem(problem string, most int) string {
	return cutTo(printable(problem), most)
}
