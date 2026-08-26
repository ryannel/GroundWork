package battery

import (
	"context"
	"errors"
	"fmt"

	"github.com/ryannel/groundwork/internal/board"
	"github.com/ryannel/groundwork/internal/journal"
	"github.com/ryannel/groundwork/internal/plan"
)

// The board row reconciles what a plan expects against what the tests did.
//
// R8 puts three inputs into the board and nothing else: the plan, git's Slice
// trailers, and the adapter's per-test run results. The row derives the board
// at every run and writes nothing at all. A derivation that wrote would be one
// small change away from a board a person could move by hand, which is the one
// thing this bet's done-when forbids.
//
// What makes it red, and what does not, is the whole judgement here.
//
// A proof its plan expects green that the run says is not green is red. That is
// work regressing, and there is no benign reading of it.
//
// A proof green ahead of its plan is not. It is the plan lagging the work, and
// it is the ordinary state of every slice between the moment its test goes
// green and the moment its commit lands. R10 asks that it be flagged rather
// than silently accepted, so it is counted in the head of the row's own line,
// named among the hits, and shown on the board render — and never red, because
// a red there would fire on every honest slice in progress and on every repo
// whose history predates the trailer.
//
// A Slice trailer the board cannot read as landed-ness is red, named. It is a
// misstatement in one of the three inputs, and the plan row calls a plan that
// misstates itself red for the same reason. Nothing else in the battery reads
// these trailers, so a board that only whispered would be the only reader of a
// lying input.
//
// A Slice trailer on a merge commit is not. One slice is one commit and a merge
// is not that commit, so it is counted and named and not read — D38 and D40's
// precedent, where merges never govern.
//
// Three verdicts, and the two that are not red are worth stating plainly.
//
// A repo with no plan directory is green. A board is derived from a plan, and
// where there is none there is no board — so nothing was reconciled and nothing
// can have been misstated. That is the plan row's own shape, ruled in D45, and
// the line says only that. It is answered before the row looks for a manifest,
// because a repo that states no plan owes the board nothing else either.
//
// Everything the row could not reach is unrunnable: a plan that will not read,
// a plan naming no proof at all, a manifest it cannot load, a history git would
// not give it, a surface whose run broke. The last of those is the run-evidence
// row's rule applied here — a run that broke says nothing about what passed, so
// every proof would read as never run, and that is a red manufactured out of
// missing data.
func boardRow() Row {
	return Row{
		ID:       "board",
		Kind:     "board",
		Severity: Blocking,
		Check:    checkBoard,
	}
}

func checkBoard(c Context) Result {
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
				"there is no %s directory, so this repo derives no board and can misstate none", plan.Dir),
		}
	case errors.Is(err, plan.ErrNoUnits):
		return Result{Outcome: Unrunnable, Evidence: cut(err.Error())}
	case err != nil:
		// The plan row is the one that judges a plan, and it goes red on this
		// same file. Two rows red for one fault is two reds for one fix.
		return Result{
			Outcome:  Unrunnable,
			Evidence: cut("the board row has no plan to derive from: " + err.Error()),
		}
	}

	pattern := board.Pattern(set)
	if pattern == "" {
		return Result{
			Outcome: Unrunnable,
			Evidence: fmt.Sprintf(
				"%s names no proof, so there is no board to derive and nothing to run", plan.Dir),
		}
	}

	s, bad, ok := openScan("board row", c)
	if !ok {
		return bad
	}

	history, err := board.ReadHistory(root)
	if err != nil {
		return Result{
			Outcome:  Unrunnable,
			Evidence: cut("the board row could not read this repo's own history: " + s.reason(err)),
		}
	}

	ctx, cancel := context.WithTimeout(context.Background(), board.Budget)
	defer cancel()

	run, blocked, err := board.RunProofs(ctx, root, s.m, pattern)
	switch {
	case errors.Is(err, board.ErrInsideARun):
		return Result{
			Outcome: Unrunnable,
			Evidence: "the board row is already running inside a battery run, " +
				"so it did not start the proofs a second time",
		}
	case err != nil:
		return Result{
			Outcome:  Unrunnable,
			Evidence: cut("the board row could not run the proofs: " + s.reason(err)),
		}
	}

	if len(blocked) > 0 {
		var why []string
		for _, one := range blocked {
			why = append(why, fmt.Sprintf("the surface %q could not be run: %s", one.Surface, s.reason(one.Err)))
		}

		return Result{
			Outcome: Unrunnable,
			Evidence: cut("the board row could not run the proofs on every surface: " +
				listed(why, "; ")),
		}
	}

	derived := board.Derive(set, history, run)
	if len(derived.Rows) == 0 {
		// The plan named proofs and none of them reached a milestone, so there
		// was nothing to reconcile. A verifier may never pass on nothing (D17),
		// and the plan reader refuses the shapes that get here, so this is the
		// guard rather than a case anybody meets.
		return Result{
			Outcome: Unrunnable,
			Evidence: fmt.Sprintf(
				"%s names proofs and the board placed none of them on a milestone", plan.Dir),
		}
	}

	return boardVerdict(derived)
}

// boardVerdict turns one derived board into the row's outcome and its one line.
func boardVerdict(b board.Board) Result {
	totals := boardTotals{
		proofs:    len(b.Rows),
		landed:    len(b.Landed),
		ahead:     len(b.Ahead()),
		behind:    len(b.Behind()),
		misstated: len(b.Wrong),
		unread:    len(b.Unread),
		shallow:   b.Shallow,
	}

	// Ordered by what a reader has to act on. hitEvidence shows as many whole
	// hits as fit and counts the rest, so the reds go first, then the trailers
	// the board did not read, and the flags last. The flags go last because they
	// are the many: a repo whose plan lags its work has one of them per proof,
	// and a rarer thing named behind them would never be seen.
	for _, row := range b.Behind() {
		totals.hits = append(totals.hits, proofHit(row))
	}
	for _, note := range b.Wrong {
		totals.hits = append(totals.hits, trailerHit(note))
	}
	for _, note := range b.Unread {
		totals.hits = append(totals.hits, trailerHit(note))
	}
	for _, row := range b.Ahead() {
		totals.hits = append(totals.hits, proofHit(row))
	}

	if len(b.Run.Twice) > 0 {
		totals.clauses = append(totals.clauses, fmt.Sprintf("%s reported by more than one suite",
			counted(len(b.Run.Twice), "test was", "tests were")))
	}

	return totals.verdict()
}

// proofHit names one proof whose expected and actual states disagree.
func proofHit(row board.Row) hit {
	return hit{
		file:  row.Proof,
		shape: fmt.Sprintf("is expected %s and %s in the run", row.Expected, row.Actual),
	}
}

// trailerHit names one Slice trailer the board did not read.
//
// Every word of it came off a commit message, which is free text written by
// whoever can write a commit. The board makes it printable and clips it before
// the row ever sees it (D49 ruling 2); the commit is shortened again here,
// because a line of evidence has less room than a board render.
func trailerHit(note board.Note) hit {
	return hit{
		file:    fmt.Sprintf("%q", note.Value),
		subject: "on " + cutTo(note.Commit, shortCommitBytes),
		shape:   note.Why,
	}
}

// shortCommitBytes is how much of a commit id a line of evidence carries. A
// commit is recognisable in its first few characters, and the board render
// carries it whole.
const shortCommitBytes = 12

// boardTotals is what one derivation came to, in the numbers its line is built
// from.
//
// The line is built from these rather than from the board itself, so the
// arithmetic that proves it fits can be handed the widest counts an int can
// print. F54 and F61: the bound has to measure the branch that prints
// everything, and the branch is found by searching rather than by feeding the
// maximum into every field at once.
type boardTotals struct {
	proofs int
	landed int
	ahead  int
	behind int

	// misstated is a trailer that misstates landed-ness, and unread is one the
	// board declined to read — a merge, or a slice an earlier commit already
	// landed. Only misstated turns the row red.
	//
	// Two counts rather than one, because the head is the only part of the line
	// guaranteed to survive, and one number covering both could not tell a red
	// cause from a benign one. D52.3 ruled the same shape for unsigned and
	// unverified seals; F75 is where this row had not yet obeyed it.
	misstated int
	unread    int

	// shallow says the history behind the landed count was not all there. It
	// rides in the head beside the count it qualifies, because a landed count a
	// reader cannot trust is worse than none.
	shallow bool

	hits    []hit
	clauses []string
}

// verdict turns the totals into the row's outcome and its one line.
//
// Every count is in the head, where no cut can reach it. D33 rules that words
// give way and counts never do, and F61 is what happens when a loud count rides
// in a clause instead: it goes silently conditional at scale. The head is at
// most 179 bytes however large the counts get, which leaves the journal's cap
// room for what a reader can act on.
func (t boardTotals) verdict() Result {
	head := t.head()

	if len(t.hits) == 0 {
		// The clauses ride this branch too. A signal the row only shows when
		// something else is already wrong is aimed the wrong way: a folded
		// double answer misleads most on a board that otherwise looks clean.
		// The run-evidence row's green branch keeps its clauses for the same
		// reason, and F76 is where this one did not.
		return Result{
			Outcome:  t.outcome(),
			Evidence: cutTo(head+t.say()+tailOf(t.clauses), journal.MaxTextBytes),
		}
	}

	return Result{Outcome: t.outcome(), Evidence: hitEvidence(head, t.hits, t.clauses)}
}

// outcome is the row's verdict: a proof behind its plan, or a trailer that
// misstates landed-ness. Nothing else.
func (t boardTotals) outcome() Outcome {
	if t.behind > 0 || t.misstated > 0 {
		return Red
	}

	return Green
}

// head is every count, in the order a reader needs them.
//
// Six counts and a note, and the arithmetic that keeps them inside the
// journal's cap is this: the fixed words come to 83 bytes at their widest, and
// six counts can print at most 19 digits each, so the head is at most 197 bytes
// however large they get. That is why the shallow note is three words rather
// than five.
//
// The widest is the plural spelling — "trailers misstated" is a byte longer
// than "trailer misstated" — so the bound is measured there and a line that
// reads singular is always narrower.
func (t boardTotals) head() string {
	return fmt.Sprintf("%s, %d landed%s: %d ahead of plan, %d behind, %s, %d unread: ",
		counted(t.proofs, "proof", "proofs"),
		t.landed, t.shallowNote(),
		t.ahead, t.behind,
		counted(t.misstated, "trailer misstated", "trailers misstated"),
		t.unread)
}

// shallowNote qualifies the landed count when the history behind it was short.
func (t boardTotals) shallowNote() string {
	if t.shallow {
		return " (shallow)"
	}

	return ""
}

// say is what a line with nothing to name says instead.
func (t boardTotals) say() string {
	if t.outcome() == Red {
		return "expected and actual disagree"
	}

	return "every proof sits where its plan puts it"
}
