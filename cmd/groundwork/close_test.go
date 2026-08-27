package main

import (
	"bytes"
	"os"
	"path/filepath"
	"slices"
	"strings"
	"testing"

	"github.com/ryannel/groundwork/internal/battery"
)

// D7 and R14: the bet-close ceremony list becomes a scope on the verify verb.
// verify --close runs the rows that exist at bet close and says so.

func TestVerifyCloseRunsTheWholeBatteryAndNamesTheScope(t *testing.T) {
	dir := newRepo(t)
	writeLock(t, dir, "0.1", trueDigest())
	writeManifest(t, dir)
	wantsARealRun(t)

	code, out, errOut := call(t, "verify", "--close")
	if code != exitOK {
		t.Fatalf("verify --close exited %d, want %d: %s%s", code, exitOK, out, errOut)
	}

	// Every row runs at a close: R14's list opens with the full suite, and no
	// row of this battery is scoped out of one.
	for _, row := range battery.Default().Rows() {
		if !strings.Contains(out, row.ID) {
			t.Errorf("the close run does not show the %s row: %s", row.ID, out)
		}
	}
	for _, want := range append([]string{closeHeading}, battery.CloseScope()...) {
		if !strings.Contains(out, want) {
			t.Errorf("the close run does not name %q: %s", want, out)
		}
	}
}

// A plain verify does not claim to be a close. The scope is what the flag adds,
// and a run that printed it either way would be printing a word rather than a
// scope.
func TestVerifyWithoutCloseDoesNotNameTheCloseScope(t *testing.T) {
	dir := newRepo(t)
	writeLock(t, dir, "0.1", trueDigest())
	writeManifest(t, dir)
	wantsARealRun(t)

	code, out, errOut := call(t, "verify")
	if code != exitOK {
		t.Fatalf("verify exited %d: %s%s", code, out, errOut)
	}
	if strings.Contains(out, closeHeading) {
		t.Fatalf("a plain verify claimed to be a close: %s", out)
	}
}

// The two flags ask for opposite things: one to run the close scope, one to run
// nothing at all. Refusing the pair beats picking one silently.
func TestVerifyRefusesListAndCloseTogether(t *testing.T) {
	newRepo(t)
	writeLock(t, ".", "0.1", trueDigest())

	code, out, errOut := call(t, "verify", "--list", "--close")
	if code != exitUsage {
		t.Fatalf("verify --list --close exited %d, want %d: %s%s", code, exitUsage, out, errOut)
	}
}

// D64 ruling 1: a close fails unless every scope row came back green or waived.
// The version that asked only whether the rows were registered reported a close
// over three unrunnable rows and exited zero.
//
// The fixture is a plan directory holding no plan file. Nothing goes red — the
// plan reader calls that unrunnable, not wrong — so an ordinary verify exits
// zero, and three of the four rows a close exists for never ran.
func TestVerifyCloseFailsWhenAScopeRowDidNotRun(t *testing.T) {
	dir := newRepo(t)
	writeLock(t, dir, "0.1", trueDigest())
	writeManifest(t, dir)
	if err := os.MkdirAll(filepath.Join(dir, "docs", "plan"), 0o750); err != nil {
		t.Fatalf("could not make the plan directory: %v", err)
	}
	wantsARealRun(t)

	code, out, errOut := call(t, "verify")
	if code != exitOK {
		t.Fatalf("an ordinary verify exited %d, so this fixture proves nothing: %s%s", code, out, errOut)
	}

	code, out, errOut = call(t, "verify", "--close")
	if code != exitFailed {
		t.Fatalf("a close over unrunnable scope rows exited %d, want %d: %s%s", code, exitFailed, out, errOut)
	}
	for _, want := range []string{"board", "trace", "record", "unrunnable"} {
		if !strings.Contains(errOut, want) {
			t.Errorf("the refusal does not name %q: %s", want, errOut)
		}
	}

	// And the journal says the close was not met, so a reader of the record
	// finds the same answer the person at the terminal got.
	runs := batteryLines(t, dir, "battery")
	if len(runs) != 2 {
		t.Fatalf("the journal holds %d battery lines, want the plain run and the close", len(runs))
	}
	for _, run := range runs {
		if _, held := run["scope"]; !held {
			continue
		}
		if met, said := run["close_met"].(bool); said && met {
			t.Errorf("the close's own line says it was met: %v", run)
		}
	}
}

// The refusal is what the run came back as, not what the battery holds. A run
// missing a scope row entirely fails the same way, which is the case the old
// registration check was written for and could never reach.
func TestTheCloseScopeIsCheckedAgainstWhatTheRunReported(t *testing.T) {
	cases := map[string]struct {
		res  battery.RunResult
		want int
	}{
		"every scope row green":  {closeRun(battery.Green), 0},
		"a scope row waived":     {closeRun(battery.Waived), 0},
		"a scope row red":        {closeRun(battery.Red), 1},
		"a scope row unrunnable": {closeRun(battery.Unrunnable), 1},
		"a scope row missing":    {battery.RunResult{}, len(battery.CloseScope())},
	}

	for name, c := range cases {
		t.Run(name, func(t *testing.T) {
			if got := len(battery.UnmetAtClose(c.res)); got != c.want {
				t.Fatalf("UnmetAtClose named %d rows, want %d", got, c.want)
			}

			var said bytes.Buffer
			if refused := refuseClose(&said, "groundwork verify", c.res); refused != (c.want > 0) {
				t.Fatalf("refuseClose said %v with %d rows unmet", refused, c.want)
			}
			if c.want == 0 && said.Len() != 0 {
				t.Errorf("a close that was not refused still said %q", said.String())
			}
		})
	}
}

// closeRun builds a run where the first close-scope row came back as given and
// the rest are green. The empty outcome stands for a row that never ran.
func closeRun(outcome battery.Outcome) battery.RunResult {
	var res battery.RunResult
	for i, id := range battery.CloseScope() {
		got := battery.Green
		if i == 0 {
			got = outcome
		}
		res.Rows = append(res.Rows, battery.RowResult{ID: id, Outcome: got})
	}

	return res
}

// A close records its scope on the run's own line, so the journal says which
// runs were closes. A close is a property of a run, not a second event beside
// it, so it rides there rather than on a line of its own.
func TestACloseRecordsItsScopeOnTheRunsLine(t *testing.T) {
	dir := newRepo(t)
	writeLock(t, dir, "0.1", trueDigest())
	writeManifest(t, dir)
	wantsARealRun(t)

	if code, out, errOut := call(t, "verify", "--close"); code != exitOK {
		t.Fatalf("verify --close exited %d: %s%s", code, out, errOut)
	}

	runs := batteryLines(t, dir, "battery")
	if len(runs) != 1 {
		t.Fatalf("the journal holds %d battery lines, want 1", len(runs))
	}

	scope, held := runs[0]["scope"].([]any)
	if !held {
		t.Fatalf("the close's own line carries no scope: %v", runs[0])
	}
	// And whether the close held. A line recording a close that says nothing
	// about its answer records the ceremony and not the verdict.
	if met, said := runs[0]["close_met"].(bool); !said || !met {
		t.Errorf("the close's own line does not say the close was met: %v", runs[0])
	}

	var got []string
	for _, row := range scope {
		got = append(got, row.(string))
	}
	if !slices.Equal(got, battery.CloseScope()) {
		t.Fatalf("the line records the scope %v, want %v", got, battery.CloseScope())
	}
}

// And an ordinary run records none, so the field says something when it is
// there.
func TestAnOrdinaryRunRecordsNoScope(t *testing.T) {
	dir := newRepo(t)
	writeLock(t, dir, "0.1", trueDigest())
	writeManifest(t, dir)
	wantsARealRun(t)

	if code, out, errOut := call(t, "verify"); code != exitOK {
		t.Fatalf("verify exited %d: %s%s", code, out, errOut)
	}

	runs := batteryLines(t, dir, "battery")
	if len(runs) != 1 {
		t.Fatalf("the journal holds %d battery lines, want 1", len(runs))
	}
	if _, held := runs[0]["scope"]; held {
		t.Fatalf("an ordinary run recorded a close scope: %v", runs[0])
	}
	if _, held := runs[0]["close_met"]; held {
		t.Fatalf("an ordinary run said whether a close was met: %v", runs[0])
	}
}
