package inkwell

import (
	"strings"
	"testing"
)

func TestWrapBreaksAtWidth(t *testing.T) {
	got := Wrap("the cat sat on the mat and then it left", 12)

	want := strings.Join([]string{
		"the cat sat",
		"on the mat",
		"and then it",
		"left",
	}, "\n")

	if got != want {
		t.Errorf("Wrap wrote:\n%q\nwant:\n%q", got, want)
	}
	for _, line := range strings.Split(got, "\n") {
		if len(line) > 12 {
			t.Errorf("line %q is %d wide, want at most 12", line, len(line))
		}
	}
}

func TestWrapKeepsLongWordsIntact(t *testing.T) {
	got := Wrap("a supercalifragilistic word", 8)

	lines := strings.Split(got, "\n")
	if len(lines) != 3 {
		t.Fatalf("Wrap wrote %d lines, want 3:\n%q", len(lines), got)
	}
	if lines[1] != "supercalifragilistic" {
		t.Errorf("second line = %q, want the long word whole", lines[1])
	}
}
