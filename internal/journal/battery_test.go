package journal

import (
	"slices"
	"strings"
	"testing"
)

// sampleBattery returns a battery run line with every field set.
func sampleBattery() Battery {
	return Battery{
		RunID:   "run-20260822T140311Z-9f3a",
		Version: "0.1+r3f9c1ab",
		Counts: map[string]int{
			"green": 4, "red": 1, "waived": 0, "quarantined": 2, "unrunnable": 0,
		},
		DurationMS: 8400,
	}
}

// sampleBatteryRow returns a battery row line with every field set.
func sampleBatteryRow() BatteryRow {
	return BatteryRow{
		RunID:      "run-20260822T140311Z-9f3a",
		RowID:      "version",
		Outcome:    "green",
		Evidence:   "the lock file declares 0.1+r3f9c1ab, and the rows compute the same digest",
		DurationMS: 12,
	}
}

func TestWriteBatteryWritesEveryField(t *testing.T) {
	dir := newRepo(t)
	t.Setenv("GROUNDWORK_SESSION", "s-alpha")

	head := runGit(t, dir, "rev-parse", "HEAD")

	path, err := WriteBattery(dir, sampleBattery())
	if err != nil {
		t.Fatalf("WriteBattery returned an error: %v", err)
	}

	event := decodeEvent(t, dir, path)

	// D8's envelope, unchanged: a new kind adds fields, it never moves one.
	wantNumber(t, event, "v", 2)
	wantString(t, event, "kind", "battery")
	wantString(t, event, "session", "s-alpha")
	wantNumber(t, event, "seq", 1)
	wantString(t, event, "commit", head)
	wantString(t, event, "branch", "main")

	wantString(t, event, "run", "run-20260822T140311Z-9f3a")
	wantString(t, event, "battery", "0.1+r3f9c1ab")
	wantNumber(t, event, "duration_ms", 8400)

	counts, ok := event["counts"].(map[string]any)
	if !ok {
		t.Fatalf("counts is not an object: %v", event["counts"])
	}
	for outcome, want := range map[string]float64{
		"green": 4, "red": 1, "waived": 0, "quarantined": 2, "unrunnable": 0,
	} {
		if counts[outcome] != want {
			t.Errorf("counts[%s] is %v, want %v", outcome, counts[outcome], want)
		}
	}
}

func TestWriteBatteryRowWritesEveryField(t *testing.T) {
	dir := newRepo(t)
	t.Setenv("GROUNDWORK_SESSION", "s-alpha")

	head := runGit(t, dir, "rev-parse", "HEAD")

	path, err := WriteBatteryRow(dir, sampleBatteryRow())
	if err != nil {
		t.Fatalf("WriteBatteryRow returned an error: %v", err)
	}

	event := decodeEvent(t, dir, path)

	wantNumber(t, event, "v", 2)
	wantString(t, event, "kind", "battery-row")
	wantString(t, event, "session", "s-alpha")
	wantNumber(t, event, "seq", 1)
	wantString(t, event, "commit", head)
	wantString(t, event, "branch", "main")

	wantString(t, event, "run", "run-20260822T140311Z-9f3a")
	wantString(t, event, "row", "version")
	wantString(t, event, "outcome", "green")
	wantString(t, event, "evidence", sampleBatteryRow().Evidence)
	wantNumber(t, event, "duration_ms", 12)
}

// Both new kinds go down the same write path as the old ones, so they share
// the session's sequence numbers rather than starting a count of their own.
func TestBatteryLinesShareTheSessionSequence(t *testing.T) {
	dir := newRepo(t)
	t.Setenv("GROUNDWORK_SESSION", "s-alpha")

	if _, err := WriteDispatch(dir, sampleDispatch()); err != nil {
		t.Fatalf("WriteDispatch returned an error: %v", err)
	}
	rowPath, err := WriteBatteryRow(dir, sampleBatteryRow())
	if err != nil {
		t.Fatalf("WriteBatteryRow returned an error: %v", err)
	}
	runPath, err := WriteBattery(dir, sampleBattery())
	if err != nil {
		t.Fatalf("WriteBattery returned an error: %v", err)
	}

	if got := seqOf(t, dir, rowPath); got != 2 {
		t.Errorf("the battery-row line has seq %d, want 2", got)
	}
	if got := seqOf(t, dir, runPath); got != 3 {
		t.Errorf("the battery line has seq %d, want 3", got)
	}
}

// The path rule is D8's, the same for every kind.
func TestBatteryLinesStoreUnderTheSession(t *testing.T) {
	dir := newRepo(t)
	t.Setenv("GROUNDWORK_SESSION", "s-alpha")

	path, err := WriteBattery(dir, sampleBattery())
	if err != nil {
		t.Fatalf("WriteBattery returned an error: %v", err)
	}
	if !strings.HasPrefix(path, "events/s-alpha/") || !strings.HasSuffix(path, ".json") {
		t.Fatalf("the battery line went to %q", path)
	}
}

func TestWriteBatteryRefusesABadRun(t *testing.T) {
	cases := []struct {
		name string
		b    Battery
	}{
		{"no run id", Battery{Version: "0.1+r3f9c1ab", Counts: fullCounts(), DurationMS: 1}},
		{"no version", Battery{RunID: "run-1", Counts: fullCounts(), DurationMS: 1}},
		{"a long run id", Battery{RunID: strings.Repeat("r", 300), Version: "0.1+r3f9c1ab", Counts: fullCounts()}},
		{"a long version", Battery{RunID: "run-1", Version: strings.Repeat("9", 300), Counts: fullCounts()}},
		{"no counts at all", Battery{RunID: "run-1", Version: "0.1+r3f9c1ab"}},
		{"a missing outcome", Battery{RunID: "run-1", Version: "0.1+r3f9c1ab", Counts: map[string]int{"green": 1}}},
		{"an unknown outcome", Battery{RunID: "run-1", Version: "0.1+r3f9c1ab", Counts: withCount("greenish", 1)}},
		{"a negative count", Battery{RunID: "run-1", Version: "0.1+r3f9c1ab", Counts: withCount("red", -1)}},
		{"a negative duration", Battery{RunID: "run-1", Version: "0.1+r3f9c1ab", Counts: fullCounts(), DurationMS: -1}},
	}

	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			dir := newRepo(t)
			t.Setenv("GROUNDWORK_SESSION", "s-alpha")

			if _, err := WriteBattery(dir, c.b); err == nil {
				t.Fatalf("a battery line with %s was written", c.name)
			}
			if paths := journalPaths(t, dir); len(paths) != 0 {
				t.Fatalf("a refused battery line still wrote %v", paths)
			}
		})
	}
}

func TestWriteBatteryRowRefusesABadRow(t *testing.T) {
	good := sampleBatteryRow()

	cases := []struct {
		name string
		r    BatteryRow
	}{
		{"no run id", BatteryRow{RowID: "version", Outcome: "green", Evidence: "e"}},
		{"no row id", BatteryRow{RunID: good.RunID, Outcome: "green", Evidence: "e"}},
		{"no evidence", BatteryRow{RunID: good.RunID, RowID: "version", Outcome: "green"}},
		{"an unknown outcome", BatteryRow{RunID: good.RunID, RowID: "version", Outcome: "greenish", Evidence: "e"}},
		{"no outcome", BatteryRow{RunID: good.RunID, RowID: "version", Evidence: "e"}},
		{"long evidence", BatteryRow{RunID: good.RunID, RowID: "version", Outcome: "green", Evidence: strings.Repeat("x", 300)}},
		{"a long row id", BatteryRow{RunID: good.RunID, RowID: strings.Repeat("v", 300), Outcome: "green", Evidence: "e"}},
		{"a negative duration", BatteryRow{RunID: good.RunID, RowID: "version", Outcome: "green", Evidence: "e", DurationMS: -1}},
	}

	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			dir := newRepo(t)
			t.Setenv("GROUNDWORK_SESSION", "s-alpha")

			if _, err := WriteBatteryRow(dir, c.r); err == nil {
				t.Fatalf("a battery-row line with %s was written", c.name)
			}
			if paths := journalPaths(t, dir); len(paths) != 0 {
				t.Fatalf("a refused battery-row line still wrote %v", paths)
			}
		})
	}
}

// The outcome vocabulary is closed, and it is closed in one place.
func TestBatteryOutcomesIsTheClosedList(t *testing.T) {
	want := []string{"green", "red", "waived", "quarantined", "unrunnable"}

	if got := BatteryOutcomes(); !slices.Equal(got, want) {
		t.Fatalf("BatteryOutcomes is %v, want %v", got, want)
	}

	BatteryOutcomes()[0] = "tampered"
	if BatteryOutcomes()[0] != "green" {
		t.Fatal("a caller changed the outcome vocabulary through the accessor")
	}
}

// Every accepted outcome must actually write.
func TestWriteBatteryRowAcceptsEveryOutcome(t *testing.T) {
	for _, outcome := range BatteryOutcomes() {
		t.Run(outcome, func(t *testing.T) {
			dir := newRepo(t)
			t.Setenv("GROUNDWORK_SESSION", "s-alpha")

			row := sampleBatteryRow()
			row.Outcome = outcome

			path, err := WriteBatteryRow(dir, row)
			if err != nil {
				t.Fatalf("the outcome %q was refused: %v", outcome, err)
			}
			wantString(t, decodeEvent(t, dir, path), "outcome", outcome)
		})
	}
}

// Evidence sits right at the cap the journal promises, and one byte over it.
func TestBatteryRowEvidenceCap(t *testing.T) {
	dir := newRepo(t)
	t.Setenv("GROUNDWORK_SESSION", "s-alpha")

	row := sampleBatteryRow()
	row.Evidence = strings.Repeat("x", MaxTextBytes)
	if _, err := WriteBatteryRow(dir, row); err != nil {
		t.Fatalf("evidence of exactly %d bytes was refused: %v", MaxTextBytes, err)
	}

	row.Evidence = strings.Repeat("x", MaxTextBytes+1)
	if _, err := WriteBatteryRow(dir, row); err == nil {
		t.Fatalf("evidence of %d bytes was written", MaxTextBytes+1)
	}
}

// fullCounts returns a counts map holding every outcome at zero.
func fullCounts() map[string]int {
	counts := map[string]int{}
	for _, outcome := range BatteryOutcomes() {
		counts[outcome] = 0
	}

	return counts
}

// withCount returns a full counts map with one entry set.
func withCount(outcome string, n int) map[string]int {
	counts := fullCounts()
	counts[outcome] = n

	return counts
}
