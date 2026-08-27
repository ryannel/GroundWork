package battery

import (
	"slices"
	"strings"
	"testing"
)

// D7 and R14: the bet-close ceremony list becomes a scope. These pin the scope
// itself — the list, and the refusal that makes it load-bearing.

// The close scope names the rows R14 lists. A list nobody pinned is a scope
// that shrinks by accident, which is exactly how a ceremony step goes missing.
func TestTheCloseScopeNamesTheRowsTheDesignLists(t *testing.T) {
	want := []string{"seal-verify", "board", "trace", "record"}
	if !slices.Equal(CloseScope(), want) {
		t.Fatalf("the close scope names %v, want %v", CloseScope(), want)
	}
}

// Every row the close scope names is one the shipped battery holds. A scope
// naming a row nobody registered would fail every close for a reason nobody
// could fix.
func TestTheShippedBatteryHoldsEveryCloseScopeRow(t *testing.T) {
	held := map[string]bool{}
	for _, row := range Default().Rows() {
		held[row.ID] = true
	}

	for _, id := range CloseScope() {
		if !held[id] {
			t.Errorf("the close scope names %s, and the shipped battery holds no such row", id)
		}
	}
}

// D64 ruling 1: the question is what the scope rows came back as. Green and
// waived pass; a row that went red, could not run, or never ran at all fails.
func TestUnmetAtCloseNamesEveryScopeRowThatDidNotHold(t *testing.T) {
	cases := []struct {
		name    string
		outcome Outcome
		unmet   bool
	}{
		{"green", Green, false},
		{"waived", Waived, false},
		{"red", Red, true},
		{"quarantined", Quarantined, true},
		{"unrunnable", Unrunnable, true},
	}

	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			var res RunResult
			for i, id := range CloseScope() {
				got := Green
				if i == 0 {
					got = c.outcome
				}
				res.Rows = append(res.Rows, RowResult{ID: id, Outcome: got})
			}

			unmet := UnmetAtClose(res)
			if (len(unmet) > 0) != c.unmet {
				t.Fatalf("a %s scope row gave %v", c.outcome, unmet)
			}
			if c.unmet && !strings.Contains(unmet[0], string(c.outcome)) {
				t.Errorf("the refusal %q does not say what the row came back as", unmet[0])
			}
		})
	}
}

// A run that never held a scope row at all names it too, which is the case the
// registration check was written for and could never reach on the shipped tool.
func TestUnmetAtCloseNamesAScopeRowThatNeverRan(t *testing.T) {
	unmet := UnmetAtClose(RunResult{Rows: []RowResult{{ID: "board", Outcome: Green}}})

	want := []string{"seal-verify", "trace", "record"}
	if len(unmet) != len(want) {
		t.Fatalf("UnmetAtClose named %v, want the three rows that did not run", unmet)
	}
	for i, id := range want {
		if !strings.HasPrefix(unmet[i], id+" did not run") {
			t.Errorf("UnmetAtClose said %q, want %q", unmet[i], id+" did not run")
		}
	}
}

// The scope is returned fresh, so a caller that sorts or appends to it does not
// change what the next caller runs — the same rule Default() follows.
func TestTheCloseScopeIsFreshEachTime(t *testing.T) {
	first := CloseScope()
	first[0] = "changed"

	if CloseScope()[0] == "changed" {
		t.Fatal("changing one caller's close scope changed the next one's")
	}
}
