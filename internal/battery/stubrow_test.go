package battery

import (
	"fmt"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"testing"

	"github.com/ryannel/groundwork/internal/adapter"
	"github.com/ryannel/groundwork/internal/board"
	"github.com/ryannel/groundwork/internal/journal"
)

// The stub check judges the proofs a plan expects red. Every fixture below is a
// whole repo: the plan is files, the landed set is commits, and the run is a
// real run of the fixture's own tests.
//
// These cases are openly authored. The sealed fixtures grade this slice in
// slice 8, and nobody building the check has seen them.

// stubProof is one proof a fixture carries: its id, the body its test is
// written with, and whether the test is written at all.
type stubProof struct {
	id string

	// body is the test function's body, tabs and newlines included. An empty
	// body is one of the three stub styles, so it is spelled by leaving this
	// empty rather than by leaving the test out.
	body string

	// unwritten leaves the test out of the suite altogether, which is the state
	// of every proof whose slice nobody has built yet.
	unwritten bool
}

// stubSlice is one slice a fixture's plan declares.
type stubSlice struct {
	id        string
	milestone string
	landed    bool
	proofs    []stubProof
}

const (
	// honestRed fails at a real assertion. It is the good red, and one sits
	// beside every planted shape below.
	honestRed = "\tt.Fatal(\"this proof is not green yet\")\n"

	// honestGreen passes because the code it tests works.
	honestGreen = "\tif AddsUp(1, 1) != 2 {\n\t\tt.Fatal(\"arithmetic broke\")\n\t}\n"

	// The three stub styles the ladder names. Each one passes when the plan
	// says it must fail, and the honesty scan has its own words for each.
	stubEmptyBody    = ""
	stubCommentedOut = "\tgot := AddsUp(1, 1)\n\t_ = got\n\t// if got != 2 {\n\t// \tt.Fatal(\"got the wrong answer\")\n\t// }\n"
	stubAlwaysTrue   = "\tgot := AddsUp(1, 1)\n\tif got != got {\n\t\tt.Fatal(\"got the wrong answer\")\n\t}\n"

	// The other three ways a proof is not red for the right reason.
	stubSkips        = "\tt.Skip(\"later\")\n"
	stubWillNotBuild = "\tt.Fatal(theAnswerNobodyDeclared)\n"
	stubDiesEarly    = "\tpanic(\"this proof died before its assertion\")\n"
)

// The scan's own words for each of the three styles. The row prints them whole,
// so each case below can be pinned to the one it belongs to (F87).
const (
	saysEmptyBody    = "asserts nothing"
	saysCommentedOut = "asserts nothing: the only assertion is commented out"
	saysAlwaysTrue   = "only asserts under a condition that compares a value to itself"
)

const stubProgram = `---
id: demo
title: A demo program
goal: To prove the stub check judges the reds
done: Every proof the plan expects red fails at an assertion
ladder:
  - id: demo_bet
    line: The one bet
    proof_sketch: The reds are honest
---

The program.
`

// stubBet is the bet file, with its milestones and its slices filled in.
const stubBet = `---
id: demo_bet
title: The one bet
program: demo
design:
  - docs/design.md
milestones:
%s
slices:
%s
---

The bet.
`

// stubSlicePlan is one slice's proof plan, with its proofs filled in.
const stubSlicePlan = `---
id: %s
bet: demo_bet
milestone: %s
proofs:
%s
fixtures: []
real: []
faked: []
---

The slice.
`

// stubRepo makes a fixture repo carrying the plan these slices describe, a Go
// module whose tests carry the proof markers, and one commit per landed slice.
//
// also runs after the files are written and before the first commit, so a case
// can add a second suite, a second surface or a manifest of its own without a
// second copy of everything above.
func stubRepo(t *testing.T, slices []stubSlice, also ...func(*testing.T, string)) string {
	t.Helper()

	dir := newRepo(t)
	writeManifest(t, dir, goCLISurface)
	writeSource(t, dir, "go.mod", "module groundwork.test/stub\n\ngo 1.24\n")
	writeSource(t, dir, "docs/design.md", "# The design\n\n## one\n\nThe shape.\n")
	writeSource(t, dir, "docs/plan/demo/program.md", stubProgram)
	writeSource(t, dir, "alpha/alpha.go", "package alpha\n\nfunc AddsUp(a, b int) int { return a + b }\n")

	var milestones, entries, suite strings.Builder
	suite.WriteString("package alpha\n\nimport \"testing\"\n")

	seen := map[string]bool{}
	for _, s := range slices {
		if !seen[s.milestone] {
			seen[s.milestone] = true
			fmt.Fprintf(&milestones, "  - id: %s\n    title: The milestone %s\n", s.milestone, s.milestone)
		}
		fmt.Fprintf(&entries, "  - id: %s\n    milestone: %s\n", s.id, s.milestone)

		var proofs strings.Builder
		for _, p := range s.proofs {
			fmt.Fprintf(&proofs, "  - id: %s\n    marker: %s\n"+
				"    from: docs/design.md#one\n    headline: true\n    retire_at_close: false\n",
				p.id, stubMarker(p.id))
			if !p.unwritten {
				fmt.Fprintf(&suite, "\nfunc %s(t *testing.T) {\n%s}\n", stubMarker(p.id), p.body)
			}
		}
		writeSource(t, dir, "docs/plan/demo/demo_bet/"+s.id+".md",
			fmt.Sprintf(stubSlicePlan, s.id, s.milestone, proofs.String()))
	}

	writeSource(t, dir, "docs/plan/demo/demo_bet/bet.md",
		fmt.Sprintf(stubBet, milestones.String(), entries.String()))
	writeSource(t, dir, "alpha/alpha_test.go", suite.String())

	for _, one := range also {
		one(t, dir)
	}

	runGit(t, dir, "add", "-A")
	runGit(t, dir, "commit", "-m", "the plan and the proofs")

	for _, s := range slices {
		if !s.landed {
			continue
		}
		writeSource(t, dir, "landed/"+s.id+".txt", s.id+"\n")
		runGit(t, dir, "add", "-A")
		runGit(t, dir, "commit", "-m", "land "+s.id+"\n\nBet: demo\nSlice: "+s.id+"\nTests: the proof")
	}

	return dir
}

// stubMarker is the test name one proof id gets, spelled the one way R9 asks
// for.
func stubMarker(proof string) string {
	return "TestProof_" + proof + "_it_holds"
}

// oneSlice is the plan most cases below carry: one slice on one milestone,
// nothing landed, so every proof it names is expected red.
func oneSlice(proofs ...stubProof) []stubSlice {
	return []stubSlice{{id: "s_one", milestone: "m_one", proofs: proofs}}
}

// runStub runs the registered stub row against dir with the recursion guard
// cleared. The row runs the fixture's own proofs, so these tests have to be the
// ones doing the running.
func runStub(t *testing.T, dir string) Result {
	t.Helper()
	t.Setenv(adapter.RunGuardEnv, "")

	return runRow(t, dir, "stub")
}

func TestTheStubRowIsRegistered(t *testing.T) {
	registered(t, "stub", "stub")
}

// TestProof_b3s5_stub_a_proof_expected_red_must_fail_at_an_assertion is R10's
// second half, driven through the real row against whole repos.
//
// A proof its plan expects red has to fail at a real assertion. Passing,
// skipping, failing to build and dying before the assertion each fail the row,
// with the reason named. An honest red sits beside every planted shape, so each
// case proves the row tells the two apart rather than reddening on the lot.
func TestProof_b3s5_stub_a_proof_expected_red_must_fail_at_an_assertion(t *testing.T) {
	// The good red, and the row's quiet. Two proofs the plan expects red, both
	// failing at a real assertion, and nothing for the row to say.
	t.Run("an honest red is red for the right reason", func(t *testing.T) {
		dir := stubRepo(t, oneSlice(
			stubProof{id: "p_honest", body: honestRed},
			stubProof{id: "p_twin", body: honestRed},
		))

		res := runStub(t, dir)
		if res.Outcome != Green {
			t.Fatalf("two honest reds came out %s: %s", res.Outcome, res.Evidence)
		}
		mustFit(t, res.Evidence, "2 proofs expected red", "2 red at an assertion", "0 not")

		// D33: the counts lead, because the line is cut from the end.
		if !strings.HasPrefix(res.Evidence, "2 proofs expected red") {
			t.Errorf("the line is %q, and it does not open with the counts", res.Evidence)
		}
		// A row's evidence is read on a machine that is not the one that wrote
		// it, so a temporary directory on it says nothing to the reader.
		if strings.Contains(res.Evidence, dir) || strings.Contains(res.Evidence, os.TempDir()) {
			t.Errorf("the row said %q, and it carries a path from the machine it ran on", res.Evidence)
		}
	})

	// The ladder's three styles, one fixture each, so the line has room to carry
	// the whole hit and each style's own reason can be pinned by name.
	//
	// F87: these used to run in one fixture, where two of the three hits never
	// fit and the case accepted "and 2 more". That made the count the only thing
	// asserted, and the distinct reasons the row genuinely prints went unchecked.
	for _, c := range []struct {
		name string
		body string
		says string
	}{
		{"an empty body", stubEmptyBody, saysEmptyBody},
		{"a commented-out assertion", stubCommentedOut, saysCommentedOut},
		{"an always-true assertion", stubAlwaysTrue, saysAlwaysTrue},
	} {
		t.Run(c.name+" passes and fails the row with its own reason named", func(t *testing.T) {
			dir := stubRepo(t, oneSlice(
				stubProof{id: "p_planted", body: c.body},
				stubProof{id: "p_twin", body: honestRed},
			))

			res := runStub(t, dir)
			if res.Outcome != Red {
				t.Fatalf("%s came out %s: %s", c.name, res.Outcome, res.Evidence)
			}

			// The whole hit, named and reasoned, on the line itself.
			mustFit(t, res.Evidence, "2 proofs expected red", "1 red at an assertion", "1 not",
				"p_planted", "passed", c.says)

			if strings.Contains(res.Evidence, "p_twin") {
				t.Errorf("the row said %q, and it blamed the honest twin", res.Evidence)
			}
			if strings.Contains(res.Evidence, "more") {
				t.Errorf("the row said %q, and a hit it could not fit went unnamed", res.Evidence)
			}
		})
	}

	// All three at once. Only the count is asserted here, because one line does
	// not hold three whole hits — which is why each style has its own case above.
	t.Run("three planted styles are all counted", func(t *testing.T) {
		dir := stubRepo(t, oneSlice(
			stubProof{id: "p_empty", body: stubEmptyBody},
			stubProof{id: "p_commented", body: stubCommentedOut},
			stubProof{id: "p_always", body: stubAlwaysTrue},
			stubProof{id: "p_twin", body: honestRed},
		))

		res := runStub(t, dir)
		if res.Outcome != Red {
			t.Fatalf("three planted stubs came out %s: %s", res.Outcome, res.Evidence)
		}
		mustFit(t, res.Evidence, "4 proofs expected red", "1 red at an assertion", "3 not")
	})

	// A skipped test proves nothing, whatever its plan expects of it.
	t.Run("a proof that skips fails the row", func(t *testing.T) {
		dir := stubRepo(t, oneSlice(
			stubProof{id: "p_skips", body: stubSkips},
			stubProof{id: "p_twin", body: honestRed},
		))

		res := runStub(t, dir)
		if res.Outcome != Red {
			t.Fatalf("a proof that skips came out %s: %s", res.Outcome, res.Evidence)
		}
		mustFit(t, res.Evidence, "1 not", "p_skips", "skipped")
	})

	// A proof that cannot compile proves nothing. The stack reports a build
	// failure for the whole surface rather than for one test, so the row names
	// the surface and what the build said.
	t.Run("a proof that fails to build fails the row", func(t *testing.T) {
		dir := stubRepo(t, oneSlice(
			stubProof{id: "p_broken", body: stubWillNotBuild},
			stubProof{id: "p_twin", body: honestRed},
		))

		res := runStub(t, dir)
		if res.Outcome != Red {
			t.Fatalf("a proof that does not build came out %s: %s", res.Outcome, res.Evidence)
		}

		// The row's own reason is the hit, and the stack's own complaint rides
		// the clause beside it — the end of it, which is where a compiler puts
		// the thing a reader has to fix.
		mustFit(t, res.Evidence, "2 proofs expected red", "cli", "did not build",
			"said:", "theAnswerNobodyDeclared")
	})

	// A test binary that died never reached anybody's assertion. Same shape as
	// the build failure: the stack loses the whole run, so the surface is what
	// gets named.
	t.Run("a proof that dies before its assertion fails the row", func(t *testing.T) {
		dir := stubRepo(t, oneSlice(
			stubProof{id: "p_dies", body: stubDiesEarly},
			stubProof{id: "p_twin", body: honestRed},
		))

		res := runStub(t, dir)
		if res.Outcome != Red {
			t.Fatalf("a proof that died came out %s: %s", res.Outcome, res.Evidence)
		}
		mustFit(t, res.Evidence, "2 proofs expected red", "cli", "died")
	})

	// F89: a broken surface never hides the stubs on the surfaces that ran. The
	// row names both, and the counts still lead.
	t.Run("a broken surface is named beside the stub it did not hide", func(t *testing.T) {
		dir := stubRepo(t, oneSlice(
			stubProof{id: "p_planted", body: stubEmptyBody},
			stubProof{id: "p_twin", body: honestRed},
		), withBrokenSideSurface)

		res := runStub(t, dir)
		if res.Outcome != Red {
			t.Fatalf("a stub beside a broken surface came out %s: %s", res.Outcome, res.Evidence)
		}
		mustFit(t, res.Evidence, "2 proofs expected red", "1 not", "side", "did not build", "p_planted")

		if !strings.HasPrefix(res.Evidence, "2 proofs expected red") {
			t.Errorf("the line is %q, and it does not open with the counts", res.Evidence)
		}
	})
}

// twoSurfaces declares a second Go surface beside the first, each its own
// module, so a run can reach one and break on the other.
const twoSurfaces = `{
  "schema": 1,
  "surfaces": [
    {"name": "cli", "profile": "cli", "stack": "go", "root": "."},
    {"name": "side", "profile": "cli", "stack": "go", "root": "side"}
  ],
  "capabilities": [
    {"name": "adding", "surface": "cli", "proof": ["alpha"]},
    {"name": "siding", "surface": "side", "proof": ["beta"]}
  ]
}`

// withBrokenSideSurface adds a second surface whose own package does not build.
func withBrokenSideSurface(t *testing.T, dir string) {
	t.Helper()

	writeManifest(t, dir, twoSurfaces)
	writeSource(t, dir, "side/go.mod", "module groundwork.test/side\n\ngo 1.24\n")
	writeSource(t, dir, "side/beta/beta_test.go",
		"package beta\n\nimport \"testing\"\n\n"+
			"func TestSideHolds(t *testing.T) {\n\tt.Fatal(theAnswerNobodyDeclared)\n}\n")
}

// D56 ruling 1, held to here: expected-red-actually-green is the plan lagging
// the work, and it is counted and never red. A test that can fail and does not
// is the ordinary state of every slice between its test going green and its
// commit landing.
//
// This is the case the stub check would otherwise fire on for every repo in
// flight, including this one.
//
// The count is in the head, where no cut reaches it. The proofs themselves are
// named by the board row, which is the row whose subject they are; naming them
// twice would print one list under two headings and leave a reader looking for
// the difference.
func TestStubRowCountsGreenAheadOfPlanAndIsNotRedForIt(t *testing.T) {
	dir := stubRepo(t, oneSlice(
		stubProof{id: "p_done", body: honestGreen},
		stubProof{id: "p_twin", body: honestRed},
	))

	res := runStub(t, dir)
	if res.Outcome != Green {
		t.Fatalf("a proof green ahead of its plan came out %s: %s", res.Outcome, res.Evidence)
	}
	mustFit(t, res.Evidence, "2 proofs expected red", "1 red at an assertion", "0 not", "1 ahead of plan")
}

// F83, F86 and F87: the row's reach is the honesty scan's reach, and the line
// has to say so rather than claim the repo holds no stub.
//
// Seven tests that pass while nothing in them can ever fail, each written the
// way the scan is documented to miss: constant conditions it does not judge, a
// helper in another file it will not follow, a handle handed to something it
// cannot see. All seven read as green ahead of plan, the row stays green, and
// the sentence it prints claims only what the scan found.
func TestStubRowReadsAScanEscapingStubAsAheadOfPlan(t *testing.T) {
	escapes := []string{
		"\tif false {\n\t\tt.Fatal(\"never\")\n\t}\n",
		"\tif 1 == 2 {\n\t\tt.Fatal(\"never\")\n\t}\n",
		"\tif 2 < 1 {\n\t\tt.Fatal(\"never\")\n\t}\n",
		"\tif len(\"\") > 0 {\n\t\tt.Fatal(\"never\")\n\t}\n",
		"\tswitch {\n\tcase false:\n\t\tt.Fatal(\"never\")\n\t}\n",
		"\tcheckNothing(t)\n",
		"\trec := fakeT{}\n\trec.Fatal(\"never\")\n",
	}

	proofs := make([]stubProof, 0, len(escapes))
	for i, body := range escapes {
		proofs = append(proofs, stubProof{id: fmt.Sprintf("p_escape_%d", i), body: body})
	}

	dir := stubRepo(t, oneSlice(proofs...), func(t *testing.T, dir string) {
		t.Helper()

		// The helper the scan will not follow, and the recorder it cannot tell
		// from the test's own handle. Both are the scan's documented limits.
		writeSource(t, dir, "alpha/helper_test.go",
			"package alpha\n\nimport \"testing\"\n\n"+
				"func checkNothing(t *testing.T) {}\n\n"+
				"type fakeT struct{}\n\n"+
				"func (fakeT) Fatal(...any) {}\n")
	})

	res := runStub(t, dir)
	if res.Outcome != Green {
		t.Fatalf("seven scan-escaping stubs came out %s: %s", res.Outcome, res.Evidence)
	}
	mustFit(t, res.Evidence, "7 proofs expected red", "0 not", "7 ahead of plan",
		"the honesty scan found no stub among them")

	// The line must not claim the repo is clean. It says who looked and what
	// they found, and these seven are exactly what that distinction is for.
	if strings.Contains(res.Evidence, "none of them is a stub") {
		t.Errorf("the row said %q, which claims more than the scan checked", res.Evidence)
	}
}

// F88: one test name answers for one proof, so an honest test of that name in
// one suite must never mask a stub of the same name in another. The run folds
// the two outcomes at the worse of them, and the scan's reading has to fold the
// same way.
func TestAStubInOneSuiteIsNotMaskedByAnHonestTestOfTheSameName(t *testing.T) {
	dir := stubRepo(t, oneSlice(stubProof{id: "p_one", body: honestRed}),
		func(t *testing.T, dir string) {
			t.Helper()

			// alpha holds the honest test, which the scan reads first. beta holds
			// a stub of the same name, which passes.
			writeSource(t, dir, "beta/beta.go", "package beta\n\nfunc AddsUp(a, b int) int { return a + b }\n")
			writeSource(t, dir, "beta/beta_test.go",
				"package beta\n\nimport \"testing\"\n\n"+
					"func "+stubMarker("p_one")+"(t *testing.T) {\n}\n")
		})

	res := runStub(t, dir)
	if res.Outcome != Red {
		t.Fatalf("a stub masked by an honest test of the same name came out %s: %s", res.Outcome, res.Evidence)
	}
	mustFit(t, res.Evidence, "1 not", "p_one", saysEmptyBody)
}

// A proof whose test nobody has written yet is the ordinary state of a plan that
// looks further than the work. It is counted, and it is red only when the slice
// that owed it has landed: a slice that landed without its proof claimed work it
// never wrote, and nothing else in the battery sees that.
func TestStubRowIsRedOnAMissingTestOnlyWhenItsSliceLanded(t *testing.T) {
	dir := stubRepo(t, []stubSlice{
		{id: "s_one", milestone: "m_one", landed: true, proofs: []stubProof{
			{id: "p_claimed", unwritten: true},
			{id: "p_written", body: honestRed},
		}},
		{id: "s_two", milestone: "m_one", proofs: []stubProof{
			{id: "p_later", unwritten: true},
		}},
	})

	res := runStub(t, dir)
	if res.Outcome != Red {
		t.Fatalf("a landed slice with no test came out %s: %s", res.Outcome, res.Evidence)
	}
	mustFit(t, res.Evidence, "3 proofs expected red", "1 not", "1 with no result", "p_claimed", "landed")
	if strings.Contains(res.Evidence, "p_later") {
		t.Errorf("the row said %q, and it blamed a proof whose slice has not landed", res.Evidence)
	}
}

// A proof with no result is blamed only when every surface ran. Where one did
// not, the missing result may be the surface rather than a missing test, and a
// red built out of that is a red built out of missing data — the board row's own
// rule, applied to the one branch of this row that could manufacture it.
//
// The row is still red here, for the broken surface. What it must not do is add
// the landed slice's proof to that red.
func TestStubRowDoesNotBlameAMissingResultWhileASurfaceWentUnrun(t *testing.T) {
	dir := stubRepo(t, []stubSlice{
		{id: "s_one", milestone: "m_one", landed: true, proofs: []stubProof{
			{id: "p_claimed", unwritten: true},
			{id: "p_written", body: honestRed},
		}},
		{id: "s_two", milestone: "m_one", proofs: []stubProof{{id: "p_later", body: honestRed}}},
	}, withBrokenSideSurface)

	res := runStub(t, dir)
	if res.Outcome != Red {
		t.Fatalf("a broken surface came out %s: %s", res.Outcome, res.Evidence)
	}
	mustFit(t, res.Evidence, "3 proofs expected red", "0 not", "1 with no result", "side")
	if strings.Contains(res.Evidence, "p_claimed") {
		t.Errorf("the row said %q, and it blamed a proof for a surface it could not run", res.Evidence)
	}
}

// F88 and F76: the clauses ride the branch with nothing to name too. A repo
// whose stack the scan cannot read is exactly when a reader most needs to know
// how much of it was checked — and that is the branch where a row that only
// spoke up on red would say nothing at all.
func TestACleanStubRowStillSaysWhatItCouldNotRead(t *testing.T) {
	dir := stubRepo(t, oneSlice(stubProof{id: "p_one", body: honestRed}),
		func(t *testing.T, dir string) {
			t.Helper()
			writeManifest(t, dir, goAndNodeSurfaces)
			writeSource(t, dir, "web/package.json", "{\"name\": \"web\"}\n")
		})

	res := runStub(t, dir)
	if res.Outcome != Green {
		t.Fatalf("an unreadable stack came out %s: %s", res.Outcome, res.Evidence)
	}

	// Two things the row could not do, and it says both: the scan cannot read
	// node source, and the run could not reach that surface at all.
	mustFit(t, res.Evidence, "1 proof expected red", "1 red at an assertion",
		"the honesty scan found no stub among them", "web", "node")
}

// F88: a surface the run could not reach at all is the only signal that some of
// the plan's proofs went unjudged, so the row has to say it. It reddens nothing
// — a red built out of missing data is not a red — which is exactly why a silent
// version of this branch would be invisible.
func TestStubRowSaysWhenItCouldNotRunASurface(t *testing.T) {
	dir := stubRepo(t, oneSlice(stubProof{id: "p_one", body: honestRed}),
		func(t *testing.T, dir string) {
			t.Helper()

			// A second Go surface with no module of its own. The scan reads it
			// happily; the run cannot start there, and no marker in R10's list
			// says why.
			writeManifest(t, dir, twoSurfaces)
			writeSource(t, dir, "side/beta/beta_test.go",
				"package beta\n\nimport \"testing\"\n\nfunc TestSideHolds(t *testing.T) {\n"+
					"\tif 1 != 1 {\n\t\tt.Fatal(\"never\")\n\t}\n}\n")
		})

	res := runStub(t, dir)
	if res.Outcome != Green {
		t.Fatalf("a surface the run could not reach came out %s: %s", res.Outcome, res.Evidence)
	}
	mustFit(t, res.Evidence, "1 proof expected red", "could not run the surface", "side")
}

// goAndNodeSurfaces declares a Go surface the row can read and a node one it
// cannot. The adapter is declared, so the manifest holds together and the
// failure is the run's own.
const goAndNodeSurfaces = `{
  "schema": 1,
  "surfaces": [
    {"name": "cli", "profile": "cli", "stack": "go", "root": "."},
    {"name": "web", "profile": "web", "stack": "node", "root": "web"}
  ],
  "capabilities": [
    {"name": "adding", "surface": "cli", "proof": ["alpha"]},
    {"name": "showing", "surface": "web", "proof": ["test/show.test.mjs"]}
  ],
  "adapters": {"node": {"command": ["node", "adapter-that-is-not-here.mjs"]}}
}`

// A plan whose every milestone has landed expects no proof red, so the stub
// check has nothing to judge. It says that and claims nothing else: whether
// those proofs are green is the board row's question, not this one's.
func TestStubRowIsGreenWhenThePlanExpectsNoProofRed(t *testing.T) {
	dir := stubRepo(t, []stubSlice{
		{id: "s_one", milestone: "m_one", landed: true, proofs: []stubProof{
			{id: "p_done", body: honestGreen},
		}},
	})

	res := runStub(t, dir)
	if res.Outcome != Green {
		t.Fatalf("a fully landed plan came out %s: %s", res.Outcome, res.Evidence)
	}
	mustFit(t, res.Evidence, "1 proof", "expected green")
	if strings.Contains(res.Evidence, "at an assertion") {
		t.Errorf("the row said %q, and it claims it judged a red", res.Evidence)
	}
}

// A repo with no plan expects no proof red. That is the board row's own shape,
// ruled in D45, and the line says only that. It is answered before the row
// looks for a manifest, because a repo that states no plan owes the stub check
// nothing else either.
func TestStubRowIsGreenOnARepoWithNoPlan(t *testing.T) {
	dir := newRepo(t)
	writeManifest(t, dir, goCLISurface)

	res := runStub(t, dir)
	if res.Outcome != Green {
		t.Fatalf("a repo with no plan came out %s: %s", res.Outcome, res.Evidence)
	}
	mustFit(t, res.Evidence, "no docs/plan")
	if strings.Contains(res.Evidence, "at an assertion") {
		t.Errorf("the row said %q, and it claims it judged a red", res.Evidence)
	}
}

// The three shapes the row could not reach at all. D17: a verifier may never
// pass on nothing, and it may never go red on missing data either.
func TestStubRowIsUnrunnableWhenItCannotReachTheBoard(t *testing.T) {
	t.Run("a plan naming no proof", func(t *testing.T) {
		dir := newRepo(t)
		writeManifest(t, dir, goCLISurface)
		writeSource(t, dir, "docs/plan/demo/program.md", stubProgram)

		res := runStub(t, dir)
		if res.Outcome != Unrunnable {
			t.Fatalf("a plan with no proof came out %s: %s", res.Outcome, res.Evidence)
		}
		mustFit(t, res.Evidence, "no proof")
	})

	t.Run("a plan that will not read", func(t *testing.T) {
		dir := stubRepo(t, oneSlice(stubProof{id: "p_one", body: honestRed}))
		writeSource(t, dir, "docs/plan/demo/demo_bet/s_one.md", "---\nid: nothing_like_it\n---\n")

		res := runStub(t, dir)
		if res.Outcome != Unrunnable {
			t.Fatalf("a plan that will not read came out %s: %s", res.Outcome, res.Evidence)
		}
	})

	t.Run("outside a repo", func(t *testing.T) {
		res := runRow(t, t.TempDir(), "stub")
		if res.Outcome != Unrunnable {
			t.Fatalf("the row outside a repo came out %s: %s", res.Outcome, res.Evidence)
		}
	})
}

// The recursion guard. A project whose own suite calls the battery would
// otherwise run the suite inside the suite.
func TestStubRowDoesNotStartASuiteInsideOne(t *testing.T) {
	dir := stubRepo(t, oneSlice(stubProof{id: "p_one", body: honestRed}))
	t.Setenv(adapter.RunGuardEnv, "1")

	res := runRow(t, dir, "stub")
	if res.Outcome != Unrunnable {
		t.Fatalf("the row inside a run came out %s: %s", res.Outcome, res.Evidence)
	}
	mustFit(t, res.Evidence, "inside")
}

// The row writes nothing. It derives the same board the board row does, and a
// derivation that wrote would be one small change away from a board a person
// could move by hand.
func TestStubRowWritesNoFileAtAll(t *testing.T) {
	dir := stubRepo(t, oneSlice(
		stubProof{id: "p_empty", body: stubEmptyBody},
		stubProof{id: "p_twin", body: honestRed},
	))

	before := treeState(t, dir)
	res := runStub(t, dir)
	after := treeState(t, dir)

	if res.Outcome != Red {
		t.Fatalf("the row came out %s, want red: %s", res.Outcome, res.Evidence)
	}
	if moved := changedPaths(before, after); len(moved) > 0 {
		t.Fatalf("the row wrote to %d paths: %s", len(moved), strings.Join(moved, ", "))
	}
}

// The vacuous judgment is the honesty scan's own, called rather than copied
// (R10). This holds the two to one answer: every shape the scan calls vacuous is
// a shape the stub check calls not-red-for-the-right-reason, in the scan's own
// words.
func TestTheStubCheckCallsTheHonestyScansOwnJudgment(t *testing.T) {
	files := map[string]string{
		"an empty body": "package alpha\n\nimport \"testing\"\n\nfunc TestProof_p_one_it_holds(t *testing.T) {\n}\n",
		"a commented-out assertion": "package alpha\n\nimport \"testing\"\n\nfunc TestProof_p_one_it_holds(t *testing.T) {\n" +
			stubCommentedOut + "}\n\nfunc AddsUp(a, b int) int { return a + b }\n",
		"an always-true assertion": "package alpha\n\nimport \"testing\"\n\nfunc TestProof_p_one_it_holds(t *testing.T) {\n" +
			stubAlwaysTrue + "}\n\nfunc AddsUp(a, b int) int { return a + b }\n",
	}

	for name, src := range files {
		t.Run(name, func(t *testing.T) {
			dir := newRepo(t)
			writeManifest(t, dir, goCLISurface)
			writeSource(t, dir, "go.mod", "module groundwork.test/one\n\ngo 1.24\n")
			writeSource(t, dir, "alpha/alpha_test.go", src)

			s, _, ok := openScan("stub check", Context{RepoDir: dir})
			if !ok {
				t.Fatal("the scan would not open on the fixture")
			}

			read := readTests(s)
			if read.tests != 1 || len(read.found) != 1 {
				t.Fatalf("the scan read %d tests and judged %d things, want 1 of each",
					read.tests, len(read.found))
			}
			shape := read.found[0].shape
			if shape == "" {
				t.Fatalf("the honesty scan calls %s honest, so the stub check has no reason to name", name)
			}

			// The words the row prints are the scan's own, whole.
			row := board.Row{Proof: "p_one", Expected: board.ExpectRed, Actual: board.Passed}
			kind, said := judgeRed(row, shape, true)
			if kind != notRightReason {
				t.Errorf("a passing proof whose test %q came out %v", shape, kind)
			}
			if !strings.Contains(said, shape) {
				t.Errorf("the row says %q, which does not carry the scan's own words %q", said, shape)
			}
		})
	}
}

// The three ways a run ends before it can report an assertion, read off the
// seam's own markers rather than off its words.
//
// The clock's marker is driven here rather than through a fixture, and it has to
// be: the board gives a run ten minutes and go test's own default clock is also
// ten minutes, so on a default setup the board's clock fires first and the run
// comes back stopped rather than timed out. Only a project that sets a shorter
// -timeout of its own reaches that arm at all.
func TestDiedReadsTheSeamsOwnMarkers(t *testing.T) {
	cases := []struct {
		name  string
		err   error
		says  string
		named bool
	}{
		{"a build failure", fmt.Errorf("%w: alpha %w: no", adapter.ErrUnrunnable, adapter.ErrBuildFailed),
			"did not build", true},
		{"the runner's own clock", fmt.Errorf("%w: %w: no", adapter.ErrUnrunnable, adapter.ErrTimedOut),
			"clock", true},
		{"a binary that died", fmt.Errorf("%w: go test %w: no", adapter.ErrUnrunnable, adapter.ErrCrashed),
			"died", true},
		{"a run that broke some other way", fmt.Errorf("%w: no adapter", adapter.ErrUnrunnable), "", false},
		{"a run that reported no test at all", fmt.Errorf("%w: %w", adapter.ErrUnrunnable, adapter.ErrNoTests),
			"", false},
	}

	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			said, named := died(c.err)
			if named != c.named {
				t.Fatalf("died named it %v, want %v: %q", named, c.named, said)
			}
			if !strings.Contains(said, c.says) {
				t.Errorf("died says %q, which does not say %q", said, c.says)
			}
		})
	}
}

// R10's list, one case each, driven through the judgment the row and the
// contract page both read. The branch a whole-repo fixture cannot reach is here:
// a proof that failed at a vacuous assertion.
func TestJudgeRedNamesEveryWayAProofIsNotRedForTheRightReason(t *testing.T) {
	cases := []struct {
		name  string
		row   board.Row
		shape string
		ran   bool
		want  how
		says  string
	}{
		{"failed at a real assertion", board.Row{Actual: board.Failed}, "", true, rightReason, ""},
		{"failed with a test that cannot fail",
			board.Row{Actual: board.Failed}, "asserts nothing", true, notRightReason, "asserts nothing"},
		{"passed with a test that cannot fail",
			board.Row{Actual: board.Passed}, "asserts nothing", true, notRightReason, "asserts nothing"},
		{"passed with a test that can fail", board.Row{Actual: board.Passed}, "", true, aheadOfPlan, ""},
		{"was skipped", board.Row{Actual: board.Skipped}, "", true, notRightReason, "skipped"},
		{"no result on a landed slice",
			board.Row{Actual: board.NeverRan, Landed: true}, "", true, notRightReason, "landed"},
		{"no result on a slice nobody landed", board.Row{Actual: board.NeverRan}, "", true, noResult, ""},
		{"no result on a landed slice while a surface went unrun",
			board.Row{Actual: board.NeverRan, Landed: true}, "", false, noResult, ""},
		{"a state the board grew and this row was never told about",
			board.Row{Actual: "exploded"}, "", true, notRightReason, "does not know"},
	}

	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			kind, said := judgeRed(c.row, c.shape, c.ran)
			if kind != c.want {
				t.Errorf("the judgment is %v, want %v", kind, c.want)
			}
			if c.says == "" {
				if said != "" {
					t.Errorf("the row says %q about a proof it has nothing to say about", said)
				}

				return
			}
			if !strings.Contains(said, c.says) {
				t.Errorf("the row says %q, which does not say %q", said, c.says)
			}
		})
	}
}

// The run's own vocabulary, walked whole. A fifth state added to the board
// without a ruling behind it would reach this row as the default arm of a switch
// and be read as one of the four; here it shows up as a failure instead. Same
// shape as the journal's kind list and the seal's signature states.
func TestJudgeRedAnswersEveryStateTheRunCanReport(t *testing.T) {
	want := map[board.Actual]how{
		board.Passed:   aheadOfPlan,
		board.Failed:   rightReason,
		board.Skipped:  notRightReason,
		board.NeverRan: noResult,
	}

	if len(want) != len(board.Actuals()) {
		t.Fatalf("the run reports %d states and this test says what the row makes of %d",
			len(board.Actuals()), len(want))
	}

	for _, state := range board.Actuals() {
		named, known := want[state]
		if !known {
			t.Fatalf("the run can report %q and this test does not say what the row makes of it", state)
		}
		if kind, _ := judgeRed(board.Row{Actual: state}, "", true); kind != named {
			t.Errorf("a proof the run reports as %q is judged %v, want %v", state, kind, named)
		}
	}
}

// R17 and D54 ruling 1: the page and the code are one ruling with two readers,
// so the page's own cells are driven through the real judgment. D57 ruling 3:
// a pin that read only the shape would guard the table's skeleton and not its
// content.
//
// Both content columns are read. F90: a pin that guarded only the verdict would
// pass a table calling a stub the good red, because both cells would still say
// no and yes in the right places while the middle column lied about what each
// row is.
func TestTheContractNamesEveryWayAProofExpectedRedIsJudged(t *testing.T) {
	cases := map[string]struct {
		row   board.Row
		shape string
		ran   bool
	}{
		"It failed at an assertion":           {board.Row{Actual: board.Failed}, "", true},
		"It failed, and its test cannot fail": {board.Row{Actual: board.Failed}, "asserts nothing", true},
		"It passed, and its test cannot fail": {board.Row{Actual: board.Passed}, "asserts nothing", true},
		"It passed, and its test can fail":    {board.Row{Actual: board.Passed}, "", true},
		"It was skipped":                      {board.Row{Actual: board.Skipped}, "", true},
		"No test of it ran, every surface ran, and its slice has landed": {
			board.Row{Actual: board.NeverRan, Landed: true}, "", true},
		"No test of it ran, and its slice has not landed": {board.Row{Actual: board.NeverRan}, "", true},
		"No test of it ran, and a surface did not run": {
			board.Row{Actual: board.NeverRan, Landed: true}, "", false},
	}

	// The middle column is the page's own name for each judgment, and this is
	// what holds the two together.
	kinds := map[string]how{
		"Red for the right reason":                rightReason,
		"A red that proves nothing":               notRightReason,
		"A stub: the test was never able to fail": notRightReason,
		"Green ahead of plan":                     aheadOfPlan,
		"A test that did not run":                 notRightReason,
		"A slice that landed without its proof":   notRightReason,
		"Work the plan has not reached":           noResult,
		"A proof the run never reached":           noResult,
	}

	rows := stubTableRows(t)
	if len(rows) != len(cases) {
		t.Fatalf("the page's stub table holds %d rows and this test drives %d shapes", len(rows), len(cases))
	}

	for _, cells := range rows {
		c, known := cases[cells[0]]
		if !known {
			t.Fatalf("the page's stub table holds the row %q, which this test does not drive", cells[0])
		}
		named, said := kinds[cells[1]]
		if !said {
			t.Fatalf("the page calls %q a %q, which is not one of this row's judgments", cells[0], cells[1])
		}

		red := stubPageVerdict(t, cells[2])
		kind, _ := judgeRed(c.row, c.shape, c.ran)

		if kind != named {
			t.Errorf("the code judges %q as %v, and the page calls it %q", cells[0], kind, cells[1])
		}
		if got := kind == notRightReason; got != red {
			t.Errorf("the code reads red=%v for %q, and the page says %v", got, cells[0], red)
		}
	}
}

// stubTableRows reads the derivation contract's stub table, cut into cells.
func stubTableRows(t *testing.T) [][]string {
	t.Helper()

	raw, err := os.ReadFile(filepath.Join("..", "..", "docs", "derivation-contract.md"))
	if err != nil {
		t.Fatalf("the derivation contract did not read: %v", err)
	}

	const heading = "| What the run said about a proof expected red | What it is | Is it red |"

	page := string(raw)
	at := strings.Index(page, heading)
	if at < 0 {
		t.Fatalf("the derivation contract holds no table opening %q", heading)
	}

	var found [][]string
	for i, line := range strings.Split(page[at:], "\n") {
		if i < 2 {
			// The heading itself, and the separator under it.
			continue
		}
		if !strings.HasPrefix(line, "|") {
			break
		}

		var cells []string
		for _, cell := range strings.Split(strings.Trim(line, "|"), "|") {
			cells = append(cells, strings.TrimSpace(cell))
		}
		if len(cells) != 3 {
			t.Fatalf("the row %q holds %d cells, want 3", line, len(cells))
		}
		found = append(found, cells)
	}

	if len(found) == 0 {
		t.Fatalf("the table opening %q holds no row at all", heading)
	}

	return found
}

// stubPageVerdict reads a verdict cell. Only the two words the column is written
// in are accepted, so a cell somebody rewrote into prose is refused rather than
// guessed at.
func stubPageVerdict(t *testing.T, cell string) bool {
	t.Helper()

	switch cell {
	case "yes":
		return true
	case "no":
		return false
	}

	t.Fatalf("the page's verdict cell says %q, and a verdict is yes or no", cell)

	return false
}

// F54's class. The arithmetic that proves a line fits has to measure the true
// widest line, and the true widest is found by searching rather than by feeding
// the maximum into every field at once.
//
// Every count is in the head, where no cut can reach it: D33 rules that words
// give way and counts never do, and F61 is what happens when a loud count rides
// in a clause instead.
//
// The search samples the boundary rather than the whole cross product, for the
// reason the board row's own search records: the head is monotone in every
// count, so the widest sits at an extreme, and a full cross product buys nothing
// but time — the time F80 was closed at.
func TestTheStubRowLineIsWidestSomewhereInTheCountSpace(t *testing.T) {
	tails := [][]string{nil, {"x"}, {strings.Repeat("c", 120)}}
	shapes := [][]hit{
		nil,
		{{file: "p_one", shape: "passed, and its test asserts nothing"}},
		{{file: strings.Repeat("p", 300), shape: strings.Repeat("s", 300)}},
	}

	widest, at := 0, ""

	for _, counts := range countTuples(5) {
		for _, hits := range shapes {
			for _, clauses := range tails {
				totals := stubTotals{
					expected: counts[0], honest: counts[1], stubbed: counts[2],
					ahead: counts[3], noResult: counts[4],
					hits: hits, clauses: clauses,
				}

				// A red always names something — a proof or a surface — so the
				// no-hits branch is only ever reached green. Searching a state
				// the row cannot be in would be searching for a line nobody will
				// ever read.
				if len(hits) == 0 {
					totals.stubbed = 0
				}

				got := totals.verdict().Evidence
				if len(got) > journal.MaxTextBytes {
					t.Fatalf("the line is %d bytes, over the journal's cap of %d: %s",
						len(got), journal.MaxTextBytes, got)
				}
				if len(got) > widest {
					widest, at = len(got), fmt.Sprintf("%+v", totals)
				}

				// A line with nothing to name still says what was checked. The
				// counts alone do not: a reader who has to work the verdict out
				// of five numbers is a reader who will get it wrong.
				//
				// At counts no repo will ever reach, the head fills the line on
				// its own and the words give way to it. That is D33's rule in
				// the direction it was written for, so the sentence is asked for
				// only on a line the cut did not reach.
				if len(hits) == 0 && len(got) < journal.MaxTextBytes {
					if !strings.Contains(got, "the honesty scan found no stub among them") {
						t.Fatalf("the line %q does not say what was checked", got)
					}
				}

				// D33: the counts never give way, and each is spelled the way a
				// person writes it, singular for one.
				for _, want := range []string{
					counted(totals.expected, "proof", "proofs") + " expected red",
					strconv.Itoa(totals.honest) + " red at an assertion",
					strconv.Itoa(totals.stubbed) + " not",
					strconv.Itoa(totals.ahead) + " ahead of plan",
					strconv.Itoa(totals.noResult) + " with no result",
				} {
					if !strings.Contains(got, want) {
						t.Fatalf("the line %q does not say %q", got, want)
					}
				}
			}
		}
	}

	t.Logf("the widest line the search found is %d bytes, at %s", widest, at)

	if widest < journal.MaxTextBytes/2 {
		t.Errorf("the widest line found is %d bytes, and the search never came near the cap", widest)
	}
}

// A broken surface is a hit like any other, and its own words are the widest
// this row prints about one. D38 ruling 2: every printed line gets a bound.
func TestTheBrokenSurfaceHitFitsAtItsFullWidth(t *testing.T) {
	for _, count := range []int{1, 2, 9, 1000, 1 << 20, 1<<62 - 1} {
		for _, wide := range []bool{false, true} {
			name, why := "cli", "did not build: the adapter could not be run"
			if wide {
				name, why = strings.Repeat("s", 300), strings.Repeat("w", 300)
			}

			totals := stubTotals{
				expected: count, honest: count, ahead: count, noResult: count, broken: 1,
				hits:    []hit{{file: fmt.Sprintf("the surface %q", name), shape: why}},
				clauses: []string{strings.Repeat("c", 120)},
			}

			got := totals.verdict()
			if got.Outcome != Red {
				t.Fatalf("a broken surface came out %s: %s", got.Outcome, got.Evidence)
			}
			if len(got.Evidence) > journal.MaxTextBytes {
				t.Fatalf("the line is %d bytes, over the journal's cap of %d: %s",
					len(got.Evidence), journal.MaxTextBytes, got.Evidence)
			}
			if !strings.Contains(got.Evidence, counted(count, "proof", "proofs")+" expected red") {
				t.Errorf("the line %q does not open with the counts", got.Evidence)
			}
		}
	}
}

// D23: a row added moves the major half of the version. This slice adds the stub
// row, so 9.0 — the version the board row put this battery at — is no longer a
// version anybody can be held to.
func TestThisRepoDeclaresTheBumpTheStubRowCost(t *testing.T) {
	lock, err := ReadLock(".")
	if err != nil {
		t.Fatalf("this repo's lock file did not read: %v", err)
	}

	if lock.Digest != Default().Digest() {
		t.Errorf("%s declares the digest %s, and the shipped rows compute %s",
			LockFile, lock.Digest, Default().Digest())
	}

	half, _, _ := strings.Cut(lock.Version, ".")
	major, err := strconv.Atoi(half)
	if err != nil {
		t.Fatalf("%s declares the version %q, whose major half is not a number", LockFile, lock.Version)
	}
	if major < 10 {
		t.Errorf("%s declares %s, and the stub row puts this battery at 10.0 or past it",
			LockFile, lock.Version)
	}
}
