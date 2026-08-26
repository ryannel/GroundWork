package journal

import (
	"errors"
	"strings"
	"testing"
)

// sampleWaiverUse returns a waiver-use line with every field set.
func sampleWaiverUse() Waiver {
	return Waiver{
		Action:   "used",
		Row:      "honesty",
		File:     ".groundwork/waivers/honesty-20260823-9f3a.json",
		Reason:   "the scan cannot see the table helper",
		Expires:  "2026-09-05",
		RunID:    "run-20260823T101112Z-4a1b",
		Evidence: "honesty scan: 1 test asserts nothing",
	}
}

// sampleWaiverGrant returns a waiver-grant line with every field set.
func sampleWaiverGrant() Waiver {
	return Waiver{
		Action:  "granted",
		Row:     "honesty",
		File:    ".groundwork/waivers/honesty-20260823-9f3a.json",
		Reason:  "the scan cannot see the table helper",
		Expires: "2026-09-05",
	}
}

func TestWriteWaiverWritesEveryField(t *testing.T) {
	dir := newRepo(t)
	t.Setenv("GROUNDWORK_SESSION", "s-alpha")

	head := runGit(t, dir, "rev-parse", "HEAD")

	path, err := WriteWaiver(dir, sampleWaiverUse())
	if err != nil {
		t.Fatalf("the write failed: %v", err)
	}

	event := decodeEvent(t, dir, path)

	wantNumber(t, event, "v", 2)
	wantString(t, event, "kind", "waiver")
	wantString(t, event, "session", "s-alpha")
	wantNumber(t, event, "seq", 1)
	wantString(t, event, "commit", head)
	wantString(t, event, "branch", "main")
	wantString(t, event, "action", "used")
	wantString(t, event, "row", "honesty")
	wantString(t, event, "waiver", ".groundwork/waivers/honesty-20260823-9f3a.json")
	wantString(t, event, "reason", "the scan cannot see the table helper")
	wantString(t, event, "expires", "2026-09-05")
	wantString(t, event, "run", "run-20260823T101112Z-4a1b")
	wantString(t, event, "evidence", "honesty scan: 1 test asserts nothing")
}

// A grant happens before any run, so it carries no run and no evidence. Those
// fields must be absent from the line, not present and empty: an empty run
// reads as a run whose id nobody recorded.
func TestWriteWaiverGrantCarriesNoRun(t *testing.T) {
	dir := newRepo(t)

	path, err := WriteWaiver(dir, sampleWaiverGrant())
	if err != nil {
		t.Fatalf("the write failed: %v", err)
	}

	event := decodeEvent(t, dir, path)

	wantString(t, event, "action", "granted")
	for _, field := range []string{"run", "evidence"} {
		if _, held := event[field]; held {
			t.Errorf("a granted line holds the field %q: %v", field, event[field])
		}
	}
}

// An ignored waiver is one the run refused. Its reason and expiry may be the
// very things that were wrong with it, so the line accepts them empty and says
// why in its evidence instead.
func TestWriteWaiverIgnoredAcceptsNoReasonOrExpiry(t *testing.T) {
	dir := newRepo(t)

	path, err := WriteWaiver(dir, Waiver{
		Action:   "ignored",
		Row:      "honesty",
		File:     ".groundwork/waivers/honesty-20260823-9f3a.json",
		RunID:    "run-20260823T101112Z-4a1b",
		Evidence: "its expires field is not a date",
	})
	if err != nil {
		t.Fatalf("the write failed: %v", err)
	}

	event := decodeEvent(t, dir, path)

	wantString(t, event, "action", "ignored")
	wantString(t, event, "evidence", "its expires field is not a date")
	for _, field := range []string{"reason", "expires"} {
		if _, held := event[field]; held {
			t.Errorf("an ignored line with nothing to say holds %q: %v", field, event[field])
		}
	}
}

func TestWriteWaiverRejectsABadWaiver(t *testing.T) {
	long := strings.Repeat("x", MaxTextBytes+1)

	cases := []struct {
		name   string
		waiver Waiver
	}{
		{"an action outside the vocabulary", waiverWith(func(w *Waiver) { w.Action = "revoked" })},
		{"an empty action", waiverWith(func(w *Waiver) { w.Action = "" })},
		{"an empty row", waiverWith(func(w *Waiver) { w.Row = "" })},
		{"an empty file", waiverWith(func(w *Waiver) { w.File = "" })},
		{"a use with no run", waiverWith(func(w *Waiver) { w.RunID = "" })},
		{"a use with no evidence", waiverWith(func(w *Waiver) { w.Evidence = "" })},
		{"a use with no reason", waiverWith(func(w *Waiver) { w.Reason = "" })},
		{"a use with no expiry", waiverWith(func(w *Waiver) { w.Expires = "" })},
		{"a grant carrying a run", grantWith(func(w *Waiver) { w.RunID = "run-1" })},
		{"a grant carrying evidence", grantWith(func(w *Waiver) { w.Evidence = "because" })},
		{"an ignored line with no run", Waiver{
			Action: "ignored", Row: "a", File: "f", Evidence: "why",
		}},
		{"a grant with no row", grantWith(func(w *Waiver) { w.Row = "" })},
		{"an ignored line with no evidence", Waiver{
			Action: "ignored", Row: "a", File: "f", RunID: "run-1",
		}},
		{"a row over the limit", waiverWith(func(w *Waiver) { w.Row = long })},
		{"a file over the limit", waiverWith(func(w *Waiver) { w.File = long })},
		{"a reason over the limit", waiverWith(func(w *Waiver) { w.Reason = long })},
		{"an expiry over the limit", waiverWith(func(w *Waiver) { w.Expires = long })},
		{"a run over the limit", waiverWith(func(w *Waiver) { w.RunID = long })},
		{"evidence over the limit", waiverWith(func(w *Waiver) { w.Evidence = long })},
	}

	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			dir := newRepo(t)

			if _, err := WriteWaiver(dir, c.waiver); err == nil {
				t.Fatalf("the journal took a waiver with %s", c.name)
			}
			if refExists(t, dir) {
				t.Fatalf("a rejected waiver still moved the journal ref")
			}
		})
	}
}

// waiverWith returns the sample use with one field changed.
func waiverWith(change func(*Waiver)) Waiver {
	w := sampleWaiverUse()
	change(&w)

	return w
}

// grantWith returns the sample grant with one field changed.
func grantWith(change func(*Waiver)) Waiver {
	w := sampleWaiverGrant()
	change(&w)

	return w
}

// A file that is not a waiver at all names no row. The line still has to be
// written — the run refused something, and that is the record — and a made-up
// row would be worse than an absent one.
func TestWriteWaiverIgnoredAcceptsNoRow(t *testing.T) {
	dir := newRepo(t)

	path, err := WriteWaiver(dir, Waiver{
		Action:   "ignored",
		File:     ".groundwork/waivers/notes.md",
		RunID:    "run-20260823T101112Z-4a1b",
		Evidence: "it is not a .json file, and this directory holds waiver files only",
	})
	if err != nil {
		t.Fatalf("the write failed: %v", err)
	}

	event := decodeEvent(t, dir, path)

	wantString(t, event, "action", "ignored")
	wantString(t, event, "waiver", ".groundwork/waivers/notes.md")
	if _, held := event["row"]; held {
		t.Errorf("the line claims the row %v, and the file names none", event["row"])
	}
}

func TestWriteWaiverAcceptsEveryAction(t *testing.T) {
	for _, action := range []string{"granted", "used", "ignored"} {
		t.Run(action, func(t *testing.T) {
			dir := newRepo(t)

			w := sampleWaiverUse()
			w.Action = action
			if action == "granted" {
				w = sampleWaiverGrant()
			}

			path, err := WriteWaiver(dir, w)
			if err != nil {
				t.Fatalf("the journal refused the action %q: %v", action, err)
			}
			wantString(t, decodeEvent(t, dir, path), "action", action)
		})
	}
}

func TestWriteWaiverOutsideARepo(t *testing.T) {
	if _, err := WriteWaiver(t.TempDir(), sampleWaiverUse()); !errors.Is(err, ErrNotARepo) {
		t.Fatalf("the error is %v, want ErrNotARepo", err)
	}
}

func TestWriteWaiverLeavesAFullJournalAloneWhenItRejects(t *testing.T) {
	dir := newRepo(t)

	if _, err := WriteWaiver(dir, sampleWaiverUse()); err != nil {
		t.Fatalf("the first write failed: %v", err)
	}
	before := journalPaths(t, dir)

	if _, err := WriteWaiver(dir, waiverWith(func(w *Waiver) { w.Action = "nonsense" })); err == nil {
		t.Fatal("the journal took a waiver with an action outside the vocabulary")
	}

	after := journalPaths(t, dir)
	if len(after) != len(before) {
		t.Fatalf("the journal holds %d events after a rejected write, want %d", len(after), len(before))
	}
}
