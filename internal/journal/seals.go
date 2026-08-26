package journal

import (
	"encoding/json"
	"fmt"
	"sort"
	"time"
)

// The two readers here answer questions the seal machinery asks of the record.
//
// Seals reads the seal lines back, so verify can hold a tag's own trailers
// against what the journal says about the same tag. LatestBattery reads the
// newest battery run, so a grant records the version it was actually made
// under rather than one the caller typed.
//
// Both are read-only. Neither creates the ref, writes an object, or touches
// the index or the working tree.

// SealLine is one seal line read back from the journal.
type SealLine struct {
	// TS is when the line was written, as it was written: RFC3339.
	TS string

	Kind       string
	Tag        string
	Target     string
	Action     string
	Battery    string
	BatteryRun string

	// Reason is why the seal moved. It is empty on a grant.
	Reason string

	// Signature is the state the tag's signature was in when the line was
	// written. Signer is who git named, and is empty unless it verified.
	Signature string
	Signer    string
}

// BatteryLine is one battery run read back from the journal.
type BatteryLine struct {
	TS      string
	Run     string
	Version string

	// Counts holds one count per outcome, as the run reported them.
	Counts map[string]int
}

// Red reports whether the run this line records had a red row. Only red fails
// a run on the strength of the rows alone, and that is the same rule here.
func (b BatteryLine) Red() bool {
	return b.Counts["red"] > 0
}

// Seals reads every seal line from the tip of the journal ref at repoDir,
// oldest first.
//
// Order is by ts, then by seq inside one session, which is D13's rule. A repo
// that never wrote to the journal holds no seal line, and that is not an error.
//
// A line that will not parse as JSON fails the whole read and the error names
// the object. That is the policy every other reader here uses: a silent skip
// would under-report the record rather than announce the problem.
func Seals(repoDir string) ([]SealLine, error) {
	var found []ordered[SealLine]

	err := eachEvent(repoDir, func(where string, data []byte) error {
		var e struct {
			Kind       string `json:"kind"`
			TS         string `json:"ts"`
			Seq        int    `json:"seq"`
			SealKind   string `json:"seal_kind"`
			Tag        string `json:"tag"`
			Target     string `json:"target"`
			Action     string `json:"action"`
			Battery    string `json:"battery"`
			BatteryRun string `json:"battery_run"`
			Reason     string `json:"reason"`
			Signature  string `json:"signature"`
			Signer     string `json:"signer"`
		}
		if err := json.Unmarshal(data, &e); err != nil {
			return fmt.Errorf("the journal line at %s is not valid JSON: %w", where, err)
		}
		if e.Kind != "seal" {
			return nil
		}

		found = append(found, ordered[SealLine]{
			ts:  e.TS,
			seq: e.Seq,
			of: SealLine{
				TS: e.TS, Kind: e.SealKind, Tag: e.Tag, Target: e.Target,
				Action: e.Action, Battery: e.Battery, BatteryRun: e.BatteryRun,
				Reason: e.Reason, Signature: e.Signature, Signer: e.Signer,
			},
		})

		return nil
	})
	if err != nil {
		return nil, err
	}

	return sorted(found), nil
}

// LatestBattery reads the newest battery run from the journal at repoDir. The
// second return says whether there was one at all.
//
// Newest is decided by ts, then by seq, the same rule the dial chain uses. A
// journal that holds no battery line has nothing to report, and saying so is
// not the same as failing.
func LatestBattery(repoDir string) (BatteryLine, bool, error) {
	var found []ordered[BatteryLine]

	err := eachEvent(repoDir, func(where string, data []byte) error {
		var e struct {
			Kind    string         `json:"kind"`
			TS      string         `json:"ts"`
			Seq     int            `json:"seq"`
			Run     string         `json:"run"`
			Battery string         `json:"battery"`
			Counts  map[string]int `json:"counts"`
		}
		if err := json.Unmarshal(data, &e); err != nil {
			return fmt.Errorf("the journal line at %s is not valid JSON: %w", where, err)
		}
		if e.Kind != "battery" {
			return nil
		}

		found = append(found, ordered[BatteryLine]{
			ts:  e.TS,
			seq: e.Seq,
			of:  BatteryLine{TS: e.TS, Run: e.Run, Version: e.Battery, Counts: e.Counts},
		})

		return nil
	})
	if err != nil {
		return BatteryLine{}, false, err
	}

	all := sorted(found)
	if len(all) == 0 {
		return BatteryLine{}, false, nil
	}

	return all[len(all)-1], true, nil
}

// eachEvent hands every event line at the journal's tip to fn, along with the
// path it is stored at. A repo with no journal ref has no line, and fn is never
// called.
func eachEvent(repoDir string, fn func(where string, data []byte) error) error {
	if err := checkRepo(repoDir); err != nil {
		return err
	}

	tip, err := resolve(repoDir, Ref)
	if err != nil {
		return err
	}
	if tip == "" {
		return nil
	}

	return eachLine(repoDir, tip, fn)
}

// ordered carries a line with the two fields that order it.
type ordered[T any] struct {
	ts  string
	seq int
	of  T
}

// sorted puts lines in the order they were written: by ts, then by seq inside
// one session.
//
// A line whose ts will not parse sorts to the front, under the zero time. It is
// not dropped: a line nobody can date is still a line the record holds, and
// hiding it would let a forger silence a seal by scribbling on its timestamp.
func sorted[T any](all []ordered[T]) []T {
	sort.SliceStable(all, func(i, j int) bool {
		left, right := when(all[i].ts), when(all[j].ts)
		if !left.Equal(right) {
			return left.Before(right)
		}

		return all[i].seq < all[j].seq
	})

	out := make([]T, 0, len(all))
	for _, one := range all {
		out = append(out, one.of)
	}

	return out
}

// when reads a line's ts. A ts that will not parse reads as the zero time.
func when(ts string) time.Time {
	at, err := time.Parse(time.RFC3339, ts)
	if err != nil {
		return time.Time{}
	}

	return at
}
