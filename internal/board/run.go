package board

import (
	"context"
	"errors"
	"os"
	"path/filepath"
	"regexp"
	"slices"
	"strings"
	"time"

	"github.com/ryannel/groundwork/internal/adapter"
	"github.com/ryannel/groundwork/internal/manifest"
	"github.com/ryannel/groundwork/internal/plan"
)

// ErrInsideARun says a run of the project's tests is already going, so the
// board did not start another inside it.
//
// A project whose own suite derives a board would otherwise run the suite
// inside the suite. The seam sets the guard on every suite it starts, and
// finding it set means somebody else is already doing the running.
var ErrInsideARun = errors.New("a run of this project's tests is already going, " +
	"so the board did not start another inside it")

// Budget is how long a whole board run gets.
//
// It runs the proofs the plan names rather than a whole suite, so it is a
// smaller clock than the run-evidence row's — but it is still a real run, and a
// clock tuned for reading source would kill it mid-suite. The row and the verb
// share it, so the two can never wait different lengths for one answer.
const Budget = 10 * time.Minute

// maxPatternBytes caps the -run pattern the board builds.
//
// The pattern goes on a command line, and a plan naming more proofs than a
// command line can hold would leave the run unable to start. Falling back to
// the marker prefix runs a few tests too many, which is a board with extra
// results in it; a run that could not start is no board at all.
const maxPatternBytes = 8192

// Run is what one run of the proofs reported.
type Run struct {
	// Outcomes is what the run said about each test, by test name. The name is
	// the whole marker, which is what joins a result to a proof.
	Outcomes map[string]adapter.Outcome

	// Twice names the tests more than one suite reported. One test name answers
	// for one proof, so two reports of one name is a thing the reader has to
	// see.
	Twice []string

	Tests int
	At    time.Time
	Took  time.Duration
}

// Blocked is one surface the board could not run, and why.
type Blocked struct {
	Surface string
	Err     error
}

// Pattern is the -run regexp that selects exactly the tests this plan's proofs
// name.
//
// This is what the marker is for (R9): -run filters names, so the board asks
// for the proofs rather than running a whole suite to learn about a handful of
// them, and no other test's result can reach the board.
//
// A plan naming no proof gets no pattern. An empty pattern would select every
// test in the repo, and a board built from every test is not a board.
func Pattern(set plan.Set) string {
	var markers []string
	for _, s := range set.Slices {
		for _, proof := range s.Proofs {
			if proof.Marker != "" {
				markers = append(markers, regexp.QuoteMeta(proof.Marker))
			}
		}
	}
	if len(markers) == 0 {
		return ""
	}

	slices.Sort(markers)
	markers = slices.Compact(markers)

	// Quoted, because the markers come out of a file somebody else wrote. The
	// plan reader already holds a marker to a Go test name, and this costs one
	// call and means a plan can never reach into the pattern it is selected by.
	pattern := "^(?:" + strings.Join(markers, "|") + ")$"
	if len(pattern) <= maxPatternBytes {
		return pattern
	}

	return "^" + regexp.QuoteMeta(plan.MarkerPrefix)
}

// RunProofs runs the proofs the pattern selects, on every surface the manifest
// declares, and folds what they reported into one run.
//
// A surface it could not run is returned rather than concluded from. Every
// proof on that surface would otherwise read as never run, which is a red
// manufactured out of missing data — the shape the run-evidence row already
// refuses for the same reason.
func RunProofs(ctx context.Context, root string, m manifest.Manifest, pattern string) (Run, []Blocked, error) {
	if os.Getenv(adapter.RunGuardEnv) != "" {
		return Run{}, nil, ErrInsideARun
	}

	started := time.Now()

	var (
		logs    []adapter.RunLog
		blocked []Blocked
	)

	for _, surface := range m.Surfaces {
		a, err := adapter.For(m, surface)
		if err != nil {
			blocked = append(blocked, Blocked{Surface: surface.Name, Err: err})

			continue
		}

		dir := filepath.Join(root, filepath.FromSlash(surface.Root))

		log, err := runOne(ctx, a, dir, pattern)
		if err != nil && !errors.Is(err, adapter.ErrNoTests) {
			blocked = append(blocked, Blocked{Surface: surface.Name, Err: err})

			continue
		}

		logs = append(logs, log)
	}

	run := ReadRun(logs)
	run.At = started

	return run, blocked, nil
}

// markerRunner is a stack that can run the tests whose names match a pattern.
//
// It is the seam's Go path today. R9 ships the Go marker convention only, and
// another stack declares its own with its adapter bet — until then a stack that
// cannot filter is run whole here, which is slower and just as true.
type markerRunner interface {
	RunMatching(ctx context.Context, dir, pattern string) (adapter.RunLog, error)
}

// runOne runs one surface's proofs, filtered when the stack can filter.
func runOne(ctx context.Context, a adapter.Adapter, dir, pattern string) (adapter.RunLog, error) {
	if picky, ok := a.(markerRunner); ok {
		return picky.RunMatching(ctx, dir, pattern)
	}

	return a.Run(ctx, dir)
}

// ReadRun folds the adapters' own run logs into one run.
//
// Nothing here decides what a test is or how it came out. Those are the seam's
// answers, and a second copy of them would drift (D54 ruling 1).
func ReadRun(logs []adapter.RunLog) Run {
	run := Run{Outcomes: map[string]adapter.Outcome{}}
	seen := map[string]int{}

	for _, log := range logs {
		run.Took += log.Duration

		for _, test := range log.Tests {
			if test.Name == "" {
				continue
			}

			seen[test.Name]++

			if got, had := run.Outcomes[test.Name]; had {
				// One test name answers for one proof, so two reports of one
				// name are folded at their worst: a proof that failed anywhere
				// has failed.
				run.Outcomes[test.Name] = adapter.Worse(got, test.Outcome)

				continue
			}

			run.Outcomes[test.Name] = test.Outcome
		}
	}

	for name, times := range seen {
		if times > 1 {
			run.Twice = append(run.Twice, name)
		}
	}
	slices.Sort(run.Twice)

	run.Tests = len(run.Outcomes)

	return run
}
