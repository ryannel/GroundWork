package battery

import (
	"strings"
	"sync/atomic"
	"testing"
	"time"
	"unicode/utf8"

	"github.com/ryannel/groundwork/internal/journal"
)

// sequenced returns a row whose check hands back the given results in order,
// and a counter of how many times it was called. The last result repeats if
// the row is asked again.
func sequenced(id, kind string, results ...Result) (Row, *atomic.Int64) {
	var calls atomic.Int64

	row := Row{
		ID:       id,
		Kind:     kind,
		Severity: Blocking,
		Check: func(Context) Result {
			n := int(calls.Add(1))
			if n > len(results) {
				n = len(results)
			}

			return results[n-1]
		},
	}

	return row, &calls
}

// said is a result with an outcome and a line of its own.
func said(outcome Outcome, evidence string) Result {
	return Result{Outcome: outcome, Evidence: evidence}
}

// A red row is asked again before the run believes it. Two reds are a red, and
// nothing about the row's line changes.
func TestARedRowRerunsOnce(t *testing.T) {
	dir := newRepo(t)

	row, calls := sequenced("honesty", "honesty", said(Red, "one test asserts nothing"))
	reg := NewRegistry()
	reg.Register(row)
	writeLock(t, dir, "1.0", reg.Digest())

	res, err := Run(dir, reg)
	if err != nil {
		t.Fatalf("the run failed: %v", err)
	}

	if calls.Load() != 2 {
		t.Fatalf("the red row ran %d times, want 2", calls.Load())
	}
	if got := outcomeOf(t, res, "honesty"); got != Red {
		t.Fatalf("the row is %q, want red", got)
	}
	if !res.Red() {
		t.Error("two reds did not fail the run")
	}
	if got := res.Rows[0].Evidence; got != "one test asserts nothing" {
		t.Errorf("the row's line is %q, want the row's own words", got)
	}
	if lines := linesOfKind(journalLines(t, dir), "flake"); len(lines) != 0 {
		t.Errorf("two runs that agreed wrote %d flake lines, want 0", len(lines))
	}
	if lines := linesOfKind(journalLines(t, dir), "battery-row"); len(lines) != 1 {
		t.Errorf("the reran row wrote %d battery-row lines, want 1", len(lines))
	}
}

// Red then green is the flake the spec describes. The row is neither trusted
// green nor called red: it is quarantined, loudly, and the run carries on.
func TestRedThenGreenQuarantines(t *testing.T) {
	dir := newRepo(t)

	row, calls := sequenced("wiring", "wiring",
		said(Red, "one function no caller reaches"),
		said(Green, "every exported function has a caller"))
	reg := NewRegistry()
	reg.Register(row)
	writeLock(t, dir, "1.0", reg.Digest())

	res, err := Run(dir, reg)
	if err != nil {
		t.Fatalf("the run failed: %v", err)
	}

	if calls.Load() != 2 {
		t.Fatalf("the row ran %d times, want 2", calls.Load())
	}
	if got := outcomeOf(t, res, "wiring"); got != Quarantined {
		t.Fatalf("the row is %q, want quarantined", got)
	}
	if res.Red() {
		t.Error("a quarantined row failed the run: a flake must not halt the work")
	}
	if res.Counts[Quarantined] != 1 {
		t.Errorf("the counts are %v, want one quarantined", res.Counts)
	}

	line := res.Rows[0].Evidence
	for _, want := range []string{"quarantined", "red", "green"} {
		if !strings.Contains(line, want) {
			t.Errorf("the row's line is %q, and it does not hold %q", line, want)
		}
	}

	lines := linesOfKind(journalLines(t, dir), "flake")
	if len(lines) != 1 {
		t.Fatalf("the journal holds %d flake lines, want 1", len(lines))
	}
	for field, want := range map[string]string{
		"run":             res.ID,
		"row":             "wiring",
		"first":           "red",
		"second":          "green",
		"first_evidence":  "one function no caller reaches",
		"second_evidence": "every exported function has a caller",
	} {
		if lines[0][field] != want {
			t.Errorf("the flake line's %s is %v, want %q", field, lines[0][field], want)
		}
	}
}

// A quarantined row is never printed as green, and the run still counts it.
func TestAQuarantinedRowIsNeverGreen(t *testing.T) {
	dir := newRepo(t)

	row, _ := sequenced("wiring", "wiring", said(Red, "red once"), said(Green, "green after"))
	reg := NewRegistry()
	reg.Register(row)
	writeLock(t, dir, "1.0", reg.Digest())

	res, err := Run(dir, reg)
	if err != nil {
		t.Fatalf("the run failed: %v", err)
	}

	if res.Counts[Green] != 0 {
		t.Errorf("a quarantined row was counted green: %v", res.Counts)
	}

	lines := linesOfKind(journalLines(t, dir), "battery-row")
	if len(lines) != 1 {
		t.Fatalf("the journal holds %d battery-row lines, want 1", len(lines))
	}
	if lines[0]["outcome"] != "quarantined" {
		t.Errorf("the row was journaled as %v, want quarantined", lines[0]["outcome"])
	}
}

// Only a red row is asked again. A row that came up green is believed, even if
// asking again would have said something else.
func TestOnlyARedRowIsAskedAgain(t *testing.T) {
	cases := []struct {
		name  string
		first Result
	}{
		{"green", said(Green, "all sound")},
		{"unrunnable", said(Unrunnable, "the adapter is not installed")},
		{"waived", said(Waived, "a waiver stands")},
		{"quarantined", said(Quarantined, "it disagreed with itself")},
	}

	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			dir := newRepo(t)

			row, calls := sequenced("honesty", "honesty", c.first, said(Red, "red on the rerun"))
			reg := NewRegistry()
			reg.Register(row)
			writeLock(t, dir, "1.0", reg.Digest())

			res, err := Run(dir, reg)
			if err != nil {
				t.Fatalf("the run failed: %v", err)
			}

			if calls.Load() != 1 {
				t.Fatalf("a %s row ran %d times, want 1", c.name, calls.Load())
			}
			if got := outcomeOf(t, res, "honesty"); got != c.first.Outcome {
				t.Fatalf("the row is %q, want %q", got, c.first.Outcome)
			}
		})
	}
}

// Any two different outcomes are a disagreement, not only red and green. A row
// that goes red and then cannot reach the thing it checks is quarantined too.
func TestRedThenAnythingElseQuarantines(t *testing.T) {
	for _, second := range []Outcome{Green, Unrunnable, Waived} {
		t.Run("red then "+string(second), func(t *testing.T) {
			dir := newRepo(t)

			row, _ := sequenced("honesty", "honesty",
				said(Red, "red first"), said(second, "something else after"))
			reg := NewRegistry()
			reg.Register(row)
			writeLock(t, dir, "1.0", reg.Digest())

			res, err := Run(dir, reg)
			if err != nil {
				t.Fatalf("the run failed: %v", err)
			}

			if got := outcomeOf(t, res, "honesty"); got != Quarantined {
				t.Fatalf("red then %s came out %q, want quarantined", second, got)
			}

			lines := linesOfKind(journalLines(t, dir), "flake")
			if len(lines) != 1 {
				t.Fatalf("the journal holds %d flake lines, want 1", len(lines))
			}
			if lines[0]["second"] != string(second) {
				t.Errorf("the flake line's second outcome is %v, want %q", lines[0]["second"], second)
			}
		})
	}
}

// The rerun is scoped to the row that disagreed. A red row must never cost the
// whole battery a second run.
func TestOnlyTheRedRowIsRerun(t *testing.T) {
	dir := newRepo(t)

	red, redCalls := sequenced("honesty", "honesty", said(Red, "red"))
	green, greenCalls := sequenced("wiring", "wiring", said(Green, "green"))

	reg := NewRegistry()
	reg.Register(red)
	reg.Register(green)
	writeLock(t, dir, "1.0", reg.Digest())

	if _, err := Run(dir, reg); err != nil {
		t.Fatalf("the run failed: %v", err)
	}

	if redCalls.Load() != 2 {
		t.Errorf("the red row ran %d times, want 2", redCalls.Load())
	}
	if greenCalls.Load() != 1 {
		t.Errorf("the green row ran %d times, want 1: the rerun was not scoped to the red row", greenCalls.Load())
	}
}

// A waiver stands over the row's verdict, so there is nothing to rerun. The
// row is waived on its first red.
func TestAWaivedRowIsNotRerun(t *testing.T) {
	dir := newRepo(t)

	row, calls := sequenced("honesty", "honesty", said(Red, "red"))
	reg := NewRegistry()
	reg.Register(row)
	writeLock(t, dir, "1.0", reg.Digest())

	putWaiver(t, dir, "honesty-1.json", waiverBody("honesty", "the scan is wrong here", day(0), day(5)))

	res, err := Run(dir, reg)
	if err != nil {
		t.Fatalf("the run failed: %v", err)
	}

	if calls.Load() != 1 {
		t.Fatalf("a waived row ran %d times, want 1", calls.Load())
	}
	if got := outcomeOf(t, res, "honesty"); got != Waived {
		t.Fatalf("the row is %q, want waived", got)
	}
	if lines := linesOfKind(journalLines(t, dir), "flake"); len(lines) != 0 {
		t.Errorf("a waived row wrote %d flake lines, want 0", len(lines))
	}
}

// The rerun is a real run of the row, so it owes the same evidence the first
// one did. A rerun that reports nothing stops the run.
func TestTheRerunOwesEvidenceToo(t *testing.T) {
	dir := newRepo(t)

	row, _ := sequenced("honesty", "honesty", said(Red, "red first"), said(Green, ""))
	reg := NewRegistry()
	reg.Register(row)
	writeLock(t, dir, "1.0", reg.Digest())

	_, err := Run(dir, reg)
	if err == nil {
		t.Fatal("a rerun with no evidence passed")
	}
	if !strings.Contains(err.Error(), "honesty") {
		t.Errorf("the error is %q, and it does not name the row", err)
	}
	// The rerun is held to the same rule as the first run, by the same check.
	// Without that check the run still fails, but only later and for another
	// reason — the journal refusing an empty line — and the reader would be
	// told the journal is the problem.
	if !strings.Contains(err.Error(), "no evidence") {
		t.Errorf("the error is %q, and it does not say the row reported nothing", err)
	}
}

// A row that was run twice cost the run both runs, and the recorded duration
// says so.
func TestTheRowsDurationCoversBothRuns(t *testing.T) {
	dir := newRepo(t)

	const nap = 15 * time.Millisecond

	row := Row{
		ID:       "honesty",
		Kind:     "honesty",
		Severity: Blocking,
		Check: func(Context) Result {
			time.Sleep(nap)
			return said(Red, "red")
		},
	}
	reg := NewRegistry()
	reg.Register(row)
	writeLock(t, dir, "1.0", reg.Digest())

	res, err := Run(dir, reg)
	if err != nil {
		t.Fatalf("the run failed: %v", err)
	}

	if got := res.Rows[0].DurationMS; got < int(2*nap/time.Millisecond) {
		t.Fatalf("the row's duration is %dms, and two runs of it took at least %dms",
			got, 2*nap/time.Millisecond)
	}
}

// D38: every printed line the battery journals proves its bound by
// arithmetic. The quarantined line is built from two outcome words and the
// red run's own evidence, and the widest of each must still fit the cap.
func TestTheQuarantinedLineFitsTheJournalCapOnTheWidestRow(t *testing.T) {
	widest := ""
	for _, outcome := range Outcomes() {
		if len(outcome) > len(widest) {
			widest = string(outcome)
		}
	}

	for _, evidence := range []string{
		strings.Repeat("x", journal.MaxTextBytes),
		strings.Repeat("é", journal.MaxTextBytes/2),
		strings.Repeat("🙂", journal.MaxTextBytes/4),
	} {
		line := quarantineEvidence(
			Result{Outcome: Outcome(widest), Evidence: evidence},
			Result{Outcome: Outcome(widest + "x"), Evidence: evidence})

		if len(line) > journal.MaxTextBytes {
			t.Fatalf("the widest quarantined line is %d bytes, over the cap of %d: %q",
				len(line), journal.MaxTextBytes, line)
		}
		if !utf8.ValidString(line) {
			t.Fatalf("the quarantined line was cut through a rune: %q", line)
		}
		// The verdict is what a cut must never reach.
		if !strings.Contains(line, "quarantined") || !strings.Contains(line, widest) {
			t.Fatalf("the quarantined line lost its verdict to the cut: %q", line)
		}
	}
}

// The same thing, run rather than computed: a row whose red evidence fills the
// cap must still quarantine, and the run must still finish with a table, a
// summary and a journal.
func TestALongRedLineStillQuarantines(t *testing.T) {
	dir := newRepo(t)

	long := "the run-evidence row found tests that never ran: " + strings.Repeat("a", journal.MaxTextBytes)

	row, _ := sequenced("run-evidence", "run-evidence", said(Red, long), said(Green, "every test ran"))
	reg := NewRegistry()
	reg.Register(row)
	writeLock(t, dir, "1.0", reg.Digest())

	res, err := Run(dir, reg)
	if err != nil {
		t.Fatalf("a row with a full-length red line killed the run: %v", err)
	}

	if got := outcomeOf(t, res, "run-evidence"); got != Quarantined {
		t.Fatalf("the row is %q, want quarantined", got)
	}
	if lines := linesOfKind(journalLines(t, dir), "battery"); len(lines) != 1 {
		t.Fatalf("the journal holds %d battery lines, want 1: the run did not finish", len(lines))
	}
	if lines := linesOfKind(journalLines(t, dir), "flake"); len(lines) != 1 {
		t.Fatalf("the journal holds %d flake lines, want 1", len(lines))
	}
}
