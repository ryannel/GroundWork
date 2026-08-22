package battery

import (
	"context"
	"errors"
	"fmt"
	"os"
	"slices"
	"strings"
	"time"

	"github.com/ryannel/groundwork/internal/adapter"
	"github.com/ryannel/groundwork/internal/manifest"
)

// The run-evidence row is proof.md's B18: execution is evidenced, never
// inferred.
//
// Three failures on record. Suites that shipped compiling but never run. A
// build that reported success while the project file had quietly dropped the
// tests from the target. A pipeline that ran one suite of three for weeks.
//
// Every one of them shows a green board over a suite nothing executed. So the
// row asks the one question a green board cannot answer for itself: of the
// tests this project has, which ones actually ran?
//
// It answers it per surface, in three steps. Discovery lists what reads as a
// test. The run reports what the runner did. D30 fixes what the two mean, and
// this row applies its reconciliation contract:
//
//   - discovered minus ran is the never-run set, and it is red, named. It holds
//     the TestMain gate that filters a suite out, and the build tag that
//     excludes a file. Both leave a function that reads as a test to a person
//     and never executes.
//   - ran minus discovered is a defect in discovery, and it is red too, named
//     as one. The adapter lied or the parser missed a shape, and either way one
//     side of the reconciliation is now blind.
//   - a surface that discovered tests and executed none is red on its own. That
//     is B18's sentence: a run that executes zero tests is red.
//
// Subtests are not this row's unit. The seam collapses them into the top-level
// test that ran them before the row ever sees a run log, because discovery
// cannot see a name that is built at run time. The row does not fold them a
// second time. proof.md says a checker imports the real rule rather than
// keeping a second copy of it, and two copies of the collapsing rule would
// drift.
//
// What this row does NOT judge:
//
//   - Outcomes. A test that failed ran, and so did a test that was skipped. CI
//     runs the tests and a failing suite is the suite's own job; this row
//     judges execution coverage. A row that went red on a failure would report
//     one defect as two, and every red board would carry it.
//   - A skip is ran for the same reason: the runner scheduled it and reported
//     it, and the skip is visible in the suite's own output. Calling it
//     never-run would red every project with a platform guard in it.
//     Unconditional skips — a proof hollowed out to nothing — belong to the
//     honesty scan, which reads the source rather than the log.
//   - Whether a stack has an adapter at all. An off-stack surface is named and
//     reported unrunnable here. D25's fail-closed red for an unmapped stack is
//     the manifest row's, and two rows claiming one failure is two reds for one
//     fix.
//
// Precedence, which D32 fixed for the scans and which splits here:
//
//   - A red found on one surface outlives another surface the row could not
//     read. The red is a defect somebody has to fix, and the unreadable surface
//     rides in the same line of evidence so neither is lost.
//   - But a surface whose own run failed never produces a red of its own,
//     however many tests it discovered. This row's reds are subtractions
//     between two sets, and a run that broke leaves one of those sets empty:
//     every test on that surface would read as never-run. That is a false red
//     manufactured out of missing data, and it is exactly the shape the wiring
//     scan refuses for the same reason. Unrunnable for that surface, always.
//
// The trust boundary, stated. The row trusts the seam for three things: what a
// test is, folding subtests, and refusing a result nothing can be matched
// against. That last one is a suite with no id, or a result with no name. Those
// refusals are the seam's, and they arrive here as a surface the row could not
// read. The row still defends
// the same shapes itself, because the in-process path could grow one and
// because a defence that only exists at the boundary is one release from being
// gone: an entry it cannot name leaves that surface unrunnable, and a name
// reported twice is counted once. Neither ever becomes a red.

// runEvidenceBudget is how long the whole row gets, shared across every
// surface it reads rather than granted to each one. This is the one row that
// runs the project's own suite, so it carries the suite's cost, and a battery
// whose clock was tuned for reading source would kill a real run mid-suite.
//
// A budget that ran out is unrunnable, never a partial log: the seam refuses a
// run it did not see the end of.
const runEvidenceBudget = 15 * time.Minute

// runEvidenceRow is the discovered-against-ran reconciliation.
func runEvidenceRow() Row {
	return runEvidenceRowWithin(runEvidenceBudget)
}

// runEvidenceRowWithin is the row on a stated clock. The tests that prove the
// budget bites build their own; nothing else should.
func runEvidenceRowWithin(budget time.Duration) Row {
	return Row{
		ID:       "run-evidence",
		Kind:     "run-evidence",
		Severity: Blocking,
		Check: func(c Context) Result {
			return checkRunEvidence(c, budget)
		},
	}
}

func checkRunEvidence(c Context, budget time.Duration) Result {
	// A project whose own suite calls the battery would otherwise run the
	// battery inside the battery, and this repo is one such project. The seam
	// sets the guard on every suite it starts; finding it set means this row is
	// already inside a run somebody else is doing.
	if os.Getenv(adapter.RunGuardEnv) != "" {
		return Result{
			Outcome: Unrunnable,
			Evidence: "the run-evidence row is already running inside a battery run, " +
				"so it did not start the suite a second time",
		}
	}

	s, bad, ok := openScan("run-evidence row", c)
	if !ok {
		return bad
	}

	ctx, cancel := context.WithTimeout(context.Background(), budget)
	defer cancel()

	var (
		empty      []hit
		neverRun   []hit
		ghosts     []hit
		blocked    []string
		noted      []string
		judged     int
		suites     int
		discovered int
	)

	for _, surface := range s.m.Surfaces {
		ev, why := readSurface(ctx, s, surface)
		if why != "" {
			blocked = append(blocked, why)
			continue
		}

		judged++
		suites += ev.suites
		discovered += ev.discovered
		noted = append(noted, ev.notes...)

		if ev.empty {
			empty = append(empty, hit{
				file: fmt.Sprintf("the surface %q", surface.Name),
				shape: fmt.Sprintf("executed no tests, though %s discovered",
					counted(ev.discovered, "test was", "tests were")),
			})
		}
		neverRun = append(neverRun, named(ev.neverRun, "never ran")...)
		ghosts = append(ghosts, named(ev.ghosts, "ran and was never discovered")...)
	}

	tail := ""
	if len(noted) > 0 {
		tail += "; " + listed(noted, "; ")
	}
	if len(blocked) > 0 {
		tail += "; " + listed(blocked, "; ")
	}

	found := slices.Concat(empty, neverRun, ghosts)

	switch {
	case len(found) > 0:
		return Result{
			Outcome:  Red,
			Evidence: hitEvidence(redPrefix(len(empty), len(neverRun), len(ghosts)), found, tail),
		}

	case len(blocked) > 0:
		// A surface the row could not judge leaves the row unable to say the
		// project's tests ran. It is not a skip: unrunnable is counted, printed,
		// and somebody's problem.
		return Result{
			Outcome: Unrunnable,
			Evidence: cut(fmt.Sprintf("the run-evidence row could not reconcile every surface: %s%s",
				listed(blocked, "; "), notesOnly(noted))),
		}

	default:
		return Result{
			Outcome: Green,
			Evidence: cut(fmt.Sprintf("the run-evidence row reconciled %s in %s on %s, and the run log names every one%s",
				counted(discovered, "discovered test", "discovered tests"),
				counted(suites, "suite", "suites"),
				counted(judged, "surface", "surfaces"), tail)),
		}
	}
}

// surfaceEvidence is what one surface's reconciliation came to.
type surfaceEvidence struct {
	suites     int
	discovered int

	// empty is the surface that discovered tests and executed none. It stands
	// in for the whole never-run set rather than beside it: a surface that ran
	// nothing would otherwise name every test it has, and one sentence says the
	// same thing better.
	empty bool

	neverRun []string
	ghosts   []string
	notes    []string
}

// readSurface discovers, runs and reconciles one surface.
//
// A returned reason means the surface could not be judged at all, and the
// caller reports it rather than concluding anything from it. Every path that
// leaves the row without both sets of names comes back this way.
func readSurface(ctx context.Context, s scanned, surface manifest.Surface) (surfaceEvidence, string) {
	a, err := adapterFor(s.m, surface)
	if err != nil {
		return surfaceEvidence{}, fmt.Sprintf("the surface %q has no adapter: %s", surface.Name, s.reason(err))
	}

	found, err := a.Discover(ctx, s.dir(surface))
	if err != nil {
		return surfaceEvidence{}, fmt.Sprintf("the surface %q could not be read: %s", surface.Name, s.reason(err))
	}

	discovered, notes, err := discoveredTests(found)
	if err != nil {
		return surfaceEvidence{}, fmt.Sprintf("the surface %q could not be reconciled: %s", surface.Name, s.reason(err))
	}

	ev := surfaceEvidence{suites: len(found), discovered: len(discovered), notes: notes}

	// The seam refuses an empty run log, and that refusal is the one failure
	// this row reads as an answer: the runner finished and nothing ran. Every
	// other failure — a build that broke, a command that would not start, a run
	// that was killed — says nothing about what executed, so nothing is
	// concluded from it.
	log, err := a.Run(ctx, s.dir(surface))
	if err != nil && !errors.Is(err, adapter.ErrNoTests) {
		return surfaceEvidence{}, fmt.Sprintf("the surface %q could not be run: %s", surface.Name, s.reason(err))
	}

	ranIDs, runNotes, err := ranTests(log)
	if err != nil {
		return surfaceEvidence{}, fmt.Sprintf("the surface %q could not be reconciled: %s", surface.Name, s.reason(err))
	}
	ev.notes = append(ev.notes, runNotes...)

	if len(ranIDs) == 0 {
		// D17: a verifier may never pass on nothing. A surface holding no test
		// at all has not been checked, and it leaves the row unrunnable rather
		// than green — this is the row's only answer for that surface, so there
		// is no second one further down.
		if len(discovered) == 0 {
			return surfaceEvidence{}, fmt.Sprintf("the surface %q holds no test to reconcile", surface.Name)
		}
		ev.empty = true

		return ev, ""
	}

	for _, id := range discovered {
		if !slices.Contains(ranIDs, id) {
			ev.neverRun = append(ev.neverRun, id)
		}
	}
	for _, id := range ranIDs {
		if !slices.Contains(discovered, id) {
			ev.ghosts = append(ev.ghosts, id)
		}
	}

	return ev, ""
}

// discoveredTests folds an adapter's suites into one sorted set of test ids.
//
// A name reported twice is counted once, and said so. Counting it twice would
// put an id in the discovered set that the run can only match once, and the
// row would report a never-run test that runs on every build — a red invented
// out of an adapter's own repetition (D18).
func discoveredTests(suites []adapter.Suite) ([]string, []string, error) {
	var (
		ids   []string
		twice int
	)
	seen := map[string]bool{}

	for _, suite := range suites {
		if strings.TrimSpace(suite.ID) == "" {
			return nil, nil, errors.New("discovery named a suite with no id")
		}
		for _, name := range suite.Tests {
			if strings.TrimSpace(name) == "" {
				return nil, nil, fmt.Errorf("discovery named a test with no name in the suite %s", suite.ID)
			}

			id := adapter.TestID(suite.ID, name)
			if seen[id] {
				twice++
				continue
			}
			seen[id] = true
			ids = append(ids, id)
		}
	}
	slices.Sort(ids)

	var notes []string
	if twice > 0 {
		notes = append(notes, fmt.Sprintf("discovery named %s twice, counted once",
			counted(twice, "test", "tests")))
	}

	return ids, notes, nil
}

// ranTests folds a run log into one sorted set of test ids.
//
// The id is built from the suite and the name the log carries rather than
// taken off the entry, so that the two sides of the reconciliation are always
// joined the same way. One test reported twice is one test: the seam has
// already folded a run log's repeats, and this holds if it ever stops.
func ranTests(log adapter.RunLog) ([]string, []string, error) {
	var (
		ids   []string
		twice int
	)
	seen := map[string]bool{}

	for _, test := range log.Tests {
		if strings.TrimSpace(test.Suite) == "" || strings.TrimSpace(test.Name) == "" {
			return nil, nil, errors.New("the run log holds a result with no suite or no test name")
		}

		id := adapter.TestID(test.Suite, test.Name)
		if seen[id] {
			twice++
			continue
		}
		seen[id] = true
		ids = append(ids, id)
	}
	slices.Sort(ids)

	var notes []string
	if twice > 0 {
		notes = append(notes, fmt.Sprintf("the run log named %s twice, counted once",
			counted(twice, "test", "tests")))
	}

	return ids, notes, nil
}

// named turns a set of test ids into hits carrying what is wrong with them.
func named(ids []string, shape string) []hit {
	out := make([]hit, 0, len(ids))
	for _, id := range ids {
		out = append(out, hit{file: id, shape: shape})
	}

	return out
}

// redPrefix says what the row found, before it names any of it.
func redPrefix(empty, neverRun, ghosts int) string {
	var said []string
	if empty > 0 {
		said = append(said, counted(empty, "surface that ran nothing", "surfaces that ran nothing"))
	}
	if neverRun > 0 {
		said = append(said, counted(neverRun, "test that never ran", "tests that never ran"))
	}
	if ghosts > 0 {
		said = append(said, counted(ghosts, "test discovery missed", "tests discovery missed"))
	}

	return "the run-evidence row found " + strings.Join(said, " and ") + ": "
}

// notesOnly renders the notes for a line that already lists its own reasons.
func notesOnly(notes []string) string {
	if len(notes) == 0 {
		return ""
	}

	return "; " + listed(notes, "; ")
}
