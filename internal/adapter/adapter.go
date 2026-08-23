// Package adapter is the per-stack seam D25 rules: one named interface, two
// shapes.
//
// Go runs in process, through go/ast and go test -json. Every other stack runs
// out of process: a command the capability manifest declares, which prints one
// JSON object on stdout under a versioned schema. Both shapes answer the same
// three calls — discover, run, mutants — and both pass the same conformance
// suite against the shipped fixture pack.
//
// Two rules hold the seam closed.
//
// First, an out-of-process adapter gets a timeout and an output cap. A run that
// hit either is unrunnable, never partly believed. A tally of the tests an
// adapter printed before it was killed is worse than no tally at all, because
// it looks like an answer.
//
// Second, a stack with no adapter is a fail-closed red row, never a skip. A
// stack the battery cannot read must never pass in silence.
package adapter

import (
	"context"
	"errors"
	"slices"
	"strings"
	"time"
)

// ErrUnrunnable marks every failure of the seam itself: a command that would
// not start, a run that was killed, output that did not parse. It is the
// battery's unrunnable outcome, and it never carries results.
var ErrUnrunnable = errors.New("the adapter could not be run")

// ErrNoTests is the one refusal a caller has to tell apart from the rest: the
// runner finished and reported no test at all.
//
// Both shapes refuse an empty run log, because an empty green log is the defect
// the battery exists to catch. But refusing it is not the same as failing to
// run. A build that broke, a command that would not start, a run that was
// killed — none of those say what executed, so nothing can be concluded from
// them. A clean run of nothing says exactly one thing, and proof.md's B18 rules
// what: a run that executes zero tests is red.
//
// It is written as the clause both shapes finish their sentence with, and both
// wrap ErrUnrunnable beside it: a caller that only asks whether the seam failed
// still gets the same answer it always did.
var ErrNoTests = errors.New("reported no tests at all, and an empty run log is not a pass")

// ErrBuildFailed marks the one failure a caller has to tell from a run that
// broke for any other reason: the code did not compile.
//
// The deletion test is why. D26 rules that a mutant which fails to compile is
// inconclusive, never a catch — the suite was never given the chance to notice
// anything. A mutation run that read a build failure as a suite doing its job
// would count its own damage as proof.
//
// It is wrapped beside ErrUnrunnable, so a caller that only asks whether the
// seam failed still gets the same answer it always did.
var ErrBuildFailed = errors.New("did not build")

// ErrTimedOut marks a run the test runner's own clock stopped.
//
// It reads as a crash on the wire — go test writes "panic: test timed out" and
// a goroutine dump, the same shape a panicking test produces — and it is not
// one. The code did not fail; nobody waited for it. D35 rules the difference,
// because the deletion test counts a crash under mutation as the suite noticing
// and must never count a hang as one.
//
// Whatever set the clock is beside the point: the project's own flags, GOFLAGS,
// or go test's ten-minute default. A caller cannot assume its own clock fires
// first, so the marker is named here rather than inferred from a timing.
//
// It is wrapped beside ErrUnrunnable, so a caller that only asks whether the
// seam failed still gets the same answer it always did.
var ErrTimedOut = errors.New("was stopped by the test runner's own clock")

// RunGuardEnv is set in a test run's own environment, so that a project whose
// suite calls the battery cannot start a battery inside the battery.
//
// The seam sets it on the child; the row that runs the suite reads it and
// reports unrunnable rather than recursing. One spelling, named here, because
// the two halves live in different packages.
const RunGuardEnv = "GROUNDWORK_BATTERY"

// Outcome is how one test came out.
type Outcome string

// The outcomes a test may report. They are the adapter's own small
// vocabulary, narrower than the battery's row outcomes: a test passed, failed,
// or was skipped by the stack's own runner.
const (
	Pass Outcome = "pass"
	Fail Outcome = "fail"
	Skip Outcome = "skip"
)

// Outcomes returns every outcome a test may report.
func Outcomes() []Outcome {
	return []Outcome{Pass, Fail, Skip}
}

// Suite is one discovered group of tests: a Go package, a test file, whatever
// the stack groups by. The ID is how the manifest names it, so it is a path
// inside the project, written with forward slashes.
type Suite struct {
	ID    string
	Name  string
	Tests []string
}

// TestRun is one test in one run.
type TestRun struct {
	// ID is the suite id and the test name, joined by a slash. It is what the
	// run log is indexed by, and what a proof plan names.
	ID string

	Suite    string
	Name     string
	Outcome  Outcome
	Duration time.Duration
}

// RunLog is one whole run, normalized out of whatever the stack's runner
// prints.
type RunLog struct {
	Tests []TestRun

	// Duration is the wall clock of the run. A run log with no duration is a
	// run nobody timed, and conformance refuses it: the record has to be able
	// to publish the battery's cost as a trend.
	Duration time.Duration
}

// Mutant is one damaged copy of one source file: which function was blanked,
// and the whole file with that function's body gone.
//
// The deletion test consumes these. Content is the whole file rather than a
// patch so the caller can write it into a throwaway worktree and run the suite
// with no further work.
type Mutant struct {
	File    string
	Symbol  string
	Line    int
	Content string
}

// Package is one package the build compiles, and the source files it compiles
// into it.
//
// It is the build's own answer, not a walk of the directory. Only a file the
// build compiles can hold a target the tests could notice being deleted, so the
// deletion test asks for this rather than reading the tree itself.
//
// ID names the package the way discovery names a suite: a directory inside the
// project, with forward slashes, and "." for the project's own root. Files are
// named from the project root the same way. Ignored counts the source files the
// build leaves out here — another platform's, or one behind a tag this build
// does not set — so that a skip is never silent.
type Package struct {
	ID      string
	Files   []string
	Ignored int
}

// Adapter is the seam. Three calls, both shapes.
//
// dir is the project root the call is about. Every path in and out — a suite
// id, a mutant's file — is relative to it, with forward slashes, so a run log
// reads the same from any machine.
type Adapter interface {
	// Name is the stack this adapter speaks for.
	Name() string

	// Discover lists the suites and the test names in them, without running
	// anything. The battery reconciles discovered against ran, so discovery
	// must never be the run's own report of itself.
	Discover(ctx context.Context, dir string) ([]Suite, error)

	// Run runs the suites and returns the normalized run log.
	Run(ctx context.Context, dir string) (RunLog, error)

	// Mutants lists the mutable targets in one source file, each with the file
	// content that blanks it.
	Mutants(ctx context.Context, dir, file string) ([]Mutant, error)
}

// TestID joins a suite id and a test name into a run log's id.
func TestID(suite, name string) string {
	return suite + "/" + name
}

// collapse folds subtest results into the top-level test that ran them, and
// sorts what is left.
//
// D30 rules it: a subtest belongs to its parent, and one top-level Test
// function is one test. Discovery cannot see a subtest's name — it is built at
// run time, often in a loop — so the parent is the only unit both sides of the
// reconciliation can name.
//
// The folded outcome is the worst of the results folded into it. A parent
// whose subtest failed has failed, whatever its own line said.
func collapse(tests []TestRun) []TestRun {
	folded := map[string]TestRun{}

	for _, tr := range tests {
		parent, _, _ := strings.Cut(tr.Name, "/")
		id := TestID(tr.Suite, parent)

		got, seen := folded[id]
		if !seen {
			folded[id] = TestRun{
				ID: id, Suite: tr.Suite, Name: parent,
				Outcome: tr.Outcome, Duration: tr.Duration,
			}
			continue
		}

		if rank(tr.Outcome) > rank(got.Outcome) {
			got.Outcome = tr.Outcome
		}
		// The parent's own duration already covers its subtests, so the
		// longest is the run rather than the sum of double-counted parts.
		got.Duration = max(got.Duration, tr.Duration)
		folded[id] = got
	}

	out := make([]TestRun, 0, len(folded))
	for _, tr := range folded {
		out = append(out, tr)
	}
	slices.SortFunc(out, func(a, b TestRun) int { return strings.Compare(a.ID, b.ID) })

	return out
}

// rank orders outcomes by how much they matter to a folded result.
func rank(outcome Outcome) int {
	switch outcome {
	case Fail:
		return 3
	case Pass:
		return 2
	default:
		return 1
	}
}
