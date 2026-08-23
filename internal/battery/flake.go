package battery

import (
	"fmt"
	"slices"
	"strings"
	"time"

	"github.com/ryannel/groundwork/internal/journal"
)

// The flake policy, from proof.md: "A failing row reruns once. If the two runs
// disagree, the CLI writes a flake event to the journal and the proof enters
// quarantine: shown loudly as quarantined on the board, never silently green,
// never falsely red."
//
// So a red row is asked once more, and only a red row: a green row is
// believed, and a row that could not run has nothing to disagree with. Two
// runs that agree are that outcome. Two that disagree are quarantined, and the
// flake line holds both verdicts because neither one is the true one.
//
// Quarantine does not fail the run. That is the spec's own rule for unattended
// work — "one nondeterministic test must not halt a night's work" — and it is
// safe because quarantined is never printed or counted as green.
//
// The numbers here are provisional. D26: "The flake mechanism ships with
// provisional numbers — rerun once, quarantine on disagreement. Bet 14's O28
// rules the real thresholds."
//
// The rerun is scoped to the row that disagreed. Nothing else is run twice,
// because nothing else disagreed.
//
// A waiver is checked before the rerun. A waiver says this row's verdict does
// not count. Confirming a verdict nobody will count is work for nothing, and
// for the deletion test that work is minutes.

// runOne runs one row, applies any waiver that stands over it, and reruns it
// once when it comes up red.
//
// It returns the row's result as the run will record it. The journal lines
// that explain a waived or quarantined row are written here, before the row's
// own line, so the record reads in the order it happened.
func runOne(repoDir, runID string, row Row, c Context, waivers *waiverSet) (RowResult, error) {
	first, elapsed, err := once(row, c)
	if err != nil {
		return RowResult{}, err
	}

	outcome, evidence := first.Outcome, first.Evidence

	if first.Outcome == Red {
		waived, err := useWaiver(repoDir, runID, row.ID, first, waivers)
		if err != nil {
			return RowResult{}, err
		}

		switch {
		case waived != "":
			outcome, evidence = Waived, waived
		default:
			second, again, err := once(row, c)
			if err != nil {
				return RowResult{}, err
			}
			elapsed += again

			if second.Outcome != first.Outcome {
				outcome, evidence = Quarantined, quarantineEvidence(first, second)

				_, err := journal.WriteFlake(repoDir, journal.Flake{
					RunID:          runID,
					RowID:          row.ID,
					First:          string(first.Outcome),
					Second:         string(second.Outcome),
					FirstEvidence:  first.Evidence,
					SecondEvidence: second.Evidence,
				})
				if err != nil {
					return RowResult{}, fmt.Errorf("could not journal the flake in the row %q: %w", row.ID, err)
				}
			}
		}
	}

	return RowResult{
		ID:         row.ID,
		Kind:       row.Kind,
		Severity:   row.Severity,
		Outcome:    outcome,
		Evidence:   evidence,
		DurationMS: elapsed,
	}, nil
}

// once runs a row's check one time and holds it to what a row owes: an outcome
// the battery knows, and a line of evidence that survives being recorded.
//
// The evidence is checked as it will be recorded, not as the row handed it
// over: a line of nothing but bytes that are not text is a row with nothing to
// show, however many bytes it is.
func once(row Row, c Context) (Result, int, error) {
	start := time.Now()
	got := row.Check(c)
	elapsed := int(time.Since(start).Milliseconds())

	if !slices.Contains(Outcomes(), got.Outcome) {
		return Result{}, 0, fmt.Errorf("the row %q reported the outcome %q, which is not one of: %s",
			row.ID, got.Outcome, strings.Join(journal.BatteryOutcomes(), ", "))
	}

	got.Evidence = cut(got.Evidence)
	if got.Evidence == "" {
		return Result{}, 0, fmt.Errorf("the row %q reported %s with no evidence for it",
			row.ID, got.Outcome)
	}

	return got, elapsed, nil
}

// quarantineEvidence is the line a quarantined row records.
//
// The verdict comes first and the row's own words after it. The words are cut
// to what is left of the journal's cap, rather than the whole line being cut
// at the end.
//
// Both halves can already be a full line on their own. A line cut only at the
// end would then overflow the cap, which killed a run before D38 ruling 2. Cut
// the other way round and the verdict itself would be the half that went.
//
// The bound is arithmetic: the fixed part is two outcome words from a closed
// vocabulary, so its widest form is known, and a committed test does the sum.
// The whole of both runs' evidence is on the flake line either way.
func quarantineEvidence(first, second Result) string {
	said := fmt.Sprintf("quarantined: %s then %s across two runs; the %s run said: ",
		first.Outcome, second.Outcome, first.Outcome)

	return said + cutTo(first.Evidence, journal.MaxTextBytes-len(said))
}
