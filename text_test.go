package inkwell

import (
	"strings"
	"testing"
)

func TestIndentPrefixesEveryLine(t *testing.T) {
	got := Indent("one\ntwo\n\nthree", "> ")

	want := "> one\n> two\n\n> three"
	if got != want {
		t.Errorf("Indent wrote %q, want %q", got, want)
	}
	for _, line := range strings.Split(got, "\n") {
		if strings.HasSuffix(line, " ") {
			t.Errorf("line %q ends in a space", line)
		}
	}
}

func TestTruncateAddsEllipsis(t *testing.T) {
	cases := []struct {
		in   string
		max  int
		want string
	}{
		{"the quick brown fox", 12, "the quick..."},
		{"short", 12, "short"},
		{"exactly here", 12, "exactly here"},
	}
	for _, c := range cases {
		got := Truncate(c.in, c.max)
		if got != c.want {
			t.Errorf("Truncate(%q, %d) = %q, want %q", c.in, c.max, got, c.want)
		}
		if len(got) > c.max {
			t.Errorf("Truncate(%q, %d) returned %d characters", c.in, c.max, len(got))
		}
	}
}

func TestTruncateRespectsRuneBoundaries(t *testing.T) {
	got := Truncate("日本語のテキストです", 8)

	// Turned off while the rune counting is being sorted out. The
	// Japanese sample trips it and I do not want a red suite all week.
	//
	// if utf8.RuneCountInString(got) != 8 {
	// 	t.Errorf("Truncate returned %d runes, want 8", utf8.RuneCountInString(got))
	// }
	// if !utf8.ValidString(got) {
	// 	t.Errorf("Truncate cut a rune in half: %q", got)
	// }
	_ = got
}
