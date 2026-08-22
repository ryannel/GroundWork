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
