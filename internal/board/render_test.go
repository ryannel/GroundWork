package board

import (
	"fmt"
	"strconv"
	"strings"
	"testing"
	"time"

	"github.com/ryannel/groundwork/internal/adapter"
)

// stamped is a board with a run on it, so the render has something to stamp
// itself with.
func stamped(b Board) Board {
	b.Run.At = time.Date(2026, 8, 26, 12, 0, 0, 0, time.UTC)
	b.Run.Took = 1500 * time.Millisecond

	return b
}

// R8: the board is rendered stamped with the run it came from. The stamp says
// when the run happened, what it cost, how many results it read, and the commit
// the landed set was read at — which is everything a reader needs to ask
// whether this board is still the truth.
func TestTheRenderIsStampedWithTheRunItCameFrom(t *testing.T) {
	b := stamped(Derive(demoSet(), landedAt("s_one", "s_two"), allPassing()))
	got := Render(b)

	for _, want := range []string{
		"2026-08-26T12:00:00Z", "1.5s", "3 tests", b.Head[:7],
	} {
		if !strings.Contains(got, want) {
			t.Errorf("the render does not carry %q:\n%s", want, got)
		}
	}
}

// Every proof gets a line, and the line says all four things the board derives:
// where it sits, what the plan expects, what the run said, and how the two sit
// together.
func TestEveryProofGetsALineSayingWhereItSitsAndHowItCameOut(t *testing.T) {
	run := allPassing()
	run.Outcomes["TestProof_p_one_it_holds"] = adapter.Fail

	got := Render(stamped(Derive(demoSet(), landedAt("s_one", "s_two"), run)))

	for _, row := range []struct{ proof, expected, actual, flag string }{
		{"p_one", "green", "failed", string(Behind)},
		{"p_two", "green", "passed", string(OnPlan)},
		{"p_three", "red", "passed", string(Ahead)},
	} {
		line := lineFor(t, got, row.proof)
		for _, want := range []string{row.expected, row.actual, row.flag} {
			if !strings.Contains(line, want) {
				t.Errorf("the line for %s does not say %q: %s", row.proof, want, line)
			}
		}
	}
}

// lineFor finds the one rendered line about a proof.
func lineFor(t *testing.T, render, proof string) string {
	t.Helper()

	var found []string
	for _, line := range strings.Split(render, "\n") {
		if strings.Contains(line, " "+proof+" ") {
			found = append(found, line)
		}
	}

	if len(found) != 1 {
		t.Fatalf("the render holds %d lines about %s:\n%s", len(found), proof, render)
	}

	return found[0]
}

// The counts a reader trusts, on one line, with every state on it including the
// ones at zero. A count that only appeared when it happened would let a proof
// behind its plan read as an absence.
func TestTheRenderCountsEveryStateIncludingTheZeroes(t *testing.T) {
	got := Render(stamped(Derive(demoSet(), landedAt("s_one", "s_two"), allPassing())))

	const want = "3 proofs: 2 on plan, 1 ahead of plan, 0 behind"
	if !strings.Contains(got, want) {
		t.Errorf("the render does not carry %q:\n%s", want, got)
	}
}

// The git half of the derivation is on the render too. A board read from a
// history with no Slice trailer in it looks exactly like a board at the start of
// its bet, and the only thing that tells them apart is this line.
func TestTheRenderSaysWhatTheHistoryGaveIt(t *testing.T) {
	b := stamped(Derive(demoSet(), History{Commits: 253, Shallow: true}, allPassing()))

	got := Render(b)
	for _, want := range []string{"0 slices landed", "253 commits", "shallow"} {
		if !strings.Contains(got, want) {
			t.Errorf("the render does not carry %q:\n%s", want, got)
		}
	}
}

// A trailer the board did not read, or could not read, is named where a person
// will see it — not folded into a count and left there.
func TestTheRenderNamesTheTrailersItDidNotRead(t *testing.T) {
	h := History{Commits: 3, Claims: []Claim{
		{Commit: strings.Repeat("a", 40), Value: "s_nine", Alone: true},
		{Commit: strings.Repeat("b", 40), Value: "s_one", Merge: true, Alone: true},
	}}

	got := Render(stamped(Derive(demoSet(), h, allPassing())))

	for _, want := range []string{"s_nine", "names no slice", "merge", "aaaaaaa", "bbbbbbb"} {
		if !strings.Contains(got, want) {
			t.Errorf("the render does not carry %q:\n%s", want, got)
		}
	}
}

// F49 and D49 ruling 2. Every value on the render comes off a plan file or a
// commit trailer, and both are written by whoever can write to this repo. A
// value carrying a newline or a tab would draw a row of its own in the table it
// is printed in.
func TestNothingOnTheRenderCanDrawARowOfItsOwn(t *testing.T) {
	set := demoSet()
	set.Slices[0].Proofs[0].ID = "p_one\tgreen\tpassed\ton plan"
	set.Slices[0].Milestone = "m\none"

	h := History{Commits: 2, Claims: []Claim{
		{Commit: "aaaa\nbbbb", Value: "s_one\nboard\tgreen", Alone: true},
	}}

	got := Render(stamped(Derive(set, h, allPassing())))

	for _, line := range strings.Split(got, "\n") {
		if strings.Count(line, "\t") > 0 {
			t.Errorf("a rendered line holds a tab: %q", line)
		}
	}
	if !strings.Contains(got, "aaaa bbbb") {
		t.Errorf("the newline in a commit id was not turned into a space:\n%s", got)
	}
	if !strings.Contains(got, "s_one board green") {
		t.Errorf("the newline and tab in a trailer value were not turned into spaces:\n%s", got)
	}
}

// D38 ruling 2: every printed line is bound. D52 ruling 4: the arithmetic that
// proves it has to measure the true widest line, and the true widest is found
// by searching the input space rather than by feeding the maximum into every
// field at once (F54, F61, and F79 for this test).
//
// Feeding maxima everywhere measures one shape. The render's width comes from
// several fields at once — a tabwriter pads every cell of a column to its
// widest — and from how many rows and notes there are, so the search walks
// lengths, counts and kinds together and keeps the widest it built.
func TestTheWidestRenderedLineIsSomewhereInTheInputSpace(t *testing.T) {
	lengths := []int{0, 1, 7, 63, 64, 65, 300, 4000}
	claims := [][]Claim{
		nil,
		{{Commit: "c", Value: "s_nine", Alone: true}},
		{{Commit: "c", Value: "s_one", Alone: true, Merge: true}},
	}

	// The multi-suite line is the widest of them, and it is the one line whose
	// width is held by a list cap rather than by a value cap. So the axis has to
	// reach past that cap: with it gone, ten long names render past the bound
	// and this test is what says so.
	names := make([]string, 200)
	for i := range names {
		names[i] = strings.Repeat("t", MaxValueBytes) + strconv.Itoa(i)
	}

	widest, at := 0, ""

	for _, idLen := range lengths {
		for _, milestoneLen := range lengths {
			for _, valueLen := range lengths {
				for _, twice := range []int{0, 1, 3, 4, 10, len(names)} {
					for _, made := range claims {
						set := demoSet()
						if idLen > 0 {
							set.Slices[0].Proofs[0].ID = strings.Repeat("p", idLen)
							set.Slices[0].Proofs[0].Marker = strings.Repeat("m", idLen)
						}
						if milestoneLen > 0 {
							long := strings.Repeat("m", milestoneLen)
							set.Bets[0].Milestones[0].ID = long
							set.Bets[0].Slices[0].Milestone = long
							set.Bets[0].Slices[1].Milestone = long
							set.Slices[0].Milestone = long
							set.Slices[1].Milestone = long
						}

						h := History{Commits: 2, Claims: made}
						for i := range h.Claims {
							h.Claims[i].Commit = strings.Repeat("c", max(valueLen, 1))
							if valueLen > 0 && h.Claims[i].Value == "s_nine" {
								h.Claims[i].Value = strings.Repeat("v", valueLen)
							}
						}

						run := allPassing()
						run.Twice = names[:twice]

						for _, line := range strings.Split(Render(stamped(Derive(set, h, run))), "\n") {
							if len(line) > maxLineBytes {
								t.Fatalf("a rendered line is %d bytes, over the bound of %d: %q",
									len(line), maxLineBytes, line)
							}
							if len(line) > widest {
								widest = len(line)
								at = fmt.Sprintf("ids %d, milestones %d, values %d, twice %d, claims %d",
									idLen, milestoneLen, valueLen, twice, len(made))
							}
						}
					}
				}
			}
		}
	}

	t.Logf("the widest line the search found is %d bytes, at %s", widest, at)

	// A search that never came near the bound would prove nothing about it.
	if widest < maxLineBytes/2 {
		t.Errorf("the widest line found is %d bytes, and the search never came near the bound of %d",
			widest, maxLineBytes)
	}
}

// One test name answers for one proof, so a name two suites both reported is on
// the render — and it is on the render of a board with nothing else wrong,
// which is when a folded double answer misleads most (F76).
func TestTheRenderSaysWhenOneTestCameFromTwoSuites(t *testing.T) {
	b := Derive(demoSet(), landedAt("s_one", "s_two", "s_three"), allPassing())

	clean := Render(stamped(b))
	if strings.Contains(clean, "more than one suite") {
		t.Fatalf("a board with one suite per name said otherwise:\n%s", clean)
	}

	b.Run.Twice = []string{"TestProof_p_one_it_holds"}

	got := Render(stamped(b))
	for _, want := range []string{"1 test was reported by more than one suite", "TestProof_p_one_it_holds"} {
		if !strings.Contains(got, want) {
			t.Errorf("the render does not carry %q:\n%s", want, got)
		}
	}
}

// A board with nothing on it says so rather than printing an empty table. A
// table with a header and no rows reads as a clean run.
func TestARenderWithNoProofsSaysSo(t *testing.T) {
	got := Render(stamped(Board{}))

	if !strings.Contains(got, "no proof") {
		t.Errorf("an empty board rendered as %q", got)
	}
}
