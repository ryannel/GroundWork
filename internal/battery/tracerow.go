package battery

import (
	"errors"
	"fmt"

	"github.com/ryannel/groundwork/internal/journal"
	"github.com/ryannel/groundwork/internal/plan"
	"github.com/ryannel/groundwork/internal/trace"
)

// The trace row reads a plan in both directions, and reads the record for the
// artifacts a bet says it stands on.
//
// Backward (R12): every proof carries from: <design-path>#<anchor>, and the row
// is red when the anchor names no heading in that file. The reference's shape
// and the file's existence are the plan row's red, so this row never repeats
// them — it asks the one question nothing else asks.
//
// Forward (R12): every id in a bet's facing list is claimed by exactly one of
// its slices, or listed under deferred with a reason. Unclaimed and unrecorded
// is red, and claimed twice is red. This direction exists because of a recorded
// failure: a sealed pattern that belonged to no slice, where every slice was
// individually correct. Only this reading sees that.
//
// Beside them (R13): a bet declares premises, and amending or withdrawing one
// of those artifacts marks every bet whose premises name it. The mark is named
// on this row's line, and this row's line is a journal line — which is the
// signal R13 asks for, written where every other row's verdict is written.
//
// What makes it red, and what does not, is the whole judgement here.
//
// A dangling anchor, an unclaimed facing item and an item claimed twice are the
// three reds. R12 says so in those words, and each is a misstatement in a file
// somebody wrote on purpose.
//
// A mark is not. Nothing in this bet gives a marked bet a way to answer — the
// answer is a person re-reading the bet against the artifact that moved — and a
// red nobody can clear is the friction-waived class this design's own risks
// name. So a mark is counted in the head, where no cut reaches it, and named
// among the hits.
//
// Nothing being sealed is not red either. R4 rules that ground: in this
// environment there is no key the agents cannot read, so a blocking rule would
// either put the key inside their reach or stop every run. A design file no seal
// covers and a premise no seal names are both loud on every line this row
// prints, and both flip when R4's unsigned does.
//
// Three verdicts, and the two that are not red are worth stating plainly.
//
// A repo with no plan directory is green. There is nothing to trace in either
// direction, so nothing can have been misstated — the plan row's own shape,
// ruled in D45 — and the line claims no more than that.
//
// Everything the row could not reach is unrunnable: a plan that will not read,
// a plan naming nothing to trace, a git that would not answer. A plan that will
// not read is the plan row's red, and two rows red for one fault is two reds for
// one fix.
func traceRow() Row {
	return Row{
		ID:       "trace",
		Kind:     "trace",
		Severity: Blocking,
		Check:    checkTrace,
	}
}

func checkTrace(c Context) Result {
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
				"there is no %s directory, so this repo traces nothing and can misstate none", plan.Dir),
		}
	case errors.Is(err, plan.ErrNoUnits):
		return Result{Outcome: Unrunnable, Evidence: cut(err.Error())}
	case err != nil:
		return Result{
			Outcome:  Unrunnable,
			Evidence: cut("the trace row has no plan to read: " + err.Error()),
		}
	}

	rep, err := trace.Check(root, set)
	if err != nil {
		return Result{Outcome: Unrunnable, Evidence: cut("the trace row could not read this repo: " + err.Error())}
	}

	if rep.Proofs == 0 && rep.Facing == 0 && rep.Premises == 0 {
		// D17: a verifier may never pass on nothing. A plan directory holding a
		// program file and no bet is a plan somebody has started, and there is
		// nothing in it to read in either direction.
		return Result{
			Outcome: Unrunnable,
			Evidence: fmt.Sprintf(
				"%s names no proof, no facing item and no premise, so there is nothing to trace", plan.Dir),
		}
	}

	return traceVerdict(rep)
}

// traceVerdict turns one reading into the row's outcome and its one line.
func traceVerdict(rep trace.Report) Result {
	totals := traceTotals{
		proofs:    rep.Proofs,
		dangling:  len(rep.Dangling),
		facing:    rep.Facing,
		unclaimed: len(rep.Unclaimed),
		twice:     len(rep.Twice),
		marked:    len(rep.Marked),
		unsealed:  len(rep.UnsealedDesign)+len(rep.UnsealedPremise) > 0,
	}

	// Ordered by what a reader has to act on. hitEvidence shows as many whole
	// hits as fit and counts the rest, so the order decides what a narrow line
	// keeps. The three reds go first, because a red is a thing to fix. Then the
	// marks, because a mark is a bet to go and re-read. Then the unsealed things,
	// which a crowded line gives up first.
	//
	// The unsealed things are named as hits rather than as a clause about the
	// row, because each of them is one file or one artifact somebody can act on.
	// They are named on a green line as readily as on a red one: a signal that
	// only shows when something else is already wrong is aimed the wrong way
	// (F76). The head's own note is what survives when the names do not.
	for _, group := range [][]trace.Note{
		rep.Dangling, rep.Unclaimed, rep.Twice, rep.Marked,
		rep.UnsealedDesign, rep.UnsealedPremise,
	} {
		for _, one := range group {
			totals.hits = append(totals.hits, traceHit(one))
		}
	}

	return totals.verdict(traceOutcome(rep))
}

// traceOutcome is the row's verdict, read from the report rather than worked out
// again here.
//
// One rule, one spelling (D54 ruling 1). Which states are red is the trace
// package's own ruling — R12's three — and a second statement of it in this file
// would be two answers able to disagree about one repo. The counts in the head
// come from the same report, so the line and the verdict can never say different
// things.
func traceOutcome(rep trace.Report) Outcome {
	if rep.Sound() {
		return Green
	}

	return Red
}

// traceHit names one thing the reading found.
//
// Both halves go through printable before the line's own clip, per D49 ruling 2:
// every word of them comes off a plan file or a design file's headings, and a
// newline in one would draw a row of its own in the verify table. Neither is
// capped here — hitEvidence gives a hit the bytes it has and drops what will not
// fit whole, so a cap of this row's own would be a bound nothing drives (F81).
func traceHit(one trace.Note) hit {
	return hit{file: printable(one.Value), shape: printable(one.Why)}
}

// traceTotals is what one reading came to, in the numbers its line is built
// from.
//
// The line is built from these rather than from the report itself, so the
// arithmetic that proves it fits can be handed the widest counts an int can
// print. F54, F61 and F81: the bound has to measure the branch that prints
// everything, and the branch is found by searching rather than by feeding the
// maximum into every field at once.
type traceTotals struct {
	// The three subjects, each the denominator of the failure beside it. A
	// reader who is told "0 unclaimed" and not how many facing ids there were
	// cannot tell a clean plan from an empty one.
	proofs int
	facing int

	dangling  int
	unclaimed int
	twice     int

	// marked is the bets standing on an artifact the record says moved. It is
	// loud and never red, and it is in the head rather than a clause because a
	// loud thing in a clause goes silently conditional at scale (F61).
	marked int

	// unsealed says something this row read carries no seal — a design file an
	// anchor resolved in, or an artifact a premise names. It rides in the head
	// as a note rather than a count, and the hits name which ones.
	unsealed bool

	hits []hit
}

// verdict turns the totals into the row's outcome and its one line.
//
// Every count is in the head, where no cut can reach it. D33 rules that words
// give way and counts never do, and F61 is what happens when a loud thing rides
// in a clause instead.
//
// The arithmetic. The fixed words come to 52 bytes. The two plural nouns come to
// 18 more, and the unsealed note to 11. Six counts print at most 19 digits each.
// So the head is at most 195 bytes however large the counts get, which leaves
// the journal's cap room for what a reader can act on.
//
// The widest line is found by searching the count space, never by feeding the
// maximum into every field at once. That is the discipline F54, F61 and F81 cost
// this repo three times.
func (t traceTotals) verdict(outcome Outcome) Result {
	head := t.head()

	if len(t.hits) == 0 {
		// Nothing to name at all: every anchor resolved, every facing id is
		// recorded once, no bet stands on moved ground, and everything this row
		// read carries a seal. The row says what it read rather than what is so.
		return Result{Outcome: outcome, Evidence: cutTo(head+t.say(), journal.MaxTextBytes)}
	}

	// No clauses. Everything this row has to say about what it found is a hit
	// with a name on it, and the one thing it says about itself — that something
	// it read carries no seal — is in the head, where no cut reaches it.
	return Result{Outcome: outcome, Evidence: hitEvidence(head, t.hits, nil)}
}

// head is every count, in the order a reader needs them: the backward
// direction, the forward direction, then the bets standing on moved ground.
//
// The widest spelling is the plural of each noun, so the bound is measured
// there and a line that reads singular is always narrower.
func (t traceTotals) head() string {
	return fmt.Sprintf("%s: %d dangling; %s: %d unclaimed, %d claimed twice; %d marked%s: ",
		counted(t.proofs, "proof", "proofs"),
		t.dangling,
		counted(t.facing, "facing id", "facing ids"),
		t.unclaimed, t.twice,
		t.marked, t.sealNote())
}

// sealNote is R4's loud state, in the head where no cut reaches it. The hits
// name which files and which artifacts; this says only that something did.
func (t traceTotals) sealNote() string {
	if t.unsealed {
		return " (unsealed)"
	}

	return ""
}

// say is what a line with nothing to name says instead.
//
// It says what was read and what was found in it, never what is so of the repo
// (F87). The anchors it could not read are named among the hits, so "every
// anchor read resolves" is a claim about this row's own reading and nothing
// wider. There is no second sentence for a red line: a red here always has a
// hit to name, and it takes the branch above this one.
func (t traceTotals) say() string {
	return "every anchor read resolves, and every facing id is claimed once or deferred"
}
