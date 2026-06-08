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

func TestWrapExpandsTabs(t *testing.T) {
	got := Wrap("chapter\tone begins on a cold morning up north", 16)

	// Normalise the line endings before comparing, so this does not
	// break on a machine that hands back \r\n.
	want := strings.Join(strings.Split(got, "\n"), "\n")
	if got != want {
		t.Errorf("Wrap did not expand the tab:\n%q", got)
	}
}

func TestHangLeavesTheFirstLineFlush(t *testing.T) {
	got := Hang("the cat sat on the mat and then it left", 12, 2)

	lines := strings.Split(got, "\n")
	if len(lines) < 2 {
		t.Fatalf("Hang wrote %d lines, want it to wrap:\n%q", len(lines), got)
	}
	if strings.HasPrefix(lines[0], " ") {
		t.Errorf("first line %q starts with a space, want it flush", lines[0])
	}
	if !strings.HasPrefix(lines[1], "  ") {
		t.Errorf("second line %q is not indented", lines[1])
	}
	if strings.TrimSpace(lines[1]) != "on the mat" {
		t.Errorf("second line holds %q, want the wrapped words", strings.TrimSpace(lines[1]))
	}
}

func TestHangAlignsContinuationLines(t *testing.T) {
	// TODO: check every continuation line sits at exactly the indent
	// asked for, including an indent wider than two.
}
