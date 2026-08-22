package journal

import (
	"fmt"
	"slices"
	"strings"
)

// The battery writes two kinds of line for every run it makes.
//
// A battery line is the run itself: what version ran, how each outcome was
// counted, and how long the whole thing took. A battery-row line is one row of
// that run: which row, how it came out, and the evidence it gave for saying
// so.
//
// The two are joined by the run field, which both carry. A row line without a
// run line means the run did not finish. A run line whose counts disagree with
// its rows means something wrote one without the other.
//
// D8's envelope is unchanged. These kinds add fields; they move none.

// batteryOutcomes is the closed vocabulary for a row's outcome.
//
// Only red fails a run. The other three non-green outcomes say a row could
// not give a verdict, and each says so in its own words: waived, because a
// waiver stands over it; quarantined, because it disagreed with itself;
// unrunnable, because the thing it checks could not be reached. A run counts
// all five, so none of them can hide inside "not green".
var batteryOutcomes = []string{"green", "red", "waived", "quarantined", "unrunnable"}

// BatteryOutcomes returns the outcomes a battery row line accepts, in the
// order a run reports them.
func BatteryOutcomes() []string {
	return slices.Clone(batteryOutcomes)
}

// Battery is one run of the battery, as the runner reports it.
type Battery struct {
	// RunID names the run. Every row line of the same run carries it too.
	RunID string

	// Version is the battery version that ran: a declared MAJOR.MINOR, a
	// plus, and the digest of the row manifest. D23 fixes the shape.
	Version string

	// Counts holds one count per outcome. Every outcome in BatteryOutcomes
	// must be present, even at zero: a count that is simply absent reads as
	// "not measured" rather than as none.
	Counts map[string]int

	DurationMS int
}

// BatteryRow is one row of one battery run, as the runner reports it.
type BatteryRow struct {
	// RunID is the run this row belongs to. It matches the Battery line's.
	RunID string

	// RowID names the row inside the battery.
	RowID string

	// Outcome is one of BatteryOutcomes.
	Outcome string

	// Evidence is the row's own human line for why it said what it said. It
	// is required: a row that reports an outcome with no evidence records a
	// verdict nobody can check. It is capped at MaxTextBytes, and a caller
	// with more to say cuts it to fit before offering it here.
	Evidence string

	DurationMS int
}

// batteryEvent is one battery line.
type batteryEvent struct {
	envelope

	Run        string         `json:"run"`
	Battery    string         `json:"battery"`
	Counts     map[string]int `json:"counts"`
	DurationMS int            `json:"duration_ms"`
}

// batteryRowEvent is one battery-row line.
type batteryRowEvent struct {
	envelope

	Run        string `json:"run"`
	Row        string `json:"row"`
	Outcome    string `json:"outcome"`
	Evidence   string `json:"evidence"`
	DurationMS int    `json:"duration_ms"`
}

// WriteBattery records one battery run in the journal of the repo at repoDir.
// It returns the path the event was stored at.
//
// It writes nothing when it rejects the run.
func WriteBattery(repoDir string, b Battery) (string, error) {
	if err := checkBattery(b); err != nil {
		return "", err
	}

	// The map is copied, so a caller that keeps writing to its own map after
	// the call cannot change what a retry marshals.
	counts := maps(b.Counts)

	return write(repoDir, "battery", func(dir, tip string, env envelope) (any, error) {
		return batteryEvent{
			envelope:   env,
			Run:        b.RunID,
			Battery:    b.Version,
			Counts:     counts,
			DurationMS: b.DurationMS,
		}, nil
	})
}

// WriteBatteryRow records one row of one battery run in the journal of the
// repo at repoDir. It returns the path the event was stored at.
//
// It writes nothing when it rejects the row.
func WriteBatteryRow(repoDir string, r BatteryRow) (string, error) {
	if err := checkBatteryRow(r); err != nil {
		return "", err
	}

	return write(repoDir, "battery-row", func(dir, tip string, env envelope) (any, error) {
		return batteryRowEvent{
			envelope:   env,
			Run:        r.RunID,
			Row:        r.RowID,
			Outcome:    r.Outcome,
			Evidence:   r.Evidence,
			DurationMS: r.DurationMS,
		}, nil
	})
}

// checkBattery rejects a run the journal will not record.
func checkBattery(b Battery) error {
	if err := checkFilled("run", b.RunID); err != nil {
		return err
	}
	if err := checkFilled("battery", b.Version); err != nil {
		return err
	}
	if err := checkDuration(b.DurationMS); err != nil {
		return err
	}

	return checkCounts(b.Counts)
}

// checkBatteryRow rejects a row the journal will not record.
func checkBatteryRow(r BatteryRow) error {
	if err := checkFilled("run", r.RunID); err != nil {
		return err
	}
	if err := checkFilled("row", r.RowID); err != nil {
		return err
	}
	if !slices.Contains(batteryOutcomes, r.Outcome) {
		return fmt.Errorf("outcome %q is not one of: %s",
			r.Outcome, strings.Join(batteryOutcomes, ", "))
	}
	if err := checkDuration(r.DurationMS); err != nil {
		return err
	}

	return checkFilled("evidence", r.Evidence)
}

// checkCounts rejects a counts map that does not hold exactly the outcome
// vocabulary, at zero or more each.
//
// Missing and unknown are both refused, and for the same reason: the counts
// are the run's own summary of itself, and a summary that skips an outcome or
// invents one is not a summary of this battery.
func checkCounts(counts map[string]int) error {
	for _, outcome := range batteryOutcomes {
		n, held := counts[outcome]
		if !held {
			return fmt.Errorf("counts has no entry for the outcome %q", outcome)
		}
		if n < 0 {
			return fmt.Errorf("counts[%s] is %d, which is below zero", outcome, n)
		}
	}

	for outcome := range counts {
		if !slices.Contains(batteryOutcomes, outcome) {
			return fmt.Errorf("counts holds %q, which is not one of: %s",
				outcome, strings.Join(batteryOutcomes, ", "))
		}
	}

	return nil
}

// checkDuration rejects a duration below zero. No run takes negative time,
// so a negative number is a caller's arithmetic showing through.
func checkDuration(ms int) error {
	if ms < 0 {
		return fmt.Errorf("duration_ms is %d, which is below zero", ms)
	}

	return nil
}

// maps copies a counts map, so the event holds the caller's numbers as they
// were at the call rather than as they are at the write.
func maps(counts map[string]int) map[string]int {
	copied := make(map[string]int, len(counts))
	for outcome, n := range counts {
		copied[outcome] = n
	}

	return copied
}
