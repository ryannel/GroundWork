package battery

import (
	"context"
	"fmt"
	"path/filepath"
	"strings"
	"time"

	"github.com/ryannel/groundwork/internal/adapter"
	"github.com/ryannel/groundwork/internal/journal"
	"github.com/ryannel/groundwork/internal/manifest"
)

// discoverTimeout bounds the whole row. Discovery reads files and, for an
// out-of-process stack, runs the project's own declared command, so the row
// carries its own clock rather than trusting one.
const discoverTimeout = 2 * time.Minute

// manifestRow checks the capability manifest against what the stacks' adapters
// can actually see.
//
// It is green only when the manifest reads, every surface has an adapter, and
// every declared capability maps to at least one discovered suite. Everything
// else is red, and red is the point: a missing manifest, an unmapped stack, and
// a capability nothing proves are the three ways a project can look proven
// while nothing checks it (D25, proof.md). None of them is a skip.
func manifestRow() Row {
	return Row{
		ID:       "manifest",
		Kind:     "manifest",
		Severity: Blocking,
		Check:    checkManifest,
	}
}

func checkManifest(c Context) Result {
	m, err := manifest.Load(c.RepoDir)
	if err != nil {
		return Result{Outcome: Red, Evidence: err.Error()}
	}

	root, err := journal.RepoRoot(c.RepoDir)
	if err != nil {
		return Result{Outcome: Red, Evidence: err.Error()}
	}

	ctx, cancel := context.WithTimeout(context.Background(), discoverTimeout)
	defer cancel()

	// discovered holds, per surface, how many tests the adapter found in each
	// suite it can see. The count is what makes the row honest: a suite that
	// holds no test proves nothing, and a row that only checked the suite
	// existed would pass an empty file.
	//
	// A capability is proven by a suite on its own surface only. A web
	// capability pointed at a Go package proves nothing about the web.
	discovered := map[string]map[string]int{}
	for _, surface := range m.Surfaces {
		a, err := adapterFor(m, surface)
		if err != nil {
			return Result{Outcome: Red, Evidence: err.Error()}
		}

		suites, err := a.Discover(ctx, filepath.Join(root, filepath.FromSlash(surface.Root)))
		if err != nil {
			return Result{
				Outcome:  Red,
				Evidence: fmt.Sprintf("the surface %q could not be read: %v", surface.Name, err),
			}
		}

		ids := map[string]int{}
		for _, suite := range suites {
			if _, twice := ids[suite.ID]; twice {
				// One id, two entries: the second would quietly replace the
				// first, and whichever suite lost would be a suite nothing
				// reconciles against.
				return Result{
					Outcome: Red,
					Evidence: fmt.Sprintf("the surface %q reported the suite %q twice",
						surface.Name, suite.ID),
				}
			}
			ids[suite.ID] = len(suite.Tests)
		}
		discovered[surface.Name] = ids
	}

	var unproven []string
	for _, capability := range m.Capabilities {
		if !proven(capability, discovered[capability.Surface]) {
			unproven = append(unproven, capability.Name)
		}
	}

	if len(unproven) > 0 {
		return Result{
			Outcome: Red,
			Evidence: fmt.Sprintf("%s declares %s no suite proves: %s",
				manifest.File, counted(len(unproven), "capability", "capabilities"), names(unproven)),
		}
	}

	return Result{
		Outcome: Green,
		Evidence: fmt.Sprintf("%s declares %s on %s, and a discovered suite proves every one",
			manifest.File,
			counted(len(m.Capabilities), "capability", "capabilities"),
			counted(len(m.Surfaces), "surface", "surfaces")),
	}
}

// proven reports whether the capability names a discovered suite that actually
// holds tests.
//
// The test count is the point. An empty file, a file that does not parse, and a
// file of helpers all discover as a suite, and all of them prove nothing. A row
// that accepted the suite's existence would pass every one.
//
// A capability with no proof entries is never proven either. proof.md calls
// that a fail-closed placeholder: the project has said, in writing, that
// nothing runs for this capability yet, and the row says so in red rather than
// passing over it.
func proven(capability manifest.Capability, suites map[string]int) bool {
	for _, proof := range capability.Proof {
		if suites[proof] > 0 {
			return true
		}
	}

	return false
}

// adapterFor returns the adapter for one surface's stack.
//
// D25: Go runs in process, every other stack runs the command the manifest
// declares, and a stack with no command is a red row rather than a skip.
func adapterFor(m manifest.Manifest, surface manifest.Surface) (adapter.Adapter, error) {
	if surface.Stack == manifest.GoStack {
		return adapter.NewGo(), nil
	}

	runner, ok := m.Adapters[surface.Stack]
	if !ok {
		return nil, fmt.Errorf("the surface %q is written in %s, and %s declares no adapter for it",
			surface.Name, surface.Stack, manifest.File)
	}

	return adapter.NewExec(surface.Stack, runner.Command), nil
}

// counted renders a count with its noun, singular for one.
func counted(n int, one, many string) string {
	if n == 1 {
		return "1 " + one
	}

	return fmt.Sprintf("%d %s", n, many)
}

// names renders a list of names for a line of evidence, cut short so one long
// list cannot push the rest of the line off the journal's cap.
func names(all []string) string {
	const most = 3

	if len(all) <= most {
		return strings.Join(all, ", ")
	}

	return fmt.Sprintf("%s and %d more", strings.Join(all[:most], ", "), len(all)-most)
}
