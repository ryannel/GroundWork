package journal

import (
	"errors"
	"strings"
	"testing"
)

// sampleFlake returns a flake line with every field set.
func sampleFlake() Flake {
	return Flake{
		RunID:          "run-20260823T101112Z-4a1b",
		RowID:          "wiring",
		First:          "red",
		Second:         "green",
		FirstEvidence:  "wiring scan: 1 function no caller reaches",
		SecondEvidence: "wiring scan: every exported function has a caller",
	}
}

func TestWriteFlakeWritesEveryField(t *testing.T) {
	dir := newRepo(t)
	t.Setenv("GROUNDWORK_SESSION", "s-alpha")

	head := runGit(t, dir, "rev-parse", "HEAD")

	path, err := WriteFlake(dir, sampleFlake())
	if err != nil {
		t.Fatalf("the write failed: %v", err)
	}

	event := decodeEvent(t, dir, path)

	wantNumber(t, event, "v", 2)
	wantString(t, event, "kind", "flake")
	wantString(t, event, "session", "s-alpha")
	wantNumber(t, event, "seq", 1)
	wantString(t, event, "commit", head)
	wantString(t, event, "branch", "main")
	wantString(t, event, "run", "run-20260823T101112Z-4a1b")
	wantString(t, event, "row", "wiring")
	wantString(t, event, "first", "red")
	wantString(t, event, "second", "green")
	wantString(t, event, "first_evidence", "wiring scan: 1 function no caller reaches")
	wantString(t, event, "second_evidence", "wiring scan: every exported function has a caller")
}

// A flake is a disagreement. Two runs that agreed are not a flake, and a line
// claiming one would put a false number in the flake rate the spec asks for.
func TestWriteFlakeRejectsTwoRunsThatAgreed(t *testing.T) {
	dir := newRepo(t)

	f := sampleFlake()
	f.Second = f.First

	if _, err := WriteFlake(dir, f); err == nil {
		t.Fatal("the journal took a flake whose two runs agreed")
	}
	if refExists(t, dir) {
		t.Fatal("a rejected flake still moved the journal ref")
	}
}

func TestWriteFlakeRejectsABadFlake(t *testing.T) {
	long := strings.Repeat("x", MaxTextBytes+1)

	cases := []struct {
		name  string
		flake Flake
	}{
		{"no run", flakeWith(func(f *Flake) { f.RunID = "" })},
		{"no row", flakeWith(func(f *Flake) { f.RowID = "" })},
		{"a first outcome outside the vocabulary", flakeWith(func(f *Flake) { f.First = "reddish" })},
		{"a second outcome outside the vocabulary", flakeWith(func(f *Flake) { f.Second = "fine" })},
		{"an empty first outcome", flakeWith(func(f *Flake) { f.First = "" })},
		{"an empty second outcome", flakeWith(func(f *Flake) { f.Second = "" })},
		{"no evidence for the first run", flakeWith(func(f *Flake) { f.FirstEvidence = "" })},
		{"no evidence for the second run", flakeWith(func(f *Flake) { f.SecondEvidence = "" })},
		{"a run over the limit", flakeWith(func(f *Flake) { f.RunID = long })},
		{"a row over the limit", flakeWith(func(f *Flake) { f.RowID = long })},
		{"first evidence over the limit", flakeWith(func(f *Flake) { f.FirstEvidence = long })},
		{"second evidence over the limit", flakeWith(func(f *Flake) { f.SecondEvidence = long })},
	}

	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			dir := newRepo(t)

			if _, err := WriteFlake(dir, c.flake); err == nil {
				t.Fatalf("the journal took a flake with %s", c.name)
			}
			if refExists(t, dir) {
				t.Fatal("a rejected flake still moved the journal ref")
			}
		})
	}
}

// flakeWith returns the sample flake with one field changed.
func flakeWith(change func(*Flake)) Flake {
	f := sampleFlake()
	change(&f)

	return f
}

// Any two different outcomes are a disagreement. Red then unrunnable is as
// much a flake as red then green, and the line records both as they came.
func TestWriteFlakeTakesAnyPairOfDifferentOutcomes(t *testing.T) {
	for _, second := range []string{"green", "unrunnable", "waived", "quarantined"} {
		t.Run("red then "+second, func(t *testing.T) {
			dir := newRepo(t)

			f := sampleFlake()
			f.Second = second

			path, err := WriteFlake(dir, f)
			if err != nil {
				t.Fatalf("the journal refused red then %s: %v", second, err)
			}
			wantString(t, decodeEvent(t, dir, path), "second", second)
		})
	}
}

func TestWriteFlakeOutsideARepo(t *testing.T) {
	if _, err := WriteFlake(t.TempDir(), sampleFlake()); !errors.Is(err, ErrNotARepo) {
		t.Fatalf("the error is %v, want ErrNotARepo", err)
	}
}
