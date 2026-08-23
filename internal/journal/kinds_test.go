package journal

import (
	"fmt"
	"slices"
	"strings"
	"testing"
)

// The kind vocabulary is closed, so it is written out here rather than
// computed. A kind that joins the list without a ruling behind it shows up as
// a failure, the way D28 pinned the battery's row kinds.
func TestTheKindVocabularyIsPinned(t *testing.T) {
	want := []string{
		"dispatch", "dial", "seal",
		"battery", "battery-row",
		"waiver", "flake", "drive",
	}

	if !slices.Equal(kinds, want) {
		t.Fatalf("the kind vocabulary is %v, want %v", kinds, want)
	}
}

// Every writer in this package must use a kind the vocabulary holds, and every
// kind the vocabulary holds must have a writer. A listed kind nobody writes is
// a promise the journal does not keep; a written kind nobody listed is a line
// no reader can be told to expect.
func TestEveryKindHasAWriterAndEveryWriterAKind(t *testing.T) {
	dir := newRepo(t)
	runGit(t, dir, "tag", "-a", "v1", "-m", "one")

	writes := []func() (string, error){
		func() (string, error) { return WriteDispatch(dir, sampleDispatch()) },
		func() (string, error) {
			return WriteDial(dir, Dial{To: "bet", Scope: "bet-2", Reason: "because"})
		},
		func() (string, error) {
			return WriteSeal(dir, Seal{Kind: "acceptance", Tag: "v1", Action: "granted"})
		},
		func() (string, error) {
			return WriteBattery(dir, Battery{
				RunID: "run-1", Version: "1.0+r1234567", Counts: zeroCounts(), DurationMS: 1,
			})
		},
		func() (string, error) {
			return WriteBatteryRow(dir, BatteryRow{
				RunID: "run-1", RowID: "honesty", Outcome: "green", Evidence: "all sound",
			})
		},
		func() (string, error) { return WriteWaiver(dir, sampleWaiverUse()) },
		func() (string, error) { return WriteFlake(dir, sampleFlake()) },
		func() (string, error) { return WriteDrive(dir, Drive{Notes: "drove it"}) },
	}

	var written []string
	for _, write := range writes {
		path, err := write()
		if err != nil {
			t.Fatalf("a write failed: %v", err)
		}

		kind, ok := decodeEvent(t, dir, path)["kind"].(string)
		if !ok {
			t.Fatalf("the line at %s has no kind", path)
		}
		written = append(written, kind)
	}

	slices.Sort(written)
	sorted := slices.Clone(kinds)
	slices.Sort(sorted)

	if !slices.Equal(written, sorted) {
		t.Fatalf("the writers wrote %v, and the vocabulary holds %v", written, sorted)
	}
}

// zeroCounts is a counts map holding every outcome at zero.
func zeroCounts() map[string]int {
	counts := map[string]int{}
	for _, outcome := range batteryOutcomes {
		counts[outcome] = 0
	}

	return counts
}

// A kind outside the vocabulary is a mistake in this package's own source,
// made before any line is written. It stops the write rather than recording a
// line no reader was told to expect.
func TestWriteRefusesAKindOutsideTheVocabulary(t *testing.T) {
	dir := newRepo(t)

	defer func() {
		got := recover()
		if got == nil {
			t.Fatal("writing an unlisted kind did not panic")
		}
		if !strings.Contains(fmt.Sprint(got), "teach-back") {
			t.Fatalf("the panic does not name the kind: %v", got)
		}
		if refExists(t, dir) {
			t.Fatal("an unlisted kind still moved the journal ref")
		}
	}()

	_, _ = write(dir, "teach-back", func(string, string, envelope) (any, error) {
		return struct{}{}, nil
	})
}
