package journal

import (
	"fmt"
	"slices"
	"strings"
)

// A waiver gets a line when it is granted, when a run uses it, and when a run
// refuses it. D24 asks for the first two; the third is the same promise from
// the other side, because a waiver a run threw away is a thing the record has
// to hold too.
//
// The file itself is committed, and git says who committed it. This line says
// what the tool did with it, and when.

// waiverActions is the closed vocabulary for what happened to a waiver.
var waiverActions = []string{"granted", "used", "ignored"}

// Waiver is one thing that happened to one waiver, as the caller reports it.
type Waiver struct {
	// Action is one of waiverActions.
	Action string

	// Row is the row the waiver names. An ignored waiver may name none: a
	// file that is not a waiver cannot say which row it meant.
	Row string

	// File is the waiver file, named from the repo root.
	File string

	// Reason is the waiver's own reason for standing. A granted or used
	// waiver has one. An ignored waiver may not: the reason may be the very
	// field that was wrong with it.
	Reason string

	// Expires is the date the waiver runs out, as the file writes it. The same
	// rule as Reason applies to an ignored waiver.
	Expires string

	// RunID is the run that used or ignored the waiver. A grant happens before
	// any run, so it carries none.
	RunID string

	// Evidence is why this line says what it says: the row's own words for a
	// use, and why the waiver could not stand for an ignore. A grant carries
	// none — the reason is the whole of it.
	Evidence string
}

// waiverEvent is one waiver line.
type waiverEvent struct {
	envelope

	Action   string `json:"action"`
	Row      string `json:"row,omitempty"`
	Waiver   string `json:"waiver"`
	Reason   string `json:"reason,omitempty"`
	Expires  string `json:"expires,omitempty"`
	Run      string `json:"run,omitempty"`
	Evidence string `json:"evidence,omitempty"`
}

// WriteWaiver records one waiver event in the journal of the repo at repoDir.
// It returns the path the event was stored at.
//
// It writes nothing when it rejects the waiver.
func WriteWaiver(repoDir string, w Waiver) (string, error) {
	if err := checkWaiver(w); err != nil {
		return "", err
	}

	return write(repoDir, "waiver", func(dir, tip string, env envelope) (any, error) {
		return waiverEvent{
			envelope: env,
			Action:   w.Action,
			Row:      w.Row,
			Waiver:   w.File,
			Reason:   w.Reason,
			Expires:  w.Expires,
			Run:      w.RunID,
			Evidence: w.Evidence,
		}, nil
	})
}

// checkWaiver rejects a waiver line the journal will not record.
//
// A grant and a use are held to different shapes on purpose. A grant that
// named a run would be claiming a run that had not happened, and a use with no
// run is a use nobody can attribute.
func checkWaiver(w Waiver) error {
	if !slices.Contains(waiverActions, w.Action) {
		return fmt.Errorf("action %q is not one of: %s", w.Action, strings.Join(waiverActions, ", "))
	}
	// An ignored waiver may name no row: the run refuses files that are not
	// waivers at all, and one of those cannot say which row it meant. Every
	// other action names one, because a grant and a use are about a row.
	if w.Action == "ignored" {
		if err := checkText("row", w.Row); err != nil {
			return err
		}
	} else if err := checkFilled("row", w.Row); err != nil {
		return err
	}

	if err := checkFilled("waiver", w.File); err != nil {
		return err
	}

	if w.Action == "granted" {
		if w.RunID != "" {
			return fmt.Errorf("a granted waiver names the run %q, and a grant happens before any run", w.RunID)
		}
		if w.Evidence != "" {
			return fmt.Errorf("a granted waiver carries evidence, and a grant has none to carry")
		}

		return checkGrantText(w)
	}

	if err := checkFilled("run", w.RunID); err != nil {
		return err
	}
	if err := checkFilled("evidence", w.Evidence); err != nil {
		return err
	}

	// An ignored waiver may be missing the very fields that made it wrong, so
	// only a used one is held to having them.
	if w.Action == "used" {
		return checkGrantText(w)
	}

	if err := checkText("reason", w.Reason); err != nil {
		return err
	}

	return checkText("expires", w.Expires)
}

// checkGrantText holds a waiver that stands to its reason and its expiry.
func checkGrantText(w Waiver) error {
	if err := checkFilled("reason", w.Reason); err != nil {
		return err
	}

	return checkFilled("expires", w.Expires)
}
