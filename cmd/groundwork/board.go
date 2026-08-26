package main

import (
	"context"
	"errors"
	"flag"
	"fmt"
	"io"

	"github.com/ryannel/groundwork/internal/board"
	"github.com/ryannel/groundwork/internal/journal"
	"github.com/ryannel/groundwork/internal/manifest"
	"github.com/ryannel/groundwork/internal/plan"
)

const boardUsage = `usage: groundwork board

board renders the board: every proof the plan names, what its plan position
expects, what the test run said, and how the two sit together. It is stamped
with the run it came from.

The board is a derivation, never a file anyone edits. It reads three things —
the plan, the Slice trailers on this repo's commits, and a run of the proofs
themselves — and it writes nothing at all.

It exits 1 when a proof its plan expects green is not green, or when a Slice
trailer misstates landed-ness. That is the verify board row's own rule, read
off the same board, so the two can never disagree.
`

// runBoard handles the board verb.
func runBoard(args []string, out, errOut io.Writer) int {
	const name = "groundwork board"

	flags := flag.NewFlagSet(name, flag.ContinueOnError)
	flags.SetOutput(errOut)
	flags.Usage = func() { fmt.Fprint(errOut, boardUsage) }

	if err := flags.Parse(args); err != nil {
		return exitUsage
	}
	if spareArgument(errOut, flags, name) {
		return exitUsage
	}

	root, err := journal.RepoRoot(".")
	if err != nil {
		return sayFailed(errOut, name, err)
	}

	set, err := plan.Load(root)
	if errors.Is(err, plan.ErrNoPlanDir) {
		// A board is derived from a plan, and where there is none there is no
		// board. That is not a failure: a repo that states no plan misstates
		// none.
		fmt.Fprintf(out, "there is no %s directory, so this repo derives no board\n", plan.Dir)

		return exitOK
	}
	if err != nil {
		return sayFailed(errOut, name, err)
	}

	pattern := board.Pattern(set)
	if pattern == "" {
		return sayFailed(errOut, name,
			fmt.Errorf("%s names no proof, so there is no board to derive", plan.Dir))
	}

	m, err := manifest.Load(root)
	if err != nil {
		return sayFailed(errOut, name, err)
	}

	history, err := board.ReadHistory(root)
	if err != nil {
		return sayFailed(errOut, name, err)
	}

	ctx, cancel := context.WithTimeout(context.Background(), board.Budget)
	defer cancel()

	run, blocked, err := board.RunProofs(ctx, root, m, pattern)
	if err != nil {
		return sayFailed(errOut, name, err)
	}
	// A surface the run could not reach leaves the board short of results, and
	// every proof on it would read as never run. Saying so beats drawing a board
	// out of missing data.
	for _, one := range blocked {
		fmt.Fprintf(errOut, "%s: the surface %q could not be run: %v\n", name, one.Surface, one.Err)
	}
	if len(blocked) > 0 {
		return exitFailed
	}

	derived := board.Derive(set, history, run)

	fmt.Fprint(out, board.Render(derived))

	if !derived.Holds() {
		return exitFailed
	}

	return exitOK
}
