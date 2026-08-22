package battery

import (
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"testing"
)

// The honesty scan reads the tests a project ships and asks whether they could
// ever fail. Every case below is one fixture repo holding one shape, with an
// honest twin wherever the shape has one.

// honestDirect is the plainest honest test there is: a condition and a
// failure call under it.
const honestDirect = `package alpha

import "testing"

func TestAdds(t *testing.T) {
	if 1+1 != 2 {
		t.Fatalf("arithmetic broke")
	}
}
`

// honestTable is the table-driven shape the old world's scan died on: the
// assertion lives in a helper the loop calls, and the helper takes the test's
// own *testing.T. A false red against this pattern is what made that scan's
// count worthless, so it gets its own green case here.
const honestTable = `package alpha

import "testing"

func check(t *testing.T, got, want int) {
	t.Helper()
	if got != want {
		t.Errorf("got %d, want %d", got, want)
	}
}

func TestTable(t *testing.T) {
	cases := []struct{ got, want int }{{1, 1}, {2, 2}}
	for _, c := range cases {
		check(t, c.got, c.want)
	}
}
`

// honestSubtests asserts inside a t.Run closure, which is the other half of
// the table pattern.
const honestSubtests = `package alpha

import "testing"

func TestSubtests(t *testing.T) {
	for _, name := range []string{"a", "b"} {
		t.Run(name, func(t *testing.T) {
			if name == "" {
				t.Error("the name is empty")
			}
		})
	}
}
`

// honestOutsideHelper hands the test's own T to a helper this file cannot see.
// The scan cannot follow it, so it must not call the test vacuous: a false red
// here poisons trust in the whole row.
const honestOutsideHelper = `package alpha

import "testing"

func TestViaHelper(t *testing.T) {
	mustAddUp(t, 1, 1)
}
`

// honestPlusSelfCompare holds a real assertion beside a self-comparison. Only
// a test whose every assertion is vacuous is vacuous.
const honestPlusSelfCompare = `package alpha

import "testing"

func TestBoth(t *testing.T) {
	got := 2
	if got != got {
		t.Errorf("never")
	}
	if got != 2 {
		t.Fatalf("got %d, want 2", got)
	}
}
`

// honestHarness keeps the test's own *testing.T inside a struct and asserts
// through it later. The scan cannot follow what the harness does next, so the
// handle escaping into the constructor is where it must stop judging.
const honestHarness = `package alpha

import "testing"

type harness struct {
	t *testing.T
}

func newHarness(t *testing.T) *harness {
	return &harness{t: t}
}

func (h *harness) mustAddUp(got, want int) {
	if got != want {
		h.t.Errorf("got %d, want %d", got, want)
	}
}

func TestViaHarness(t *testing.T) {
	h := newHarness(t)
	h.mustAddUp(1+1, 2)
}
`

// honestPanic fails by panicking, which the runner reports as a failure like
// any other.
const honestPanic = `package alpha

import "testing"

func TestPanics(t *testing.T) {
	if 1+1 != 2 {
		panic("arithmetic broke")
	}
}
`

// honestMust fails through a Must-named call, which panics when it does not
// get what it must have.
const honestMust = `package alpha

import "testing"

func TestMustParse(t *testing.T) {
	got := MustParse("1")
	_ = got
}
`

func TestHonestyRowIsInTheDefaultBattery(t *testing.T) {
	registered(t, "honesty", "honesty")
}

func TestHonestyRowIsGreenOnHonestTests(t *testing.T) {
	cases := []struct {
		name string
		file string
	}{
		{"a direct assertion", honestDirect},
		{"a table driven test with an asserting helper", honestTable},
		{"assertions inside subtests", honestSubtests},
		{"a helper this file cannot see", honestOutsideHelper},
		{"a real assertion beside a vacuous one", honestPlusSelfCompare},
		{"a harness holding the test's own handle", honestHarness},
		{"a test that fails by panicking", honestPanic},
		{"a test that fails through a Must call", honestMust},
	}

	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			dir := newRepo(t)
			writeManifest(t, dir, goCLISurface)
			writeSource(t, dir, "alpha/alpha_test.go", c.file)

			res := runRow(t, dir, "honesty")
			if res.Outcome != Green {
				t.Fatalf("the row came out %s: %s", res.Outcome, res.Evidence)
			}
		})
	}
}

// TestHonestyRowIsRedOnAVacuousTest is the row's whole job. Each shape is one
// of the ways a suite stays green while it proves nothing.
func TestHonestyRowIsRedOnAVacuousTest(t *testing.T) {
	cases := []struct {
		name  string
		file  string
		test  string
		shape string
	}{
		{
			"no assertion at all",
			"package alpha\n\nimport \"testing\"\n\nfunc TestNothing(t *testing.T) {\n\tgot := 1 + 1\n\t_ = got\n}\n",
			"TestNothing", "asserts nothing",
		},
		{
			"an assertion comparing a value to itself",
			"package alpha\n\nimport \"testing\"\n\nfunc TestSelf(t *testing.T) {\n\tgot := 1 + 1\n\tif got != got {\n\t\tt.Errorf(\"got %d\", got)\n\t}\n}\n",
			"TestSelf", "compares a value to itself",
		},
		{
			"the only assertion commented out",
			"package alpha\n\nimport \"testing\"\n\nfunc TestCommented(t *testing.T) {\n\tgot := 1 + 1\n\t_ = got\n\t// if got != 2 {\n\t// \tt.Errorf(\"got %d, want 2\", got)\n\t// }\n}\n",
			"TestCommented", "commented out",
		},
		{
			"a skip as the first statement",
			"package alpha\n\nimport \"testing\"\n\nfunc TestSkipped(t *testing.T) {\n\tt.Skip(\"later\")\n\tif 1 != 2 {\n\t\tt.Fatal(\"never reached\")\n\t}\n}\n",
			"TestSkipped", "skipped unconditionally",
		},
		{
			// The common shape: the skip stands after something else, so a rule
			// that read only the first statement would miss every one of them.
			"a skip after t.Parallel",
			"package alpha\n\nimport \"testing\"\n\nfunc TestParallelSkipped(t *testing.T) {\n\tt.Parallel()\n\tt.Skip(\"later\")\n\tif 1 != 2 {\n\t\tt.Fatal(\"never reached\")\n\t}\n}\n",
			"TestParallelSkipped", "skipped unconditionally",
		},
		{
			// The twin of the table-driven green case: the scan follows a
			// helper this file declares, so a helper that judges nothing is a
			// test that judges nothing.
			"a helper that asserts nothing",
			"package alpha\n\nimport \"testing\"\n\nfunc check(t *testing.T, got, want int) {\n\t_ = got\n\t_ = want\n}\n\n" +
				"func TestViaLocalHelper(t *testing.T) {\n\tcheck(t, 1, 2)\n}\n",
			"TestViaLocalHelper", "asserts nothing",
		},
		{
			"logging instead of asserting",
			"package alpha\n\nimport \"testing\"\n\nfunc TestLogs(t *testing.T) {\n\tgot := 1 + 1\n\tt.Logf(\"got %d\", got)\n}\n",
			"TestLogs", "logs but never asserts",
		},
	}

	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			dir := newRepo(t)
			writeManifest(t, dir, goCLISurface)
			writeSource(t, dir, "alpha/alpha_test.go", c.file)

			res := runRow(t, dir, "honesty")
			if res.Outcome != Red {
				t.Fatalf("%s came out %s: %s", c.name, res.Outcome, res.Evidence)
			}
			mustContain(t, res.Evidence, "alpha/alpha_test.go:", c.test, c.shape)
		})
	}
}

// A skip under a condition is a test that runs when the condition is false.
// Reading it as a dead test would be a false red on every fixture that needs a
// tool the machine may not have.
func TestHonestyRowLeavesAConditionalSkipAlone(t *testing.T) {
	dir := newRepo(t)
	writeManifest(t, dir, goCLISurface)
	writeSource(t, dir, "alpha/alpha_test.go",
		"package alpha\n\nimport \"testing\"\n\nfunc TestMaybe(t *testing.T) {\n\tif testing.Short() {\n\t\tt.Skip(\"short\")\n\t}\n\tif 1 != 2 {\n\t\tt.Fatal(\"no\")\n\t}\n}\n")

	res := runRow(t, dir, "honesty")
	if res.Outcome != Green {
		t.Fatalf("the row came out %s: %s", res.Outcome, res.Evidence)
	}
}

// A self-comparison of two calls is not the vacuous shape: two calls can
// return two answers. The scan errs green there, and this pins that it does.
func TestHonestyRowLeavesTwoCallsAlone(t *testing.T) {
	dir := newRepo(t)
	writeManifest(t, dir, goCLISurface)
	writeSource(t, dir, "alpha/alpha_test.go",
		"package alpha\n\nimport \"testing\"\n\nfunc next() int { return 1 }\n\n"+
			"func TestCalls(t *testing.T) {\n\tif next() != next() {\n\t\tt.Errorf(\"unstable\")\n\t}\n}\n")

	res := runRow(t, dir, "honesty")
	if res.Outcome != Green {
		t.Fatalf("the row came out %s: %s", res.Outcome, res.Evidence)
	}
}

// One red row, whatever the count. The evidence names as many hits as fit and
// says how many more there were, so a reader knows the size of what they face
// and every path in the line is a whole one.
func TestHonestyRowReportsManyHitsAsOneRowWithACappedList(t *testing.T) {
	dir := newRepo(t)
	writeManifest(t, dir, goCLISurface)

	var file strings.Builder
	file.WriteString("package alpha\n\nimport \"testing\"\n")
	for i := range 6 {
		file.WriteString("\nfunc TestEmpty" + strconv.Itoa(i) + "(t *testing.T) {\n}\n")
	}
	writeSource(t, dir, "alpha/alpha_test.go", file.String())

	res := runRow(t, dir, "honesty")
	if res.Outcome != Red {
		t.Fatalf("the row came out %s: %s", res.Outcome, res.Evidence)
	}
	mustFit(t, res.Evidence, "6", "TestEmpty0", "more")
	if strings.Contains(res.Evidence, "TestEmpty5") {
		t.Errorf("the evidence lists every hit rather than the first few: %s", res.Evidence)
	}
}

// A test file that does not parse is red with the parser's own words. An
// unreadable file must never read as an absent one.
func TestHonestyRowIsRedOnATestFileThatDoesNotParse(t *testing.T) {
	dir := newRepo(t)
	writeManifest(t, dir, goCLISurface)
	writeSource(t, dir, "alpha/alpha_test.go", "package alpha\n\nthis is not go\n")

	res := runRow(t, dir, "honesty")
	if res.Outcome != Red {
		t.Fatalf("the row came out %s: %s", res.Outcome, res.Evidence)
	}
	mustContain(t, res.Evidence, "alpha/alpha_test.go", "does not parse")
}

// Bytes that are not UTF-8 are a file the parser refuses, so the row is red
// and names it. The test itself is honest, so red can only come from the
// bytes.
func TestHonestyRowIsRedOnATestFileOfBadBytes(t *testing.T) {
	dir := newRepo(t)
	writeManifest(t, dir, goCLISurface)
	writeBytes(t, dir, "alpha/alpha_test.go", []byte(
		"package alpha\n\nimport \"testing\"\n\nfunc TestBad(t *testing.T) {\n\tif 1 != 2 {\n\t\tt.Fatal(\"\xff\xfe\")\n\t}\n}\n"))

	res := runRow(t, dir, "honesty")
	if res.Outcome != Red {
		t.Fatalf("the row came out %s: %s", res.Outcome, res.Evidence)
	}
	mustContain(t, res.Evidence, "alpha/alpha_test.go")
}

// Generated files are skipped, and the row says so rather than quietly
// passing over them.
func TestHonestyRowSkipsAGeneratedTestFile(t *testing.T) {
	dir := newRepo(t)
	writeManifest(t, dir, goCLISurface)
	writeSource(t, dir, "alpha/alpha_test.go", honestDirect)
	writeSource(t, dir, "alpha/gen_test.go",
		"// Code generated by a generator. DO NOT EDIT.\n\npackage alpha\n\nimport \"testing\"\n\nfunc TestGenerated(t *testing.T) {\n}\n")

	res := runRow(t, dir, "honesty")
	if res.Outcome != Green {
		t.Fatalf("the row came out %s: %s", res.Outcome, res.Evidence)
	}
	mustContain(t, res.Evidence, "generated")
}

// A file with everything on one line still gets a file and a line in the
// evidence. A minified file is where a line number stops being obvious.
func TestHonestyRowReadsAMinifiedTestFile(t *testing.T) {
	dir := newRepo(t)
	writeManifest(t, dir, goCLISurface)
	writeSource(t, dir, "alpha/alpha_test.go",
		"package alpha; import \"testing\"; func TestOne(t *testing.T) { x := 1; _ = x }; func TestTwo(t *testing.T) { y := 2; _ = y }\n")

	res := runRow(t, dir, "honesty")
	if res.Outcome != Red {
		t.Fatalf("the row came out %s: %s", res.Outcome, res.Evidence)
	}
	mustContain(t, res.Evidence, "alpha/alpha_test.go:1", "TestOne")
}

// A symlink is never followed out of the surface, and the row says one was
// there. Following it would read code the project does not ship.
func TestHonestyRowDoesNotFollowASymlink(t *testing.T) {
	outside := t.TempDir()
	target := filepath.Join(outside, "vacuous_test.go")
	writeFile(t, target, "package alpha\n\nimport \"testing\"\n\nfunc TestOutside(t *testing.T) {\n}\n")

	dir := newRepo(t)
	writeManifest(t, dir, goCLISurface)
	writeSource(t, dir, "alpha/alpha_test.go", honestDirect)

	link := filepath.Join(dir, "alpha", "linked_test.go")
	if err := os.Symlink(target, link); err != nil {
		t.Skipf("this machine cannot make symlinks: %v", err)
	}

	res := runRow(t, dir, "honesty")
	if res.Outcome != Green {
		t.Fatalf("the row came out %s: %s", res.Outcome, res.Evidence)
	}
	mustContain(t, res.Evidence, "symlink")
}

// A stack the Go scan cannot read is unrunnable with its reason, never a
// silent skip. D25: a stack the battery cannot read must not pass in silence.
func TestHonestyRowIsUnrunnableOnANonGoSurface(t *testing.T) {
	dir := newRepo(t)
	writeManifest(t, dir, webSurface)

	res := runRow(t, dir, "honesty")
	if res.Outcome != Unrunnable {
		t.Fatalf("the row came out %s: %s", res.Outcome, res.Evidence)
	}
	mustContain(t, res.Evidence, "node", "web")
}

// A scan that read no tests never says green. D17: a verifier may never pass
// on nothing.
func TestHonestyRowIsUnrunnableWhenItReadNoTests(t *testing.T) {
	dir := newRepo(t)
	writeManifest(t, dir, goCLISurface)

	res := runRow(t, dir, "honesty")
	if res.Outcome != Unrunnable {
		t.Fatalf("the row came out %s: %s", res.Outcome, res.Evidence)
	}
	mustContain(t, res.Evidence, "no tests")
}

// A repo with no manifest cannot be scanned at all, and the row says which
// file it wanted. The manifest row is the one that turns red on it.
func TestHonestyRowIsUnrunnableWithNoManifest(t *testing.T) {
	dir := newRepo(t)

	res := runRow(t, dir, "honesty")
	if res.Outcome != Unrunnable {
		t.Fatalf("the row came out %s: %s", res.Outcome, res.Evidence)
	}
	mustContain(t, res.Evidence, ".groundwork/manifest.json")
}

// A hit outranks a surface the scan could not read. The red is somebody's
// defect; the unreadable surface rides in the same evidence so neither is
// lost.
func TestHonestyRowKeepsARedWhenAnotherSurfaceCannotBeRead(t *testing.T) {
	dir := newRepo(t)
	writeManifest(t, dir, `{
  "schema": 1,
  "surfaces": [
    {"name": "cli", "profile": "cli", "stack": "go", "root": "."},
    {"name": "web", "profile": "web", "stack": "node", "root": "site"}
  ],
  "capabilities": [{"name": "adding", "surface": "cli", "proof": ["alpha"]}],
  "adapters": {"node": {"command": ["node", "adapter.mjs"]}}
}`)
	writeSource(t, dir, "alpha/alpha_test.go",
		"package alpha\n\nimport \"testing\"\n\nfunc TestNothing(t *testing.T) {\n}\n")

	res := runRow(t, dir, "honesty")
	if res.Outcome != Red {
		t.Fatalf("the row came out %s: %s", res.Outcome, res.Evidence)
	}
	mustContain(t, res.Evidence, "TestNothing", "web")
}

// Evidence is read on a machine that is not the one that wrote it, so no
// absolute path may reach it.
func TestHonestyRowEvidenceCarriesNoAbsolutePath(t *testing.T) {
	dir := newRepo(t)
	writeManifest(t, dir, strings.Replace(goCLISurface, `"root": "."`, `"root": "nowhere"`, 1))

	res := runRow(t, dir, "honesty")
	if res.Outcome == Green {
		t.Fatalf("a surface that does not exist came out green: %s", res.Evidence)
	}
	if strings.Contains(res.Evidence, dir) {
		t.Errorf("the evidence carries this machine's own path: %s", res.Evidence)
	}
	mustFit(t, res.Evidence, "nowhere")
}

// TestHonestyRowIsGreenOnThisRepo runs the row against the repo it ships in.
// A scan that reds on its own project's honest tests is a scan nobody will
// keep.
func TestHonestyRowIsGreenOnThisRepo(t *testing.T) {
	res := runRow(t, ".", "honesty")
	if res.Outcome != Green {
		t.Fatalf("this repo's own honesty row came out %s: %s", res.Outcome, res.Evidence)
	}
}
