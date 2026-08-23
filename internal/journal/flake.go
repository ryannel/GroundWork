package journal

import (
	"fmt"
	"slices"
	"strings"
)

// A flake line is written when a row's two runs disagreed. It holds both
// verdicts and both lines of evidence, because the disagreement is the whole
// event: neither run is the true one, and a line that kept only one of them
// would be picking a winner the tool has no way to pick.
//
// The flake rate the spec asks for (proof.md) is counted from these lines.

// Flake is one disagreement between two runs of one row.
type Flake struct {
	// RunID is the battery run the row belongs to.
	RunID string

	// RowID names the row that disagreed with itself.
	RowID string

	// First and Second are the two outcomes, in the order they happened. Both
	// are from BatteryOutcomes, and they must differ.
	First  string
	Second string

	// FirstEvidence and SecondEvidence are each run's own words.
	FirstEvidence  string
	SecondEvidence string
}

// flakeEvent is one flake line.
type flakeEvent struct {
	envelope

	Run            string `json:"run"`
	Row            string `json:"row"`
	First          string `json:"first"`
	Second         string `json:"second"`
	FirstEvidence  string `json:"first_evidence"`
	SecondEvidence string `json:"second_evidence"`
}

// WriteFlake records one flake in the journal of the repo at repoDir. It
// returns the path the event was stored at.
//
// It writes nothing when it rejects the flake.
func WriteFlake(repoDir string, f Flake) (string, error) {
	if err := checkFlake(f); err != nil {
		return "", err
	}

	return write(repoDir, "flake", func(dir, tip string, env envelope) (any, error) {
		return flakeEvent{
			envelope:       env,
			Run:            f.RunID,
			Row:            f.RowID,
			First:          f.First,
			Second:         f.Second,
			FirstEvidence:  f.FirstEvidence,
			SecondEvidence: f.SecondEvidence,
		}, nil
	})
}

// checkFlake rejects a flake the journal will not record.
func checkFlake(f Flake) error {
	if err := checkFilled("run", f.RunID); err != nil {
		return err
	}
	if err := checkFilled("row", f.RowID); err != nil {
		return err
	}

	for _, o := range []struct{ name, value string }{{"first", f.First}, {"second", f.Second}} {
		if !slices.Contains(batteryOutcomes, o.value) {
			return fmt.Errorf("the %s outcome %q is not one of: %s",
				o.name, o.value, strings.Join(batteryOutcomes, ", "))
		}
	}

	// Two runs that agreed are not a flake. A line claiming one would put a
	// number in the flake rate that never happened.
	if f.First == f.Second {
		return fmt.Errorf("both runs came out %q, and two runs that agreed are not a flake", f.First)
	}

	if err := checkFilled("first_evidence", f.FirstEvidence); err != nil {
		return err
	}

	return checkFilled("second_evidence", f.SecondEvidence)
}
