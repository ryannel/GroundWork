package journal

import (
	"strings"
	"testing"
	"unicode"
)

// D28 named the deferral this closes: the seal line's battery and battery_run
// fields are D23's second recording place, and they land with the machinery.
//
// They are written only when the caller has them. The low-level journal seal
// verb does not, and a field with no value is left off the line rather than
// written empty — an empty string there would read as a battery pair nobody
// can find rather than as a pair nobody recorded.
func TestWriteSealCarriesTheBatteryPairWhenItHasOne(t *testing.T) {
	dir := newRepo(t)
	t.Setenv("GROUNDWORK_SESSION", "s-alpha")
	tagAnnotated(t, dir, "seal-1")

	s := sampleSeal()
	s.Battery = "8.0+r1234567"
	s.BatteryRun = "run-20260826T120000Z-abcd"

	path, err := WriteSeal(dir, s)
	if err != nil {
		t.Fatalf("WriteSeal returned an error: %v", err)
	}

	event := decodeEvent(t, dir, path)
	wantString(t, event, "battery", s.Battery)
	wantString(t, event, "battery_run", s.BatteryRun)
}

func TestWriteSealLeavesOffABatteryPairItDoesNotHave(t *testing.T) {
	dir := newRepo(t)
	t.Setenv("GROUNDWORK_SESSION", "s-alpha")
	tagAnnotated(t, dir, "seal-1")

	path, err := WriteSeal(dir, sampleSeal())
	if err != nil {
		t.Fatalf("WriteSeal returned an error: %v", err)
	}

	event := decodeEvent(t, dir, path)
	for _, field := range []string{"battery", "battery_run"} {
		if _, found := event[field]; found {
			t.Errorf("the line carries %q, and the caller named no battery run", field)
		}
	}
}

// Half a pair is worse than none: a line naming a version with no run behind
// it, or a run with no version, cannot be cross-checked against anything.
func TestWriteSealRefusesHalfABatteryPair(t *testing.T) {
	cases := []struct {
		name    string
		battery string
		run     string
	}{
		{"a version with no run", "8.0+r1234567", ""},
		{"a run with no version", "", "run-20260826T120000Z-abcd"},
	}

	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			dir := newRepo(t)
			t.Setenv("GROUNDWORK_SESSION", "s-alpha")
			tagAnnotated(t, dir, "seal-1")

			s := sampleSeal()
			s.Battery = c.battery
			s.BatteryRun = c.run

			if _, err := WriteSeal(dir, s); err == nil {
				t.Fatalf("%s was recorded", c.name)
			} else if !strings.Contains(err.Error(), "battery") {
				t.Errorf("the error is %q, and it does not say which pair was half written", err)
			}
		})
	}
}

// Seals reads the seal lines back, oldest first, so a caller can find the line
// that stands behind a tag.
func TestSealsReadsTheLinesBackInOrder(t *testing.T) {
	dir := newRepo(t)
	t.Setenv("GROUNDWORK_SESSION", "s-alpha")
	tagAnnotated(t, dir, "seal-1")
	head := runGit(t, dir, "rev-parse", "HEAD")

	first := sampleSeal()
	first.Battery = "8.0+r1234567"
	first.BatteryRun = "run-20260826T120000Z-abcd"
	if _, err := WriteSeal(dir, first); err != nil {
		t.Fatalf("WriteSeal returned an error: %v", err)
	}

	second := sampleSeal()
	second.Action = "revoked"
	if _, err := WriteSeal(dir, second); err != nil {
		t.Fatalf("WriteSeal returned an error: %v", err)
	}

	lines, err := Seals(dir)
	if err != nil {
		t.Fatalf("Seals returned an error: %v", err)
	}
	if len(lines) != 2 {
		t.Fatalf("Seals read %d lines, want 2", len(lines))
	}

	if lines[0].Action != "granted" || lines[1].Action != "revoked" {
		t.Fatalf("Seals read %q then %q, want granted then revoked", lines[0].Action, lines[1].Action)
	}
	if lines[0].Tag != "seal-1" || lines[0].Kind != "acceptance" || lines[0].Target != head {
		t.Errorf("the first line is %+v", lines[0])
	}
	if lines[0].Battery != first.Battery || lines[0].BatteryRun != first.BatteryRun {
		t.Errorf("the first line carries %q and %q", lines[0].Battery, lines[0].BatteryRun)
	}
	if lines[1].Battery != "" {
		t.Errorf("the second line carries the battery %q, and it was written without one", lines[1].Battery)
	}
}

// A journal that was never written to holds no seal, and saying so is not the
// same as failing.
func TestSealsOnARepoWithNoJournal(t *testing.T) {
	dir := newRepo(t)

	lines, err := Seals(dir)
	if err != nil {
		t.Fatalf("Seals returned an error: %v", err)
	}
	if len(lines) != 0 {
		t.Fatalf("Seals read %d lines from a repo that never wrote one", len(lines))
	}
}

// LatestBattery is what a grant reads to learn the version it is sealing under.
// Newest is decided by ts, the same rule the dial chain uses.
func TestLatestBatteryPicksTheNewestRun(t *testing.T) {
	dir := newRepo(t)
	t.Setenv("GROUNDWORK_SESSION", "s-alpha")

	green := map[string]int{"green": 3, "red": 0, "waived": 0, "quarantined": 0, "unrunnable": 0}
	for _, run := range []string{"run-20260101T000000Z-0001", "run-20260102T000000Z-0002"} {
		if _, err := WriteBattery(dir, Battery{
			RunID: run, Version: "8.0+r1234567", Counts: green, DurationMS: 1,
		}); err != nil {
			t.Fatalf("WriteBattery returned an error: %v", err)
		}
	}

	got, found, err := LatestBattery(dir)
	if err != nil {
		t.Fatalf("LatestBattery returned an error: %v", err)
	}
	if !found {
		t.Fatal("LatestBattery found no run in a journal holding two")
	}
	if got.Run != "run-20260102T000000Z-0002" {
		t.Fatalf("LatestBattery picked %q, want the newer run", got.Run)
	}
	if got.Version != "8.0+r1234567" || got.Counts["green"] != 3 {
		t.Errorf("LatestBattery read %+v", got)
	}
}

func TestLatestBatteryOnARepoWithNoRun(t *testing.T) {
	dir := newRepo(t)

	_, found, err := LatestBattery(dir)
	if err != nil {
		t.Fatalf("LatestBattery returned an error: %v", err)
	}
	if found {
		t.Fatal("LatestBattery found a run in a journal that holds none")
	}
}

// F65 and D52.8: R6 says the record states who signed. D51.3 already ruled that
// a value only printed is not on the record, and the amended tag's signature
// state got exactly the treatment that ruling forbids. So the line carries it.
func TestWriteSealCarriesTheSignatureAndTheSigner(t *testing.T) {
	dir := newRepo(t)
	t.Setenv("GROUNDWORK_SESSION", "s-alpha")
	tagAnnotated(t, dir, "seal-1")

	s := sampleSeal()
	s.Signature = "verified"
	s.Signer = "owner@example.com"

	path, err := WriteSeal(dir, s)
	if err != nil {
		t.Fatalf("WriteSeal returned an error: %v", err)
	}

	event := decodeEvent(t, dir, path)
	wantString(t, event, "signature", "verified")
	wantString(t, event, "signer", "owner@example.com")

	lines, err := Seals(dir)
	if err != nil {
		t.Fatalf("Seals returned an error: %v", err)
	}
	if len(lines) != 1 || lines[0].Signature != "verified" || lines[0].Signer != "owner@example.com" {
		t.Fatalf("Seals read %+v", lines)
	}
}

// A signer with no signature state behind it names somebody for a signature
// nobody recorded. Both or neither, the same rule the battery pair follows.
func TestWriteSealRefusesASignerWithNoSignature(t *testing.T) {
	dir := newRepo(t)
	t.Setenv("GROUNDWORK_SESSION", "s-alpha")
	tagAnnotated(t, dir, "seal-1")

	s := sampleSeal()
	s.Signer = "owner@example.com"

	if _, err := WriteSeal(dir, s); err == nil {
		t.Fatal("a signer with no signature state was recorded")
	} else if !strings.Contains(err.Error(), "signature") {
		t.Errorf("the error is %q, and it does not say what was missing", err)
	}
}

// An unsigned seal records that it is unsigned, and names nobody. A line with
// no signature field at all would read as "not measured" rather than "unsigned".
func TestWriteSealLeavesOffASignerNobodyNamed(t *testing.T) {
	dir := newRepo(t)
	t.Setenv("GROUNDWORK_SESSION", "s-alpha")
	tagAnnotated(t, dir, "seal-1")

	s := sampleSeal()
	s.Signature = "unsigned"

	path, err := WriteSeal(dir, s)
	if err != nil {
		t.Fatalf("WriteSeal returned an error: %v", err)
	}

	event := decodeEvent(t, dir, path)
	wantString(t, event, "signature", "unsigned")
	if _, found := event["signer"]; found {
		t.Error("the line names a signer, and an unsigned tag has none")
	}
}

// F66 and D52.9: short() is the one clip in this package that skipped
// printable. Everything it cuts is a value somebody else wrote, and a newline
// in one draws a line of its own wherever the error is printed.
func TestShortMakesAValueSafeToPrint(t *testing.T) {
	got := short("a\nseal\tgreen\tthe seal holds")

	for _, r := range got {
		if !unicode.IsPrint(r) {
			t.Errorf("short gave %q, and it holds the unprintable character %q", got, r)
		}
	}
	if strings.Contains(got, "\n") || strings.Contains(got, "\t") {
		t.Errorf("short gave %q, and it would draw a line of its own", got)
	}
	if !strings.Contains(got, "seal") {
		t.Errorf("short gave %q, and it lost the words", got)
	}
}
