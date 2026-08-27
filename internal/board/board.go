// Package board derives the board R8 describes. It is never a file anyone
// edits.
//
// Three inputs, and nothing else:
//
//  1. The plan — which proofs exist, and which milestone each sits on.
//  2. Git — which slices have landed, read from a Slice trailer on commits,
//     never from a file's claim.
//  3. The adapter's per-test run results — which proofs are red and green.
//
// Expected state comes from plan position (R10). A proof whose milestone still
// holds unlanded slices is expected red; a proof on a fully landed milestone is
// expected green. The milestone is the unit rather than the slice, because a
// milestone is what a bet promises and a slice is how it gets there.
//
// The two directions of disagreement are not the same thing, and this package
// keeps them apart.
//
// Green ahead of plan is the plan lagging the work. It is the ordinary state of
// every slice between the moment its test goes green and the moment its commit
// lands, and of every repo whose history predates the trailer. R10 asks that it
// be flagged rather than silently accepted, so it is counted, named on the row's
// own line and shown on the render — and it never turns anything red, because a
// red there would fire on every honest slice in progress.
//
// Red behind the plan has no benign reading. A proof its plan expects green
// that the run says is not green is work that regressed, and it is red.
//
// Nothing here writes. The board is derived at every reading, so there is
// nothing for a person to move by hand.
package board

import (
	"slices"
	"unicode/utf8"

	"github.com/ryannel/groundwork/internal/adapter"
	"github.com/ryannel/groundwork/internal/journal"
	"github.com/ryannel/groundwork/internal/plan"
)

// Expected is what the plan's own position says a proof should be.
type Expected string

// The two expected states. There is no third: a proof is either on a milestone
// that is finished or on one that is not.
const (
	ExpectRed   Expected = "red"
	ExpectGreen Expected = "green"
)

// Actual is what the run said about a proof's test.
type Actual string

// The four actual states. Only the first is green. The other three are kept
// apart rather than folded into one red, because slice 5's stub check judges
// the reds and cannot judge what it cannot tell apart.
const (
	Passed   Actual = "passed"
	Failed   Actual = "failed"
	Skipped  Actual = "skipped"
	NeverRan Actual = "never ran"
)

// Actuals returns every state a run may report about a proof, in the order this
// package writes them.
//
// It is exported because the stub check judges each of them and must be able to
// say it judged all of them. A list written out there instead would be a second
// statement of this vocabulary, and a fifth state added here would reach the
// stub check as the default branch of a switch — silently read as one of the
// four (D54 ruling 1).
func Actuals() []Actual {
	return []Actual{Passed, Failed, Skipped, NeverRan}
}

// Flag is how a proof's expected and actual states sit together.
type Flag string

// The three flag states.
const (
	OnPlan Flag = "on plan"
	Ahead  Flag = "ahead of plan"
	Behind Flag = "behind its plan"
)

// MaxValueBytes caps one value the board takes off a plan file or a commit
// trailer. A plan id is capped at 64 bytes by the plan's own rules, and a
// commit trailer is capped by nothing at all, so the board caps it here.
//
// It is exported because the contract page writes the number down and the row
// has to know how wide the widest trailer it will ever print can be. One
// statement of the cap, read by both (D54 ruling 1).
const MaxValueBytes = 64

// Row is one proof on the board: where it sits, what its plan position expects,
// what the run said, and how the two sit together.
type Row struct {
	Bet       string
	Milestone string
	Slice     string
	Proof     string
	Marker    string
	Headline  bool

	// Landed says whether this proof's own slice has landed. The expected state
	// comes from the milestone rather than from this, and both are worth
	// showing: a landed slice on an unfinished milestone is expected red, and a
	// reader who could not see that would think the board had lost the commit.
	Landed bool

	Expected Expected
	Actual   Actual
	Flag     Flag
}

// Note is one Slice trailer the board did not read, and why.
type Note struct {
	Commit string
	Value  string
	Why    string
}

// Board is one whole derivation.
type Board struct {
	Rows       []Row
	Milestones int

	// Landed is the slice ids the trailers landed, sorted.
	Landed []string

	// Unread is a trailer the board declined to read: one on a merge commit, or
	// one naming a slice another commit already landed. Neither misstates
	// anything, and both are worth seeing.
	Unread []Note

	// Wrong is a trailer that misstates landed-ness: one outside the id
	// charset, one naming no slice the plan declares, one with nothing after
	// its colon, or one of several on a single commit.
	Wrong []Note

	Commits int
	Shallow bool
	Head    string

	Run Run
}

// Derive joins the three inputs into one board.
func Derive(set plan.Set, h History, r Run) Board {
	b := Board{Commits: h.Commits, Shallow: h.Shallow, Head: h.Head, Run: r}

	read := Landings(set, h)
	b.Unread, b.Wrong = read.Unread, read.Wrong

	landed := map[string]bool{}
	for id := range read.At {
		landed[id] = true
	}

	b.Landed = make([]string, 0, len(landed))
	for id := range landed {
		b.Landed = append(b.Landed, id)
	}
	slices.Sort(b.Landed)

	for _, bet := range set.Bets {
		plans := map[string]plan.Slice{}
		for _, s := range set.Slices {
			if s.Bet == bet.ID {
				plans[s.ID] = s
			}
		}

		for _, milestone := range bet.Milestones {
			b.Milestones++

			expected := ExpectRed
			if reached(bet, milestone.ID, landed) {
				expected = ExpectGreen
			}

			for _, entry := range bet.Slices {
				if entry.Milestone != milestone.ID {
					continue
				}

				// A slice the bet names with no file of its own cannot happen
				// through the plan reader, which refuses that shape. Skipping it
				// keeps a hand-built Set from indexing into nothing.
				s, ok := plans[entry.ID]
				if !ok {
					continue
				}

				for _, proof := range s.Proofs {
					b.Rows = append(b.Rows, row(bet.ID, milestone.ID, s.ID, proof, landed[s.ID], expected, r))
				}
			}
		}
	}

	return b
}

// Landing is what this repo's own history says about which slices landed.
//
// It is exported because two rows ask the same question of the same trailers.
// The board asks which slices landed; the record row asks which commit landed
// one, so it can judge whether a record predates it. A second reading would be
// two rows able to disagree about one commit (D54 ruling 1), and the review
// that forced this found them disagreeing already.
type Landing struct {
	// At maps a slice id to the commit that landed it.
	At map[string]string

	// Unread is a trailer the board declined to read, and Wrong one that
	// misstates landed-ness. They are the Board fields of the same names.
	Unread []Note
	Wrong  []Note
}

// Landings judges every Slice trailer git found and says which commit landed
// each slice.
//
// A trailer is read once, in one place, so that a claim can never be counted by
// one reader and refused by another.
func Landings(set plan.Set, h History) Landing {
	known := map[string]bool{}
	for _, s := range set.Slices {
		known[s.ID] = true
	}
	for _, bet := range set.Bets {
		for _, entry := range bet.Slices {
			known[entry.ID] = true
		}
	}

	read := Landing{At: map[string]string{}}

	// Oldest first, because history lands a thing once and what comes after is
	// commentary (D57 ruling 4). git hands the claims back newest first, so the
	// walk runs backwards: crediting the newest claim would name the real
	// landing commit as the stray and send whoever chased it to the wrong
	// commit.
	for _, claim := range slices.Backward(h.Claims) {
		if claim.Merge {
			// D38 and D40: merges never govern. One slice is one commit, and a
			// merge is not that commit. It misstates nothing about the id space,
			// so it is named and not read rather than refused.
			read.Unread = append(read.Unread, note(claim, "sits on a merge commit, and one slice is one commit"))

			continue
		}

		switch shape, why := JudgeValue(claim.Value, claim.Alone, known); shape {
		case ShapeDoubled:
			read.Wrong = append(read.Wrong, note(claim, "is one of several on its commit, and one slice is one commit"))

		case ShapeEmpty:
			read.Wrong = append(read.Wrong, note(claim, "has nothing after its colon, so it names no slice"))

		case ShapeNotAnID:
			read.Wrong = append(read.Wrong, note(claim, "is not an id: it "+why))

		case ShapeUnknown:
			read.Wrong = append(read.Wrong, note(claim, "names no slice this plan declares"))

		default:
			if _, already := read.At[claim.Value]; already {
				read.Unread = append(read.Unread, note(claim, "names a slice an earlier commit already landed"))

				continue
			}

			read.At[claim.Value] = claim.Commit
		}
	}

	return read
}

// Shape is what is wrong with a trailer value that names an id.
type Shape int

// The four shapes a trailer value can be wrong in, and the one it can be right
// in. They are D56 ruling 4's list, and they are here rather than in each
// caller because a second copy would let two rows judge one commit differently.
const (
	// ShapeSound: the value names one declared id.
	ShapeSound Shape = iota

	// ShapeDoubled: the value is one of several on its commit.
	ShapeDoubled

	// ShapeEmpty: the value has nothing after its colon.
	ShapeEmpty

	// ShapeNotAnID: the value is outside the id charset.
	ShapeNotAnID

	// ShapeUnknown: the value names nothing the plan declares.
	ShapeUnknown
)

// JudgeValue reports which shape a trailer value has. The second result is the
// id reader's own words, and it is empty for every shape but ShapeNotAnID.
//
// Each caller writes its own sentence, because a Slice trailer and a Bet
// trailer name different things. What is shared is which four shapes are wrong
// and in what order, which is the part two readers must not disagree about.
func JudgeValue(value string, alone bool, known map[string]bool) (Shape, string) {
	switch bad := plan.CheckID(value); {
	case !alone:
		return ShapeDoubled, ""
	case value == "":
		return ShapeEmpty, ""
	case bad != nil:
		return ShapeNotAnID, bad.Error()
	case !known[value]:
		return ShapeUnknown, ""
	default:
		return ShapeSound, ""
	}
}

// note renders one refused or unread trailer, safe to print.
//
// D49 ruling 2: every word of a commit trailer is written by whoever can write
// a commit, so it goes through printable and a clip before it reaches a line.
// A newline in one would otherwise draw a row of its own wherever the board is
// shown.
func note(claim Claim, why string) Note {
	return Note{Commit: say(claim.Commit), Value: say(claim.Value), Why: why}
}

// say makes one value from a plan file or a commit trailer safe and short
// enough to print.
func say(value string) string {
	value = journal.Printable(value)
	if len(value) <= MaxValueBytes {
		return value
	}

	// Only a partial rune can be invalid here, so this backs off at most three
	// bytes.
	kept := value[:MaxValueBytes-3]
	for len(kept) > 0 && !utf8.ValidString(kept) {
		kept = kept[:len(kept)-1]
	}

	return kept + "..."
}

// reached reports whether every slice a milestone holds has landed.
func reached(bet plan.Bet, milestone string, landed map[string]bool) bool {
	held := 0
	for _, entry := range bet.Slices {
		if entry.Milestone != milestone {
			continue
		}
		held++
		if !landed[entry.ID] {
			return false
		}
	}

	// A milestone holding no slice at all has promised nothing, so nothing on
	// it can be finished. There is no proof on such a milestone to expect
	// anything of, so this only decides a board nobody can see.
	return held > 0
}

// row derives one proof's row.
func row(bet, milestone, slice string, proof plan.Proof, landed bool, expected Expected, r Run) Row {
	out := Row{
		Bet: say(bet), Milestone: say(milestone), Slice: say(slice),
		Proof: say(proof.ID), Marker: say(proof.Marker),
		Headline: proof.Headline, Landed: landed, Expected: expected,
	}

	// The join is the marker as the plan wrote it; what the row carries is the
	// safe copy. A board that joined on the clipped one would lose a proof
	// whose marker ran past the cap.
	out.Actual = actual(r, proof.Marker)
	out.Flag = flag(expected, out.Actual)

	return out
}

// actual reads what the run said about one proof's test.
//
// The join is the whole marker and nothing less. R9 spells the proof id inside
// the test name so that one name answers for one proof, and a join on a prefix
// would land one result on two proofs — the trap the contract page names.
func actual(r Run, marker string) Actual {
	outcome, ran := r.Outcomes[marker]
	if !ran {
		return NeverRan
	}

	switch outcome {
	case adapter.Pass:
		return Passed
	case adapter.Skip:
		return Skipped
	case adapter.Fail:
		return Failed
	default:
		// The seam's vocabulary is closed to three, and nothing the shipped
		// adapters return reaches this. A caller holding a hand-built run can,
		// though, and an outcome the board cannot read is not a pass.
		return Failed
	}
}

// flag says which way expected and actual disagree, if they do.
func flag(expected Expected, got Actual) Flag {
	green := got == Passed

	switch {
	case expected == ExpectGreen && !green:
		return Behind
	case expected == ExpectRed && green:
		return Ahead
	default:
		return OnPlan
	}
}

// Ahead returns the proofs green ahead of their plan.
func (b Board) Ahead() []Row {
	return b.flagged(Ahead)
}

// Behind returns the proofs their plan expects green that are not.
func (b Board) Behind() []Row {
	return b.flagged(Behind)
}

// OnPlan returns the proofs sitting where their plan puts them.
func (b Board) OnPlan() []Row {
	return b.flagged(OnPlan)
}

func (b Board) flagged(want Flag) []Row {
	var found []Row
	for _, row := range b.Rows {
		if row.Flag == want {
			found = append(found, row)
		}
	}

	return found
}

// Holds reports whether the board holds together: no proof behind its plan, and
// no trailer that misstates landed-ness.
//
// The row and the verb both ask this, so the two can never disagree about one
// board (D54 ruling 1).
func (b Board) Holds() bool {
	return len(b.Behind()) == 0 && len(b.Wrong) == 0
}
