package adapter

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"slices"
	"strconv"
	"strings"
	"testing"
	"time"
)

// goPack and nodePack are the shipped fixture pack: one tiny Go module and one
// tiny node --test project. Each carries its own answer key, so conformance
// asks the pack what is true rather than being told by the adapter under test.
const (
	goPack   = "testdata/gopack"
	nodePack = "testdata/nodepack"
)

// nodeAdapter is the shipped example adapter script, run out of process.
const nodeAdapterScript = "testdata/adapters/node.mjs"

func TestGoAdapterPassesConformance(t *testing.T) {
	conformance(t, NewGo(), goPack)
}

// The adapter's name is the stack it speaks for, and it is the word a capability
// manifest writes in a surface's stack field. The battery picks an adapter by
// that word and prints it in the reasons it gives, so an adapter that forgot its
// own name would be the adapter for nothing.
//
// This package never asked it. The deletion test found the gap when the battery
// moved to 7.0: blanking Name left all 47 tests here green (F29's shape).
func TestTheGoAdapterNamesItsStack(t *testing.T) {
	if got := NewGo().Name(); got != "go" {
		t.Fatalf("the Go adapter calls itself %q, and a manifest names that stack \"go\"", got)
	}
}

// NewGo is the only way this package hands out its adapter, and every caller
// takes what it returns on trust.
//
// This package never asked whether it returned anything. The deletion test
// found the gap when the battery moved to 8.0: blanking NewGo makes it return a
// nil *Go, and all 48 tests here stayed green. Nothing here dereferences the
// adapter — Name has a pointer receiver that never touches its receiver, and
// conformance calls methods that behave the same on nil — so a nil adapter
// answered every question as happily as a real one. F29's shape, and F34's and
// F47's: the pin goes in the survivor's own package.
func TestNewGoHandsBackAnAdapter(t *testing.T) {
	if NewGo() == nil {
		t.Fatal("NewGo returned no adapter, and every caller of it takes one on trust")
	}
}

func TestNodeAdapterPassesConformance(t *testing.T) {
	needNode(t)

	conformance(t, newNodeAdapter(t), nodePack)
}

// TestConformanceCatchesALyingAdapter is the point of the suite. An adapter
// that reports the wrong counts must fail, or conformance proves nothing.
func TestConformanceCatchesALyingAdapter(t *testing.T) {
	cases := []struct {
		name  string
		lie   func(*lying)
		about string
	}{
		{"a dropped suite", func(l *lying) { l.dropSuite = true }, "suite"},
		{"an invented suite", func(l *lying) { l.extraSuite = true }, "suite"},
		{"a dropped test", func(l *lying) { l.dropTest = true }, "test"},
		{"a failing test reported as passing", func(l *lying) { l.allPass = true }, "fail"},
		{"a passing test reported as failing", func(l *lying) { l.allFail = true }, "pass"},
		{"a run that reports no tests at all", func(l *lying) { l.noTests = true }, "test"},
		{"a dropped mutant", func(l *lying) { l.dropMutant = true }, "mutant"},
		{"a mutant that changes nothing", func(l *lying) { l.emptyMutant = true }, "mutant"},
		{"a run with no duration", func(l *lying) { l.noDuration = true }, "duration"},
		{"a cosmetic mutator", func(l *lying) { l.cosmetic = true }, "changes nothing that matters"},
		{"one suite id reported twice", func(l *lying) { l.twiceSuite = true }, "twice"},
		{"TestMain counted as a test", func(l *lying) { l.testMain = true }, "testmain"},
		{"a test that ran but was never discovered", func(l *lying) { l.hidesFromDiscover = true }, "never"},
	}

	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			liar := &lying{under: NewGo()}
			c.lie(liar)

			problems := Check(liar, goPack)
			if len(problems) == 0 {
				t.Fatalf("conformance accepted %s", c.name)
			}
			if !strings.Contains(strings.ToLower(strings.Join(problems, "\n")), c.about) {
				t.Errorf("the problems do not mention %q: %v", c.about, problems)
			}
		})
	}
}

// TestConformanceReporterSeesEveryProblem holds conformance itself to the
// problems Check found: a helper that swallowed one would hide a lie.
func TestConformanceReporterSeesEveryProblem(t *testing.T) {
	liar := &lying{under: NewGo(), dropSuite: true, allPass: true}

	rec := &recorder{}
	conformance(rec, liar, goPack)

	if len(rec.errors) != len(Check(liar, goPack)) {
		t.Fatalf("conformance reported %d problems, Check found %d",
			len(rec.errors), len(Check(liar, goPack)))
	}
	if len(rec.errors) == 0 {
		t.Fatal("conformance reported nothing about a lying adapter")
	}
}

func TestGoAdapterDiscoversSuitesAndTests(t *testing.T) {
	suites, err := NewGo().Discover(context.Background(), goPack)
	if err != nil {
		t.Fatalf("Discover failed: %v", err)
	}

	ids := make([]string, 0, len(suites))
	for _, s := range suites {
		ids = append(ids, s.ID)
	}
	slices.Sort(ids)

	if !slices.Equal(ids, []string{"alpha", "beta"}) {
		t.Errorf("Discover found the suites %v, want [alpha beta]", ids)
	}

	for _, s := range suites {
		if s.Name == "" {
			t.Errorf("the suite %s has no package name", s.ID)
		}
		if len(s.Tests) == 0 {
			t.Errorf("the suite %s has no tests", s.ID)
		}
	}
}

// TestGoAdapterDiscoversWhatReadsAsATest is D30's ruling, held to the letter.
// A Test function with the testing.T signature counts. TestMain takes
// testing.M and is the harness. A benchmark is not a test this bet. A helper
// whose name starts with test is not one either.
func TestGoAdapterDiscoversWhatReadsAsATest(t *testing.T) {
	suites, err := NewGo().Discover(context.Background(), goPack)
	if err != nil {
		t.Fatalf("Discover failed: %v", err)
	}

	var alpha Suite
	for _, s := range suites {
		if s.ID == "alpha" {
			alpha = s
		}
	}

	want := []string{"TestAddsUp", "TestAddsUpWrong", "TestCounterAdds", "TestTable"}
	if !slices.Equal(alpha.Tests, want) {
		t.Fatalf("discover listed %v in alpha, want %v", alpha.Tests, want)
	}
	for _, unwanted := range []string{"TestMain", "BenchmarkAddsUp", "testHelper"} {
		if slices.Contains(alpha.Tests, unwanted) {
			t.Errorf("discover counted %s as a test", unwanted)
		}
	}
}

// TestGoAdapterDiscoversTestsNothingWillRun is the other half of D30. A test a
// build tag excludes still reads as a test. So does one a closed TestMain gate
// never calls. The never-run scan is built on seeing both, which is why
// discovery reads the source instead of asking the toolchain.
func TestGoAdapterDiscoversTestsNothingWillRun(t *testing.T) {
	dir := copyPack(t, goPack)
	writeFile(t, filepath.Join(dir, "alpha", "tagged_test.go"),
		"//go:build never\n\npackage alpha\n\nimport \"testing\"\n\nfunc TestBehindATag(t *testing.T) {}\n")

	suites, err := NewGo().Discover(context.Background(), dir)
	if err != nil {
		t.Fatalf("Discover failed: %v", err)
	}

	var found bool
	for _, s := range suites {
		if s.ID == "alpha" && slices.Contains(s.Tests, "TestBehindATag") {
			found = true
		}
	}
	if !found {
		t.Fatalf("discover hid a test a build tag excludes: %+v", suites)
	}

	// The same suite, gated shut, runs none of its tests while discovery still
	// lists every one. That gap is the never-run set, and a later slice calls
	// it red.
	t.Setenv("GROUNDWORK_PACK_GATE", "closed")

	log, err := NewGo().Run(context.Background(), goPack)
	if err != nil {
		t.Fatalf("the gated run failed: %v", err)
	}
	for _, tr := range log.Tests {
		if tr.Suite == "alpha" {
			t.Errorf("the gated suite still reported %s", tr.ID)
		}
	}

	discovered := 0
	for _, s := range suites {
		if s.ID == "alpha" {
			discovered = len(s.Tests)
		}
	}
	if discovered == 0 {
		t.Fatal("discovery lost the gated suite's tests, so nothing could ever call them never-run")
	}
}

// TestGoAdapterRunRefusesAnEmptyRunLog holds the fail-closed direction D30
// gives both shapes: a run that reported nothing is not a pass.
func TestGoAdapterRunRefusesAnEmptyRunLog(t *testing.T) {
	dir := t.TempDir()
	writeFile(t, filepath.Join(dir, "go.mod"), "module groundwork.test/empty\n\ngo 1.24\n")
	writeFile(t, filepath.Join(dir, "empty.go"), "package empty\n")

	_, err := NewGo().Run(context.Background(), dir)
	if err == nil {
		t.Fatal("a module with no tests at all reported a clean run")
	}
	if !errors.Is(err, ErrUnrunnable) {
		t.Errorf("an empty run log reported %v, which is not unrunnable", err)
	}
	// The caller has to tell a clean run of nothing from a run that broke: one
	// is red and the other is unrunnable. Only this sentinel says which.
	if !errors.Is(err, ErrNoTests) {
		t.Errorf("an empty run log reported %v, which does not carry ErrNoTests", err)
	}
}

// A run that did not finish is unrunnable, never a partial log. The tests
// behind a crash never ran, and handing them back as absent would make the
// battery report a stack trace as a pile of tests nobody wired up.
func TestGoAdapterRunRefusesARunThatDiedMidSuite(t *testing.T) {
	dir := t.TempDir()
	writeFile(t, filepath.Join(dir, "go.mod"), "module groundwork.test/crash\n\ngo 1.24\n")
	writeFile(t, filepath.Join(dir, "alpha_test.go"),
		"package crash\n\nimport \"testing\"\n\n"+
			"func TestFirst(t *testing.T) {}\n\n"+
			"func TestPanics(t *testing.T) {\n\tpanic(\"boom\")\n}\n\n"+
			"func TestThird(t *testing.T) {}\n")

	log, err := NewGo().Run(context.Background(), dir)
	if err == nil {
		t.Fatalf("a crashed run came back as a run log of %d tests", len(log.Tests))
	}
	if !errors.Is(err, ErrUnrunnable) {
		t.Errorf("a crashed run reported %v, which is not unrunnable", err)
	}
	if errors.Is(err, ErrNoTests) {
		t.Errorf("a crashed run reported %v, which reads as a clean run of nothing", err)
	}
	// A panic the code raised is not the clock giving up on it. The deletion
	// test reads the first as the suite noticing and the second as nobody
	// waiting, so the two must never carry one sentinel.
	if errors.Is(err, ErrTimedOut) {
		t.Errorf("a crashed run reported %v, which reads as a run that ran out of time", err)
	}
	// The stub check has to tell a run that died from one that broke some other
	// way: R10 makes the first a red with the reason named and the second missing
	// data. Only this sentinel says which.
	if !errors.Is(err, ErrCrashed) {
		t.Errorf("a crashed run reported %v, which does not carry ErrCrashed", err)
	}
	if !strings.Contains(err.Error(), "boom") {
		t.Errorf("the error %q does not say what killed the run", err)
	}
	if len(log.Tests) != 0 {
		t.Errorf("a refused run handed back %d tests", len(log.Tests))
	}
}

// A test binary that walks out writes no crash report at all. What it leaves
// behind is a test that reported starting and never reported ending, and that is
// the same fact as a crash: the run stopped before its tests finished. It has to
// carry the same marker, or a caller would read one of the two as a run that
// broke for a reason nobody named.
func TestGoAdapterRunRefusesARunWhoseBinaryWalkedOut(t *testing.T) {
	if runtime.GOOS == "windows" {
		t.Skip("this case kills the test binary with a signal, which this machine does not have")
	}

	// A signal rather than os.Exit, because the testing package catches os.Exit
	// and turns it back into a panic — which is the crash path, not this one.
	dir := t.TempDir()
	writeFile(t, filepath.Join(dir, "go.mod"), "module groundwork.test/exits\n\ngo 1.24\n")
	writeFile(t, filepath.Join(dir, "alpha_test.go"),
		"package exits\n\nimport (\n\t\"os\"\n\t\"syscall\"\n\t\"testing\"\n)\n\n"+
			"func TestFirst(t *testing.T) {}\n\n"+
			"func TestWalksOut(t *testing.T) {\n"+
			"\tif err := syscall.Kill(os.Getpid(), syscall.SIGKILL); err != nil {\n"+
			"\t\tt.Fatalf(\"could not stop the binary: %v\", err)\n\t}\n}\n\n"+
			"func TestThird(t *testing.T) {}\n")

	log, err := NewGo().Run(context.Background(), dir)
	if err == nil {
		t.Fatalf("a binary that walked out came back as a run log of %d tests", len(log.Tests))
	}
	if !errors.Is(err, ErrUnrunnable) {
		t.Errorf("a binary that walked out reported %v, which is not unrunnable", err)
	}
	if !errors.Is(err, ErrCrashed) {
		t.Errorf("a binary that walked out reported %v, which does not carry ErrCrashed", err)
	}
	if errors.Is(err, ErrNoTests) {
		t.Errorf("a binary that walked out reported %v, which reads as a clean run of nothing", err)
	}
	if !strings.Contains(err.Error(), "TestWalksOut") {
		t.Errorf("the error %q does not name the test the run stopped in", err)
	}
	if len(log.Tests) != 0 {
		t.Errorf("a refused run handed back %d tests", len(log.Tests))
	}
}

// A run this tool stopped is unrunnable for the same reason: nothing it printed
// before the stop says what the rest of the suite would have done.
func TestGoAdapterRunRefusesACancelledRun(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())
	cancel()

	log, err := NewGo().Run(ctx, goPack)
	if err == nil {
		t.Fatalf("a cancelled run came back as a run log of %d tests", len(log.Tests))
	}
	if !errors.Is(err, ErrUnrunnable) {
		t.Errorf("a cancelled run reported %v, which is not unrunnable", err)
	}
	if len(log.Tests) != 0 {
		t.Errorf("a refused run handed back %d tests", len(log.Tests))
	}
}

// The seam tells every suite it starts that it is already inside a battery run.
// Without it, a project whose own tests call the battery runs the battery
// inside the battery, forever.
func TestGoAdapterRunGuardsAgainstRunningInsideItself(t *testing.T) {
	dir := t.TempDir()
	writeFile(t, filepath.Join(dir, "go.mod"), "module groundwork.test/guard\n\ngo 1.24\n")
	writeFile(t, filepath.Join(dir, "guard_test.go"),
		"package guard\n\nimport (\n\t\"os\"\n\t\"testing\"\n)\n\n"+
			"func TestSeesTheGuard(t *testing.T) {\n"+
			"\tif os.Getenv(\""+"GROUNDWORK_BATTERY"+"\") == \"\" {\n\t\tt.Fatal(\"the run was not marked as a battery run\")\n\t}\n}\n")

	log, err := NewGo().Run(context.Background(), dir)
	if err != nil {
		t.Fatalf("the guarded run failed: %v", err)
	}
	if len(log.Tests) != 1 || log.Tests[0].Outcome != Pass {
		t.Fatalf("the suite came back as %+v, want one passing test", log.Tests)
	}
}

// TestGoAdapterRunCollapsesSubtests is D30's folding rule: one top-level Test
// function is one test, whatever it ran inside itself.
func TestGoAdapterRunCollapsesSubtests(t *testing.T) {
	log, err := NewGo().Run(context.Background(), goPack)
	if err != nil {
		t.Fatalf("Run failed: %v", err)
	}

	var table int
	for _, tr := range log.Tests {
		if strings.Contains(tr.Name, "/") {
			t.Errorf("the run log holds the subtest %s as a test of its own", tr.ID)
		}
		if tr.ID == "alpha/TestTable" {
			table++
			if tr.Outcome != Pass {
				t.Errorf("alpha/TestTable came out %s, want pass", tr.Outcome)
			}
		}
	}
	if table != 1 {
		t.Fatalf("the run log holds alpha/TestTable %d times, want once", table)
	}
}

// TestCollapseTakesTheWorstOutcome proves the fold does not lose a failure. A
// parent whose subtest failed has failed.
func TestCollapseTakesTheWorstOutcome(t *testing.T) {
	got := collapse([]TestRun{
		{Suite: "alpha", Name: "TestTable/one", Outcome: Pass, Duration: time.Millisecond},
		{Suite: "alpha", Name: "TestTable/two", Outcome: Fail, Duration: 2 * time.Millisecond},
		{Suite: "alpha", Name: "TestTable", Outcome: Fail, Duration: 3 * time.Millisecond},
		{Suite: "alpha", Name: "TestOther", Outcome: Skip},
	})

	if len(got) != 2 {
		t.Fatalf("collapse returned %d tests, want 2: %+v", len(got), got)
	}
	if got[0].ID != "alpha/TestOther" || got[0].Outcome != Skip {
		t.Errorf("the skipped test came out %+v", got[0])
	}
	if got[1].ID != "alpha/TestTable" || got[1].Outcome != Fail {
		t.Errorf("the table came out %+v", got[1])
	}
	if got[1].Duration != 3*time.Millisecond {
		t.Errorf("the folded duration is %s, want the longest of the parts", got[1].Duration)
	}
}

// TestGoAdapterSkipsTestdata keeps discovery out of fixture directories. Go's
// own tooling ignores testdata, and a battery that counted fixture suites as
// real ones would report a repo it was never asked about.
func TestGoAdapterSkipsTestdata(t *testing.T) {
	suites, err := NewGo().Discover(context.Background(), ".")
	if err != nil {
		t.Fatalf("Discover failed: %v", err)
	}

	for _, s := range suites {
		if strings.Contains(s.ID, "testdata") {
			t.Errorf("Discover walked into %s", s.ID)
		}
	}
}

func TestGoAdapterRunReportsOutcomes(t *testing.T) {
	log, err := NewGo().Run(context.Background(), goPack)
	if err != nil {
		t.Fatalf("Run failed: %v", err)
	}

	outcomes := map[string]Outcome{}
	for _, tr := range log.Tests {
		outcomes[tr.ID] = tr.Outcome
	}

	if got := outcomes["alpha/TestAddsUp"]; got != Pass {
		t.Errorf("alpha/TestAddsUp came out %q, want pass", got)
	}
	if got := outcomes["alpha/TestAddsUpWrong"]; got != Fail {
		t.Errorf("alpha/TestAddsUpWrong came out %q, want fail", got)
	}
	if log.Duration <= 0 {
		t.Errorf("the run reports a duration of %s", log.Duration)
	}
}

// TestGoAdapterRunFailsOnCodeThatDoesNotBuild proves a broken package is an
// error, not an empty green run log.
func TestGoAdapterRunFailsOnCodeThatDoesNotBuild(t *testing.T) {
	dir := copyPack(t, goPack)
	writeFile(t, filepath.Join(dir, "alpha", "broken.go"), "package alpha\n\nthis is not go\n")

	_, err := NewGo().Run(context.Background(), dir)
	if err == nil {
		t.Fatal("Run passed on a package that does not build")
	}
	if !strings.Contains(err.Error(), "alpha") {
		t.Errorf("the error does not name the package that failed: %v", err)
	}
	if !strings.Contains(err.Error(), "broken.go") || !strings.Contains(err.Error(), "syntax error") {
		t.Errorf("the error does not carry the compiler's words: %v", err)
	}
}

// A build failure is the one failure the deletion test has to tell from every
// other. D26 calls a mutant that did not compile inconclusive, and only that
// one, so the sentinel has to ride on the error itself.
func TestGoAdapterRunMarksABuildFailureAsOne(t *testing.T) {
	dir := copyPack(t, goPack)
	writeFile(t, filepath.Join(dir, "alpha", "broken.go"), "package alpha\n\nthis is not go\n")

	_, err := NewGo().Run(context.Background(), dir)
	if err == nil {
		t.Fatal("Run passed on a package that does not build")
	}
	if !errors.Is(err, ErrBuildFailed) {
		t.Errorf("a build failure reported %v, which does not carry ErrBuildFailed", err)
	}
	if !errors.Is(err, ErrUnrunnable) {
		t.Errorf("a build failure reported %v, which is not unrunnable", err)
	}
	// A build that broke is not a clean run of nothing, and a caller that took
	// it for one would call a package with no tests a package that will not
	// compile.
	if errors.Is(err, ErrNoTests) {
		t.Errorf("a build failure reported %v, which reads as a clean run of nothing", err)
	}
}

// Packages is the build's own answer to what compiles. Every file a target can
// come from is in it, and every file the build leaves out is not.
//
// D33: two walkers in one repo must never disagree about what a package is. A
// walk of .go files would offer targets in a package the platform does not
// build, in a directory the go tool ignores, and in a file behind a build tag.
// Nothing compiles any of them, so no test can notice their deletion, and a
// mutation run that offered them would report a survivor it invented.
func TestGoAdapterPackagesAreTheBuildsOwnAnswer(t *testing.T) {
	dir := buildFixture(t)

	pkgs, err := NewGo().Packages(context.Background(), dir)
	if err != nil {
		t.Fatalf("Packages failed: %v", err)
	}

	files := map[string][]string{}
	for _, pkg := range pkgs {
		files[pkg.ID] = pkg.Files
	}

	alpha, ok := files["alpha"]
	if !ok {
		t.Fatalf("Packages did not list the one package that compiles: %v", files)
	}
	// alpha_windows.go is not built on this machine, alpha_test.go is a test
	// file, and the deletion test damages the code rather than the tests.
	if !slices.Equal(alpha, []string{"alpha/alpha.go"}) {
		t.Errorf("the package alpha compiles %v, want [alpha/alpha.go]", alpha)
	}

	for _, gone := range []string{"_scratch", "tools", "nested", "testdata"} {
		if _, listed := files[gone]; listed {
			t.Errorf("Packages listed %s, which this build does not compile: %v", gone, files)
		}
	}
}

// The count of files the build leaves out rides back with the list. Nothing is
// skipped in silence: a reader of the row's evidence can tell a surface where
// everything compiles from one where half of it sits behind a build tag.
func TestGoAdapterPackagesCountTheFilesTheBuildLeavesOut(t *testing.T) {
	dir := buildFixture(t)

	pkgs, err := NewGo().Packages(context.Background(), dir)
	if err != nil {
		t.Fatalf("Packages failed: %v", err)
	}

	var ignored int
	for _, pkg := range pkgs {
		ignored += pkg.Ignored
	}
	if ignored != 1 {
		t.Errorf("Packages counted %d files the build leaves out, want 1 (alpha_windows.go)", ignored)
	}
}

// The package list must not depend on how this process happened to reach the
// project.
//
// A plain cd through a symlink leaves $PWD naming the link, and the go tool
// prefers $PWD whenever it names the same directory it is in. A child that
// inherited it reports every package under the linked path, and every path this
// tool then measures from the project root comes back climbing out of it. The
// caller's answer is then that the project holds nothing at all.
func TestGoAdapterPackagesAreNotFooledByALinkedPath(t *testing.T) {
	dir := buildFixture(t)
	link := filepath.Join(t.TempDir(), "link")
	if err := os.Symlink(dir, link); err != nil {
		t.Skipf("this machine does not do symlinks: %v", err)
	}

	direct, err := NewGo().Packages(context.Background(), dir)
	if err != nil {
		t.Fatalf("Packages failed: %v", err)
	}
	if len(direct) == 0 {
		t.Fatal("Packages found nothing at all, so this test proves nothing")
	}

	// This is what a shell leaves behind after cd through a link.
	t.Setenv("PWD", link)

	through, err := NewGo().Packages(context.Background(), dir)
	if err != nil {
		t.Fatalf("Packages failed with a linked PWD: %v", err)
	}

	if !slices.Equal(idsOf(through), idsOf(direct)) {
		t.Errorf("reached through a link the build lists %v, and directly it lists %v",
			idsOf(through), idsOf(direct))
	}
}

// The go tool's output is input, and D18 says input gets checked. A package the
// tool names outside the directory this call asked about belongs to somebody
// else's tree, and a mutation run writes files.
func TestGoAdapterPackagesRefuseAPackageOutsideTheDirectory(t *testing.T) {
	root := filepath.Join(string(filepath.Separator), "project")
	raw := []byte(`{"Dir":"` + filepath.Join(root, "alpha") + `","ImportPath":"p/alpha","GoFiles":["alpha.go"]}
{"Dir":"` + filepath.Join(string(filepath.Separator), "elsewhere") + `","ImportPath":"q/beta","GoFiles":["beta.go"]}
{"Dir":"` + root + string(filepath.Separator) + `..` + string(filepath.Separator) + `sneaky","ImportPath":"r/s","GoFiles":["s.go"]}
`)

	pkgs, err := packagesFrom(root, raw)
	if err != nil {
		t.Fatalf("packagesFrom failed: %v", err)
	}

	if !slices.Equal(idsOf(pkgs), []string{"alpha"}) {
		t.Errorf("the list kept %v, want only the package inside the directory", idsOf(pkgs))
	}
}

// go test's own clock writes a panic, and it is the clock speaking rather than
// the code. A caller that read it as a crash would call a suite that hung a
// suite that noticed something (D35).
func TestGoAdapterRunMarksItsOwnTimeoutAsOne(t *testing.T) {
	dir := t.TempDir()
	writeFile(t, filepath.Join(dir, "go.mod"), "module groundwork.test/wedged\n\ngo 1.24\n")
	writeFile(t, filepath.Join(dir, "wedged_test.go"),
		"package wedged\n\nimport (\n\t\"testing\"\n\t\"time\"\n)\n\n"+
			"func TestWedged(t *testing.T) {\n\ttime.Sleep(time.Minute)\n}\n")

	// The project's own flags set this in the wild, and GOFLAGS is one of the
	// ways they do it. Either way the row's clock cannot be assumed to fire
	// first.
	t.Setenv("GOFLAGS", "-timeout=5s")

	_, err := NewGo().Run(context.Background(), dir)
	if err == nil {
		t.Fatal("a suite that outlived go test's own clock came back clean")
	}
	if !errors.Is(err, ErrTimedOut) {
		t.Errorf("a run stopped by go test's own clock reported %v, which does not carry ErrTimedOut", err)
	}
	if !errors.Is(err, ErrUnrunnable) {
		t.Errorf("a run stopped by go test's own clock reported %v, which is not unrunnable", err)
	}
}

// Every child of this tool is told the same directory twice, and told it is
// already inside a battery run.
func TestChildEnvPinsTheDirectoryTheChildStartsIn(t *testing.T) {
	dir := t.TempDir()
	env := childEnv(dir)

	var pinned []string
	var guard string
	for _, kv := range env {
		if rest, found := strings.CutPrefix(kv, "PWD="); found {
			pinned = append(pinned, rest)
		}
		if rest, found := strings.CutPrefix(kv, RunGuardEnv+"="); found {
			guard = rest
		}
	}

	// One PWD, not two. A child reading the first of a pair would get the
	// parent's directory back.
	if len(pinned) != 1 || pinned[0] != dir {
		t.Errorf("the child's environment names the directories %v, want only %s", pinned, dir)
	}
	if guard == "" {
		t.Errorf("the child was not told it is inside a battery run: %s is unset", RunGuardEnv)
	}
}

// idsOf names a package list, so a test can compare two of them.
func idsOf(pkgs []Package) []string {
	out := make([]string, 0, len(pkgs))
	for _, pkg := range pkgs {
		out = append(out, pkg.ID)
	}

	return out
}

// A package that does not compile is still a package. The list is asked for
// with go list -e so one broken directory cannot hide every other one — the
// same direction as discovery, which reads a file that does not parse rather
// than pretending it is absent.
func TestGoAdapterPackagesSurviveAPackageThatDoesNotBuild(t *testing.T) {
	dir := buildFixture(t)
	writeFile(t, filepath.Join(dir, "broken", "broken.go"), "package broken\n\nthis is not go\n")

	pkgs, err := NewGo().Packages(context.Background(), dir)
	if err != nil {
		t.Fatalf("one package that does not build stopped the whole list: %v", err)
	}

	var alpha, broken bool
	for _, pkg := range pkgs {
		alpha = alpha || pkg.ID == "alpha"
		broken = broken || pkg.ID == "broken"
	}
	if !alpha {
		t.Errorf("the package that does compile was lost: %v", pkgs)
	}
	if !broken {
		t.Errorf("the package that does not compile was dropped rather than listed: %v", pkgs)
	}
}

// RunPackage runs the one package it was given and nothing else. The deletion
// test damaged one package's code, and a run that swept the whole project
// would judge that mutant by suites that never touch it — and cost the whole
// suite once per mutant.
func TestGoAdapterRunPackageRunsOnlyThatPackage(t *testing.T) {
	log, err := NewGo().RunPackage(context.Background(), goPack, "beta")
	if err != nil {
		t.Fatalf("RunPackage failed: %v", err)
	}
	if len(log.Tests) == 0 {
		t.Fatal("RunPackage reported no tests at all")
	}

	for _, tr := range log.Tests {
		if tr.Suite != "beta" {
			t.Errorf("RunPackage(beta) reported %s, which is not in beta", tr.ID)
		}
	}
}

// The project's own root package is named "." the way discovery names it, and
// running it must not sweep the packages under it.
func TestGoAdapterRunPackageRunsTheRootPackageAlone(t *testing.T) {
	dir := t.TempDir()
	writeFile(t, filepath.Join(dir, "go.mod"), "module groundwork.test/rooted\n\ngo 1.24\n")
	writeFile(t, filepath.Join(dir, "root_test.go"),
		"package rooted\n\nimport \"testing\"\n\nfunc TestRoot(t *testing.T) {}\n")
	writeFile(t, filepath.Join(dir, "sub", "sub_test.go"),
		"package sub\n\nimport \"testing\"\n\nfunc TestSub(t *testing.T) {}\n")

	log, err := NewGo().RunPackage(context.Background(), dir, ".")
	if err != nil {
		t.Fatalf("RunPackage failed: %v", err)
	}

	ids := make([]string, 0, len(log.Tests))
	for _, tr := range log.Tests {
		ids = append(ids, tr.ID)
	}
	if !slices.Equal(ids, []string{"./TestRoot"}) {
		t.Errorf("RunPackage(.) ran %v, want only the root package's test", ids)
	}
}

// A suite name that climbs out of the project is refused before anything runs.
// A mutation run writes files, so a name that could escape the project is a
// name that could damage the machine.
func TestGoAdapterRunPackageRefusesAPathOutsideTheProject(t *testing.T) {
	refusals := []struct {
		suite string
		says  string
	}{
		{"../elsewhere", "climbs out of the project"},
		{"/etc", "absolute path"},
		{"", "no file was named"},
	}

	for _, want := range refusals {
		_, err := NewGo().RunPackage(context.Background(), goPack, want.suite)
		if err == nil {
			t.Errorf("RunPackage ran the suite %q", want.suite)
			continue
		}
		if !errors.Is(err, ErrUnrunnable) {
			t.Errorf("the suite %q reported %v, which is not unrunnable", want.suite, err)
		}
		// The refusal has to be this tool's own rule, not the go tool's
		// complaint about a directory it could not find. Only the first of
		// those is a rule, and only the first holds when the directory exists.
		if !strings.Contains(err.Error(), want.says) {
			t.Errorf("the suite %q was refused as %v, which does not say %q", want.suite, err, want.says)
		}
	}
}

// A run this tool stops kills the test binary too, not only go test.
//
// go test starts a test binary, and killing only go test orphans it. A mutant
// is exactly the thing that turns a loop that ends into one that does not, so
// the row would leave a spinning binary behind on every mutant it timed out.
func TestGoAdapterRunKillsTheTestBinaryItStarted(t *testing.T) {
	dir := t.TempDir()
	beat := filepath.Join(dir, "beat")
	writeFile(t, filepath.Join(dir, "go.mod"), "module groundwork.test/spin\n\ngo 1.24\n")
	writeFile(t, filepath.Join(dir, "spin_test.go"),
		"package spin\n\nimport (\n\t\"os\"\n\t\"strconv\"\n\t\"testing\"\n\t\"time\"\n)\n\n"+
			"func TestSpins(t *testing.T) {\n\tfor {\n"+
			"\t\tos.WriteFile("+strconv.Quote(beat)+", []byte(strconv.FormatInt(time.Now().UnixNano(), 10)), 0o600)\n"+
			"\t\ttime.Sleep(20 * time.Millisecond)\n\t}\n}\n")

	ctx, cancel := context.WithTimeout(context.Background(), 6*time.Second)
	defer cancel()

	if _, err := NewGo().Run(ctx, dir); err == nil {
		t.Fatal("a run that never ends came back clean")
	}
	// The heartbeat proves the binary got as far as running. Without it a
	// build failure would pass this test having proven nothing.
	first, err := os.ReadFile(beat)
	if err != nil {
		t.Fatalf("the test binary never started: %v", err)
	}

	time.Sleep(2 * time.Second)

	again, err := os.ReadFile(beat)
	if err != nil {
		t.Fatalf("the heartbeat went missing: %v", err)
	}
	if string(again) != string(first) {
		t.Errorf("the test binary outlived the run that started it: %s then %s", first, again)
	}
}

// A killed command must never hold the runner on a pipe something else still
// owns. A process that escaped the group keeps the write end open, and a
// runner with no wait delay would sit on it for as long as that process lives.
func TestBoundedCommandGivesUpOnASurvivingPipeHolder(t *testing.T) {
	if _, err := exec.LookPath("sh"); err != nil {
		t.Skip("this machine has no shell to leave a pipe holder behind with")
	}

	// sh exits at once; the sleep it backgrounded inherits stdout and holds
	// the write end of the runner's pipe for far longer than the wait delay.
	cmd := exec.CommandContext(context.Background(), "sh", "-c", "sleep 45 & exit 0")
	var out bytes.Buffer
	cmd.Stdout = &out
	bounded(cmd)

	start := time.Now()
	err := cmd.Run()
	waited := time.Since(start)

	if !errors.Is(err, exec.ErrWaitDelay) {
		t.Errorf("the run came back as %v, want the wait delay giving up", err)
	}
	if waited > 20*time.Second {
		t.Errorf("the runner waited %s on a pipe its command no longer owns", waited)
	}
}

// buildFixture is a module holding one package that compiles and four things
// the build leaves out: a file for another platform, a directory whose name
// the go tool ignores, a package behind a build tag, a module of its own, and
// Go's own fixture directory.
func buildFixture(t *testing.T) string {
	t.Helper()

	dir := t.TempDir()
	writeFile(t, filepath.Join(dir, "go.mod"), "module groundwork.test/build\n\ngo 1.24\n")
	writeFile(t, filepath.Join(dir, "alpha", "alpha.go"),
		"package alpha\n\nfunc AddsUp(a, b int) int { return a + b }\n")
	writeFile(t, filepath.Join(dir, "alpha", "alpha_windows.go"),
		"package alpha\n\nfunc WindowsOnly(n int) int { return n * 3 }\n")
	writeFile(t, filepath.Join(dir, "alpha", "alpha_test.go"),
		"package alpha\n\nimport \"testing\"\n\nfunc TestAddsUp(t *testing.T) {}\n")
	writeFile(t, filepath.Join(dir, "_scratch", "scratch.go"),
		"package scratch\n\nfunc Draft(n int) int { return n * 5 }\n")
	writeFile(t, filepath.Join(dir, "tools", "tools.go"),
		"//go:build tools\n\npackage tools\n\nfunc Pin(n int) int { return n }\n")
	writeFile(t, filepath.Join(dir, "nested", "go.mod"), "module groundwork.test/nested\n\ngo 1.24\n")
	writeFile(t, filepath.Join(dir, "nested", "nested.go"),
		"package nested\n\nfunc Deep(n int) int { return n }\n")
	writeFile(t, filepath.Join(dir, "testdata", "fixture.go"),
		"package fixture\n\nfunc Fake(n int) int { return n }\n")

	return dir
}

func TestGoAdapterMutantsBlankFunctionBodies(t *testing.T) {
	mutants, err := NewGo().Mutants(context.Background(), goPack, "alpha/alpha.go")
	if err != nil {
		t.Fatalf("Mutants failed: %v", err)
	}

	symbols := make([]string, 0, len(mutants))
	for _, m := range mutants {
		symbols = append(symbols, m.Symbol)
	}
	slices.Sort(symbols)

	if !slices.Equal(symbols, []string{"(Counter).Add", "AddsUp", "Name"}) {
		t.Errorf("Mutants listed %v", symbols)
	}

	original, err := os.ReadFile(filepath.Join(goPack, "alpha", "alpha.go"))
	if err != nil {
		t.Fatalf("could not read the fixture: %v", err)
	}

	for _, m := range mutants {
		if m.Line <= 0 {
			t.Errorf("the mutant %s has no line", m.Symbol)
		}
		if !strings.Contains(m.Content, "package alpha") {
			t.Errorf("the mutant %s does not look like the file it came from", m.Symbol)
		}
		if m.Content == string(original) {
			t.Errorf("the mutant %s changes nothing", m.Symbol)
		}
		if !strings.Contains(m.Content, "*new(") {
			t.Errorf("the mutant %s blanks no body: %s", m.Symbol, m.Content)
		}
		if strings.Count(m.Content, "*new(") != 1 {
			t.Errorf("the mutant %s blanks more than one body: %s", m.Symbol, m.Content)
		}
	}
}

// TestGoAdapterMutantsCompile proves the blanked bodies are still Go. A mutant
// that cannot build is inconclusive (D26), so a mutator that produced only
// those would prove nothing.
func TestGoAdapterMutantsCompile(t *testing.T) {
	mutants, err := NewGo().Mutants(context.Background(), goPack, "alpha/alpha.go")
	if err != nil {
		t.Fatalf("Mutants failed: %v", err)
	}

	for _, m := range mutants {
		dir := copyPack(t, goPack)
		writeFile(t, filepath.Join(dir, filepath.FromSlash(m.File)), m.Content)

		if _, err := NewGo().Run(context.Background(), dir); err != nil {
			t.Errorf("the mutant of %s does not build: %v", m.Symbol, err)
		}
	}
}

// TestGoAdapterMutantsTurnTheSuiteRed is the deletion test in miniature: blank
// the implementation and the tests must notice.
func TestGoAdapterMutantsTurnTheSuiteRed(t *testing.T) {
	mutants, err := NewGo().Mutants(context.Background(), goPack, "alpha/alpha.go")
	if err != nil {
		t.Fatalf("Mutants failed: %v", err)
	}

	var caught bool
	for _, m := range mutants {
		if m.Symbol != "AddsUp" {
			continue
		}

		dir := copyPack(t, goPack)
		writeFile(t, filepath.Join(dir, filepath.FromSlash(m.File)), m.Content)

		log, err := NewGo().Run(context.Background(), dir)
		if err != nil {
			t.Fatalf("the mutated pack did not run: %v", err)
		}
		for _, tr := range log.Tests {
			if tr.ID == "alpha/TestAddsUp" && tr.Outcome == Fail {
				caught = true
			}
		}
	}

	if !caught {
		t.Fatal("blanking AddsUp left alpha/TestAddsUp green")
	}
}

func TestGoAdapterMutantsRefuseATestFile(t *testing.T) {
	_, err := NewGo().Mutants(context.Background(), goPack, "alpha/alpha_test.go")
	if err == nil {
		t.Fatal("Mutants accepted a test file")
	}
}

func TestGoAdapterMutantsRefuseAPathOutsideTheProject(t *testing.T) {
	for _, path := range []string{"../adapter.go", "/etc/hosts", ""} {
		if _, err := NewGo().Mutants(context.Background(), goPack, path); err == nil {
			t.Errorf("Mutants accepted the path %q", path)
		}
	}
}

// TestExecTimeoutKills is D25's timeout. A sleeping adapter must be killed and
// reported unrunnable — never waited on, and never partly believed.
func TestExecTimeoutKills(t *testing.T) {
	needNode(t)

	a := script(t, "sleep.mjs", withTimeout(250*time.Millisecond))

	start := time.Now()
	_, err := a.Discover(context.Background(), nodePack)
	elapsed := time.Since(start)

	if err == nil {
		t.Fatal("a sleeping adapter passed")
	}
	if !errors.Is(err, ErrUnrunnable) {
		t.Errorf("a killed adapter reported %v, which is not unrunnable", err)
	}
	if elapsed > 10*time.Second {
		t.Errorf("the sleeping adapter ran for %s before it was killed", elapsed)
	}
}

// TestExecOutputCapKills is D25's output cap. A flooding adapter must be cut
// off, not buffered until the machine gives out.
func TestExecOutputCapKills(t *testing.T) {
	needNode(t)

	a := script(t, "flood.mjs", withCap(64*1024), withTimeout(20*time.Second))

	_, err := a.Discover(context.Background(), nodePack)
	if err == nil {
		t.Fatal("a flooding adapter passed")
	}
	if !errors.Is(err, ErrUnrunnable) {
		t.Errorf("a capped adapter reported %v, which is not unrunnable", err)
	}
	if !strings.Contains(err.Error(), "cap") {
		t.Errorf("the error %q does not say the output cap was hit", err)
	}
}

// TestExecNeverReportsAPartialTally is the fail-closed half of D25: a killed
// run is unrunnable, never the tests it happened to print first.
func TestExecNeverReportsAPartialTally(t *testing.T) {
	needNode(t)

	a := script(t, "partial.mjs", withTimeout(500*time.Millisecond))

	log, err := a.Run(context.Background(), nodePack)
	if err == nil {
		t.Fatal("an adapter killed mid-sentence passed")
	}
	if !errors.Is(err, ErrUnrunnable) {
		t.Errorf("the error %v is not unrunnable", err)
	}
	if len(log.Tests) != 0 {
		t.Fatalf("a killed run reported %d tests: %v", len(log.Tests), log.Tests)
	}
}

// TestExecRefusesHostileStdout is the D18 table for the out-of-process seam:
// the adapter's stdout is foreign input, and every shape but the one the
// protocol names must fail.
func TestExecRefusesHostileStdout(t *testing.T) {
	needNode(t)

	cases := []struct {
		name   string
		script string
		says   string
	}{
		{"garbage", "garbage.mjs", "JSON"},
		{"nothing at all", "silent.mjs", "nothing"},
		{"stderr only", "stderr-only.mjs", "nothing"},
		{"a schema from the future", "schema9.mjs", "schema"},
		{"no schema at all", "noschema.mjs", "schema"},
		{"a JSON list", "list.mjs", "JSON"},
		{"trailing garbage after the object", "trailing.mjs", "more than one thing"},
		{"a second object", "twice.mjs", "more than one thing"},
		{"a huge single line", "hugeline.mjs", "cap"},
		{"an exit code with good JSON", "exit-nonzero.mjs", "exit"},
	}

	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			a := script(t, c.script, withCap(256*1024), withTimeout(20*time.Second))

			_, err := a.Discover(context.Background(), nodePack)
			if err == nil {
				t.Fatalf("the seam accepted %s", c.name)
			}
			if !errors.Is(err, ErrUnrunnable) {
				t.Errorf("%s reported %v, which is not unrunnable", c.name, err)
			}
			if !strings.Contains(err.Error(), c.says) {
				t.Errorf("the error %q does not say %q", err, c.says)
			}
		})
	}
}

// TestExecRefusesARunThatProvesNothing is the fail-closed direction on the
// out-of-process side: an empty run log and a nameless result are both refused,
// the same way the Go path refuses them.
func TestExecRefusesARunThatProvesNothing(t *testing.T) {
	cases := []struct {
		name   string
		script string
		says   string

		// empty says whether this refusal is a run that executed nothing, as
		// opposed to a run the seam could not believe. The first is red and the
		// second is unrunnable, and only the sentinel tells them apart.
		empty bool
	}{
		{"a run log with no tests in it", "notests.mjs", "no tests at all", true},
		{"a result with no suite or name", "nameless.mjs", "no suite or no test name", false},
	}

	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			a := script(t, c.script, withTimeout(20*time.Second))

			log, err := a.Run(context.Background(), nodePack)
			if err == nil {
				t.Fatalf("the seam accepted %s", c.name)
			}
			if !errors.Is(err, ErrUnrunnable) {
				t.Errorf("%s reported %v, which is not unrunnable", c.name, err)
			}
			// A clean run of nothing is red and a broken run is unrunnable, so
			// the sentinel that tells them apart is pinned on this side too.
			if errors.Is(err, ErrNoTests) != c.empty {
				t.Errorf("%s reported %v, and ErrNoTests should be %v", c.name, err, c.empty)
			}
			if !strings.Contains(err.Error(), c.says) {
				t.Errorf("the error %q does not say %q", err, c.says)
			}
			if len(log.Tests) != 0 {
				t.Errorf("a refused run handed back %d tests", len(log.Tests))
			}
		})
	}
}

// TestExecCollapsesSubtests holds D30's folding rule on the out-of-process
// side, where the adapter is somebody else's code and may report either shape.
func TestExecCollapsesSubtests(t *testing.T) {
	needNode(t)

	log, err := script(t, "subtests.mjs", withTimeout(20*time.Second)).Run(context.Background(), nodePack)
	if err != nil {
		t.Fatalf("Run failed: %v", err)
	}

	if len(log.Tests) != 2 {
		t.Fatalf("the run log holds %d tests, want 2: %+v", len(log.Tests), log.Tests)
	}
	if log.Tests[1].ID != "test/a.test.mjs/table" || log.Tests[1].Outcome != Fail {
		t.Errorf("the folded table came out %+v, want one failing test/a.test.mjs/table", log.Tests[1])
	}
}

// TestExecKillsTheWholeProcessGroup proves a killed adapter takes what it
// started with it. A surviving child holds the machine, and the output pipe,
// long after the battery has given up on it.
func TestExecKillsTheWholeProcessGroup(t *testing.T) {
	needNode(t)

	if _, err := exec.LookPath("pgrep"); err != nil {
		t.Skip("pgrep is not installed, so a surviving child cannot be looked for")
	}

	dir := t.TempDir()
	marker := filepath.Join(dir, "groundwork-forked-child")

	if _, err := script(t, "forker.mjs", withTimeout(500*time.Millisecond)).
		Discover(context.Background(), dir); err == nil {
		t.Fatal("the forking adapter passed")
	}

	// The marker file is written by the adapter after it spawns, so its
	// absence would mean this test proved nothing about surviving children.
	if _, err := os.Stat(marker); err != nil {
		t.Fatalf("the forking adapter never spawned a child: %v", err)
	}

	deadline := time.Now().Add(5 * time.Second)
	for {
		out, _ := exec.Command("pgrep", "-f", marker).Output()
		if len(strings.TrimSpace(string(out))) == 0 {
			return
		}
		if time.Now().After(deadline) {
			t.Fatalf("a child of the killed adapter is still running: %s", out)
		}
		time.Sleep(50 * time.Millisecond)
	}
}

func TestExecRefusesACommandThatDoesNotExist(t *testing.T) {
	a := NewExec("ghost", []string{"groundwork-no-such-adapter", "--serve"})

	_, err := a.Discover(context.Background(), nodePack)
	if err == nil {
		t.Fatal("a command that does not exist passed")
	}
	if !errors.Is(err, ErrUnrunnable) {
		t.Errorf("a missing command reported %v, which is not unrunnable", err)
	}
}

func TestExecRefusesAnEmptyCommand(t *testing.T) {
	if _, err := NewExec("empty", nil).Discover(context.Background(), nodePack); err == nil {
		t.Fatal("an adapter with no command passed")
	}
}

// TestExecPassesTheCallAndTheProject proves the protocol the shipped script
// implements is the protocol the runner speaks.
func TestExecPassesTheCallAndTheProject(t *testing.T) {
	needNode(t)

	a := script(t, "echo-argv.mjs", withTimeout(20*time.Second))

	suites, err := a.Discover(context.Background(), nodePack)
	if err != nil {
		t.Fatalf("the echo adapter failed: %v", err)
	}
	if len(suites) != 1 {
		t.Fatalf("the echo adapter returned %d suites", len(suites))
	}
	if got, want := suites[0].ID, "discover"; got != want {
		t.Errorf("the first argument was %q, want %q", got, want)
	}
	if len(suites[0].Tests) == 0 || !strings.HasSuffix(suites[0].Tests[0], nodePack) {
		t.Errorf("the project directory was not passed: %v", suites[0].Tests)
	}
}

func TestNodeAdapterMutantsBlankFunctionBodies(t *testing.T) {
	needNode(t)

	mutants, err := newNodeAdapter(t).Mutants(context.Background(), nodePack, "src/alpha.mjs")
	if err != nil {
		t.Fatalf("Mutants failed: %v", err)
	}

	symbols := make([]string, 0, len(mutants))
	for _, m := range mutants {
		symbols = append(symbols, m.Symbol)
	}
	slices.Sort(symbols)

	if !slices.Equal(symbols, []string{"addsUp", "name"}) {
		t.Errorf("Mutants listed %v", symbols)
	}
	for _, m := range mutants {
		if !strings.Contains(m.Content, "export function") {
			t.Errorf("the mutant %s does not look like the file it came from", m.Symbol)
		}
	}
}

// TestNodeAdapterMutantsTurnTheSuiteRed runs the same deletion test through the
// out-of-process seam.
func TestNodeAdapterMutantsTurnTheSuiteRed(t *testing.T) {
	needNode(t)

	a := newNodeAdapter(t)

	mutants, err := a.Mutants(context.Background(), nodePack, "src/alpha.mjs")
	if err != nil {
		t.Fatalf("Mutants failed: %v", err)
	}

	var caught bool
	for _, m := range mutants {
		if m.Symbol != "addsUp" {
			continue
		}

		dir := copyPack(t, nodePack)
		writeFile(t, filepath.Join(dir, filepath.FromSlash(m.File)), m.Content)

		log, err := a.Run(context.Background(), dir)
		if err != nil {
			t.Fatalf("the mutated pack did not run: %v", err)
		}
		for _, tr := range log.Tests {
			if strings.HasSuffix(tr.ID, "/adds up") && tr.Outcome == Fail {
				caught = true
			}
		}
	}

	if !caught {
		t.Fatal("blanking addsUp left the adding test green")
	}
}

// lying wraps a real adapter and reports something other than what it found.
type lying struct {
	under Adapter

	dropSuite   bool
	extraSuite  bool
	dropTest    bool
	allPass     bool
	allFail     bool
	noTests     bool
	dropMutant  bool
	emptyMutant bool
	noDuration  bool

	cosmetic          bool
	twiceSuite        bool
	testMain          bool
	hidesFromDiscover bool
}

func (l *lying) Name() string { return "lying" }

func (l *lying) Discover(ctx context.Context, dir string) ([]Suite, error) {
	suites, err := l.under.Discover(ctx, dir)
	if err != nil {
		return nil, err
	}

	if l.dropSuite && len(suites) > 0 {
		suites = suites[1:]
	}
	if l.extraSuite {
		suites = append(suites, Suite{ID: "gamma", Name: "gamma", Tests: []string{"TestNothing"}})
	}
	if l.dropTest && len(suites) > 0 && len(suites[0].Tests) > 0 {
		suites[0].Tests = suites[0].Tests[1:]
	}
	if l.twiceSuite && len(suites) > 0 {
		suites = append(suites, suites[0])
	}
	if l.testMain && len(suites) > 0 {
		suites[0].Tests = append(slices.Clone(suites[0].Tests), "TestMain")
	}
	if l.hidesFromDiscover && len(suites) > 0 && len(suites[0].Tests) > 0 {
		suites[0].Tests = slices.Clone(suites[0].Tests)[1:]
	}

	return suites, nil
}

func (l *lying) Run(ctx context.Context, dir string) (RunLog, error) {
	log, err := l.under.Run(ctx, dir)
	if err != nil {
		return RunLog{}, err
	}

	if l.noTests {
		log.Tests = nil
	}
	if l.noDuration {
		log.Duration = 0
	}
	for i := range log.Tests {
		if l.allPass {
			log.Tests[i].Outcome = Pass
		}
		if l.allFail {
			log.Tests[i].Outcome = Fail
		}
	}

	return log, nil
}

func (l *lying) Mutants(ctx context.Context, dir, file string) ([]Mutant, error) {
	mutants, err := l.under.Mutants(ctx, dir, file)
	if err != nil {
		return nil, err
	}

	if l.dropMutant && len(mutants) > 0 {
		mutants = mutants[1:]
	}
	if l.emptyMutant && len(mutants) > 0 {
		raw, err := os.ReadFile(filepath.Join(dir, filepath.FromSlash(file)))
		if err != nil {
			return nil, err
		}
		mutants[0].Content = string(raw)
	}
	if l.cosmetic {
		// The mutator every fail-open deletion test is built on: the content
		// differs, the targets are right, and nothing is actually broken.
		raw, err := os.ReadFile(filepath.Join(dir, filepath.FromSlash(file)))
		if err != nil {
			return nil, err
		}
		for i := range mutants {
			mutants[i].Content = string(raw) + "\n// mutated, honestly\n"
		}
	}

	return mutants, nil
}

// recorder stands in for *testing.T so a lying adapter can be run through
// conformance without failing the test that runs it.
type recorder struct {
	errors []string
}

func (r *recorder) Helper() {}

func (r *recorder) Errorf(format string, args ...any) {
	r.errors = append(r.errors, fmt.Sprintf(format, args...))
}

// script returns an exec adapter running one of the fixture scripts.
func script(t *testing.T, name string, opts ...Option) *Exec {
	t.Helper()

	path, err := filepath.Abs(filepath.Join("testdata", "scripts", name))
	if err != nil {
		t.Fatalf("could not resolve %s: %v", name, err)
	}
	if _, err := os.Stat(path); err != nil {
		t.Fatalf("the fixture script is missing: %v", err)
	}

	return NewExec("node", []string{"node", path}, opts...)
}

// newNodeAdapter returns the shipped node adapter, run out of process.
func newNodeAdapter(t *testing.T) *Exec {
	t.Helper()

	path, err := filepath.Abs(nodeAdapterScript)
	if err != nil {
		t.Fatalf("could not resolve the node adapter: %v", err)
	}

	return NewExec("node", []string{"node", path}, withTimeout(60*time.Second))
}

// copyPack copies a fixture pack into a temp dir, so a test may mutate it.
func copyPack(t *testing.T, pack string) string {
	t.Helper()

	dir := t.TempDir()
	root := filepath.Clean(pack)

	err := filepath.WalkDir(root, func(path string, d os.DirEntry, err error) error {
		if err != nil {
			return err
		}

		rel, err := filepath.Rel(root, path)
		if err != nil {
			return err
		}
		target := filepath.Join(dir, rel)

		if d.IsDir() {
			return os.MkdirAll(target, 0o750)
		}

		raw, err := os.ReadFile(path)
		if err != nil {
			return err
		}

		return os.WriteFile(target, raw, 0o600)
	})
	if err != nil {
		t.Fatalf("could not copy %s: %v", pack, err)
	}

	return dir
}

func writeFile(t *testing.T, path, content string) {
	t.Helper()

	if err := os.MkdirAll(filepath.Dir(path), 0o750); err != nil {
		t.Fatalf("could not make %s: %v", filepath.Dir(path), err)
	}
	if err := os.WriteFile(path, []byte(content), 0o600); err != nil {
		t.Fatalf("could not write %s: %v", path, err)
	}
}

// needNode makes sure node is there. The node fixtures prove the whole
// out-of-process seam, so a machine without node proves none of it.
//
// On a developer's machine that is a skip. On CI it is a failure: a skipped
// check reads as a green one on the board, and half this slice would then be
// unproven every build without anyone seeing it.
func needNode(t *testing.T) {
	t.Helper()

	if _, err := os.Stat("testdata/nodepack/package.json"); err != nil {
		t.Fatalf("the node fixture pack is missing: %v", err)
	}
	if _, err := exec.LookPath("node"); err == nil {
		return
	}

	if os.Getenv("CI") != "" {
		t.Fatal("node is not installed on CI, so the out-of-process seam would go unproven")
	}
	t.Skip("node is not installed, so the out-of-process fixtures cannot run")
}
