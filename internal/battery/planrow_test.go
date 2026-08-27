package battery

import (
	"os"
	"path/filepath"
	"slices"
	"strconv"
	"strings"
	"testing"

	"github.com/ryannel/groundwork/internal/journal"
)

// The plan row's fixture: one program, one bet, one slice, all resolving. Each
// case copies it and breaks one thing.

const planProgram = `---
id: demo
title: The demo program
goal: Show what a plan file looks like.
done: One committed file per unit.
ladder:
  - id: demo_bet
    line: The only bet with files of its own.
    proof_sketch: The reader parses its files.
---

Prose.
`

const planBet = `---
id: demo_bet
title: The demo bet
program: demo
design:
  - docs/design.md
milestones:
  - id: demo_m1
    title: The first milestone
slices:
  - id: demo_s1
    milestone: demo_m1
---

Prose.
`

const planSlice = `---
id: demo_s1
bet: demo_bet
milestone: demo_m1
proofs:
  - id: demo_p1
    marker: TestProof_demo_p1_the_table_prints
    from: docs/design.md#one
    headline: true
    retire_at_close: false
fixtures:
  - an empty table and a full one
real:
  - the parser
faked: []
---

Prose.
`

// writePlan puts the fixture plan inside the repo at dir, with one file
// replaced when rel is given.
func writePlan(t *testing.T, dir, rel, content string) {
	t.Helper()

	writePlanFiles(t, dir, planFiles(rel, content))
}

// planFiles is the fixture plan as a path-to-content map, with one file
// replaced when rel is given, ready to be broken further.
func planFiles(rel, content string) map[string]string {
	files := map[string]string{
		"docs/design.md":                     "# The design\n",
		"docs/plan/demo/program.md":          planProgram,
		"docs/plan/demo/demo_bet/bet.md":     planBet,
		"docs/plan/demo/demo_bet/demo_s1.md": planSlice,
	}
	if rel != "" {
		files[rel] = content
	}

	return files
}

// writePlanFiles writes a fixture map into the repo at dir.
func writePlanFiles(t *testing.T, dir string, files map[string]string) {
	t.Helper()

	for path, body := range files {
		writeSource(t, dir, path, body)
	}
}

// The row has to be registered, or it is a check that never runs.
func TestPlanRowIsRegistered(t *testing.T) {
	registered(t, "plan", "plan")
}

// TestProof_b3s1_row_green_on_a_plan_that_resolves is the row's own happy
// path: three files, every id its own, every reference reaching something.
func TestProof_b3s1_row_green_on_a_plan_that_resolves(t *testing.T) {
	dir := newRepo(t)
	writePlan(t, dir, "", "")

	res := runRow(t, dir, "plan")
	if res.Outcome != Green {
		t.Fatalf("a plan that resolves came out %s: %s", res.Outcome, res.Evidence)
	}
	for _, want := range []string{"1 program", "1 bet", "1 slice"} {
		if !strings.Contains(res.Evidence, want) {
			t.Errorf("the row said %q, and it does not say it read %s", res.Evidence, want)
		}
	}
}

// TestProof_b3s1_row_red_on_the_three_ways_a_plan_misstates walks the three
// failures the design names for this row: a file that will not parse, an id
// that repeats, and a reference that does not resolve.
func TestProof_b3s1_row_red_on_the_three_ways_a_plan_misstates(t *testing.T) {
	cases := []struct{ name, rel, content, want string }{
		{
			"a file that will not parse",
			"docs/plan/demo/demo_bet/demo_s1.md",
			"# no frontmatter here\n",
			"frontmatter",
		},
		{
			"an id that repeats",
			"docs/plan/demo/demo_bet/bet.md",
			strings.Replace(planBet, "id: demo_m1", "id: demo_bet", 1),
			"demo_bet",
		},
		{
			"a reference that does not resolve",
			"docs/plan/demo/demo_bet/demo_s1.md",
			strings.Replace(planSlice, "milestone: demo_m1", "milestone: demo_m9", 1),
			"demo_m9",
		},
	}

	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			dir := newRepo(t)
			writePlan(t, dir, c.rel, c.content)

			res := runRow(t, dir, "plan")
			if res.Outcome != Red {
				t.Fatalf("%s came out %s: %s", c.name, res.Outcome, res.Evidence)
			}
			if !strings.Contains(res.Evidence, c.want) {
				t.Errorf("the row said %q, and it does not name %q", res.Evidence, c.want)
			}
		})
	}
}

// A repo with no plan directory has nothing to misstate, so the row is green —
// and it says only what it checked. A green that claimed the plans resolve
// would be a green over no plans at all.
func TestPlanRowIsGreenAndPlainOnARepoWithNoPlans(t *testing.T) {
	res := runRow(t, newRepo(t), "plan")
	if res.Outcome != Green {
		t.Fatalf("a repo with no plans came out %s: %s", res.Outcome, res.Evidence)
	}
	if !strings.Contains(res.Evidence, "docs/plan") {
		t.Errorf("the row said %q, and it does not name the directory it looked for", res.Evidence)
	}
	if !strings.Contains(res.Evidence, "no") {
		t.Errorf("the row said %q, and it does not say there are no plans", res.Evidence)
	}

	// The green must not claim any unit was read, because none was.
	for _, overclaim := range []string{"resolve", "1 program", "1 bet", "1 slice"} {
		if strings.Contains(res.Evidence, overclaim) {
			t.Errorf("the row read no plan and still said %q", res.Evidence)
		}
	}
}

// The green line's bound test (D38.2). It says which directory was read, how
// much was in it, and what was checked, and dropping any one of those from the
// line kills this test. A green that said less would be a green nobody can
// audit.
func TestThePlanRowsGreenLineSaysWhatItRead(t *testing.T) {
	dir := newRepo(t)
	writePlan(t, dir, "", "")

	res := runRow(t, dir, "plan")
	if res.Outcome != Green {
		t.Fatalf("a plan that resolves came out %s: %s", res.Outcome, res.Evidence)
	}
	for _, want := range []string{
		"docs/plan", "1 program", "1 bet", "1 slice", "every id and reference in them resolves",
	} {
		if !strings.Contains(res.Evidence, want) {
			t.Errorf("the row said %q, and it does not say %q", res.Evidence, want)
		}
	}
}

// The red line's bound test (D38.2), and H1's landing condition. The count of
// problems is written before the first problem, so a line long enough to be cut
// loses the tail of somebody's file path and never the count. D33: words give
// way, counts never do.
func TestThePlanRowsRedLineNeverLosesTheCount(t *testing.T) {
	dir := newRepo(t)

	files := planFiles("docs/plan/demo/demo_bet/demo_s1.md",
		strings.Replace(planSlice, "milestone: demo_m1", "milestone: demo_m9", 1))

	// A slice file with a name long enough to fill the journal's whole line on
	// its own. Its name sorts before bet.md, so the walk meets it first and it
	// is the problem the line carries.
	long := strings.Repeat("a", 200)
	files["docs/plan/demo/demo_bet/"+long+".md"] = strings.Replace(planSlice, "id: demo_s1", "id: demo_s2", 1)

	writePlanFiles(t, dir, files)

	res := runRow(t, dir, "plan")
	if res.Outcome != Red {
		t.Fatalf("a plan with two broken things came out %s: %s", res.Outcome, res.Evidence)
	}
	if len(res.Evidence) != journal.MaxTextBytes {
		t.Fatalf("the line is %d bytes, and this case is only worth anything when it is cut to %d: %s",
			len(res.Evidence), journal.MaxTextBytes, res.Evidence)
	}
	if !strings.HasSuffix(res.Evidence, "...") {
		t.Errorf("the row said %q, and it does not say it was cut", res.Evidence)
	}
	if !strings.HasPrefix(res.Evidence, "2 problems") {
		t.Errorf("the row said %q, and the cut took the count with it", res.Evidence)
	}
}

// The other half of H1. A path a plan file names is somebody else's text, up to
// the path cap of 300 bytes, and every other value on these lines is clipped.
// Left unclipped it spends the whole line on itself, and the reader loses both
// the second problem and the room to say anything else.
func TestALongPathInAPlanFileIsClippedNotLeftToFillTheLine(t *testing.T) {
	dir := newRepo(t)

	long := "docs/" + strings.Repeat("z", 237) + ".md"
	if len(long) != 245 {
		t.Fatalf("the case meant to name a 245-byte path and names a %d-byte one", len(long))
	}

	files := planFiles("docs/plan/demo/demo_bet/bet.md",
		strings.Replace(planBet, "  - docs/design.md", "  - "+long, 1))
	files["docs/plan/demo/demo_bet/demo_s1.md"] =
		strings.Replace(planSlice, "from: docs/design.md#one", "from: docs/gone.md#one", 1)

	writePlanFiles(t, dir, files)

	res := runRow(t, dir, "plan")
	if res.Outcome != Red {
		t.Fatalf("a plan naming two files that are not there came out %s: %s", res.Outcome, res.Evidence)
	}
	if len(res.Evidence) >= journal.MaxTextBytes {
		t.Errorf("the row said %d bytes over one long path, and the line holds %d: %s",
			len(res.Evidence), journal.MaxTextBytes, res.Evidence)
	}
	if !strings.Contains(res.Evidence, "2 problems") {
		t.Errorf("the row said %q, and it does not count the problems it found", res.Evidence)
	}
}

// D45: a docs/plan with nothing to parse is unrunnable, and one that offers
// something misshapen is red. The line between them is whether a program.md was
// there at all. The unrunnable line names what the directory held instead.
func TestThePlanRowSeparatesNothingToParseFromAMisshapenPlan(t *testing.T) {
	cases := []struct {
		name  string
		files map[string]string
		want  Outcome
		said  []string
	}{
		{
			"a plan directory holding one file and no program directory",
			map[string]string{"docs/plan/README.md": "# plans go here\n"},
			Unrunnable,
			[]string{"docs/plan", "README.md"},
		},
		{
			"a program directory with no program.md above a real bet",
			func() map[string]string {
				files := planFiles("", "")
				delete(files, "docs/plan/demo/program.md")

				return files
			}(),
			Red,
			[]string{"docs/plan/demo", "holds no program.md"},
		},
		{
			"a stray file beside a program that does parse",
			func() map[string]string {
				files := planFiles("", "")
				files["docs/plan/notes.md"] = "# notes\n"

				return files
			}(),
			Red,
			[]string{"notes.md"},
		},
	}

	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			dir := newRepo(t)
			writePlanFiles(t, dir, c.files)

			res := runRow(t, dir, "plan")
			if res.Outcome != c.want {
				t.Fatalf("%s came out %s, want %s: %s", c.name, res.Outcome, c.want, res.Evidence)
			}
			for _, said := range c.said {
				if !strings.Contains(res.Evidence, said) {
					t.Errorf("the row said %q, and it does not say %q", res.Evidence, said)
				}
			}
		})
	}
}

// The same for the other path a plan file hands the resolver: the one a proof
// comes from. It has its own clip and needs its own bound test — the design
// half's test passes with this clip removed, because the two lines are built in
// different places (F44a).
func TestALongFromPathIsClippedNotLeftToFillTheLine(t *testing.T) {
	dir := newRepo(t)

	long := "docs/" + strings.Repeat("z", 237) + ".md"
	if len(long) != 245 {
		t.Fatalf("the case meant to name a 245-byte path and names a %d-byte one", len(long))
	}

	// Two problems, both from resolveSlice and in this order: the proof's path
	// reaches no file, and the slice sits on a milestone its bet does not hold.
	// The long one is first, so it is the one the line carries.
	broken := strings.NewReplacer(
		"from: docs/design.md#one", "from: "+long+"#one",
		"milestone: demo_m1", "milestone: demo_m9",
	).Replace(planSlice)

	writePlanFiles(t, dir, planFiles("docs/plan/demo/demo_bet/demo_s1.md", broken))

	res := runRow(t, dir, "plan")
	if res.Outcome != Red {
		t.Fatalf("a plan naming a design file that is not there came out %s: %s", res.Outcome, res.Evidence)
	}
	if !strings.Contains(res.Evidence, "comes from") {
		t.Fatalf("the row said %q, and the line this case means to measure is not the one it carried",
			res.Evidence)
	}
	if len(res.Evidence) >= journal.MaxTextBytes {
		t.Errorf("the row said %d bytes over one long path, and the line holds %d: %s",
			len(res.Evidence), journal.MaxTextBytes, res.Evidence)
	}
	if !strings.Contains(res.Evidence, "2 problems") {
		t.Errorf("the row said %q, and it does not count the problems it found", res.Evidence)
	}
}

// F43's pair, at the row. Two repos alike but for one file: the same bet, the
// same slice, the same misstatement, with program.md and without it. The row is
// red both times.
//
// This is where the defect bit. Unrunnable is counted and printed, but it never
// fails a run, so a row that answered unrunnable to the second repo let a real
// misstatement through. Deleting one file silenced the check.
func TestDeletingTheProgramFileDoesNotSilenceThePlanRow(t *testing.T) {
	// The misstatement both repos carry: a slice sitting on a milestone its bet
	// does not hold.
	broken := strings.Replace(planSlice, "milestone: demo_m1", "milestone: demo_m9", 1)

	withFile := newRepo(t)
	writePlanFiles(t, withFile, planFiles("docs/plan/demo/demo_bet/demo_s1.md", broken))

	first := runRow(t, withFile, "plan")
	if first.Outcome != Red {
		t.Fatalf("a plan that misstates itself came out %s: %s", first.Outcome, first.Evidence)
	}
	if !strings.Contains(first.Evidence, "demo_m9") {
		t.Fatalf("the row said %q, and it does not name the misstatement", first.Evidence)
	}

	files := planFiles("docs/plan/demo/demo_bet/demo_s1.md", broken)
	delete(files, "docs/plan/demo/program.md")

	without := newRepo(t)
	writePlanFiles(t, without, files)

	second := runRow(t, without, "plan")
	if second.Outcome != Red {
		t.Fatalf("deleting the program file turned a red plan row %s: %s", second.Outcome, second.Evidence)
	}
	if !strings.Contains(second.Evidence, "holds no program.md") {
		t.Errorf("the row said %q, and it does not name the file that is missing", second.Evidence)
	}
	if !strings.Contains(second.Evidence, " problems, the first: ") {
		t.Errorf("the row said %q, and it found nothing wrong beyond the missing file", second.Evidence)
	}
}

// A plan directory that holds no unit is not a pass. D17: a verifier may never
// pass on nothing, and somebody halfway through writing their first plan is
// exactly who this protects.
func TestPlanRowIsUnrunnableOnAPlanDirectoryHoldingNothing(t *testing.T) {
	dir := newRepo(t)
	if err := os.MkdirAll(filepath.Join(dir, "docs", "plan"), 0o750); err != nil {
		t.Fatalf("could not make the plan directory: %v", err)
	}

	res := runRow(t, dir, "plan")
	if res.Outcome != Unrunnable {
		t.Fatalf("an empty plan directory came out %s: %s", res.Outcome, res.Evidence)
	}
	if !strings.Contains(res.Evidence, "docs/plan") {
		t.Errorf("the row said %q, and it does not name the directory", res.Evidence)
	}
}

// TestPlanRowIsGreenOnThisRepo runs the row against the repo it ships in. This
// repo writes its own plan in this format, so a format nobody can write shows
// up here first.
func TestPlanRowIsGreenOnThisRepo(t *testing.T) {
	res := runRow(t, ".", "plan")
	if res.Outcome != Green {
		t.Fatalf("this repo's own plan row came out %s: %s", res.Outcome, res.Evidence)
	}
}

// A row's evidence is read on a machine that is not the one that wrote it, so a
// temporary directory in a line of evidence says nothing to the reader.
func TestPlanRowEvidenceNeverCarriesAMachinePath(t *testing.T) {
	dir := newRepo(t)
	writePlan(t, dir, "docs/plan/demo/demo_bet/demo_s1.md", "# no frontmatter here\n")

	res := runRow(t, dir, "plan")
	if strings.Contains(res.Evidence, dir) || strings.Contains(res.Evidence, os.TempDir()) {
		t.Errorf("the row said %q, and it carries a path from the machine it ran on", res.Evidence)
	}
}

// The row kinds are a closed vocabulary, so the list is written out here rather
// than computed. D28 closed it, and R16 says each row this bet adds joins it as
// its own kind. A kind that arrives without a ruling behind it shows up as a
// failure, the way the journal's own vocabulary test works.
func TestTheRowKindVocabularyIsPinned(t *testing.T) {
	want := []string{
		"version", "manifest",
		"honesty", "wiring", "token", "divergence", "reachability",
		"flag", "mutate", "seal-verify", "run-evidence",
		"plan", "chain", "board", "stub", "trace",
	}

	if !slices.Equal(kinds, want) {
		t.Fatalf("the row kind vocabulary is %v, want %v", kinds, want)
	}
}

// D23: a row added moves the major half of the version. This slice adds the
// plan row, so 5.0 — the version bet 2 closed at — is no longer a version
// anybody can be held to. The digest moves with the row list, and the version
// row would find that drift on this repo first.
func TestThisRepoDeclaresTheBumpThePlanRowCost(t *testing.T) {
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
	if major < 6 {
		t.Errorf("%s declares %s, and the plan row puts this battery at 6.0 or past it",
			LockFile, lock.Version)
	}
}
