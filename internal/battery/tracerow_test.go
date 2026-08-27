package battery

import (
	"fmt"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"testing"
	"unicode"

	"github.com/ryannel/groundwork/internal/journal"
	"github.com/ryannel/groundwork/internal/seal"
)

// The trace row reads a plan in both directions and reads the record for the
// artifacts a bet stands on. Every fixture below is a whole repo: the plan is
// files, the design is a file, and the seals are real tags granted through the
// real verb.

// traceDesign is the fixture design file. Its two headings make the anchors the
// fixture plans point at, computed the way GitHub computes them.
const traceDesign = `# The design

## R12 — Two-direction traceability (B7)

Words.

## R13 — The cross-bet invalidation signal (B9)

More words.
`

const (
	traceAnchor      = "r12--two-direction-traceability-b7"
	traceOtherAnchor = "r13--the-cross-bet-invalidation-signal-b9"
)

// traceSlice is one slice a fixture plan declares.
type traceSlice struct {
	id     string
	anchor string
	facing []string
}

// tracePlan is one fixture plan: what the bet declares, and what its slices
// claim.
type tracePlan struct {
	facing   []string
	deferred [][2]string
	premises []string
	slices   []traceSlice
}

// files renders the fixture as the files a repo holds.
func (p tracePlan) files() map[string]string {
	slices := p.slices
	if len(slices) == 0 {
		slices = []traceSlice{{id: "demo_s1", anchor: traceAnchor}}
	}

	var listed, blocks strings.Builder
	for _, one := range slices {
		fmt.Fprintf(&listed, "  - id: %s\n    milestone: demo_m1\n", one.id)
	}

	for _, id := range p.facing {
		fmt.Fprintf(&blocks, "  - id: %s\n    line: A thing the design names.\n", id)
	}

	bet := "---\nid: demo_bet\ntitle: The demo bet\nprogram: demo\ndesign:\n  - docs/design.md\n" +
		"milestones:\n  - id: demo_m1\n    title: The first milestone\n" +
		"slices:\n" + listed.String()
	if blocks.Len() > 0 {
		bet += "facing:\n" + blocks.String()
	}
	if len(p.deferred) > 0 {
		bet += "deferred:\n"
		for _, one := range p.deferred {
			bet += fmt.Sprintf("  - id: %s\n    reason: %s\n", one[0], one[1])
		}
	}
	if len(p.premises) > 0 {
		bet += "premises:\n"
		for _, one := range p.premises {
			bet += "  - " + one + "\n"
		}
	}
	bet += "---\n\nProse.\n"

	files := map[string]string{
		"docs/design.md":                 traceDesign,
		"docs/plan/demo/program.md":      planProgram,
		"docs/plan/demo/demo_bet/bet.md": bet,
	}

	for _, one := range slices {
		claims := ""
		if len(one.facing) > 0 {
			claims = "facing:\n"
			for _, id := range one.facing {
				claims += "  - " + id + "\n"
			}
		}

		files["docs/plan/demo/demo_bet/"+one.id+".md"] = fmt.Sprintf(
			"---\nid: %s\nbet: demo_bet\nmilestone: demo_m1\nproofs:\n"+
				"  - id: %s_p\n    marker: TestProof_%s_p_it_holds\n    from: docs/design.md#%s\n"+
				"    headline: true\n    retire_at_close: false\n"+
				"fixtures:\n  - one axis\nreal:\n  - the reader\nfaked: []\n%s---\n\nProse.\n",
			one.id, one.id, one.id, one.anchor, claims)
	}

	return files
}

// traceRepo makes a repo carrying the fixture plan, with the design file
// committed so a seal can cover it.
func traceRepo(t *testing.T, p tracePlan) string {
	t.Helper()

	dir := newRepo(t)
	files := p.files()
	writePlanFiles(t, dir, files)
	commitSealed(t, dir, "docs/design.md", files["docs/design.md"])

	return dir
}

// runTrace runs the row against a fixture repo.
func runTrace(t *testing.T, dir string) Result {
	t.Helper()

	return runRow(t, dir, "trace")
}

func TestTheTraceRowIsRegistered(t *testing.T) {
	registered(t, "trace", "trace")
}

// TestProof_b3s6_backward_an_anchor_that_resolves_to_nothing_is_red is R12's
// backward half, driven through the real row against whole repos.
//
// Every proof carries from: <design-path>#<anchor>, and the row fails when the
// anchor does not resolve inside the design file. The shape of the reference and
// the existence of the file are the plan row's, and this is what nothing checked
// until now: whether the anchor names a heading anybody wrote.
func TestProof_b3s6_backward_an_anchor_that_resolves_to_nothing_is_red(t *testing.T) {
	t.Run("an anchor that names a heading is green", func(t *testing.T) {
		dir := traceRepo(t, tracePlan{slices: []traceSlice{
			{id: "demo_s1", anchor: traceAnchor},
			{id: "demo_s2", anchor: traceOtherAnchor},
		}})

		res := runTrace(t, dir)
		if res.Outcome != Green {
			t.Fatalf("two anchors that resolve came out %s: %s", res.Outcome, res.Evidence)
		}
		mustFit(t, res.Evidence, "2 proofs", "0 dangling")

		// D33: the counts lead, because the line is cut from the end.
		if !strings.HasPrefix(res.Evidence, "2 proofs") {
			t.Errorf("the line is %q, and it does not open with the counts", res.Evidence)
		}
	})

	t.Run("an anchor that names no heading is red, and it is named", func(t *testing.T) {
		dir := traceRepo(t, tracePlan{slices: []traceSlice{
			{id: "demo_s1", anchor: "r99--a-ruling-nobody-wrote"},
			{id: "demo_s2", anchor: traceAnchor},
		}})

		res := runTrace(t, dir)
		if res.Outcome != Red {
			t.Fatalf("an anchor that resolves to nothing came out %s: %s", res.Outcome, res.Evidence)
		}
		mustFit(t, res.Evidence, "2 proofs", "1 dangling",
			"demo_s1_p", "r99--a-ruling-nobody-wrote", "docs/design.md")

		if strings.Contains(res.Evidence, "demo_s2_p") {
			t.Errorf("the row said %q, and it blamed the proof whose anchor resolves", res.Evidence)
		}

		// The plan row reads the same repo and finds nothing wrong with it: the
		// reference's shape and its file are what that row judges. A red here is
		// this row's own catch, not a second report of somebody else's.
		if plan := runRow(t, dir, "plan"); plan.Outcome != Green {
			t.Errorf("the plan row came out %s on the same repo: %s", plan.Outcome, plan.Evidence)
		}
	})
}

// TestProof_b3s6_forward_a_facing_item_no_slice_claims_is_red is R12's forward
// half, and the direction the recorded failure needed: a sealed pattern that
// belonged to no slice, where every slice was individually correct.
//
// Every id in the bet's facing list is claimed by exactly one slice, or listed
// under deferred with a reason. Unclaimed and unrecorded is red. Claimed twice
// is red.
func TestProof_b3s6_forward_a_facing_item_no_slice_claims_is_red(t *testing.T) {
	t.Run("claimed by one slice is green", func(t *testing.T) {
		dir := traceRepo(t, tracePlan{
			facing: []string{"f_one"},
			slices: []traceSlice{{id: "demo_s1", anchor: traceAnchor, facing: []string{"f_one"}}},
		})

		res := runTrace(t, dir)
		if res.Outcome != Green {
			t.Fatalf("a facing id claimed once came out %s: %s", res.Outcome, res.Evidence)
		}
		mustFit(t, res.Evidence, "1 facing id", "0 unclaimed", "0 claimed twice")
	})

	t.Run("claimed by nobody is red, and it is named", func(t *testing.T) {
		dir := traceRepo(t, tracePlan{
			facing: []string{"f_one", "f_orphan"},
			slices: []traceSlice{{id: "demo_s1", anchor: traceAnchor, facing: []string{"f_one"}}},
		})

		res := runTrace(t, dir)
		if res.Outcome != Red {
			t.Fatalf("a facing id no slice claims came out %s: %s", res.Outcome, res.Evidence)
		}
		mustFit(t, res.Evidence, "2 facing ids", "1 unclaimed", "f_orphan")

		if strings.Contains(res.Evidence, "f_one") {
			t.Errorf("the row said %q, and it blamed the item a slice claims", res.Evidence)
		}
		if plan := runRow(t, dir, "plan"); plan.Outcome != Green {
			t.Errorf("the plan row came out %s on the same repo: %s", plan.Outcome, plan.Evidence)
		}
	})

	t.Run("claimed by two slices is red, and both are named", func(t *testing.T) {
		dir := traceRepo(t, tracePlan{
			facing: []string{"f_one"},
			slices: []traceSlice{
				{id: "demo_s1", anchor: traceAnchor, facing: []string{"f_one"}},
				{id: "demo_s2", anchor: traceOtherAnchor, facing: []string{"f_one"}},
			},
		})

		res := runTrace(t, dir)
		if res.Outcome != Red {
			t.Fatalf("a facing id two slices claim came out %s: %s", res.Outcome, res.Evidence)
		}
		mustFit(t, res.Evidence, "1 claimed twice", "f_one", "demo_s1", "demo_s2")

		if plan := runRow(t, dir, "plan"); plan.Outcome != Green {
			t.Errorf("the plan row came out %s on the same repo: %s", plan.Outcome, plan.Evidence)
		}
	})

	// The fourth answer, and the one R12's or makes: an item both claimed by a
	// slice and deferred by the bet is two records of one item's fate (D60.4).
	t.Run("claimed by a slice and deferred by the bet is red", func(t *testing.T) {
		dir := traceRepo(t, tracePlan{
			facing:   []string{"f_one"},
			deferred: [][2]string{{"f_one", "it needs the next bet"}},
			slices:   []traceSlice{{id: "demo_s1", anchor: traceAnchor, facing: []string{"f_one"}}},
		})

		res := runTrace(t, dir)
		if res.Outcome != Red {
			t.Fatalf("an item claimed and deferred came out %s: %s", res.Outcome, res.Evidence)
		}
		mustFit(t, res.Evidence, "1 claimed twice", "f_one", "demo_s1", "defers")

		if plan := runRow(t, dir, "plan"); plan.Outcome != Green {
			t.Errorf("the plan row came out %s on the same repo: %s", plan.Outcome, plan.Evidence)
		}
	})

	t.Run("deferred with a reason is green", func(t *testing.T) {
		dir := traceRepo(t, tracePlan{
			facing:   []string{"f_one", "f_later"},
			deferred: [][2]string{{"f_later", "it needs the next bet"}},
			slices:   []traceSlice{{id: "demo_s1", anchor: traceAnchor, facing: []string{"f_one"}}},
		})

		res := runTrace(t, dir)
		if res.Outcome != Green {
			t.Fatalf("a deferred facing id came out %s: %s", res.Outcome, res.Evidence)
		}
		mustFit(t, res.Evidence, "2 facing ids", "0 unclaimed")
	})
}

// sealedTraceRepo makes a fixture repo whose design file carries a design seal,
// granted on a green battery run through the real verb.
func sealedTraceRepo(t *testing.T, p tracePlan) string {
	t.Helper()

	t.Setenv("GROUNDWORK_SESSION", "s-trace-row")

	dir := traceRepo(t, p)

	if _, err := journal.WriteBattery(dir, journal.Battery{
		RunID:   "run-20260826T120000Z-abcd",
		Version: "11.0+r1234567",
		Counts: map[string]int{
			"green": 13, "red": 0, "waived": 0, "quarantined": 0, "unrunnable": 0,
		},
		DurationMS: 1,
	}); err != nil {
		t.Fatalf("could not record a battery run: %v", err)
	}

	if _, err := seal.GrantSeal(dir, seal.Grant{
		Kind: "design", Subject: "b3_design", Paths: []string{"docs/design.md"},
	}); err != nil {
		t.Fatalf("granting the design seal failed: %v", err)
	}

	return dir
}

// TestProof_b3s6_premises_an_amended_artifact_marks_the_bets_that_cite_it is
// R13: a bet declares the premises it stands on, and amending or withdrawing an
// artifact marks every later bet whose premises name it.
//
// The mark is loud and never red. There is no mechanism in this bet for a bet to
// answer a mark — re-reading a bet against a moved premise is a person's work —
// and a red nobody can clear is the friction-waived class the design's own risks
// name.
func TestProof_b3s6_premises_an_amended_artifact_marks_the_bets_that_cite_it(t *testing.T) {
	dir := sealedTraceRepo(t, tracePlan{premises: []string{"b3_design"}})

	before := runTrace(t, dir)
	if before.Outcome != Green {
		t.Fatalf("a bet standing on a seal nobody moved came out %s: %s", before.Outcome, before.Evidence)
	}
	mustFit(t, before.Evidence, "0 marked")
	if strings.Contains(before.Evidence, "demo_bet") {
		t.Fatalf("the row marked a bet before anything moved: %s", before.Evidence)
	}
	if strings.Contains(before.Evidence, "unsealed") {
		t.Errorf("the row said %q of a repo whose design file and premise are both sealed", before.Evidence)
	}

	// The design moves, through the verb that prints what changed and demands a
	// reason. That is the whole event R13 says marks the bets standing on it.
	commitSealed(t, dir, "docs/design.md", traceDesign+"\n## R14 — A ruling that arrived late\n")

	if _, err := seal.AmendSeal(dir, seal.Amendment{
		Kind: "design", Subject: "b3_design", Paths: []string{"docs/design.md"},
		Reason: "the design gained a ruling",
	}); err != nil {
		t.Fatalf("amending the design seal failed: %v", err)
	}

	after := runTrace(t, dir)
	if after.Outcome != Green {
		t.Fatalf("an amended premise came out %s, and a mark is loud rather than red: %s",
			after.Outcome, after.Evidence)
	}
	mustFit(t, after.Evidence, "1 marked", "demo_bet", "b3_design", "amended")
}

// F94's two probes, driven through the real row: a design file too big to read
// and a design file that is a symlink to a device. Each one comes back as a
// named verdict, and the row is still there to give it.
//
// This is the whole point of the cap. Before it, either file took the process
// down: no summary, no journal line, no row — a battery one committed file could
// kill.
func TestProof_b3s6_backward_a_design_file_the_row_will_not_read_is_named(t *testing.T) {
	cases := []struct {
		name string
		make func(t *testing.T, at string)
		says string
	}{
		{
			"a file over the cap",
			func(t *testing.T, at string) {
				f, err := os.Create(at)
				if err != nil {
					t.Fatalf("could not make the big file: %v", err)
				}
				defer f.Close()

				// Sparse: the case costs no disk, because the row refuses it on
				// its size and never reads a byte.
				if err := f.Truncate(400 << 20); err != nil {
					t.Fatalf("could not grow the big file: %v", err)
				}
			},
			"over the limit",
		},
		{
			"a symlink to a device",
			func(t *testing.T, at string) {
				if err := os.Symlink("/dev/zero", at); err != nil {
					t.Skipf("this machine cannot make a symlink: %v", err)
				}
			},
			"symlink",
		},
	}

	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			dir := traceRepo(t, tracePlan{})

			at := filepath.Join(dir, "docs", "design.md")
			if err := os.Remove(at); err != nil {
				t.Fatalf("could not clear the design file: %v", err)
			}
			c.make(t, at)

			// The plan reader still takes it, which is what leaves this read to
			// the trace row.
			if plan := runRow(t, dir, "plan"); plan.Outcome != Green {
				t.Fatalf("the plan row came out %s, so this case never reaches the trace row: %s",
					plan.Outcome, plan.Evidence)
			}

			res := runTrace(t, dir)
			if res.Outcome != Red {
				t.Fatalf("a design file the row will not read came out %s: %s", res.Outcome, res.Evidence)
			}
			mustFit(t, res.Evidence, "1 dangling", "docs/design.md", c.says)
		})
	}
}

// R13's other half at the row: an artifact the record says was withdrawn marks
// the bets that cite it, and the line says withdrawn rather than amended.
//
// The withdrawal is written as the record's own dying-amend shape — a revoked
// line with nothing granted after it — which is the state F68 names and the one
// a half-finished amendment leaves behind.
func TestTheTraceRowNamesABetStandingOnAWithdrawnArtifact(t *testing.T) {
	dir := sealedTraceRepo(t, tracePlan{premises: []string{"b3_design"}})

	tag, err := seal.TagName("design", "b3_design")
	if err != nil {
		t.Fatalf("the tag name did not build: %v", err)
	}
	if _, err := journal.WriteSeal(dir, journal.Seal{
		Kind: "design", Tag: tag, Action: "revoked",
		Battery: "11.0+r1234567", BatteryRun: "run-20260826T120000Z-abcd",
		Reason: "withdrawn while the design is rewritten",
	}); err != nil {
		t.Fatalf("could not write the revoked line: %v", err)
	}

	res := runTrace(t, dir)
	if res.Outcome != Green {
		t.Fatalf("a withdrawn premise came out %s, and a mark is loud rather than red: %s",
			res.Outcome, res.Evidence)
	}
	mustFit(t, res.Evidence, "1 marked", "demo_bet", "b3_design", "withdrawn")
}

// A repo with no plan directory states no plan, so it traces nothing and can
// misstate nothing. That is the plan row's own shape, ruled in D45, and the line
// must claim no more than that.
func TestTraceRowIsGreenAndPlainOnARepoWithNoPlans(t *testing.T) {
	res := runRow(t, newRepo(t), "trace")
	if res.Outcome != Green {
		t.Fatalf("a repo with no plan came out %s: %s", res.Outcome, res.Evidence)
	}
	mustFit(t, res.Evidence, "docs/plan")

	for _, overclaim := range []string{"dangling", "unclaimed", "resolve"} {
		if strings.Contains(res.Evidence, overclaim) {
			t.Errorf("the row read no plan and still said %q", res.Evidence)
		}
	}
}

// A plan that will not read leaves this row unrunnable, never red. The plan row
// is the one that judges a plan, and two rows red for one fault is two reds for
// one fix.
func TestTraceRowIsUnrunnableOnAPlanThatWillNotRead(t *testing.T) {
	dir := traceRepo(t, tracePlan{})
	writeSource(t, dir, "docs/plan/demo/demo_bet/demo_s1.md", "# no frontmatter here\n")

	res := runTrace(t, dir)
	if res.Outcome != Unrunnable {
		t.Fatalf("a plan that will not read came out %s: %s", res.Outcome, res.Evidence)
	}
	if plan := runRow(t, dir, "plan"); plan.Outcome != Red {
		t.Fatalf("the plan row came out %s, so nothing owns this red: %s", plan.Outcome, plan.Evidence)
	}
}

// D17: a verifier may never pass on nothing. A plan directory holding a program
// file and no bet names no proof and no facing id, so there is nothing to trace
// and the row says so rather than passing.
func TestTraceRowIsUnrunnableOnAPlanWithNothingToTrace(t *testing.T) {
	dir := newRepo(t)
	writeSource(t, dir, "docs/plan/demo/program.md", planProgram)

	res := runTrace(t, dir)
	if res.Outcome != Unrunnable {
		t.Fatalf("a plan naming nothing to trace came out %s: %s", res.Outcome, res.Evidence)
	}
	mustFit(t, res.Evidence, "docs/plan")
}

// R4's ground, applied to the seal this row reads. A design file no seal covers
// is loud on every line and never blocking: there is no key in this environment
// the agents cannot read, so a blocking rule would either put the key inside
// their reach or stop every run. The flip is named with R4's own.
func TestTraceRowSaysWhenNothingItReadIsSealed(t *testing.T) {
	dir := traceRepo(t, tracePlan{premises: []string{"b3_design"}})

	res := runTrace(t, dir)
	if res.Outcome != Green {
		t.Fatalf("an unsealed design file came out %s: %s", res.Outcome, res.Evidence)
	}

	// The state is in the head, where no cut reaches it, and each unsealed thing
	// is named beside it.
	mustFit(t, res.Evidence, "(unsealed)", "docs/design.md", "carries no seal", "b3_design")
}

// The green line's bound test (D38.2). It says what it counted and what it
// found, and dropping any one of those from the line kills this test.
//
// F87: the sentence says who looked and what they found, never a claim about
// the repo the row cannot establish. The anchors it read resolve; the row says
// nothing about the ones it could not read, and nothing about seals it never saw.
func TestTheTraceRowsGreenLineSaysWhatItRead(t *testing.T) {
	// A repo whose design file is sealed, because the sentence is what a line
	// with nothing at all to name says, and an unsealed file is something to
	// name.
	dir := sealedTraceRepo(t, tracePlan{
		facing: []string{"f_one"},
		slices: []traceSlice{{id: "demo_s1", anchor: traceAnchor, facing: []string{"f_one"}}},
	})

	res := runTrace(t, dir)
	if res.Outcome != Green {
		t.Fatalf("a plan that traces came out %s: %s", res.Outcome, res.Evidence)
	}
	for _, want := range []string{
		"1 proof", "0 dangling", "1 facing id", "0 unclaimed", "0 claimed twice", "0 marked",
		"every anchor read resolves", "claimed once or deferred",
	} {
		if !strings.Contains(res.Evidence, want) {
			t.Errorf("the row said %q, and it does not say %q", res.Evidence, want)
		}
	}
}

// The red line's bound test (D38.2), and the widest-line proof.
//
// The widest line is found by searching the count space rather than by feeding
// the maximum into every field: F54, F61 and F81 are three entries in the class
// where a widest-line test measured a shape somebody guessed at. Every count is
// in the head, where no cut reaches it, and the head fits the journal's cap
// however large the counts get.
func TestTheTraceRowsCountsAlwaysFitTheLine(t *testing.T) {
	shapes := [][]hit{
		nil,
		{{file: "f_one", shape: "is claimed by no slice and deferred by none"}},
		{{file: strings.Repeat("f", 300), shape: strings.Repeat("s", 300)}},
		{
			{file: strings.Repeat("a", 90), shape: strings.Repeat("b", 90)},
			{file: strings.Repeat("c", 90), shape: strings.Repeat("d", 90)},
		},
	}
	widest, at := 0, ""

	for _, counts := range countTuples(6) {
		for _, unsealed := range []bool{false, true} {
			for _, hits := range shapes {
				{
					totals := traceTotals{
						proofs: counts[0], dangling: counts[1], facing: counts[2],
						unclaimed: counts[3], twice: counts[4], marked: counts[5],
						unsealed: unsealed, hits: hits,
					}

					got := totals.verdict(Red).Evidence
					if len(got) > journal.MaxTextBytes {
						t.Fatalf("the line is %d bytes, over the journal's cap of %d: %s",
							len(got), journal.MaxTextBytes, got)
					}
					if len(got) > widest {
						widest, at = len(got), fmt.Sprintf("%+v", totals)
					}

					// D33: the counts never give way. Each is spelled the way a
					// person writes it, singular for one.
					for _, want := range []string{
						counted(totals.proofs, "proof", "proofs"),
						strconv.Itoa(totals.dangling) + " dangling",
						counted(totals.facing, "facing id", "facing ids"),
						strconv.Itoa(totals.unclaimed) + " unclaimed",
						strconv.Itoa(totals.twice) + " claimed twice",
						strconv.Itoa(totals.marked) + " marked",
					} {
						if !strings.Contains(got, want) {
							t.Fatalf("the line %q does not say %q", got, want)
						}
					}

					// R4's loud state rides in the head too, where no cut can
					// reach it. F61: a loud clause goes silently conditional at
					// scale, and that is exactly what must not happen here.
					if unsealed && !strings.Contains(got, "unsealed") {
						t.Fatalf("the line %q does not say that something it read carries no seal", got)
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

// D49 ruling 2: every value a line of evidence takes off a file somebody else
// wrote goes through printable before it goes through the clip. An anchor is one
// of those — the plan reader holds its shape and its two forbidden characters,
// space and tab, and nothing else about its charset — so a control character in
// one reaches this row and must never reach the table. A newline there would
// draw a row of its own in the verify table, and a run that prints a forged row
// is worse than one that prints nothing.
func TestATraceLineNeverCarriesAControlCharacter(t *testing.T) {
	dir := traceRepo(t, tracePlan{slices: []traceSlice{
		{id: "demo_s1", anchor: "r99--a\x01ruling\x02nobody-wrote"},
	}})

	// The plan reader took the anchor, which is what makes this reachable at all.
	if plan := runRow(t, dir, "plan"); plan.Outcome != Green {
		t.Fatalf("the plan row came out %s, so this case never reaches the trace row: %s",
			plan.Outcome, plan.Evidence)
	}

	res := runTrace(t, dir)
	if res.Outcome != Red {
		t.Fatalf("an anchor that resolves to nothing came out %s: %s", res.Outcome, res.Evidence)
	}
	mustFit(t, res.Evidence, "demo_s1_p")

	for _, r := range res.Evidence {
		if !unicode.IsPrint(r) {
			t.Fatalf("the row said %q, and it carries the character %q", res.Evidence, r)
		}
	}
}

// A row's evidence is read on a machine that is not the one that wrote it, so a
// temporary directory in a line of evidence says nothing to the reader.
func TestTraceRowEvidenceNeverCarriesAMachinePath(t *testing.T) {
	dir := traceRepo(t, tracePlan{slices: []traceSlice{
		{id: "demo_s1", anchor: "r99--nobody-wrote-this"},
	}})

	res := runTrace(t, dir)
	if strings.Contains(res.Evidence, dir) || strings.Contains(res.Evidence, os.TempDir()) {
		t.Errorf("the row said %q, and it carries a path from the machine it ran on", res.Evidence)
	}
}

// The dogfood. This repo writes its own plan in this format and points its own
// proofs at its own design, so a rule nobody can follow shows up here first.
//
// The line has to be honest about this repo's actual state: nothing here is
// sealed yet, and the row says so rather than passing over it in silence.
func TestTraceRowIsGreenAndHonestOnThisRepo(t *testing.T) {
	res := runRow(t, ".", "trace")
	if res.Outcome != Green {
		t.Fatalf("this repo's own trace row came out %s: %s", res.Outcome, res.Evidence)
	}
	mustFit(t, res.Evidence, "0 dangling", "0 unclaimed", "0 claimed twice")
}

// D23: a row added moves the major half of the version. This slice adds the
// trace row, so 10.0 is no longer a version anybody can be held to.
func TestThisRepoDeclaresTheBumpTheTraceRowCost(t *testing.T) {
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
	if major < 11 {
		t.Errorf("%s declares %s, and the trace row puts this battery at 11.0 or past it",
			LockFile, lock.Version)
	}
}
