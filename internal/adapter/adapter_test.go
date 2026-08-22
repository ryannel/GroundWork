package adapter

import (
	"context"
	"errors"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"slices"
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
	Conformance(t, NewGo(), goPack)
}

func TestNodeAdapterPassesConformance(t *testing.T) {
	needNode(t)

	Conformance(t, newNodeAdapter(t), nodePack)
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

// TestConformanceReporterSeesEveryProblem holds Conformance itself to the
// problems Check found: a helper that swallowed one would hide a lie.
func TestConformanceReporterSeesEveryProblem(t *testing.T) {
	liar := &lying{under: NewGo(), dropSuite: true, allPass: true}

	rec := &recorder{}
	Conformance(rec, liar, goPack)

	if len(rec.errors) != len(Check(liar, goPack)) {
		t.Fatalf("Conformance reported %d problems, Check found %d",
			len(rec.errors), len(Check(liar, goPack)))
	}
	if len(rec.errors) == 0 {
		t.Fatal("Conformance reported nothing about a lying adapter")
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

	a := script(t, "sleep.mjs", Timeout(250*time.Millisecond))

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

	a := script(t, "flood.mjs", Cap(64*1024), Timeout(20*time.Second))

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

	a := script(t, "partial.mjs", Timeout(500*time.Millisecond))

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
			a := script(t, c.script, Cap(256*1024), Timeout(20*time.Second))

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
	}{
		{"a run log with no tests in it", "notests.mjs", "no tests at all"},
		{"a result with no suite or name", "nameless.mjs", "no suite or no test name"},
	}

	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			a := script(t, c.script, Timeout(20*time.Second))

			log, err := a.Run(context.Background(), nodePack)
			if err == nil {
				t.Fatalf("the seam accepted %s", c.name)
			}
			if !errors.Is(err, ErrUnrunnable) {
				t.Errorf("%s reported %v, which is not unrunnable", c.name, err)
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

	log, err := script(t, "subtests.mjs", Timeout(20*time.Second)).Run(context.Background(), nodePack)
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

	if _, err := script(t, "forker.mjs", Timeout(500*time.Millisecond)).
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

	a := script(t, "echo-argv.mjs", Timeout(20*time.Second))

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
// Conformance without failing the test that runs it.
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

	return NewExec("node", []string{"node", path}, Timeout(60*time.Second))
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
