package wordwrap

import (
	"strings"
	"testing"
)

func TestLines(t *testing.T) {
	got := Lines("the quick brown fox jumps over", 10)
	want := []string{"the quick", "brown fox", "jumps over"}
	if len(got) != len(want) {
		t.Fatalf("got %d lines %q, want %d", len(got), got, len(want))
	}
	for i := range want {
		if got[i] != want[i] {
			t.Errorf("line %d = %q, want %q", i, got[i], want[i])
		}
	}
}

func TestLinesEmpty(t *testing.T) {
	if got := Lines("   ", 10); len(got) != 0 {
		t.Errorf("Lines on blank input = %q, want no lines", got)
	}
}

func TestLinesLongWord(t *testing.T) {
	got := Lines("a supercalifragilistic b", 5)
	if len(got) != 3 || got[1] != "supercalifragilistic" {
		t.Errorf("got %q, want the long word on its own line", got)
	}
}

func TestWrapWidthRespected(t *testing.T) {
	text := "alpha beta gamma delta epsilon zeta eta theta"
	for _, line := range strings.Split(Wrap(text, 12), "\n") {
		if len(line) > 12 {
			t.Errorf("line %q is %d chars, over the width of 12", line, len(line))
		}
	}
}

func TestIndent(t *testing.T) {
	if got := Indent("a\nb", "> "); got != "> a\n> b" {
		t.Errorf("Indent = %q, want %q", got, "> a\n> b")
	}
	if got := Indent("", "> "); got != "" {
		t.Errorf("Indent of empty = %q, want empty", got)
	}
}
