package battery

import (
	"errors"
	"fmt"

	"github.com/ryannel/groundwork/internal/journal"
	"github.com/ryannel/groundwork/internal/plan"
)

// The plan row reads the plan a repo commits and says whether it holds
// together: every file parses, every id names one thing, and every reference
// reaches something.
//
// It judges what a plan says about itself, and nothing else. Whether the work
// is done, whether a proof is red for the right reason, and whether a design
// anchor resolves are all derived from git, from the test run, and from the
// seal — later slices of this bet. A row that guessed at any of those here
// would be a second answer to a question something else already answers.
//
// Three verdicts, and the two that are not red are worth stating plainly.
//
// A repo with no plan directory is green. It states no plan, so it can misstate
// none, and a red there would be this tool telling every repo it has to plan
// before it can verify anything. The evidence says only that: it never claims a
// plan resolved, because none was read.
//
// A plan directory that is there and holds no plan file of any kind is
// unrunnable, not green. That is D17's rule — a verifier may never pass on
// nothing — and the person it protects is whoever is halfway through writing
// their first plan. The line names what the directory held instead, so that
// person can see which of their files did not count.
//
// One plan file of any kind means there is a plan, and everything wrong with it
// is red. D45 drew that line. F43 is where it was first drawn wrong: counting
// program files alone, a whole bet under a directory missing its program.md
// read as unrunnable. Unrunnable never fails a run, so deleting one file
// silenced every misstatement below it.
func planRow() Row {
	return Row{
		ID:       "plan",
		Kind:     "plan",
		Severity: Blocking,
		Check:    checkPlan,
	}
}

func checkPlan(c Context) Result {
	root, err := journal.RepoRoot(c.RepoDir)
	if err != nil {
		return Result{Outcome: Red, Evidence: cut(err.Error())}
	}

	set, err := plan.Load(root)
	switch {
	case errors.Is(err, plan.ErrNoPlanDir):
		return Result{
			Outcome:  Green,
			Evidence: fmt.Sprintf("there is no %s directory, so this repo states no plan and can misstate none", plan.Dir),
		}
	case errors.Is(err, plan.ErrNoUnits):
		return Result{Outcome: Unrunnable, Evidence: cut(err.Error())}
	case err != nil:
		return Result{Outcome: Red, Evidence: cut(err.Error())}
	}

	return Result{
		Outcome: Green,
		Evidence: fmt.Sprintf("%s holds %s, %s and %s, and every id and reference in them resolves",
			plan.Dir,
			counted(len(set.Programs), "program", "programs"),
			counted(len(set.Bets), "bet", "bets"),
			counted(len(set.Slices), "slice", "slices")),
	}
}
