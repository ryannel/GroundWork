package board

import (
	"fmt"
	"regexp"
	"slices"
	"strings"
	"testing"
	"time"

	"github.com/ryannel/groundwork/internal/adapter"
	"github.com/ryannel/groundwork/internal/plan"
)

// The pattern selects exactly the tests the plan's proofs name, and nothing
// else. That is what the marker is for: -run filters names, so the board runs
// the proofs rather than the whole suite, and no other test's result can reach
// it.
func TestThePatternSelectsExactlyTheMarkersThePlanNames(t *testing.T) {
	got := Pattern(demoSet())
	if got == "" {
		t.Fatal("a plan with proofs produced no pattern")
	}

	re, err := regexp.Compile(got)
	if err != nil {
		t.Fatalf("the pattern %q does not compile: %v", got, err)
	}

	for _, want := range []string{
		"TestProof_p_one_it_holds", "TestProof_p_two_it_holds", "TestProof_p_three_it_holds",
	} {
		if !re.MatchString(want) {
			t.Errorf("the pattern %q does not select %q", got, want)
		}
	}
	for _, wrong := range []string{
		"TestProof_p_one_it_holds_and_more", "TestSomethingElse", "TestProof_p_four_it_holds",
	} {
		if re.MatchString(wrong) {
			t.Errorf("the pattern %q selects %q, which no proof names", got, wrong)
		}
	}
}

// A plan with no proof in it selects nothing. An empty pattern would select
// everything, and a board built from every test in the repo is not a board.
func TestThePatternIsEmptyWhenThePlanNamesNoProof(t *testing.T) {
	if got := Pattern(plan.Set{}); got != "" {
		t.Errorf("a plan with no proofs produced the pattern %q", got)
	}
}

// A marker is a Go test name and cannot hold a regexp character, but the
// pattern is built from a file somebody else wrote. Quoting it costs one call
// and means a plan can never reach into the pattern it is selected by.
func TestThePatternQuotesWhatItIsGiven(t *testing.T) {
	set := demoSet()
	set.Slices[0].Proofs[0].Marker = "TestProof_p_one_.*"

	re, err := regexp.Compile(Pattern(set))
	if err != nil {
		t.Fatalf("the pattern does not compile: %v", err)
	}
	if re.MatchString("TestProof_p_one_it_holds") {
		t.Error("a marker holding a regexp reached into the pattern")
	}
	if !re.MatchString("TestProof_p_one_.*") {
		t.Error("the quoted marker does not select its own literal name")
	}
}

// A plan large enough to make the pattern longer than a command line can hold
// falls back to the marker prefix. Selecting a few tests too many is a board
// with extra results in it; a run that could not start is no board at all.
func TestThePatternFallsBackWhenThePlanIsEnormous(t *testing.T) {
	set := plan.Set{Bets: []plan.Bet{{ID: "b"}}}
	slice := plan.Slice{ID: "s", Bet: "b"}
	for i := range 4000 {
		// Every id different. Ids that repeated would be folded into one marker,
		// and the pattern would never grow past the cap this case is about.
		id := fmt.Sprintf("p%s%d", strings.Repeat("x", 20), i)
		slice.Proofs = append(slice.Proofs, plan.Proof{
			ID: id, Marker: plan.MarkerPrefix + id + "_" + strings.Repeat("y", 30),
		})
	}
	set.Slices = []plan.Slice{slice}

	got := Pattern(set)
	if len(got) > maxPatternBytes {
		t.Fatalf("the pattern is %d bytes, over the cap of %d", len(got), maxPatternBytes)
	}

	re, err := regexp.Compile(got)
	if err != nil {
		t.Fatalf("the fallback pattern %q does not compile: %v", got, err)
	}
	if !re.MatchString(slice.Proofs[0].Marker) {
		t.Errorf("the fallback pattern %q does not select the plan's own markers", got)
	}
	if re.MatchString("TestSomethingElse") {
		t.Errorf("the fallback pattern %q selects a test that is not a proof", got)
	}
}

// The cap has two sides, and the one that must not fire is the one worth
// pinning: a plan that fits, however large, is selected exactly (F79). A
// boundary drawn one marker too tight would quietly widen the run for every
// big plan and nobody would see it.
func TestAPlanJustInsideTheCapDoesNotFallBack(t *testing.T) {
	set := plan.Set{Bets: []plan.Bet{{ID: "b"}}}
	slice := plan.Slice{ID: "s", Bet: "b"}

	// Markers added one at a time until one more tips the cap. Over the cap
	// Pattern returns the fallback, which is how the tipping point is seen: its
	// own length says nothing, because the fallback is short.
	fallback := "^" + regexp.QuoteMeta(plan.MarkerPrefix)

	for i := 0; i < 1000; i++ {
		id := fmt.Sprintf("p%s%d", strings.Repeat("x", 20), i)
		next := append(slices.Clone(slice.Proofs), plan.Proof{
			ID: id, Marker: plan.MarkerPrefix + id + "_" + strings.Repeat("y", 30),
		})

		set.Slices = []plan.Slice{{ID: "s", Bet: "b", Proofs: next}}
		if Pattern(set) == fallback {
			break
		}
		slice.Proofs = next
	}
	if len(slice.Proofs) == 0 {
		t.Fatal("the case built no marker at all")
	}

	set.Slices = []plan.Slice{slice}

	got := Pattern(set)
	if len(got) > maxPatternBytes {
		t.Fatalf("the case built a pattern of %d bytes, over the cap of %d", len(got), maxPatternBytes)
	}
	if len(got) < maxPatternBytes-100 {
		t.Fatalf("the case built a pattern of %d bytes, which is not the boundary", len(got))
	}
	if got == fallback {
		t.Fatalf("a plan of %d bytes fell back, and it fits", len(got))
	}

	re, err := regexp.Compile(got)
	if err != nil {
		t.Fatalf("the pattern does not compile: %v", err)
	}
	if re.MatchString(slice.Proofs[0].Marker + "_and_more") {
		t.Error("the boundary pattern selects a name no proof declares")
	}
	for _, proof := range slice.Proofs {
		if !re.MatchString(proof.Marker) {
			t.Fatalf("the boundary pattern does not select %q", proof.Marker)
		}
	}
}

// The run is read off the adapter's own log. Nothing here decides what a test
// is or how it came out: those are the seam's answers, and a second copy of
// them would drift (D54).
func TestTheRunIsReadOffTheAdaptersOwnLog(t *testing.T) {
	run := ReadRun([]adapter.RunLog{{
		Duration: 3 * time.Second,
		Tests: []adapter.TestRun{
			{Suite: "alpha", Name: "TestProof_p_one_it_holds", Outcome: adapter.Pass},
			{Suite: "alpha", Name: "TestProof_p_two_it_holds", Outcome: adapter.Fail},
			{Suite: "alpha", Name: "TestProof_p_three_it_holds", Outcome: adapter.Skip},
		},
	}})

	if run.Tests != 3 {
		t.Errorf("the run holds %d tests, want 3", run.Tests)
	}
	if run.Took != 3*time.Second {
		t.Errorf("the run took %s, want 3s", run.Took)
	}
	for name, want := range map[string]adapter.Outcome{
		"TestProof_p_one_it_holds":   adapter.Pass,
		"TestProof_p_two_it_holds":   adapter.Fail,
		"TestProof_p_three_it_holds": adapter.Skip,
	} {
		if got := run.Outcomes[name]; got != want {
			t.Errorf("the test %s came out %q, want %q", name, got, want)
		}
	}
}

// One test name answers for one proof, so a name two suites both report is a
// thing the reader has to see. The result kept is the worst of them: a proof
// that failed anywhere has failed.
func TestOneNameReportedByTwoSuitesIsNamedAndTakenAtItsWorst(t *testing.T) {
	run := ReadRun([]adapter.RunLog{{
		Duration: time.Second,
		Tests: []adapter.TestRun{
			{Suite: "alpha", Name: "TestProof_p_one_it_holds", Outcome: adapter.Pass},
			{Suite: "beta", Name: "TestProof_p_one_it_holds", Outcome: adapter.Fail},
		},
	}})

	if got := run.Outcomes["TestProof_p_one_it_holds"]; got != adapter.Fail {
		t.Errorf("the folded result is %q, want %q", got, adapter.Fail)
	}
	if len(run.Twice) != 1 || run.Twice[0] != "TestProof_p_one_it_holds" {
		t.Errorf("the run named %v as reported twice, want the one name", run.Twice)
	}
	if run.Tests != 1 {
		t.Errorf("the run counts %d tests, want 1: two reports of one name is one test", run.Tests)
	}
}

// Several surfaces make one run. The durations add up, because the board's
// stamp says what the whole run cost.
func TestSeveralSurfacesMakeOneRun(t *testing.T) {
	run := ReadRun([]adapter.RunLog{
		{Duration: time.Second, Tests: []adapter.TestRun{
			{Suite: "alpha", Name: "TestProof_p_one_it_holds", Outcome: adapter.Pass},
		}},
		{Duration: 2 * time.Second, Tests: []adapter.TestRun{
			{Suite: "beta", Name: "TestProof_p_two_it_holds", Outcome: adapter.Pass},
		}},
	})

	if run.Tests != 2 {
		t.Errorf("the run holds %d tests, want 2", run.Tests)
	}
	if run.Took != 3*time.Second {
		t.Errorf("the run took %s, want 3s", run.Took)
	}
}

// The worst of two outcomes is the adapter's own rule, called rather than
// copied. A parent whose subtest failed has failed, and a proof two suites
// disagree about has failed, and both are the same sentence.
func TestTheWorstOfTwoOutcomesIsTheAdaptersOwnRule(t *testing.T) {
	cases := []struct {
		a, b, want adapter.Outcome
	}{
		{adapter.Pass, adapter.Fail, adapter.Fail},
		{adapter.Fail, adapter.Pass, adapter.Fail},
		{adapter.Pass, adapter.Skip, adapter.Pass},
		{adapter.Skip, adapter.Skip, adapter.Skip},
	}

	for _, c := range cases {
		if got := adapter.Worse(c.a, c.b); got != c.want {
			t.Errorf("the worse of %q and %q is %q, want %q", c.a, c.b, got, c.want)
		}
	}
}
