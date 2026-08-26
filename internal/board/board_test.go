package board

import (
	"strings"
	"testing"

	"github.com/ryannel/groundwork/internal/adapter"
	"github.com/ryannel/groundwork/internal/plan"
)

// demoSet is the plan every derivation test below works from: one bet, two
// milestones, three slices, one proof each.
//
// It is written as a value rather than parsed from files because Derive is the
// pure half of the board — the join, with nothing read from disk. The tests
// that need the real parser build real files instead.
func demoSet() plan.Set {
	return plan.Set{
		Bets: []plan.Bet{{
			ID: "demo_bet",
			Milestones: []plan.Milestone{
				{ID: "m_one", Title: "The first"},
				{ID: "m_two", Title: "The second"},
			},
			Slices: []plan.SliceEntry{
				{ID: "s_one", Milestone: "m_one"},
				{ID: "s_two", Milestone: "m_one"},
				{ID: "s_three", Milestone: "m_two"},
			},
		}},
		Slices: []plan.Slice{
			{ID: "s_one", Bet: "demo_bet", Milestone: "m_one", Proofs: []plan.Proof{
				{ID: "p_one", Marker: "TestProof_p_one_it_holds", Headline: true},
			}},
			{ID: "s_two", Bet: "demo_bet", Milestone: "m_one", Proofs: []plan.Proof{
				{ID: "p_two", Marker: "TestProof_p_two_it_holds"},
			}},
			{ID: "s_three", Bet: "demo_bet", Milestone: "m_two", Proofs: []plan.Proof{
				{ID: "p_three", Marker: "TestProof_p_three_it_holds"},
			}},
		},
	}
}

// landedAt is the history a fixture is at: one plain commit per slice id, each
// carrying that id in its Slice trailer.
func landedAt(ids ...string) History {
	h := History{Commits: len(ids) + 1, Head: "0123456789abcdef"}
	for i, id := range ids {
		h.Claims = append(h.Claims, Claim{
			Commit: strings.Repeat(string(rune('a'+i)), 40), Value: id, Alone: true,
		})
	}

	return h
}

// allPassing is a run in which every proof test of demoSet passed.
func allPassing() Run {
	return Run{Tests: 3, Outcomes: map[string]adapter.Outcome{
		"TestProof_p_one_it_holds":   adapter.Pass,
		"TestProof_p_two_it_holds":   adapter.Pass,
		"TestProof_p_three_it_holds": adapter.Pass,
	}}
}

// rowFor finds one proof's row, so a case can name the proof it is about.
func rowFor(t *testing.T, b Board, proof string) Row {
	t.Helper()

	for _, row := range b.Rows {
		if row.Proof == proof {
			return row
		}
	}

	t.Fatalf("the board holds no row for the proof %q", proof)

	return Row{}
}

// R10, first half: expected state comes from plan position. A proof whose
// milestone still holds unlanded slices is expected red; a proof on a fully
// landed milestone is expected green.
//
// The milestone is the unit, not the slice: a proof of a landed slice on a
// milestone that is still going is still expected red, because the work its
// milestone promises is not finished.
func TestExpectedStateComesFromTheMilestonesPosition(t *testing.T) {
	cases := []struct {
		name   string
		landed []string
		want   map[string]Expected
	}{
		{
			"nothing landed", nil,
			map[string]Expected{"p_one": ExpectRed, "p_two": ExpectRed, "p_three": ExpectRed},
		},
		{
			"one slice of a two-slice milestone", []string{"s_one"},
			map[string]Expected{"p_one": ExpectRed, "p_two": ExpectRed, "p_three": ExpectRed},
		},
		{
			"a whole milestone landed", []string{"s_one", "s_two"},
			map[string]Expected{"p_one": ExpectGreen, "p_two": ExpectGreen, "p_three": ExpectRed},
		},
		{
			"every slice landed", []string{"s_one", "s_two", "s_three"},
			map[string]Expected{"p_one": ExpectGreen, "p_two": ExpectGreen, "p_three": ExpectGreen},
		},
	}

	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			b := Derive(demoSet(), landedAt(c.landed...), allPassing())

			for proof, want := range c.want {
				if got := rowFor(t, b, proof).Expected; got != want {
					t.Errorf("the proof %s is expected %s, want %s", proof, got, want)
				}
			}
		})
	}
}

// The three flag states, and the two directions that are not the same thing.
//
// Green ahead of plan is the plan lagging the work, which happens in every
// slice between the test going green and the commit landing. Red behind the
// plan is work that regressed, and there is no benign reading of it.
func TestTheFlagSaysWhichWayExpectedAndActualDisagree(t *testing.T) {
	cases := []struct {
		name    string
		landed  []string
		outcome adapter.Outcome
		want    Flag
		actual  Actual
	}{
		{"expected red and red", nil, adapter.Fail, OnPlan, Failed},
		{"expected red and green", nil, adapter.Pass, Ahead, Passed},
		{"expected green and green", []string{"s_one", "s_two"}, adapter.Pass, OnPlan, Passed},
		{"expected green and red", []string{"s_one", "s_two"}, adapter.Fail, Behind, Failed},
		{"expected green and skipped", []string{"s_one", "s_two"}, adapter.Skip, Behind, Skipped},
	}

	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			run := allPassing()
			run.Outcomes["TestProof_p_one_it_holds"] = c.outcome

			row := rowFor(t, Derive(demoSet(), landedAt(c.landed...), run), "p_one")
			if row.Flag != c.want {
				t.Errorf("the proof is flagged %q, want %q", row.Flag, c.want)
			}
			if row.Actual != c.actual {
				t.Errorf("the proof's actual state is %q, want %q", row.Actual, c.actual)
			}
		})
	}
}

// A proof whose test no run reported never ran. It is not green, and the board
// says which of the not-green things it is, because slice 5's stub check judges
// the reds and cannot judge what it cannot tell apart.
func TestAProofNoRunReportedNeverRan(t *testing.T) {
	run := allPassing()
	delete(run.Outcomes, "TestProof_p_one_it_holds")

	row := rowFor(t, Derive(demoSet(), landedAt("s_one", "s_two"), run), "p_one")
	if row.Actual != NeverRan {
		t.Errorf("a proof with no result is %q, want %q", row.Actual, NeverRan)
	}
	if row.Flag != Behind {
		t.Errorf("a landed proof that never ran is flagged %q, want %q", row.Flag, Behind)
	}
}

// The seam's outcome vocabulary is closed to three, and nothing the shipped
// adapters return reaches the fourth case. A caller holding a hand-built run
// can, though, and an outcome the board cannot read is not a pass — so the
// branch is pinned rather than left as a guard nothing proves (F79).
func TestAnOutcomeTheSeamDoesNotNameIsNotAPass(t *testing.T) {
	run := allPassing()
	run.Outcomes["TestProof_p_one_it_holds"] = adapter.Outcome("inconclusive")

	row := rowFor(t, Derive(demoSet(), landedAt("s_one", "s_two"), run), "p_one")
	if row.Actual != Failed {
		t.Errorf("an outcome the board cannot read reads %q, want %q", row.Actual, Failed)
	}
	if row.Flag != Behind {
		t.Errorf("a landed proof the board cannot read is flagged %q, want %q", row.Flag, Behind)
	}
}

// TestProof_b3s4_marker_the_proof_id_is_spelled_once is R9 and D28's one
// spelling: the proof id is spelled inside the test name, so the plan file and
// the test carry one spelling of it and nothing can drift.
//
// Both halves are proved through the real parser and the real derivation. The
// plan side refuses a marker that does not carry the id. The run side joins a
// result to a proof on the whole marker, so a test whose name merely opens with
// another proof's marker prefix never lands on that proof — which is the trap
// the contract page names, where one result would land in two places.
func TestProof_b3s4_marker_the_proof_id_is_spelled_once(t *testing.T) {
	t.Run("the plan refuses a marker that does not spell the id", func(t *testing.T) {
		raw := "---\nid: s_one\nbet: demo_bet\nmilestone: m_one\nproofs:\n" +
			"  - id: p_one\n    marker: TestProof_p_other_it_holds\n" +
			"    from: docs/design.md#one\n    headline: true\n    retire_at_close: false\n" +
			"fixtures: []\nreal: []\nfaked: []\n---\n"

		_, err := plan.ParseSlice("docs/plan/demo/demo_bet/s_one.md", []byte(raw))
		if err == nil {
			t.Fatal("a marker that does not spell the proof id was accepted")
		}
		if !strings.Contains(err.Error(), "TestProof_p_one_") {
			t.Errorf("the refusal is %q, and it does not say what the marker had to be", err)
		}
	})

	t.Run("a near-miss test name never lands on the proof", func(t *testing.T) {
		run := Run{Tests: 2, Outcomes: map[string]adapter.Outcome{
			// The marker with more words after it, and the marker of a proof
			// whose id opens with this one's. Neither is this proof's test.
			"TestProof_p_one_it_holds_and_then_some": adapter.Pass,
			"TestProof_p_one_two_it_holds":           adapter.Pass,
		}}

		row := rowFor(t, Derive(demoSet(), landedAt("s_one", "s_two"), run), "p_one")
		if row.Actual != NeverRan {
			t.Errorf("a near-miss name landed on the proof: it reads %q", row.Actual)
		}
	})

	t.Run("the id spelled the same way joins the two", func(t *testing.T) {
		run := Run{Tests: 1, Outcomes: map[string]adapter.Outcome{
			"TestProof_p_one_it_holds": adapter.Pass,
		}}

		row := rowFor(t, Derive(demoSet(), landedAt("s_one", "s_two"), run), "p_one")
		if row.Actual != Passed {
			t.Errorf("the marker did not join the plan to the run: it reads %q", row.Actual)
		}
		if !strings.HasPrefix(row.Marker, plan.MarkerPrefix+row.Proof+"_") {
			t.Errorf("the marker %q does not open with the proof id %q", row.Marker, row.Proof)
		}
	})
}

// A trailer the board cannot read as landed-ness lands nothing, and it is
// named. Every one of these is a misstatement in the input the board reads
// landed-ness from, so the board never quietly believes it and never quietly
// throws it away.
func TestATrailerTheBoardCannotReadLandsNothingAndIsNamed(t *testing.T) {
	cases := []struct {
		name  string
		claim Claim
		why   string
	}{
		{
			"a value outside the id charset",
			Claim{Commit: "aaaa", Value: "S-ONE", Alone: true},
			"not a lowercase letter",
		},
		{
			"a value naming no slice the plan declares",
			Claim{Commit: "bbbb", Value: "s_four", Alone: true},
			"names no slice",
		},
		{
			"an empty value",
			Claim{Commit: "cccc", Value: "", Alone: true},
			"nothing after its colon",
		},
		{
			"one of two trailers on one commit",
			Claim{Commit: "dddd", Value: "s_one", Alone: false},
			"one slice is one commit",
		},
	}

	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			b := Derive(demoSet(), History{Claims: []Claim{c.claim}, Commits: 2}, allPassing())

			if len(b.Landed) != 0 {
				t.Errorf("the board landed %v from a trailer it cannot read", b.Landed)
			}
			if len(b.Wrong) != 1 {
				t.Fatalf("the board named %d wrong trailers, want 1", len(b.Wrong))
			}
			if !strings.Contains(b.Wrong[0].Why, c.why) {
				t.Errorf("the board said %q, and it does not say %q", b.Wrong[0].Why, c.why)
			}
			if b.Wrong[0].Commit != c.claim.Commit {
				t.Errorf("the board named the commit %q, want %q", b.Wrong[0].Commit, c.claim.Commit)
			}
		})
	}
}

// D38 and D40's precedent: merges never govern. A merge commit is not a
// slice's commit — one slice is one commit — so a Slice trailer on one is not
// read. It is counted and named rather than refused, because it misstates
// nothing about the id space: it is a claim in a place the board does not read.
func TestATrailerOnAMergeCommitIsNotReadAndIsNamed(t *testing.T) {
	h := History{Commits: 2, Claims: []Claim{
		{Commit: "eeee", Value: "s_one", Merge: true, Alone: true},
	}}

	b := Derive(demoSet(), h, allPassing())

	if len(b.Landed) != 0 {
		t.Errorf("a merge commit landed %v", b.Landed)
	}
	if len(b.Wrong) != 0 {
		t.Errorf("a merge commit's trailer was called wrong: %v", b.Wrong)
	}
	if len(b.Unread) != 1 {
		t.Fatalf("the board named %d unread trailers, want 1", len(b.Unread))
	}
	if !strings.Contains(b.Unread[0].Why, "merge") {
		t.Errorf("the board said %q, and it does not say why", b.Unread[0].Why)
	}
}

// One slice is one commit, so two commits claiming one slice is worth saying.
// The slice is landed either way: the claim is not in doubt, only how many
// commits made it.
//
// D57 ruling 4 fixes which of the two is which. History lands a thing once and
// what comes after is commentary, so the oldest claim is the landing and every
// newer claim is a stray — and the stray is the one named. Crediting the newest
// claim would name the real landing commit as the duplicate and send whoever
// chased it to the wrong commit (F78).
func TestASliceClaimedByTwoCommitsLandsOnceAndTheStrayIsNamed(t *testing.T) {
	// Newest first, the way git hands them back.
	h := History{Commits: 3, Claims: []Claim{
		{Commit: "the_newer_commit", Value: "s_one", Alone: true},
		{Commit: "the_older_commit", Value: "s_one", Alone: true},
	}}

	b := Derive(demoSet(), h, allPassing())

	if len(b.Landed) != 1 || b.Landed[0] != "s_one" {
		t.Errorf("the board landed %v, want just s_one", b.Landed)
	}
	if len(b.Wrong) != 0 {
		t.Errorf("a slice claimed twice was called a misstatement: %v", b.Wrong)
	}
	if len(b.Unread) != 1 {
		t.Fatalf("the board named %d unread trailers, want 1", len(b.Unread))
	}
	if b.Unread[0].Commit != "the_newer_commit" {
		t.Errorf("the board named %q as the stray, and the landing is the oldest claim",
			b.Unread[0].Commit)
	}
	if !strings.Contains(b.Unread[0].Why, "earlier commit already landed") {
		t.Errorf("the board said %q, and it does not say which commit landed it", b.Unread[0].Why)
	}
}

// Ahead and Behind are what the row counts, so they are read off the board
// rather than counted twice (D54).
func TestTheBoardCountsWhatIsAheadAndWhatIsBehind(t *testing.T) {
	run := allPassing()
	run.Outcomes["TestProof_p_one_it_holds"] = adapter.Fail

	b := Derive(demoSet(), landedAt("s_one", "s_two"), run)

	if got := len(b.Ahead()); got != 1 {
		t.Errorf("the board counts %d proofs ahead of plan, want 1", got)
	}
	if got := len(b.Behind()); got != 1 {
		t.Errorf("the board counts %d proofs behind plan, want 1", got)
	}
}

// D49 ruling 2: every value the board takes off a commit trailer is somebody
// else's text. A trailer carrying a newline and tabs would otherwise draw a row
// of its own wherever the board is printed.
func TestATrailerValueIsMadeSafeBeforeItIsNamed(t *testing.T) {
	h := History{Commits: 2, Claims: []Claim{
		{Commit: "aaaa\nbbbb", Value: "s_one\tboard\tgreen\tit holds", Alone: true},
	}}

	b := Derive(demoSet(), h, allPassing())

	if len(b.Wrong) != 1 {
		t.Fatalf("the board named %d wrong trailers, want 1", len(b.Wrong))
	}
	for _, said := range []string{b.Wrong[0].Value, b.Wrong[0].Commit} {
		if strings.ContainsAny(said, "\n\t") {
			t.Errorf("the board holds %q, and a table would draw a second row from it", said)
		}
	}
}

// The rows come out in the plan's own order: milestone by milestone, slice by
// slice, proof by proof. A board whose order moved between runs would be a
// board nobody could read twice.
func TestTheRowsFollowThePlansOwnOrder(t *testing.T) {
	b := Derive(demoSet(), landedAt(), allPassing())

	var got []string
	for _, row := range b.Rows {
		got = append(got, row.Proof)
	}

	want := []string{"p_one", "p_two", "p_three"}
	if strings.Join(got, ",") != strings.Join(want, ",") {
		t.Errorf("the rows came out %v, want %v", got, want)
	}
}
