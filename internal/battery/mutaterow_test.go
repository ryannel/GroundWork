package battery

import (
	"context"
	"fmt"
	"math"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"
	"testing"
	"time"

	"github.com/ryannel/groundwork/internal/adapter"
	"github.com/ryannel/groundwork/internal/journal"
)

// The deletion test damages the code and expects the suite to notice. Every
// fixture below is a whole repo, because the row runs the project's own tests
// against a broken copy of the project.
//
// The expected answers here come from proof.md's clause — a suite is red when
// tests survive the implementation being deleted — from D26's ruling that a
// mutant which fails to compile is inconclusive, and from D33, which fixes
// where targets come from and what the row's one line must reconcile. None of
// them is read off what the row happens to do.

// mutateRepo makes a fixture repo with one Go surface at its root.
func mutateRepo(t *testing.T) string {
	t.Helper()

	dir := newRepo(t)
	writeManifest(t, dir, goCLISurface)
	writeSource(t, dir, "go.mod", "module groundwork.test/fixture\n\ngo 1.24\n")

	return dir
}

// writeKilledSuite puts a package whose test really proves its exported
// function. Blank AddsUp and the test cannot pass, so its mutant dies.
func writeKilledSuite(t *testing.T, dir, pkg string) {
	t.Helper()

	writeSource(t, dir, pkg+"/"+pkg+".go",
		"package "+pkg+"\n\nfunc AddsUp(a, b int) int {\n\treturn a + b\n}\n")
	writeSource(t, dir, pkg+"/"+pkg+"_test.go",
		"package "+pkg+"\n\nimport \"testing\"\n\n"+
			"func TestAddsUp(t *testing.T) {\n\tif AddsUp(1, 1) != 2 {\n\t\tt.Fatal(\"no\")\n\t}\n}\n")
}

// writeSurvivorSuite puts the deletion-survivor shape the held-out design
// names: the code returns a value and an error, and the test asserts only that
// the error is nil. Blank the function and it still returns a nil error, so the
// suite stays green over an implementation that is gone.
func writeSurvivorSuite(t *testing.T, dir, pkg string) {
	t.Helper()

	writeSource(t, dir, pkg+"/"+pkg+".go",
		"package "+pkg+"\n\nfunc Parse(s string) (int, error) {\n"+
			"\tn := 0\n\tfor _, r := range s {\n\t\tn = n*10 + int(r-'0')\n\t}\n\n\treturn n, nil\n}\n")
	writeSource(t, dir, pkg+"/"+pkg+"_test.go",
		"package "+pkg+"\n\nimport \"testing\"\n\n"+
			"func TestParse(t *testing.T) {\n\tif _, err := Parse(\"12\"); err != nil {\n\t\tt.Fatalf(\"Parse: %v\", err)\n\t}\n}\n")
}

// writeUncompilableSuite puts a package whose only import is used inside the
// one function a mutant blanks. Blanking it leaves an unused import, so the
// mutant does not compile — D26's inconclusive.
func writeUncompilableSuite(t *testing.T, dir, pkg string) {
	t.Helper()

	writeSource(t, dir, pkg+"/"+pkg+".go",
		"package "+pkg+"\n\nimport \"strings\"\n\nfunc Upper(s string) string {\n\treturn strings.ToUpper(s)\n}\n")
	writeSource(t, dir, pkg+"/"+pkg+"_test.go",
		"package "+pkg+"\n\nimport \"testing\"\n\n"+
			"func TestUpper(t *testing.T) {\n\tif Upper(\"a\") != \"A\" {\n\t\tt.Fatal(\"no\")\n\t}\n}\n")
}

// runMutate runs the deletion test against dir with the recursion guard
// cleared. Like the run-evidence row, this is a row that has to reach a real
// run: every other suite in this repo runs under the guard when the battery is
// the one running it, and the guard has its own test below.
//
// Every result goes past mustReconcile on the way out. D33 rules that the
// printed line accounts for the whole sample, and a rule checked in one test is
// a rule the next fixture can break.
func runMutate(t *testing.T, dir string, opts MutateOptions) Result {
	t.Helper()
	t.Setenv(adapter.RunGuardEnv, "")

	res := MutateRow(opts).Check(Context{RepoDir: dir})
	mustReconcile(t, res.Evidence)

	return res
}

// small is the options every fixture runs under: a whole-row clock short
// enough that a wedged fixture fails the test rather than the build, and a
// per-mutant clock under it.
var small = MutateOptions{Budget: 4 * time.Minute, PerMutant: 90 * time.Second}

func TestMutateRowIsInTheDefaultBattery(t *testing.T) {
	registered(t, "mutate", "mutate")
}

// The clause, in its green direction: the suite catches the mutant, so the
// deletion test passes.
func TestMutateRowIsGreenWhenTheSuiteKillsItsMutant(t *testing.T) {
	dir := mutateRepo(t)
	writeKilledSuite(t, dir, "alpha")

	res := runMutate(t, dir, small)
	if res.Outcome != Green {
		t.Fatalf("a suite that catches its mutant came out %s: %s", res.Outcome, res.Evidence)
	}
	mustFit(t, res.Evidence, "1 of 1", "killed 1")
}

// The clause itself: a suite is red when the tests survive the implementation
// being deleted. The row names the function and the suite that should have
// caught it, because a reader who gets neither cannot act on the red.
func TestMutateRowIsRedWhenAMutantSurvives(t *testing.T) {
	dir := mutateRepo(t)
	writeSurvivorSuite(t, dir, "gamma")

	res := runMutate(t, dir, small)
	if res.Outcome != Red {
		t.Fatalf("a surviving mutant came out %s: %s", res.Outcome, res.Evidence)
	}
	mustFit(t, res.Evidence, "Parse", "gamma", "survived")
}

// A target no test covers at all is a survivor too, and the loudest kind:
// nothing could have caught it. It is not an unrunnable — the run worked, and
// what it proved is that the implementation is unproven.
func TestMutateRowIsRedWhenNoTestCoversTheTarget(t *testing.T) {
	dir := mutateRepo(t)
	writeKilledSuite(t, dir, "alpha")
	writeSource(t, dir, "naked/naked.go", "package naked\n\nfunc Double(n int) int {\n\treturn n * 2\n}\n")

	res := runMutate(t, dir, small)
	if res.Outcome != Red {
		t.Fatalf("an untested target came out %s: %s", res.Outcome, res.Evidence)
	}
	mustFit(t, res.Evidence, "Double", "naked", "no test")
}

// D33's first ruling: targets come from the build, never from a walk of the
// tree. The go toolchain's own package list names the files a surface
// compiles, and only those files hold targets.
//
// Each shape below is a file no build on this machine compiles. No test can
// notice its deletion, so a row that offered it as a target would report a
// survivor it invented — a red that cannot be true.
func TestMutateRowTakesItsTargetsFromTheBuild(t *testing.T) {
	// A platform file. This repo ships two of them, so the first exported
	// symbol in one would have turned this repo red.
	t.Run("a file this build leaves out", func(t *testing.T) {
		dir := mutateRepo(t)
		writeKilledSuite(t, dir, "alpha")
		writeSource(t, dir, "alpha/alpha_windows.go",
			"package alpha\n\nfunc WindowsOnly(n int) int {\n\treturn n * 3\n}\n")

		res := runMutate(t, dir, small)
		if res.Outcome != Green {
			t.Fatalf("a file this build leaves out came out %s: %s", res.Outcome, res.Evidence)
		}
		if strings.Contains(res.Evidence, "WindowsOnly") {
			t.Errorf("a file nothing compiles was offered as a target: %s", res.Evidence)
		}
		// Nothing is skipped in silence. The file held no target, and the
		// reader still gets to see that the run was that much narrower.
		mustFit(t, res.Evidence, "1 of 1", "1 file was left out of this build")
	})

	// The go tool leaves a _-prefixed directory out of ./..., so nothing in it
	// is ever built or run.
	t.Run("a directory the go tool ignores", func(t *testing.T) {
		dir := mutateRepo(t)
		writeKilledSuite(t, dir, "alpha")
		writeSource(t, dir, "_scratch/scratch.go",
			"package scratch\n\nfunc Draft(n int) int {\n\treturn n * 5\n}\n")

		res := runMutate(t, dir, small)
		if res.Outcome != Green {
			t.Fatalf("a directory the go tool ignores came out %s: %s", res.Outcome, res.Evidence)
		}
		if strings.Contains(res.Evidence, "Draft") || strings.Contains(res.Evidence, "scratch") {
			t.Errorf("a directory nothing builds was offered as a target: %s", res.Evidence)
		}
	})

	// A whole package behind a build tag. It is not a package whose tests do
	// not run — it is a package this build does not compile at all, and saying
	// the first about it would blame the project for the platform.
	t.Run("a package behind a build tag", func(t *testing.T) {
		dir := mutateRepo(t)
		writeKilledSuite(t, dir, "alpha")
		writeSource(t, dir, "tools/tools.go",
			"//go:build tools\n\npackage tools\n\nfunc Pin(n int) int {\n\treturn n * 3\n}\n")

		res := runMutate(t, dir, small)
		if res.Outcome != Green {
			t.Fatalf("a package behind a build tag came out %s: %s", res.Outcome, res.Evidence)
		}
		if strings.Contains(res.Evidence, "Pin") || strings.Contains(res.Evidence, "tools") {
			t.Errorf("a package this build does not compile was named: %s", res.Evidence)
		}
		if strings.Contains(res.Evidence, "its own tests do not run") {
			t.Errorf("a package this build does not compile was blamed for its tests: %s", res.Evidence)
		}
	})
}

// D26: a mutant that fails to compile is inconclusive, never a catch. It is
// counted and printed, and it never turns the row red on its own.
func TestMutateRowCountsAMutantThatDoesNotCompileAsInconclusive(t *testing.T) {
	t.Run("beside a mutant that was judged", func(t *testing.T) {
		dir := mutateRepo(t)
		writeKilledSuite(t, dir, "alpha")
		writeUncompilableSuite(t, dir, "broken")

		res := runMutate(t, dir, small)
		if res.Outcome != Green {
			t.Fatalf("a mutant that will not compile came out %s: %s", res.Outcome, res.Evidence)
		}
		mustFit(t, res.Evidence, "did not compile")
		if strings.Contains(res.Evidence, "killed 2") {
			t.Errorf("a mutant that never ran was counted as killed: %s", res.Evidence)
		}
	})

	// The same fact with nothing else in the run. A row that called this green
	// would be reporting a mutation run that judged nothing as a suite proven
	// sound — D17's rule, and the inversion this row is likeliest to grow.
	t.Run("alone", func(t *testing.T) {
		dir := mutateRepo(t)
		writeUncompilableSuite(t, dir, "broken")

		res := runMutate(t, dir, small)
		if res.Outcome != Unrunnable {
			t.Fatalf("a run that judged no mutant came out %s: %s", res.Outcome, res.Evidence)
		}
		mustFit(t, res.Evidence, "did not compile")
	})
}

// A package whose own tests fail before anything is mutated cannot prove a
// mutant died: every mutant would look killed by the failure that was already
// there. The row judges nothing there and says so.
func TestMutateRowJudgesNothingInAPackageThatIsAlreadyRed(t *testing.T) {
	dir := mutateRepo(t)
	writeSource(t, dir, "sick/sick.go", "package sick\n\nfunc AddsUp(a, b int) int {\n\treturn a + b\n}\n")
	writeSource(t, dir, "sick/sick_test.go",
		"package sick\n\nimport \"testing\"\n\n"+
			"func TestAlreadyFailing(t *testing.T) {\n\tt.Fatal(\"this suite is red before anything is mutated\")\n}\n")

	res := runMutate(t, dir, small)
	if res.Outcome != Unrunnable {
		t.Fatalf("an already-red package came out %s: %s", res.Outcome, res.Evidence)
	}
	mustFit(t, res.Evidence, "sick")
	if strings.Contains(res.Evidence, "killed 1") {
		t.Errorf("a suite that was red before the mutation was counted as a catch: %s", res.Evidence)
	}
}

// D34: the mutate row asks one question, and a crash is an answer to it.
//
// A package whose baseline run is clean, and whose run crashes with the mutant
// applied, has noticed. D32 already rules a panic a failure path. So the crash
// is a kill, and the line says how many of the kills were crashes.
//
// The boundary is the point of the three subtests. Only a crash counts. A clock
// that ran out is not one, and a package that was already crashing before
// anything was mutated is not one either.
func TestMutateRowCountsACrashUnderMutationAsAKill(t *testing.T) {
	// Blanking Guard hands the test a nil slice, so the test binary dies on the
	// index rather than reporting a failure. Nothing in a run log says the
	// suite failed — the run log is refused outright.
	t.Run("a mutant that kills the test binary", func(t *testing.T) {
		dir := mutateRepo(t)
		writeCrashingSuite(t, dir, "boom")

		res := runMutate(t, dir, small)
		if res.Outcome != Green {
			t.Fatalf("a mutant that crashed the suite came out %s: %s", res.Outcome, res.Evidence)
		}
		mustFit(t, res.Evidence, "killed 1", "1 by crash")
	})

	// The row's own clock is not the suite noticing anything. A mutant nobody
	// waited out stays exactly where it was: counted, printed, never a catch.
	t.Run("a mutant nobody waited out", func(t *testing.T) {
		dir := mutateRepo(t)
		writeHangingSuite(t, dir, "slow")

		res := runMutate(t, dir, MutateOptions{Budget: 3 * time.Minute, PerMutant: 5 * time.Second})
		if res.Outcome != Unrunnable {
			t.Fatalf("a mutant nobody waited out came out %s: %s", res.Outcome, res.Evidence)
		}
		mustFit(t, res.Evidence, "killed 0", "1 ran out of time")
		if strings.Contains(res.Evidence, "crash") {
			t.Errorf("a clock that ran out was reported as a crash: %s", res.Evidence)
		}
	})

	// D34 rests on a clean baseline. A package that was already crashing before
	// anything was mutated would report every mutant as caught by the crash
	// that was there first.
	t.Run("a package that was crashing before anything was mutated", func(t *testing.T) {
		dir := mutateRepo(t)
		writeSource(t, dir, "sick/sick.go", "package sick\n\nfunc AddsUp(a, b int) int {\n\treturn a + b\n}\n")
		writeSource(t, dir, "sick/sick_test.go",
			"package sick\n\nimport \"testing\"\n\n"+
				"func TestAlreadyCrashing(t *testing.T) {\n\tpanic(\"this suite dies before anything is mutated\")\n}\n")

		res := runMutate(t, dir, small)
		if res.Outcome != Unrunnable {
			t.Fatalf("a package that was already crashing came out %s: %s", res.Outcome, res.Evidence)
		}
		// The reason is the seam's own words, so the line does say the package
		// crashed. What it must never say is that the crash was a catch.
		mustFit(t, res.Evidence, "killed 0", "sick")
		if strings.Contains(res.Evidence, "by crash") {
			t.Errorf("a package that was already broken was reported as a catch: %s", res.Evidence)
		}
	})
}

// D35's second ruling: go test's own clock writes a panic, and that panic is
// the clock noticing the suite rather than the suite noticing the mutant.
//
// A project sets its own timeout — in its flags, or through GOFLAGS — and the
// row cannot assume its own per-mutant clock fires first. Read as a crash, a
// mutant that hangs forever would come back as a kill, and a suite that proves
// nothing would read as one that caught everything.
func TestMutateRowCountsGoTestsOwnClockAsAClockDeath(t *testing.T) {
	dir := mutateRepo(t)
	writeSource(t, dir, "alpha/alpha.go",
		"package alpha\n\nfunc AddsUp(a, b int) int {\n\treturn a + b\n}\n\n"+
			"func Stop(i int) bool {\n\treturn i > 2\n}\n")
	writeSource(t, dir, "alpha/alpha_test.go",
		"package alpha\n\nimport (\n\t\"testing\"\n\t\"time\"\n)\n\n"+
			"func TestAddsUp(t *testing.T) {\n\tif AddsUp(1, 1) != 2 {\n\t\tt.Fatal(\"no\")\n\t}\n}\n\n"+
			"func TestLoops(t *testing.T) {\n\tfor i := 0; ; i++ {\n\t\tif Stop(i) {\n\t\t\tbreak\n\t\t}\n"+
			"\t\ttime.Sleep(time.Millisecond)\n\t}\n}\n")

	// The project's clock, not the row's. The row's own is left long enough
	// that it cannot be what ends the run.
	t.Setenv("GOFLAGS", "-timeout=5s")

	res := runMutate(t, dir, MutateOptions{Budget: 3 * time.Minute, PerMutant: 90 * time.Second})
	if res.Outcome != Green {
		t.Fatalf("a mutant the project's own clock ended came out %s: %s", res.Outcome, res.Evidence)
	}
	mustFit(t, res.Evidence, "killed 1", "1 ran out of time")
	if strings.Contains(res.Evidence, "crash") {
		t.Errorf("a clock that ran out was reported as the suite noticing: %s", res.Evidence)
	}
}

// The same clock, one step earlier: a package whose tests were already ending
// on the test runner's own clock before anything was mutated. Nothing about
// that package can be judged, and the reason is the clock rather than a verdict
// on its tests.
func TestMutateRowSaysAPackageDidNotFinishInTimeBeforeAnyMutant(t *testing.T) {
	dir := mutateRepo(t)
	writeSource(t, dir, "slow/slow.go", "package slow\n\nfunc AddsUp(a, b int) int {\n\treturn a + b\n}\n")
	writeSource(t, dir, "slow/slow_test.go",
		"package slow\n\nimport (\n\t\"testing\"\n\t\"time\"\n)\n\n"+
			"func TestSlow(t *testing.T) {\n\ttime.Sleep(time.Minute)\n}\n")

	t.Setenv("GOFLAGS", "-timeout=5s")

	res := runMutate(t, dir, MutateOptions{Budget: 3 * time.Minute, PerMutant: 90 * time.Second})
	if res.Outcome != Unrunnable {
		t.Fatalf("a package whose own tests never finish came out %s: %s", res.Outcome, res.Evidence)
	}
	mustFit(t, res.Evidence, "do not finish in time")
}

// A mutant that leaves the suite running no test at all is inconclusive, never
// a catch.
//
// The gate is one a real project has: TestMain runs the suite only when a
// feature is on. Blank the function behind the gate and every test is skipped
// before it starts. Nothing ran, so nothing noticed — and a row that read the
// refused run log as a crash would report a green over a suite that did
// nothing at all.
func TestMutateRowCountsAMutantThatRanNothingAsInconclusive(t *testing.T) {
	dir := mutateRepo(t)
	writeSource(t, dir, "alpha/alpha.go",
		"package alpha\n\nfunc AddsUp(a, b int) int {\n\treturn a + b\n}\n\n"+
			"func Feature() string {\n\treturn \"on\"\n}\n")
	writeSource(t, dir, "alpha/alpha_test.go",
		"package alpha\n\nimport (\n\t\"os\"\n\t\"testing\"\n)\n\n"+
			"func TestMain(m *testing.M) {\n\tif Feature() != \"on\" {\n\t\tos.Exit(0)\n\t}\n\n\tos.Exit(m.Run())\n}\n\n"+
			"func TestAddsUp(t *testing.T) {\n\tif AddsUp(1, 1) != 2 {\n\t\tt.Fatal(\"no\")\n\t}\n}\n")

	res := runMutate(t, dir, small)
	if res.Outcome != Green {
		t.Fatalf("a mutant that left nothing running came out %s: %s", res.Outcome, res.Evidence)
	}
	mustFit(t, res.Evidence, "killed 1", "1 ran nothing")
	if strings.Contains(res.Evidence, "killed 2") {
		t.Errorf("a suite that ran nothing was counted as a catch: %s", res.Evidence)
	}
	if strings.Contains(res.Evidence, "crash") {
		t.Errorf("a suite that ran nothing was reported as one that died: %s", res.Evidence)
	}
}

// A mutant that could not be applied was never applied, so nothing was damaged
// and nothing could notice. It is counted, and no run is started for it.
//
// Two separate ways to fail, and two separate fixtures, because one fixture
// covering both would let either guard be removed without a test noticing. The
// write is the one that matters most: with it unguarded, the package runs
// unmutated, comes back clean, and the row appends a survivor naming a function
// it never touched — a red invented out of a file it could not open.
func TestMutateCountsAMutantItCouldNotApplyAsInconclusive(t *testing.T) {
	tgt := target{
		suite: "alpha", file: "alpha/alpha.go", place: "alpha/alpha.go",
		symbol: "AddsUp", content: "package alpha\n\nfunc AddsUp(a, b int) int { return *new(int) }\n",
	}

	judged := func(t *testing.T, dir string) *tally {
		t.Helper()

		got := &tally{}
		never := runnerFunc(func(context.Context, string, string) (adapter.RunLog, error) {
			t.Error("a mutant that was never applied was run anyway")

			return adapter.RunLog{}, nil
		})

		if !got.judgeOne(context.Background(), never, dir, tgt,
			baseline{state: baselineCovered, tests: 1}, small.withDefaults()) {
			t.Fatal("a mutant that could not be applied stopped the whole run")
		}
		if got.unwritten != 1 {
			t.Errorf("the run counted %d mutants it could not apply, want 1", got.unwritten)
		}
		if got.killed != 0 || len(got.survivors) != 0 {
			t.Errorf("a mutant that was never applied came out as killed %d, survived %d",
				got.killed, len(got.survivors))
		}

		return got
	}

	// The file is not there at all, which is what a copy that lost a file
	// mid-run leaves behind.
	t.Run("the file could not be read", func(t *testing.T) {
		judged(t, t.TempDir())
	})

	// The file is there and reads fine, and the write is what fails.
	t.Run("the file could not be written", func(t *testing.T) {
		dir := t.TempDir()
		file := filepath.Join(dir, "alpha", "alpha.go")
		writeSource(t, dir, "alpha/alpha.go", "package alpha\n\nfunc AddsUp(a, b int) int { return a + b }\n")
		unwritable(t, file)

		if _, err := os.ReadFile(file); err != nil {
			t.Fatalf("the fixture cannot be read either, so it proves nothing about the write: %v", err)
		}
		judged(t, dir)
	})
}

// unwritable makes one file refuse a write while still reading fine, and takes
// the refusal off again when the test ends.
//
// File modes are no help here: this suite may be running as a user that
// overrides them, and a fixture that quietly writes anyway would prove nothing.
// The immutable attribute is refused even then. Where it cannot be set, the
// test skips rather than passing on a fixture that did not hold.
func unwritable(t *testing.T, file string) {
	t.Helper()

	if err := exec.Command("chattr", "+i", file).Run(); err != nil {
		t.Skipf("this machine will not make a file unwritable: %v", err)
	}
	t.Cleanup(func() { _ = exec.Command("chattr", "-i", file).Run() })

	if err := os.WriteFile(file, []byte("probe"), 0o600); err == nil {
		t.Skip("this machine wrote to a file it was told not to, so the fixture proves nothing")
	}
}

// A file the build names and the seam cannot read holds no target, and the
// reader gets to see that the run was that much narrower. Nothing is skipped in
// silence.
func TestMutateRowCountsAFileItCouldNotReadAsANote(t *testing.T) {
	dir := mutateRepo(t)
	writeKilledSuite(t, dir, "alpha")
	writeSource(t, dir, "broken/broken.go", "package broken\n\nthis is not go\n")

	res := runMutate(t, dir, small)
	if res.Outcome != Green {
		t.Fatalf("a file that does not parse came out %s: %s", res.Outcome, res.Evidence)
	}
	mustFit(t, res.Evidence, "1 file was not read")
}

// A file the build names and this row cannot even look at is counted the same
// way as one it cannot parse: a narrower run, said out loud.
//
// The build named it, so it existed a moment ago. Something took it away
// between the listing and the reading, and that is a fact about the run rather
// than about the project's tests.
func TestMutateCountsAFileTheBuildNamesAndIsNotThereAsANote(t *testing.T) {
	dir := mutateRepo(t)
	writeKilledSuite(t, dir, "alpha")

	s, _, ok := openScan("deletion test", Context{RepoDir: dir})
	if !ok {
		t.Fatal("the fixture did not open")
	}

	got := &tally{}
	named := []adapter.Package{{ID: "alpha", Files: []string{"alpha/gone.go"}}}

	found, why := targetsOf(context.Background(), s, s.m.Surfaces[0], seamOf(t, s), named, got)
	if why != "" {
		t.Fatalf("reading the surface came out %q", why)
	}
	if len(found) != 0 {
		t.Errorf("a file that is not there offered %d targets", len(found))
	}
	if got.notes.unreadable != 1 {
		t.Errorf("the run counted %d files it could not read, want 1", got.notes.unreadable)
	}
}

// seamOf is the seam the row would have used for one surface.
func seamOf(t *testing.T, s scanned) mutationSeam {
	t.Helper()

	seam, why := seamFor(s, s.m.Surfaces[0])
	if why != "" {
		t.Fatalf("the fixture has no seam: %s", why)
	}

	return seam
}

// A surface the seam cannot run a package in is not a surface whose tests are
// bad. Saying "its own tests do not run" about a project whose tests are fine
// puts a false sentence on the record, so the row carries the seam's own words
// instead — the truer thing the run-evidence row already says.
func TestMutateRowNamesWhyAPackageCouldNotBeRun(t *testing.T) {
	const subdirSurface = `{
  "schema": 1,
  "surfaces": [{"name": "cli", "profile": "cli", "stack": "go", "root": "./app"}],
  "capabilities": [{"name": "adding", "surface": "cli", "proof": ["alpha"]}]
}`

	dir := newRepo(t)
	writeManifest(t, dir, subdirSurface)
	writeSource(t, dir, "go.mod", "module groundwork.test/fixture\n\ngo 1.24\n")
	writeKilledSuite(t, filepath.Join(dir, "app"), "alpha")

	res := runMutate(t, dir, small)
	if res.Outcome != Unrunnable {
		t.Fatalf("a surface root that is not a module root came out %s: %s", res.Outcome, res.Evidence)
	}
	// The surface's own root, named the way the project names it. By the time
	// the seam complains, the run has moved into a throwaway copy, and that
	// directory's name is this run's alone — it tells a reader nothing.
	mustFit(t, res.Evidence, "app is not a Go module")
	if strings.Contains(res.Evidence, "groundwork-mutate") {
		t.Errorf("the evidence names the throwaway copy rather than the surface: %s", res.Evidence)
	}
	if strings.Contains(res.Evidence, "its own tests do not run") {
		t.Errorf("the row blamed the project's tests for its layout: %s", res.Evidence)
	}
}

// D35's restatement of D33: the numbers-never-cut rule binds the whole
// accounting. When the full wording will not fit, the words give way — shorter
// class names, a shorter verdict — and every count stays whole.
//
// This is the worst case the row can produce: every class populated, four-digit
// counts, and the longest verdict of the five.
func TestMutateEvidenceKeepsEveryCountWhenEveryClassIsFull(t *testing.T) {
	got := &tally{
		version: "10.20+r1234567", pool: 99999,
		killed: 999, crashed: 99,
		uncompiled: 999, outOfTime: 999, unrun: 999, unchanged: 999, unwritten: 999,
		notJudged: 999,
	}
	for i := range 999 {
		got.survivors = append(got.survivors, hit{
			file:    fmt.Sprintf("internal/some/package%d/withalongname.go", i),
			line:    i + 1,
			subject: "SomeExportedFunctionName",
			shape:   "survived, and the 3 tests of internal/some stayed green",
		})
		got.blame("internal/blocked", "its own tests do not pass unmutated")
	}
	got.sampled = got.accounted()

	res := got.result()
	// Every class populated includes the budget dying, which carries the
	// longest verdict of the five.
	if res.Outcome != Unrunnable {
		t.Fatalf("a run that ran out of its budget came out %s: %s", res.Outcome, res.Evidence)
	}

	// mustReconcile carries most of the assertion: it can only add the classes
	// up to the sample if every count reached the line whole. It steps over the
	// crash split, so that one is named here — D34 asks for it in every
	// wording, not only the roomy one.
	mustReconcile(t, res.Evidence)
	mustFit(t, res.Evidence, "99 crashed")
	// The wordier rungs are what keep the version and the class split in the
	// line, so one case has to land on them. This one carries no names at all,
	// which is what leaves the room: the same numbers, one rung up.
	fits := &tally{
		version: "10.20+r1234567", pool: 99999,
		killed: 999, crashed: 99,
		uncompiled: 999, outOfTime: 999, unrun: 999, unchanged: 999, unwritten: 999,
		notJudged: 999,
	}
	fits.sampled = fits.accounted()

	wordier := fits.result()
	mustReconcile(t, wordier.Evidence)
	// The version says which sample this was, so a red can be reproduced, and
	// the classes are still told apart. Both are worth more than the plainest
	// wording, and both go before any count does.
	mustFit(t, wordier.Evidence, fits.version, "uncompiled", "timed out")
}

// D36's first ruling: the ladder must end on a rung that provably fits the
// journal's cap on any input the types allow.
//
// This is arithmetic, not measurement. Every number the rung prints is an int,
// and the widest an int prints is what this pins. A rung proven by one fixture
// is a rung proven for one fixture.
func TestMutateEvidenceLastRungFitsWhateverTheNumbersAre(t *testing.T) {
	most := math.MaxInt

	widest := collapsedCounts(most, most, most, most, most, most, most)
	if len(widest) > journal.MaxTextBytes {
		t.Errorf("the last rung is %d bytes at its widest, over the journal's cap of %d: %s",
			len(widest), journal.MaxTextBytes, widest)
	}

	// The rung takes no version, which is how it stays bounded: a declared
	// version is 32 bytes of somebody else's choosing, and the digest is eight
	// more. D36 lets the last rung drop it.
	if strings.Contains(widest, "+r") || strings.Contains(widest, " at ") {
		t.Errorf("the last rung carries a version, which no arithmetic here bounds: %s", widest)
	}
}

// And the same rung reached for real, on the widest inputs a lock file and a
// full sweep can legally produce: a 32-byte declared version, a pool of six
// digits, and every class populated. The rung above this one is 208 bytes on
// exactly this input, which is what makes this the rung under test.
func TestMutateEvidenceFallsToItsLastRung(t *testing.T) {
	const each = 9999

	// The widest declared half a lock file may hold, plus the digest.
	got := &tally{
		version: VersionString(strings.Repeat("9", maxVersionBytes-2)+".9", "r1234567"),
		pool:    999999,
		killed:  each, crashed: 999,
		uncompiled: each, outOfTime: each, unrun: each, unchanged: each, unwritten: each,
		notJudged: each,
	}
	for i := range each {
		got.survivors = append(got.survivors, hit{
			file: fmt.Sprintf("internal/some/package%d/file.go", i), line: i + 1,
			subject: "SomeExportedFunctionName", shape: "survived, and the 3 tests of it stayed green",
		})
		got.blame("internal/blocked", "its own tests do not pass unmutated")
	}
	got.sampled = got.accounted()

	res := got.result()

	// The whole point of the rung: the line still reconciles, and no count was
	// cut to make it fit. The crash split survives too — D34 asks for it at
	// every rung, and mustReconcile steps over it.
	mustReconcile(t, res.Evidence)
	mustFit(t, res.Evidence, "inconclusive", "999 crashed")

	// This is the rung under test, and the version going is how it is bounded.
	if strings.Contains(res.Evidence, got.version) {
		t.Errorf("the line did not fall as far as its last rung: %s", res.Evidence)
	}
}

// writeCrashingSuite puts a package whose test proves its exported function by
// reading past the front of what it returns. Blank the function and the test
// binary dies where it stands, which is the suite noticing (D34).
func writeCrashingSuite(t *testing.T, dir, pkg string) {
	t.Helper()

	writeSource(t, dir, pkg+"/"+pkg+".go",
		"package "+pkg+"\n\nfunc Pair(n int) []int {\n\treturn []int{n, n + 1}\n}\n")
	writeSource(t, dir, pkg+"/"+pkg+"_test.go",
		"package "+pkg+"\n\nimport \"testing\"\n\n"+
			"func TestPair(t *testing.T) {\n\tif Pair(1)[1] != 2 {\n\t\tt.Fatal(\"no\")\n\t}\n}\n")
}

// writeHangingSuite puts a package whose test spins forever once its exported
// function is blanked. The mutant's own clock is what ends it.
func writeHangingSuite(t *testing.T, dir, pkg string) {
	t.Helper()

	writeSource(t, dir, pkg+"/"+pkg+".go",
		"package "+pkg+"\n\nfunc Guard(n int) int {\n\tif n > 0 {\n\t\treturn n\n\t}\n\n\treturn 1\n}\n")
	writeSource(t, dir, pkg+"/"+pkg+"_test.go",
		"package "+pkg+"\n\nimport (\n\t\"testing\"\n\t\"time\"\n)\n\n"+
			"func TestGuard(t *testing.T) {\n\tfor Guard(1) == 0 {\n\t\ttime.Sleep(time.Second)\n\t}\n}\n")
}

// One package that cannot be judged is one entry with a count, not one entry
// per target. Four repeats of a package name push the reader's own numbers off
// the end of a line the journal caps.
func TestMutateEvidenceNamesAnUnjudgeablePackageOnce(t *testing.T) {
	dir := mutateRepo(t)
	writeKilledSuite(t, dir, "alpha")
	writeSource(t, dir, "sick/sick.go",
		"package sick\n\nfunc One(n int) int { return n + 1 }\n\n"+
			"func Two(n int) int { return n + 2 }\n\n"+
			"func Three(n int) int { return n + 3 }\n\n"+
			"func Four(n int) int { return n + 4 }\n")
	writeSource(t, dir, "sick/sick_test.go",
		"package sick\n\nimport \"testing\"\n\n"+
			"func TestAlreadyFailing(t *testing.T) {\n\tt.Fatal(\"red before anything is mutated\")\n}\n")

	res := runMutate(t, dir, small)
	if res.Outcome != Green {
		t.Fatalf("one already-red package beside a kill came out %s: %s", res.Outcome, res.Evidence)
	}
	if got := strings.Count(res.Evidence, "sick"); got != 1 {
		t.Errorf("the package sick is named %d times in one line: %s", got, res.Evidence)
	}
	mustFit(t, res.Evidence, "4 blocked by their own package")
}

// The sample is a budget, and the budget is what makes the row affordable.
// Sampling every target on every verify run costs minutes per run; sampling
// none proves nothing.
func TestMutateRowSamplesWithinItsBudget(t *testing.T) {
	pool := make([]target, 0, 40)
	for i := range 40 {
		pool = append(pool, target{
			surface: "cli",
			suite:   "alpha",
			file:    "alpha/alpha.go",
			symbol:  fmt.Sprintf("Exported%02d", i),
		})
	}

	t.Run("the same version picks the same targets", func(t *testing.T) {
		first := symbolsOf(sample(pool, "4.0+r1234567", 5))
		again := symbolsOf(sample(pool, "4.0+r1234567", 5))
		if len(first) != 5 {
			t.Fatalf("the sample holds %d targets, want 5: %v", len(first), first)
		}
		if strings.Join(first, ",") != strings.Join(again, ",") {
			t.Errorf("two runs of one version sampled %v and %v", first, again)
		}
	})

	// Coverage rotates as the version moves, so a target the last version never
	// touched is reached by the next one. A hash that ignored the version would
	// mutate the same five functions until the end of the repo.
	t.Run("a new version picks different targets", func(t *testing.T) {
		first := symbolsOf(sample(pool, "4.0+r1234567", 5))
		next := symbolsOf(sample(pool, "5.0+r7654321", 5))
		if strings.Join(first, ",") == strings.Join(next, ",") {
			t.Errorf("two versions sampled the same targets: %v", first)
		}
	})

	t.Run("a budget over the pool takes the whole pool", func(t *testing.T) {
		if got := sample(pool, "4.0+r1234567", 500); len(got) != len(pool) {
			t.Errorf("the sample holds %d of %d targets", len(got), len(pool))
		}
	})

	// The full sweep is the grading tool's, and it asks for it by name rather
	// than by passing a number big enough.
	t.Run("the full sweep takes every target", func(t *testing.T) {
		opts := MutateOptions{RunAll: true}.withDefaults()
		if got := sample(pool, "4.0+r1234567", opts.budget()); len(got) != len(pool) {
			t.Errorf("the full sweep holds %d of %d targets", len(got), len(pool))
		}
	})
}

// The row's headline safety claim, watched from inside the run rather than read
// off the tree afterwards.
//
// The runner is wrapped, so the test is called once per package run with a
// mutant applied. It reads the project's own file at that moment and asserts
// the original bytes are still there, and it asserts the run was pointed at the
// copy rather than at the working tree. A row that mutated the real tree and
// put it back would pass a check made after the run; it cannot pass this one.
func TestMutateRowDamagesOnlyTheCopy(t *testing.T) {
	dir := mutateRepo(t)
	writeKilledSuite(t, dir, "alpha")

	real := filepath.Join(dir, "alpha", "alpha.go")
	was, err := os.ReadFile(real)
	if err != nil {
		t.Fatalf("could not read the fixture: %v", err)
	}

	var mutated int
	opts := small
	opts.watch = func(inner packageRunner) packageRunner {
		return runnerFunc(func(ctx context.Context, at, suite string) (adapter.RunLog, error) {
			if at == dir {
				t.Errorf("the mutation run was pointed at the working tree at %s", at)
			}
			now, err := os.ReadFile(real)
			if err != nil {
				t.Errorf("the mutation run took the project's own file away: %v", err)
			} else if string(now) != string(was) {
				t.Errorf("the project's own file was damaged while a mutant was applied")
			}
			// Watching a run that mutated nothing would prove nothing, so the
			// test counts the runs that really had a mutant in front of them.
			if copied, err := os.ReadFile(filepath.Join(at, "alpha", "alpha.go")); err == nil &&
				string(copied) != string(was) {
				mutated++
			}

			return inner.RunPackage(ctx, at, suite)
		})
	}

	res := runMutate(t, dir, opts)
	if res.Outcome != Green {
		t.Fatalf("the fixture came out %s: %s", res.Outcome, res.Evidence)
	}
	if mutated == 0 {
		t.Fatal("no mutant was ever applied, so nothing about isolation was watched")
	}
}

// The same claim from the other end, read off the tree once the run is over.
// It catches what the watch cannot: a file written after the last run, or one
// the copy took away.
func TestMutateRowNeverWritesInTheWorkingTree(t *testing.T) {
	dir := mutateRepo(t)
	writeKilledSuite(t, dir, "alpha")
	writeSurvivorSuite(t, dir, "gamma")

	before := treeOf(t, dir)
	res := runMutate(t, dir, small)
	if res.Outcome != Red {
		t.Fatalf("the fixture came out %s: %s", res.Outcome, res.Evidence)
	}

	for path, was := range before {
		now, err := os.ReadFile(path)
		if err != nil {
			t.Fatalf("the mutation run removed %s: %v", path, err)
		}
		if string(now) != was {
			t.Errorf("the mutation run wrote in the working tree at %s", path)
		}
	}
}

// D33's fourth ruling: the throwaway copy is faithful. It carries the
// project's git record, as a copy, so a package whose tests ask git about the
// project answers in the copy the way it does in the project.
func TestMutateCopyCarriesTheProjectsGitRecord(t *testing.T) {
	dir := mutateRepo(t)
	writeKilledSuite(t, dir, "alpha")
	runGit(t, dir, "add", ".")
	runGit(t, dir, "commit", "-m", "the project's own record")
	writeSource(t, dir, "alpha/untracked.go", "package alpha\n\nfunc Later(n int) int {\n\treturn n\n}\n")

	head := runGit(t, dir, "rev-parse", "HEAD")

	res := inWorktree(scanned{root: dir}, dir, func(copied string) Result {
		if got := runGit(t, copied, "rev-parse", "HEAD"); got != head {
			t.Errorf("the copy's history is at %s, and the project's is at %s", got, head)
		}
		if got := runGit(t, copied, "ls-files", "alpha/alpha.go"); got != "alpha/alpha.go" {
			t.Errorf("the copy does not track alpha/alpha.go: %q", got)
		}
		// The copy is of the working tree, not of HEAD. A pre-commit gate that
		// judged the last commit would pass a repo whose uncommitted change
		// breaks it.
		if got := runGit(t, copied, "status", "--porcelain"); !strings.Contains(got, "untracked.go") {
			t.Errorf("the copy does not carry the working tree's own state: %q", got)
		}

		return Result{Outcome: Green, Evidence: "the copy was read"}
	})
	if res.Outcome != Green {
		t.Fatalf("reading the copy came out %s: %s", res.Outcome, res.Evidence)
	}
}

// D35's first ruling: a project whose git record lives outside it is refused.
//
// In a linked worktree — and in a submodule — .git is a file holding one line,
// "gitdir: …", naming a git directory somewhere else. Copying that file byte
// for byte does not copy the record it names. git inside the copy resolves
// straight back to the developer's real object store, so a test running on
// mutated code could commit to the real history. D33 asks for a faithful copy,
// and a faithful copy of this shape is a self-contained record or none.
func TestMutateRowRefusesAProjectWhoseGitRecordLivesElsewhere(t *testing.T) {
	// The record at the surface root governs every run on that surface.
	t.Run("at the surface root", func(t *testing.T) {
		main := newRepo(t)
		live := filepath.Join(t.TempDir(), "live")
		runGit(t, main, "worktree", "add", live, "-b", "live")

		// The shape is real: git itself made it, and git works inside it.
		if info, err := os.Lstat(filepath.Join(live, ".git")); err != nil || info.IsDir() {
			t.Fatalf("the fixture is not a linked worktree: %v", err)
		}

		writeManifest(t, live, goCLISurface)
		writeSource(t, live, "go.mod", "module groundwork.test/fixture\n\ngo 1.24\n")
		writeKilledSuite(t, live, "alpha")

		res := runMutate(t, live, small)
		if res.Outcome != Unrunnable {
			t.Fatalf("a linked worktree came out %s: %s", res.Outcome, res.Evidence)
		}
		// The shape is named, because a reader who is told only "unrunnable"
		// has nowhere to go next.
		mustFit(t, res.Evidence, "cli", "git record")
		if strings.Contains(res.Evidence, main) {
			t.Errorf("the evidence carries this machine's own path: %s", res.Evidence)
		}
	})

	// And a record deeper in, on a package the build names. A test runs with
	// its own package directory as its working directory, and git resolves a
	// record by walking upward from there — so this one governs that package's
	// run just as surely as one at the root. A submodule is this shape.
	t.Run("at a package the build names", func(t *testing.T) {
		dir := mutateRepo(t)
		writeKilledSuite(t, dir, "alpha")
		writeSource(t, dir, "lib/lib.go", "package lib\n\nfunc Twice(n int) int {\n\treturn n * 2\n}\n")
		writeSource(t, dir, "lib/lib_test.go",
			"package lib\n\nimport \"testing\"\n\n"+
				"func TestTwice(t *testing.T) {\n\tif Twice(2) != 4 {\n\t\tt.Fatal(\"no\")\n\t}\n}\n")
		writeSource(t, dir, "lib/.git", "gitdir: "+t.TempDir()+"\n")

		res := runMutate(t, dir, small)
		if res.Outcome != Unrunnable {
			t.Fatalf("a borrowed record at a package came out %s: %s", res.Outcome, res.Evidence)
		}
		mustFit(t, res.Evidence, "lib/.git")
	})
}

// D36's second ruling: the guard refuses a record only where it can govern a
// run.
//
// A test runs with its package directory as its working directory, and git
// walks upward from there. A .git file on no such path captures nothing — and a
// project that keeps a linked-worktree fixture under testdata is a
// self-contained project doing its own business. Refusing it was a false
// sentence about a project that is fine.
func TestMutateRowToleratesAGitRecordNoRunCanReach(t *testing.T) {
	dir := mutateRepo(t)
	writeKilledSuite(t, dir, "alpha")

	// testdata is Go's own fixture convention, and the build names nothing
	// inside it. Nothing this row runs will ever have it on the way up.
	writeSource(t, dir, "testdata/linked-worktree/.git", "gitdir: "+t.TempDir()+"\n")
	writeSource(t, dir, "testdata/linked-worktree/go.mod", "module groundwork.test/fixture\n\ngo 1.24\n")

	res := runMutate(t, dir, small)
	if res.Outcome != Green {
		t.Fatalf("a fixture the build never names came out %s: %s", res.Outcome, res.Evidence)
	}
	if strings.Contains(res.Evidence, "git record") {
		t.Errorf("the row refused a record no run of it can reach: %s", res.Evidence)
	}
}

// The ordinary shape still holds, and the copy of it is its own repository. A
// copy that shared the project's object store would let a mutated suite write
// the project's history, which is the whole reason the shape above is refused.
func TestMutateCopyOfAnOrdinaryRepoIsSelfContained(t *testing.T) {
	dir := mutateRepo(t)
	writeKilledSuite(t, dir, "alpha")
	runGit(t, dir, "add", ".")
	runGit(t, dir, "commit", "-m", "the project's own record")

	head := runGit(t, dir, "rev-parse", "HEAD")

	res := inWorktree(scanned{root: dir}, dir, func(copied string) Result {
		// A commit made inside the copy is the strongest form of what a
		// mutated suite could do. It must land in the copy and nowhere else.
		writeFile(t, filepath.Join(copied, "written-by-the-copy.txt"), "from inside\n")
		runGit(t, copied, "add", ".")
		runGit(t, copied, "commit", "-m", "written from inside the copy")

		if runGit(t, copied, "rev-parse", "HEAD") == head {
			t.Error("the commit made in the copy did not land in the copy")
		}
		if now := runGit(t, dir, "rev-parse", "HEAD"); now != head {
			t.Errorf("a commit made in the copy moved the project's own history to %s", now)
		}

		return Result{Outcome: Green, Evidence: "the copy was read"}
	})
	if res.Outcome != Green {
		t.Fatalf("reading the copy came out %s: %s", res.Outcome, res.Evidence)
	}
}

// A symlink can point anywhere on the machine, and a copy that followed one
// would carry a file this project does not ship — and then mutate it.
func TestMutateCopyDoesNotFollowASymlink(t *testing.T) {
	dir := mutateRepo(t)
	writeKilledSuite(t, dir, "alpha")

	outside := writeSource(t, dir, "outside/elsewhere.txt", "not this project's work\n")
	link := filepath.Join(dir, "linked.txt")
	if err := os.Symlink(outside, link); err != nil {
		t.Skipf("this machine does not do symlinks: %v", err)
	}

	res := inWorktree(scanned{root: dir}, dir, func(copied string) Result {
		if _, err := os.Lstat(filepath.Join(copied, "linked.txt")); !os.IsNotExist(err) {
			t.Errorf("the copy carries a file it reached through a symlink")
		}

		return Result{Outcome: Green, Evidence: "the copy was read"}
	})
	if res.Outcome != Green {
		t.Fatalf("reading the copy came out %s: %s", res.Outcome, res.Evidence)
	}
}

// The copy goes even when the work inside it blows up. A panic mid-mutation is
// the one path that has no return statement to clean up after it, and a run
// that left its copies behind would fill the machine one verify at a time.
func TestMutateWorktreeIsRemovedEvenWhenTheWorkInsideItCrashes(t *testing.T) {
	dir := mutateRepo(t)
	writeKilledSuite(t, dir, "alpha")

	var used string
	res := inWorktree(scanned{root: dir}, dir, func(copied string) Result {
		used = copied
		panic("the mutation run fell over")
	})

	if res.Outcome != Unrunnable {
		t.Fatalf("a crashed mutation run came out %s: %s", res.Outcome, res.Evidence)
	}
	if used == "" {
		t.Fatal("the work never ran, so the cleanup was not proven")
	}
	if _, err := os.Stat(used); !os.IsNotExist(err) {
		t.Errorf("the throwaway worktree %s outlived the crash", used)
	}
}

// The recursion guard, both halves. The row starts test runs, and a project
// whose own suite calls the battery would otherwise mutate itself inside its
// own mutation run, forever.
func TestMutateRowRefusesToRunInsideItself(t *testing.T) {
	dir := mutateRepo(t)
	writeKilledSuite(t, dir, "alpha")
	t.Setenv(adapter.RunGuardEnv, "1")

	res := runRow(t, dir, "mutate")
	if res.Outcome != Unrunnable {
		t.Fatalf("the row ran inside a battery run and came out %s: %s", res.Outcome, res.Evidence)
	}
	mustFit(t, res.Evidence, "already running inside a battery run")
}

// D25 puts every other stack out of process, and the seam's mutants call is
// there for them. Driving a whole mutation run through a foreign runner lands
// with that stack's adapter, so the row says so rather than passing in silence.
func TestMutateRowIsUnrunnableOnAnOutOfProcessSurface(t *testing.T) {
	dir := newRepo(t)
	writeManifest(t, dir, webSurface)

	res := runMutate(t, dir, small)
	if res.Outcome != Unrunnable {
		t.Fatalf("an out-of-process surface came out %s: %s", res.Outcome, res.Evidence)
	}
	mustFit(t, res.Evidence, "web", "node")
}

// D17: a verifier may never pass on nothing. A surface with nothing to delete
// has not been checked, and green would say it had.
func TestMutateRowIsUnrunnableWhenThereIsNothingToDelete(t *testing.T) {
	dir := mutateRepo(t)
	writeSource(t, dir, "alpha/alpha.go", "package alpha\n\nfunc addsUp(a, b int) int {\n\treturn a + b\n}\n")
	writeSource(t, dir, "alpha/alpha_test.go",
		"package alpha\n\nimport \"testing\"\n\n"+
			"func TestAddsUp(t *testing.T) {\n\tif addsUp(1, 1) != 2 {\n\t\tt.Fatal(\"no\")\n\t}\n}\n")

	res := runMutate(t, dir, small)
	if res.Outcome != Unrunnable {
		t.Fatalf("a surface with nothing to delete came out %s: %s", res.Outcome, res.Evidence)
	}
	mustFit(t, res.Evidence, "cli")
}

func TestMutateRowIsUnrunnableWithNoManifest(t *testing.T) {
	dir := newRepo(t)

	res := runMutate(t, dir, small)
	if res.Outcome != Unrunnable {
		t.Fatalf("the row came out %s: %s", res.Outcome, res.Evidence)
	}
	mustContain(t, res.Evidence, ".groundwork/manifest.json")
}

// The budget is the whole row's, and a clock that ran out before the first
// target says nothing about what the suite would have caught.
func TestMutateRowIsUnrunnableWhenItsBudgetRanOutBeforeItStarted(t *testing.T) {
	dir := mutateRepo(t)
	writeKilledSuite(t, dir, "alpha")

	res := runMutate(t, dir, MutateOptions{Budget: time.Nanosecond})
	if res.Outcome != Unrunnable {
		t.Fatalf("a run out of time came out %s: %s", res.Outcome, res.Evidence)
	}
	mustFit(t, res.Evidence)
}

// D33's second ruling. A run that exhausts its budget partway through its
// sample is unrunnable, naming how far it got. It is never green on the part it
// managed, and it never blames the project's own suite for the row's clock.
//
// Both subtests drive the clock through the wrapped runner rather than by
// sleeping, so what they prove does not depend on how fast this machine is.
func TestMutateRowIsUnrunnableWhenItsBudgetDiesMidSample(t *testing.T) {
	// The clock goes while a package is being measured, and that run comes back
	// with nothing. The row's own budget is what ran out, so nothing at all is
	// concluded about that package's tests.
	t.Run("while a package is being measured", func(t *testing.T) {
		dir := mutateRepo(t)
		writeKilledSuite(t, dir, "alpha")
		writeKilledSuite(t, dir, "beta")
		writeKilledSuite(t, dir, "gamma")

		var calls int
		opts := MutateOptions{Budget: 8 * time.Second, PerMutant: 8 * time.Second}
		opts.watch = func(inner packageRunner) packageRunner {
			return runnerFunc(func(ctx context.Context, at, suite string) (adapter.RunLog, error) {
				calls++
				// The first package is judged. The run after it sits until the
				// row's clock is gone, which is what a real suite does to a
				// budget that was too small for the sample.
				if calls > 2 {
					<-ctx.Done()

					return adapter.RunLog{}, ctx.Err()
				}

				return inner.RunPackage(ctx, at, suite)
			})
		}

		res := runMutate(t, dir, opts)
		if res.Outcome != Unrunnable {
			t.Fatalf("a run that ran out of its budget came out %s: %s", res.Outcome, res.Evidence)
		}
		mustFit(t, res.Evidence, "killed 1", "2 not judged")
		// The row's own clock is not a fact about the project. Filing it as one
		// would put "its own tests do not run" on the record about a package
		// whose tests are fine — and the count is in the accounting, which is
		// the half of the line that is never cut.
		if strings.Contains(res.Evidence, "blocked by their own package") {
			t.Errorf("the row filed its own clock as a package it could not judge: %s", res.Evidence)
		}
		if strings.Contains(res.Evidence, "its own tests do not run") {
			t.Errorf("the row blamed the project for its own clock: %s", res.Evidence)
		}
	})

	// The clock goes while a run is in flight, and that run still comes back
	// with an answer. The answer counts — it was judged. What must not happen
	// is the row opening the next package it never reached.
	t.Run("between mutants", func(t *testing.T) {
		dir := mutateRepo(t)
		writeKilledSuite(t, dir, "alpha")
		writeKilledSuite(t, dir, "beta")
		writeKilledSuite(t, dir, "gamma")

		var calls int
		opened := map[string]bool{}

		opts := MutateOptions{Budget: 8 * time.Second, PerMutant: 8 * time.Second}
		opts.watch = func(inner packageRunner) packageRunner {
			return runnerFunc(func(ctx context.Context, at, suite string) (adapter.RunLog, error) {
				calls++
				opened[suite] = true

				switch calls {
				case 3:
					<-ctx.Done()

					return oneTest(suite, adapter.Pass), nil
				case 4:
					return oneTest(suite, adapter.Fail), nil
				}

				return inner.RunPackage(ctx, at, suite)
			})
		}

		res := runMutate(t, dir, opts)
		if res.Outcome != Unrunnable {
			t.Fatalf("a run that ran out of its budget came out %s: %s", res.Outcome, res.Evidence)
		}
		mustFit(t, res.Evidence, "killed 2", "1 not judged")
		// A run with no clock left starts no more work.
		if opened["gamma"] {
			t.Error("the row opened a package after its clock had gone")
		}
	})
}

// oneTest is a run log of one test, so a wrapped runner can hand the row a
// clean answer without a real suite behind it.
func oneTest(suite string, outcome adapter.Outcome) adapter.RunLog {
	return adapter.RunLog{
		Tests: []adapter.TestRun{{
			ID: adapter.TestID(suite, "TestOne"), Suite: suite, Name: "TestOne", Outcome: outcome,
		}},
		Duration: time.Second,
	}
}

// D33's third ruling, as a property of the one line the record keeps: sampled
// equals killed plus survivors plus each inconclusive class plus not judged.
// A tally that cannot say that is not an answer, whatever else it counted.
func TestMutateResultRefusesASampleItCannotAccountFor(t *testing.T) {
	got := &tally{version: "4.0+r0000000", pool: 3, sampled: 3, killed: 1}

	res := got.result()
	if res.Outcome != Unrunnable {
		t.Fatalf("a tally that lost two of its three mutants came out %s: %s", res.Outcome, res.Evidence)
	}
	mustFit(t, res.Evidence, "could not account")
}

// The numbers are never what gets cut, and neither is a name cut in half. A
// line whose names ran long keeps the accounting and says how many names it
// left out. A reader can check the run from the numbers, and can act on a whole
// name; half a path is worth nothing at all.
func TestMutateEvidenceKeepsItsNumbersWhenTheNamesDoNotFit(t *testing.T) {
	t.Run("some names fit", func(t *testing.T) {
		got := &tally{version: "4.0+r0000000", pool: 40, sampled: 6, killed: 1}
		for i := range 5 {
			got.survivors = append(got.survivors, hit{
				file:    fmt.Sprintf("a/b%d.go", i),
				line:    i + 1,
				subject: fmt.Sprintf("Fn%d", i),
				shape:   "survived, and the 1 test of a stayed green",
			})
		}

		res := got.result()
		if res.Outcome != Red {
			t.Fatalf("five survivors came out %s: %s", res.Outcome, res.Evidence)
		}
		// The counts survive whatever else does. The wording may not: this line
		// takes the shorter one to keep one more name, which is the order D35
		// asks for — counts, then names, then words.
		mustFit(t, res.Evidence, "killed 1", "survived 5", "more")
		mustReconcile(t, res.Evidence)
	})

	t.Run("not even one name fits", func(t *testing.T) {
		got := &tally{version: "4.0+r0000000", pool: 40, sampled: 6, killed: 1}
		// Longer than any rung of the ladder has room for, so the line has to
		// fall back to saying how many it left out.
		for i := range 5 {
			got.survivors = append(got.survivors, hit{
				file:    "internal/" + strings.Repeat("deeply/nested/", 12) + fmt.Sprintf("package%d.go", i),
				line:    i + 1,
				subject: fmt.Sprintf("SomeVeryLongExportedFunctionName%d", i),
				shape:   "survived, and the 12 tests of internal/deeply/nested stayed green",
			})
		}

		res := got.result()
		if res.Outcome != Red {
			t.Fatalf("five survivors came out %s: %s", res.Outcome, res.Evidence)
		}
		mustFit(t, res.Evidence, "sampled 6 of 40 targets", "killed 1", "survived 5", "not named here")
		mustReconcile(t, res.Evidence)
	})
}

// mustEndWhole fails when a line reaches the record with the journal's own
// trimming mark on it. The row decides what to drop and says how much; a line
// the journal had to cut is one the row let get away from it, and its last
// count may be half a number.
//
// The length is what tells the two apart. Three dots at the end of a short line
// are a tool's own complaint, capped at 70 bytes the way every scan caps one.
// Three dots at the end of a full line are the journal's trim, which only ever
// happens to a line that was already too long.
func mustEndWhole(t *testing.T, evidence string) {
	t.Helper()

	const mark = "..."

	if strings.HasSuffix(evidence, mark) && len(evidence) >= journal.MaxTextBytes-len(mark) {
		t.Errorf("the line was cut by the journal rather than shortened by the row: %s", evidence)
	}
}

// D18, four hostile shapes the row must survive.
func TestMutateRowSurvivesHostileTargets(t *testing.T) {
	// A symlink can point anywhere on the machine. A row that mutated through
	// one would write a blanked function into a file this project does not
	// ship — and the scans' shared rule already says a symlink is not followed.
	t.Run("a target file that is a symlink", func(t *testing.T) {
		dir := mutateRepo(t)
		writeKilledSuite(t, dir, "alpha")

		outside := writeSource(t, dir, "outside/elsewhere.txt",
			"package beta\n\nfunc Widen(n int) int {\n\treturn n * 3\n}\n")
		link := filepath.Join(dir, "beta", "beta.go")
		if err := os.MkdirAll(filepath.Dir(link), 0o750); err != nil {
			t.Fatalf("could not make the package directory: %v", err)
		}
		if err := os.Symlink(outside, link); err != nil {
			t.Skipf("this machine does not do symlinks: %v", err)
		}

		res := runMutate(t, dir, small)
		if res.Outcome != Green {
			t.Fatalf("a symlinked source file came out %s: %s", res.Outcome, res.Evidence)
		}
		mustFit(t, res.Evidence, "symlink")
		if strings.Contains(res.Evidence, "Widen") {
			t.Errorf("the row mutated through a symlink: %s", res.Evidence)
		}
		was, err := os.ReadFile(outside)
		if err != nil || !strings.Contains(string(was), "n * 3") {
			t.Errorf("the file behind the symlink was written to: %v", err)
		}
	})

	// A mutant identical to the original damages nothing, so the suite has
	// nothing to catch. Reporting it would be a red the row invented out of a
	// mutation that never happened.
	t.Run("a mutant that changes nothing", func(t *testing.T) {
		dir := mutateRepo(t)
		writeKilledSuite(t, dir, "alpha")
		writeSource(t, dir, "zero/zero.go",
			"package zero\n\nfunc Zero() int { return *new(int) }\n")
		writeSource(t, dir, "zero/zero_test.go",
			"package zero\n\nimport \"testing\"\n\n"+
				"func TestZero(t *testing.T) {\n\tif Zero() != 0 {\n\t\tt.Fatal(\"no\")\n\t}\n}\n")

		res := runMutate(t, dir, small)
		if res.Outcome != Green {
			t.Fatalf("a mutant that changes nothing came out %s: %s", res.Outcome, res.Evidence)
		}
		mustFit(t, res.Evidence, "changed nothing")
	})

	// Go's own rule for exported is a case rule, and it is a Unicode one. A
	// name whose script has no case is not exported, and a row that read the
	// first byte instead would get both wrong.
	t.Run("unicode function names", func(t *testing.T) {
		dir := mutateRepo(t)
		writeSource(t, dir, "uni/uni.go",
			"package uni\n\nfunc Über(n int) int {\n\treturn n + 7\n}\n\n"+
				"func 内側(n int) int {\n\treturn n - 1\n}\n")
		writeSource(t, dir, "uni/uni_test.go",
			"package uni\n\nimport \"testing\"\n\n"+
				"func TestÜber(t *testing.T) {\n\tif Über(1) != 8 {\n\t\tt.Fatal(\"no\")\n\t}\n"+
				"\tif 内側(1) != 0 {\n\t\tt.Fatal(\"no\")\n\t}\n}\n")

		res := runMutate(t, dir, small)
		if res.Outcome != Green {
			t.Fatalf("a unicode-named function came out %s: %s", res.Outcome, res.Evidence)
		}
		mustFit(t, res.Evidence, "1 of 1")
	})

	// A suite that hangs under mutation would hang the whole battery. The
	// per-mutant clock bounds it, and it is the mutant's own clock rather than
	// the row's: a row that waited out its whole budget on one wedged mutant
	// would judge nothing else in the sample.
	t.Run("a package whose tests hang under mutation", func(t *testing.T) {
		dir := mutateRepo(t)
		writeHangingSuite(t, dir, "slow")

		done := make(chan Result, 1)
		start := time.Now()
		go func() {
			done <- runMutateNoSetenv(t, dir, MutateOptions{Budget: 3 * time.Minute, PerMutant: 5 * time.Second})
		}()

		select {
		case res := <-done:
			if res.Outcome == Red {
				t.Fatalf("a mutant nobody waited out was reported as a catch: %s", res.Evidence)
			}
			// The row's own budget is minutes. A run that took them is a run
			// bounded by the wrong clock.
			if waited := time.Since(start); waited > 45*time.Second {
				t.Errorf("one wedged mutant held the row for %s, which is the row's clock rather than the mutant's", waited)
			}
			mustReconcile(t, res.Evidence)
			mustFit(t, res.Evidence)
		case <-time.After(4 * time.Minute):
			t.Fatal("the deletion test never came back from a package that hangs")
		}
	})
}

// A row's evidence is read on a machine that is not the one that wrote it, so
// a temporary directory in a line of evidence says nothing to the reader — and
// it fills a line the journal caps.
//
// D33's sixth ruling: every error path renders its reason the way the scans do.
// So the survivor path is not the only one checked here.
func TestMutateEvidenceNeverCarriesAMachinePath(t *testing.T) {
	t.Run("a surviving mutant", func(t *testing.T) {
		dir := mutateRepo(t)
		writeSurvivorSuite(t, dir, "gamma")

		res := runMutate(t, dir, small)
		if strings.Contains(res.Evidence, dir) {
			t.Errorf("the evidence carries this machine's own path: %s", res.Evidence)
		}
		mustFit(t, res.Evidence)
	})

	// A copy that could not be made is the row's loudest machine path: the
	// error comes back from the operating system with a temporary directory in
	// it, and that directory means nothing to any other machine.
	t.Run("a copy that could not be made", func(t *testing.T) {
		dir := mutateRepo(t)
		writeKilledSuite(t, dir, "alpha")

		blocked := filepath.Join(t.TempDir(), "not-a-directory")
		writeFile(t, blocked, "")
		t.Setenv("TMPDIR", blocked)

		res := runMutate(t, dir, small)
		if res.Outcome != Unrunnable {
			t.Fatalf("a copy that could not be made came out %s: %s", res.Outcome, res.Evidence)
		}
		for _, path := range []string{dir, blocked} {
			if strings.Contains(res.Evidence, path) {
				t.Errorf("the evidence carries this machine's own path %s: %s", path, res.Evidence)
			}
		}
		// Not half of one either. A path cut off at the journal's cap is still
		// a path nobody can read, and it took the row's own words with it.
		if strings.Contains(res.Evidence, " "+string(filepath.Separator)) {
			t.Errorf("the evidence carries a path from this machine's root: %s", res.Evidence)
		}
		mustEndWhole(t, res.Evidence)
		mustFit(t, res.Evidence, "copy")
	})
}

// D23: a row added moves the major half of the version, and the digest in the
// lock file must be the one the shipped rows compute.
func TestThisRepoDeclaresTheBumpTheMutateRowNeeds(t *testing.T) {
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
	// 3.0 is the version declared when the battery held six rows. The deletion
	// test is a seventh, so the major moves again.
	if major < 4 {
		t.Errorf("%s declares %s, and the battery has gained a row since 3.0", LockFile, lock.Version)
	}
}

// runMutateNoSetenv is runMutate for a test that runs the row on another
// goroutine, where t.Setenv is not allowed. The guard is cleared by the caller
// or not set at all.
//
// It goes past the same arithmetic check as runMutate. The check reports with
// Errorf rather than Fatalf for exactly this reason: Fatalf may only be called
// on the goroutine running the test, and this one is not it.
func runMutateNoSetenv(t *testing.T, dir string, opts MutateOptions) Result {
	res := MutateRow(opts).Check(Context{RepoDir: dir})
	mustReconcile(t, res.Evidence)

	return res
}

// runnerFunc is a package runner made of one function, so a test can stand
// between the row and the real one and watch a mutation run from the inside.
type runnerFunc func(ctx context.Context, dir, suite string) (adapter.RunLog, error)

// RunPackage runs the one function.
func (f runnerFunc) RunPackage(ctx context.Context, dir, suite string) (adapter.RunLog, error) {
	return f(ctx, dir, suite)
}

// accountingLine finds the numbers a line of evidence reconciles with: how many
// mutants were sampled, and the classes they were sorted into.
//
// It matches every wording. A run with every class populated will not fit the
// journal's cap in plain words, so the row says the same numbers in fewer of
// them — "8991/99999 at 4.0+r1234567" rather than "sampled 8991 of 99999 targets
// at 4.0+r1234567" — and its last rung drops the version too. The numbers are
// the part that never changes, and the sum reconciles at every rung.
var accountingLine = regexp.MustCompile(`(?:sampled )?(\d+)(?: of |/)\d+(?: targets?)?(?: at [^:;]+)?: ([^;]*)`)

// counts pulls every number out of one clause.
var counts = regexp.MustCompile(`\d+`)

// aside matches a split of the class before it, in brackets. A split is not a
// class of its own, so it takes no part in the sum: "killed 8 (2 by crash)" is
// eight mutants, two of which the suite noticed by dying.
var aside = regexp.MustCompile(`\s*\([^)]*\)`)

// mustReconcile holds the row's one arithmetic rule against the line the record
// keeps: sampled equals the sum of the classes printed beside it. A reader has
// to be able to check it from the line alone, with nothing else to hand.
func mustReconcile(t *testing.T, evidence string) {
	t.Helper()

	// A line the journal had to trim is a line whose last count may be half a
	// number. D35: if the full line will not fit, the words give way and the
	// counts do not — so a trimmed line is a defect in the line's design, and
	// the suite catches it here rather than one test at a time.
	mustEndWhole(t, evidence)

	found := accountingLine.FindStringSubmatch(evidence)
	if found == nil {
		// Not every outcome samples anything: a missing manifest and the
		// recursion guard both answer before there is a sample at all.
		return
	}

	sampled, err := strconv.Atoi(found[1])
	if err != nil {
		t.Errorf("the sample count %q is not a number: %s", found[1], evidence)

		return
	}

	sum := 0
	for _, said := range strings.Split(aside.ReplaceAllString(found[2], ""), ", ") {
		numbers := counts.FindAllString(said, -1)
		if len(numbers) != 1 {
			t.Errorf("the class %q carries %d numbers, and a reader needs exactly one: %s",
				said, len(numbers), evidence)

			return
		}
		n, err := strconv.Atoi(numbers[0])
		if err != nil {
			t.Errorf("the class %q is not a number: %s", said, evidence)

			return
		}
		sum += n
	}

	if sum != sampled {
		t.Errorf("the line samples %d mutants and accounts for %d: %s", sampled, sum, evidence)
	}
	if len(evidence) > journal.MaxTextBytes {
		t.Errorf("the evidence is %d bytes, over the journal's cap of %d: %s",
			len(evidence), journal.MaxTextBytes, evidence)
	}
}

// symbolsOf names a sample, so a test can compare two of them.
func symbolsOf(picked []target) []string {
	out := make([]string, 0, len(picked))
	for _, tgt := range picked {
		out = append(out, tgt.symbol)
	}

	return out
}

// treeOf reads every file in a fixture, so a test can prove none of them
// moved.
//
// .git is read too, and that is the point of it. The copy now carries the
// project's record, so the record is the one part of the tree a mutation run
// could newly reach — and a watcher that looked everywhere except there would
// be watching the one place nothing was ever going to happen.
func treeOf(t *testing.T, dir string) map[string]string {
	t.Helper()

	tree := map[string]string{}
	err := filepath.WalkDir(dir, func(p string, d os.DirEntry, err error) error {
		if err != nil {
			return err
		}
		if d.IsDir() {
			return nil
		}
		if !d.Type().IsRegular() {
			return nil
		}

		raw, err := os.ReadFile(p)
		if err != nil {
			return err
		}
		tree[p] = string(raw)

		return nil
	})
	if err != nil {
		t.Fatalf("could not read the fixture: %v", err)
	}

	return tree
}
