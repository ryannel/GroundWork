package battery

import (
	"fmt"
	"path/filepath"
	"strconv"
	"strings"
	"testing"
	"time"

	"github.com/ryannel/groundwork/internal/adapter"
)

// The run-evidence row reconciles the tests a surface discovers against the
// tests its run actually reported. Every fixture below is a whole repo, because
// the row runs the project's own suite rather than reading its source.

// evidenceRepo makes a fixture repo with one Go surface at its root.
func evidenceRepo(t *testing.T) string {
	t.Helper()

	dir := newRepo(t)
	writeManifest(t, dir, goCLISurface)
	writeSource(t, dir, "go.mod", "module groundwork.test/fixture\n\ngo 1.24\n")

	return dir
}

// writeRunningSuite puts a package holding one test that really runs. It is
// what every fixture needs beside the shape under test, so that the run log is
// never empty for the wrong reason.
func writeRunningSuite(t *testing.T, dir, pkg string) {
	t.Helper()

	writeSource(t, dir, pkg+"/"+pkg+".go",
		"package "+pkg+"\n\nfunc AddsUp(a, b int) int { return a + b }\n")
	writeSource(t, dir, pkg+"/"+pkg+"_test.go",
		"package "+pkg+"\n\nimport \"testing\"\n\n"+
			"func TestAddsUp(t *testing.T) {\n\tif AddsUp(1, 1) != 2 {\n\t\tt.Fatal(\"no\")\n\t}\n}\n")
}

// writeGatedSuite puts a package whose TestMain never calls m.Run. Everything
// in it reads as a test and none of it executes, which is the never-run shape
// this row exists to catch.
func writeGatedSuite(t *testing.T, dir, pkg string, tests ...string) {
	t.Helper()

	var body strings.Builder
	body.WriteString("package " + pkg + "\n\nimport \"testing\"\n")
	for _, name := range tests {
		body.WriteString("\nfunc " + name + "(t *testing.T) {\n\tt.Fatal(\"this never runs\")\n}\n")
	}

	writeSource(t, dir, pkg+"/"+pkg+".go", "package "+pkg+"\n\nfunc AddsUp(a, b int) int { return a + b }\n")
	writeSource(t, dir, pkg+"/"+pkg+"_test.go", body.String())
	writeSource(t, dir, pkg+"/main_test.go",
		"package "+pkg+"\n\nimport (\n\t\"os\"\n\t\"testing\"\n)\n\n"+
			"func TestMain(m *testing.M) {\n\tos.Exit(0)\n}\n")
}

// nodeManifest points one node surface at one of the shipped adapter scripts.
func nodeManifest(t *testing.T, dir, script string) {
	t.Helper()

	path, err := filepath.Abs(filepath.Join("..", "adapter", "testdata", "scripts", script))
	if err != nil {
		t.Fatalf("could not resolve %s: %v", script, err)
	}

	writeManifest(t, dir, fmt.Sprintf(`{
  "schema": 1,
  "surfaces": [{"name": "web", "profile": "web", "stack": "node", "root": "."}],
  "capabilities": [{"name": "sign-in", "surface": "web", "proof": ["test/auth.test.mjs"]}],
  "adapters": {"node": {"command": ["node", %q]}}
}`, path))
}

// runEvidence runs the registered row against dir with the recursion guard
// cleared. These are the tests that have to reach the real run: every other
// suite in this repo runs under the guard when the battery is the one running
// it, and the guard is proven by its own test below.
func runEvidence(t *testing.T, dir string) Result {
	t.Helper()
	t.Setenv(adapter.RunGuardEnv, "")

	return runRow(t, dir, "run-evidence")
}

func TestRunEvidenceRowIsInTheDefaultBattery(t *testing.T) {
	registered(t, "run-evidence", "run-evidence")
}

// The two never-run shapes the design names: a TestMain gate that filters a
// suite out, and a build tag that excludes a file. Both leave a function that
// reads as a test to a person and never executes.
func TestRunEvidenceRowIsRedOnATestThatNeverRan(t *testing.T) {
	t.Run("a TestMain gate", func(t *testing.T) {
		dir := evidenceRepo(t)
		writeRunningSuite(t, dir, "beta")
		writeGatedSuite(t, dir, "gated", "TestNeverRuns")

		res := runEvidence(t, dir)
		if res.Outcome != Red {
			t.Fatalf("a gated suite came out %s: %s", res.Outcome, res.Evidence)
		}
		mustFit(t, res.Evidence, "gated/TestNeverRuns", "never ran")
	})

	t.Run("a build tag", func(t *testing.T) {
		dir := evidenceRepo(t)
		writeRunningSuite(t, dir, "beta")
		writeSource(t, dir, "tagged/tagged.go", "package tagged\n\nfunc AddsUp(a, b int) int { return a + b }\n")
		writeSource(t, dir, "tagged/tagged_test.go",
			"//go:build never\n\npackage tagged\n\nimport \"testing\"\n\nfunc TestBehindATag(t *testing.T) {}\n")

		res := runEvidence(t, dir)
		if res.Outcome != Red {
			t.Fatalf("a tagged-out test came out %s: %s", res.Outcome, res.Evidence)
		}
		mustFit(t, res.Evidence, "tagged/TestBehindATag", "never ran")
	})
}

// The other direction of D30's contract: a test the run named that discovery
// never saw is a defect in discovery, and it is red too. It is planted through
// an out-of-process adapter that invents a result, because a lying adapter is
// the only way this shape reaches the row.
func TestRunEvidenceRowIsRedOnATestThatRanAndWasNeverDiscovered(t *testing.T) {
	needNode(t)

	dir := newRepo(t)
	nodeManifest(t, dir, "evidence-invented.mjs")

	res := runEvidence(t, dir)
	if res.Outcome != Red {
		t.Fatalf("an invented result came out %s: %s", res.Outcome, res.Evidence)
	}
	mustFit(t, res.Evidence, "invented", "discover")
}

// B18: a run that executes zero tests is red. The whole surface is gated here,
// so the suite reports nothing at all — the shape that ships as a green board
// with no run behind it.
func TestRunEvidenceRowIsRedWhenTheSurfaceExecutedNothing(t *testing.T) {
	dir := evidenceRepo(t)
	writeGatedSuite(t, dir, "gated", "TestNeverRuns", "TestNeverRunsEither")

	res := runEvidence(t, dir)
	if res.Outcome != Red {
		t.Fatalf("a surface that ran nothing came out %s: %s", res.Outcome, res.Evidence)
	}
	mustFit(t, res.Evidence, "cli", "no tests")
}

// A skipped test ran: the runner scheduled it and reported it, and the skip is
// visible in the suite's own output. Counting it as never-run would red every
// repo with a platform guard in it. Unconditional skips are the honesty scan's
// catch, not this row's.
func TestRunEvidenceRowCountsASkippedTestAsRan(t *testing.T) {
	dir := evidenceRepo(t)
	writeSource(t, dir, "alpha/alpha.go", "package alpha\n\nfunc AddsUp(a, b int) int { return a + b }\n")
	writeSource(t, dir, "alpha/alpha_test.go",
		"package alpha\n\nimport \"testing\"\n\n"+
			"func TestSkipped(t *testing.T) {\n\tt.Skip(\"not on this machine\")\n}\n\n"+
			"func TestAddsUp(t *testing.T) {\n\tif AddsUp(1, 1) != 2 {\n\t\tt.Fatal(\"no\")\n\t}\n}\n")

	res := runEvidence(t, dir)
	if res.Outcome != Green {
		t.Fatalf("a skipped test came out %s: %s", res.Outcome, res.Evidence)
	}
}

// A failing test ran. Test failures are the suite's own job — CI runs the
// tests — and this row judges execution coverage, never outcomes. A row that
// went red on a failure would report one defect as two.
func TestRunEvidenceRowCountsAFailedTestAsRan(t *testing.T) {
	dir := evidenceRepo(t)
	writeSource(t, dir, "alpha/alpha.go", "package alpha\n\nfunc AddsUp(a, b int) int { return a + b }\n")
	writeSource(t, dir, "alpha/alpha_test.go",
		"package alpha\n\nimport \"testing\"\n\n"+
			"func TestFailsOnPurpose(t *testing.T) {\n\tt.Fatal(\"on purpose\")\n}\n\n"+
			"func TestAddsUp(t *testing.T) {\n\tif AddsUp(1, 1) != 2 {\n\t\tt.Fatal(\"no\")\n\t}\n}\n")

	res := runEvidence(t, dir)
	if res.Outcome != Green {
		t.Fatalf("a failing test came out %s: %s", res.Outcome, res.Evidence)
	}
}

// A healthy repo is green, and its subtests fold into their parents. A table
// test whose cases arrived in the run log under their own names would read as
// tests nobody discovered.
func TestRunEvidenceRowIsGreenWhenDiscoveredAndRanAgree(t *testing.T) {
	dir := evidenceRepo(t)
	writeRunningSuite(t, dir, "beta")
	writeSource(t, dir, "alpha/alpha.go", "package alpha\n\nfunc AddsUp(a, b int) int { return a + b }\n")
	writeSource(t, dir, "alpha/alpha_test.go",
		"package alpha\n\nimport \"testing\"\n\n"+
			"func TestTable(t *testing.T) {\n"+
			"\tfor _, name := range []string{\"one\", \"two\"} {\n"+
			"\t\tt.Run(name, func(t *testing.T) {\n\t\t\tif AddsUp(1, 1) != 2 {\n\t\t\t\tt.Fatal(\"no\")\n\t\t\t}\n\t\t})\n"+
			"\t}\n}\n")

	res := runEvidence(t, dir)
	if res.Outcome != Green {
		t.Fatalf("a healthy repo came out %s: %s", res.Outcome, res.Evidence)
	}
	mustFit(t, res.Evidence, "2 discovered tests", "2 suites")
}

// A stack with no adapter is named and never silently passed. The row reports
// unrunnable rather than red: the manifest row owns the fail-closed red D25
// asks for, and two rows claiming one failure is two reds for one fix.
func TestRunEvidenceRowIsUnrunnableOnAnOffStackSurface(t *testing.T) {
	dir := newRepo(t)
	writeManifest(t, dir, `{
  "schema": 1,
  "surfaces": [{"name": "web", "profile": "web", "stack": "node", "root": "."}],
  "capabilities": [{"name": "sign-in", "surface": "web", "proof": ["test/auth.test.mjs"]}]
}`)

	res := runEvidence(t, dir)
	if res.Outcome != Unrunnable {
		t.Fatalf("an off-stack surface came out %s: %s", res.Outcome, res.Evidence)
	}
	mustFit(t, res.Evidence, "web", "node")
}

// A run that failed outright tells the row nothing about what executed. Half a
// run can only manufacture never-runs that are not there, so the surface is
// unrunnable and never red.
func TestRunEvidenceRowIsUnrunnableWhenARunFailedOutright(t *testing.T) {
	needNode(t)

	dir := newRepo(t)
	nodeManifest(t, dir, "evidence-runbroken.mjs")

	res := runEvidence(t, dir)
	if res.Outcome != Unrunnable {
		t.Fatalf("a broken run came out %s: %s", res.Outcome, res.Evidence)
	}
	mustFit(t, res.Evidence, "web")
}

// D32's precedence, and the split this row makes inside it. A red found on one
// surface outlives another surface the row could not read at all: the red is a
// defect somebody has to fix, and the unreadable surface rides in the same line
// so neither is lost.
func TestRunEvidenceRowKeepsARedWhenAnotherSurfaceCannotBeRead(t *testing.T) {
	dir := evidenceRepo(t)
	writeManifest(t, dir, `{
  "schema": 1,
  "surfaces": [
    {"name": "cli", "profile": "cli", "stack": "go", "root": "."},
    {"name": "missing", "profile": "library", "stack": "go", "root": "nowhere"}
  ],
  "capabilities": [{"name": "adding", "surface": "cli", "proof": ["beta"]}]
}`)
	writeRunningSuite(t, dir, "beta")
	writeGatedSuite(t, dir, "gated", "TestNeverRuns")

	res := runEvidence(t, dir)
	if res.Outcome != Red {
		t.Fatalf("a red beside an unreadable surface came out %s: %s", res.Outcome, res.Evidence)
	}
	mustFit(t, res.Evidence, "gated/TestNeverRuns", "missing")
}

// The other half of the split. A surface whose own run broke contributes no
// red, however many tests it discovered — but it does not cancel a red found
// somewhere else either.
func TestRunEvidenceRowKeepsARedWhenAnotherSurfacesRunBroke(t *testing.T) {
	needNode(t)

	script, err := filepath.Abs(filepath.Join("..", "adapter", "testdata", "scripts", "evidence-runbroken.mjs"))
	if err != nil {
		t.Fatalf("could not resolve the script: %v", err)
	}

	dir := evidenceRepo(t)
	writeManifest(t, dir, fmt.Sprintf(`{
  "schema": 1,
  "surfaces": [
    {"name": "cli", "profile": "cli", "stack": "go", "root": "."},
    {"name": "web", "profile": "web", "stack": "node", "root": "."}
  ],
  "capabilities": [{"name": "adding", "surface": "cli", "proof": ["beta"]}],
  "adapters": {"node": {"command": ["node", %q]}}
}`, script))
	writeRunningSuite(t, dir, "beta")
	writeGatedSuite(t, dir, "gated", "TestNeverRuns")

	res := runEvidence(t, dir)
	if res.Outcome != Red {
		t.Fatalf("a red beside a broken run came out %s: %s", res.Outcome, res.Evidence)
	}
	mustFit(t, res.Evidence, "gated/TestNeverRuns", "web")
}

// D18: an adapter that reports one test twice must not turn into a defect the
// row invents. Discovery naming a test twice is counted once.
func TestRunEvidenceRowCountsATestDiscoveredTwiceOnce(t *testing.T) {
	needNode(t)

	dir := newRepo(t)
	nodeManifest(t, dir, "evidence-twice.mjs")

	res := runEvidence(t, dir)
	if res.Outcome != Green {
		t.Fatalf("a test discovered twice came out %s: %s", res.Outcome, res.Evidence)
	}
	mustFit(t, res.Evidence, "1 discovered test", "named 1 test twice")
}

// D18: a run log naming one test twice with two outcomes folds into one
// result. Neither copy is a test nobody discovered.
func TestRunEvidenceRowFoldsARunLogThatNamesATestTwice(t *testing.T) {
	needNode(t)

	dir := newRepo(t)
	nodeManifest(t, dir, "evidence-conflict.mjs")

	res := runEvidence(t, dir)
	if res.Outcome != Green {
		t.Fatalf("a test reported twice came out %s: %s", res.Outcome, res.Evidence)
	}
	mustFit(t, res.Evidence, "1 discovered test")
}

// D18: a result with no name is one nothing can be reconciled against. The
// seam refuses it, and the row reports the surface unrunnable rather than
// inventing a test that ran under no name.
func TestRunEvidenceRowRefusesANamelessResult(t *testing.T) {
	needNode(t)

	dir := newRepo(t)
	nodeManifest(t, dir, "evidence-nameless.mjs")

	res := runEvidence(t, dir)
	if res.Outcome != Unrunnable {
		t.Fatalf("a nameless result came out %s: %s", res.Outcome, res.Evidence)
	}
	mustFit(t, res.Evidence, "web")
}

// One red row, whatever the count, with as many tests named whole as the
// journal's cap holds and a count of the rest.
func TestRunEvidenceRowNamesManyNeverRunTestsWithinTheCap(t *testing.T) {
	dir := evidenceRepo(t)
	writeRunningSuite(t, dir, "beta")

	names := make([]string, 0, 12)
	for i := range 12 {
		names = append(names, fmt.Sprintf("TestNeverRuns%02d", i))
	}
	writeGatedSuite(t, dir, "gated", names...)

	res := runEvidence(t, dir)
	if res.Outcome != Red {
		t.Fatalf("the row came out %s: %s", res.Outcome, res.Evidence)
	}
	mustFit(t, res.Evidence, "12", "gated/TestNeverRuns00", "more")
	if strings.Contains(res.Evidence, "TestNeverRuns11") {
		t.Errorf("the evidence lists every hit rather than the first few: %s", res.Evidence)
	}
}

// A surface holding no test at all has not been checked, and green would say
// it had. D17: a verifier may never pass on nothing. The surface is the thing
// that has nothing to reconcile, so the surface is what the row says it about.
func TestRunEvidenceRowIsUnrunnableWhenASurfaceHoldsNoTest(t *testing.T) {
	dir := evidenceRepo(t)
	writeSource(t, dir, "alpha/alpha.go", "package alpha\n\nfunc AddsUp(a, b int) int { return a + b }\n")

	res := runEvidence(t, dir)
	if res.Outcome != Unrunnable {
		t.Fatalf("a repo with no tests came out %s: %s", res.Outcome, res.Evidence)
	}
	mustFit(t, res.Evidence, "cli", "holds no test")
}

func TestRunEvidenceRowIsUnrunnableWithNoManifest(t *testing.T) {
	dir := newRepo(t)

	res := runEvidence(t, dir)
	if res.Outcome != Unrunnable {
		t.Fatalf("the row came out %s: %s", res.Outcome, res.Evidence)
	}
	mustContain(t, res.Evidence, ".groundwork/manifest.json")
}

// A row's evidence is read on a machine that is not the one that wrote it, so
// a temporary directory in a line of evidence says nothing to the reader — and
// it fills a line the journal caps.
func TestRunEvidenceEvidenceNeverCarriesAMachinePath(t *testing.T) {
	dir := evidenceRepo(t)
	writeManifest(t, dir, strings.Replace(goCLISurface, `"root": "."`, `"root": "nowhere"`, 1))

	res := runEvidence(t, dir)
	if strings.Contains(res.Evidence, dir) {
		t.Errorf("the evidence carries this machine's own path: %s", res.Evidence)
	}
	mustFit(t, res.Evidence)
}

// D23: a row added moves the major half of the version, and the digest in the
// lock file must be the one the shipped rows compute.
func TestThisRepoDeclaresTheBumpTheRunEvidenceRowNeeds(t *testing.T) {
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
	// 2.0 is the version declared when the battery held five rows. The
	// run-evidence row is a sixth, so the major moves again.
	if major < 3 {
		t.Errorf("%s declares %s, and the battery has gained a row since 2.0", LockFile, lock.Version)
	}
}

// A suite that crashed mid-run tells the row nothing about the tests behind the
// crash. They never ran, and they never will have — but calling them never-run
// would report a stack trace as a pile of tests nobody wired up. The row says
// the run did not finish, and says what killed it.
func TestRunEvidenceRowIsUnrunnableWhenTheSuiteCrashed(t *testing.T) {
	dir := evidenceRepo(t)
	writeSource(t, dir, "alpha/alpha.go", "package alpha\n\nfunc AddsUp(a, b int) int { return a + b }\n")
	writeSource(t, dir, "alpha/alpha_test.go",
		"package alpha\n\nimport \"testing\"\n\n"+
			"func TestFirst(t *testing.T) {\n\tif AddsUp(1, 1) != 2 {\n\t\tt.Fatal(\"no\")\n\t}\n}\n\n"+
			"func TestPanics(t *testing.T) {\n\tpanic(\"boom\")\n}\n\n"+
			"func TestThird(t *testing.T) {}\n")

	res := runEvidence(t, dir)
	if res.Outcome != Unrunnable {
		t.Fatalf("a crashed suite came out %s: %s", res.Outcome, res.Evidence)
	}
	mustFit(t, res.Evidence, "crashed")
	if strings.Contains(res.Evidence, "never ran") {
		t.Errorf("a crash was reported as a never-run test: %s", res.Evidence)
	}
	if strings.Contains(res.Evidence, "TestThird") {
		t.Errorf("the tests behind the crash were named as defects: %s", res.Evidence)
	}
}

// A nested module is another project. go test ./... stops at its go.mod, so a
// tools/ or examples/ module discovered as part of this one would be a pile of
// tests that can never appear in this project's run log.
func TestRunEvidenceRowLeavesANestedModuleAlone(t *testing.T) {
	dir := evidenceRepo(t)
	writeRunningSuite(t, dir, "beta")
	writeSource(t, dir, "tools/go.mod", "module groundwork.test/fixture/tools\n\ngo 1.24\n")
	writeSource(t, dir, "tools/gen.go", "package tools\n\nfunc AddsUp(a, b int) int { return a + b }\n")
	writeSource(t, dir, "tools/gen_test.go",
		"package tools\n\nimport \"testing\"\n\n"+
			"func TestNestedModule(t *testing.T) {\n\tif AddsUp(1, 1) != 2 {\n\t\tt.Fatal(\"no\")\n\t}\n}\n")

	res := runEvidence(t, dir)
	if res.Outcome != Green {
		t.Fatalf("a nested module came out %s: %s", res.Outcome, res.Evidence)
	}
	if strings.Contains(res.Evidence, "TestNestedModule") {
		t.Errorf("a nested module's test was reconciled against this module's run: %s", res.Evidence)
	}
}

// B18 on the out-of-process side: an adapter that discovers a suite and then
// reports a clean sweep of nothing has executed zero tests, and zero is red.
// The seam refuses the empty log, and the row reads that refusal as the answer
// it is rather than as a run that broke.
func TestRunEvidenceRowIsRedWhenAnOutOfProcessRunExecutedNothing(t *testing.T) {
	needNode(t)

	dir := newRepo(t)
	nodeManifest(t, dir, "evidence-notests.mjs")

	res := runEvidence(t, dir)
	if res.Outcome != Red {
		t.Fatalf("an out-of-process run of nothing came out %s: %s", res.Outcome, res.Evidence)
	}
	mustFit(t, res.Evidence, "web", "no tests")
}

// The budget is the row's, shared across every surface it reads. A run that
// outlives it is unrunnable: a clock that ran out says nothing about what
// executed.
func TestRunEvidenceRowIsUnrunnableWhenItsBudgetRanOut(t *testing.T) {
	dir := evidenceRepo(t)
	writeRunningSuite(t, dir, "beta")
	t.Setenv(adapter.RunGuardEnv, "")

	res := runEvidenceRowWithin(time.Nanosecond).Check(Context{RepoDir: dir})
	if res.Outcome != Unrunnable {
		t.Fatalf("a run out of time came out %s: %s", res.Outcome, res.Evidence)
	}
	mustFit(t, res.Evidence, "cli")
}

// The recursion guard, both halves. A project whose own suite calls the battery
// would run the battery inside the battery forever, and this repo is one such
// project.
func TestRunEvidenceRowRefusesToRunInsideItself(t *testing.T) {
	dir := evidenceRepo(t)
	writeRunningSuite(t, dir, "beta")
	t.Setenv(adapter.RunGuardEnv, "1")

	res := runRow(t, dir, "run-evidence")
	if res.Outcome != Unrunnable {
		t.Fatalf("the row ran inside a battery run and came out %s: %s", res.Outcome, res.Evidence)
	}
	mustFit(t, res.Evidence, "already running inside a battery run")
}

// The seam refuses a suite with no id and a result with no name before either
// reaches the row, so the row's own defence against them is reached through its
// reconciliation directly. Its expected answers come from D18's
// adversarial-input duty and from the trust boundary this row states — never
// from what the code happens to do.
//
// Both refusals leave the surface unrunnable. An entry the row cannot name is
// an entry it cannot match, and a set with a hole in it can only manufacture
// defects that are not there.
func TestRunEvidenceReconciliationRefusesWhatItCannotName(t *testing.T) {
	t.Run("a suite with no id", func(t *testing.T) {
		_, _, err := discoveredTests([]adapter.Suite{{ID: "  ", Tests: []string{"TestAddsUp"}}})
		if err == nil {
			t.Fatal("a suite with no id was reconciled")
		}
	})

	t.Run("a discovered test with no name", func(t *testing.T) {
		_, _, err := discoveredTests([]adapter.Suite{{ID: "alpha", Tests: []string{""}}})
		if err == nil {
			t.Fatal("a test with no name was reconciled")
		}
	})

	t.Run("a result with no name", func(t *testing.T) {
		_, _, err := ranTests(adapter.RunLog{Tests: []adapter.TestRun{{Suite: "alpha", Name: " "}}})
		if err == nil {
			t.Fatal("a result with no name was reconciled")
		}
	})
}

// One name is one test on both sides. Counted twice on the discovered side it
// would read as a test the run never reported; counted twice on the ran side it
// would read as a test nobody discovered. Both would be reds the row invented
// out of an adapter's own repetition.
func TestRunEvidenceReconciliationCountsARepeatedNameOnce(t *testing.T) {
	t.Run("discovered twice", func(t *testing.T) {
		ids, notes, err := discoveredTests([]adapter.Suite{
			{ID: "alpha", Tests: []string{"TestAddsUp", "TestAddsUp"}},
		})
		if err != nil {
			t.Fatalf("a repeated name was refused: %v", err)
		}
		if len(ids) != 1 || ids[0] != "alpha/TestAddsUp" {
			t.Fatalf("discovery reconciled to %v, want one alpha/TestAddsUp", ids)
		}
		if len(notes) == 0 {
			t.Error("the repetition was folded away without a word about it")
		}
	})

	t.Run("reported twice", func(t *testing.T) {
		ids, notes, err := ranTests(adapter.RunLog{Tests: []adapter.TestRun{
			{Suite: "alpha", Name: "TestAddsUp", Outcome: adapter.Pass},
			{Suite: "alpha", Name: "TestAddsUp", Outcome: adapter.Fail},
		}})
		if err != nil {
			t.Fatalf("a repeated result was refused: %v", err)
		}
		if len(ids) != 1 || ids[0] != "alpha/TestAddsUp" {
			t.Fatalf("the run log reconciled to %v, want one alpha/TestAddsUp", ids)
		}
		if len(notes) == 0 {
			t.Error("the repetition was folded away without a word about it")
		}
	})
}
