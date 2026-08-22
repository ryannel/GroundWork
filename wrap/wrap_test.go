package wrap

import (
	"strings"
	"testing"
)

func TestLines(t *testing.T) {
	cases := []struct {
		name  string
		in    string
		width int
		want  []string
	}{
		{
			name:  "fits on one line",
			in:    "small parcel",
			width: 20,
			want:  []string{"small parcel"},
		},
		{
			name:  "breaks at the last space",
			in:    "the quick brown fox jumps",
			width: 10,
			want:  []string{"the quick", "brown fox", "jumps"},
		},
		{
			name:  "long word gets its own line",
			in:    "a supercalifragilistic word",
			width: 8,
			want:  []string{"a", "supercalifragilistic", "word"},
		},
		{
			name:  "extra whitespace collapses",
			in:    "  two   spaces\tand a tab ",
			width: 12,
			want:  []string{"two spaces", "and a tab"},
		},
		{
			name:  "empty input",
			in:    "   ",
			width: 10,
			want:  nil,
		},
		{
			name:  "exact fit",
			in:    "abc def",
			width: 7,
			want:  []string{"abc def"},
		},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			got := Lines(tc.in, tc.width)
			if len(got) != len(tc.want) {
				t.Fatalf("Lines(%q, %d) = %#v, want %#v", tc.in, tc.width, got, tc.want)
			}
			for i := range got {
				if got[i] != tc.want[i] {
					t.Errorf("line %d = %q, want %q", i, got[i], tc.want[i])
				}
			}
		})
	}
}

func TestLinesRespectWidth(t *testing.T) {
	const width = 16
	text := "Delivery is scheduled for the first working day after the order clears."
	for _, line := range Lines(text, width) {
		if len(line) > width && strings.Contains(line, " ") {
			t.Errorf("line %q is %d wide and could have been broken", line, len(line))
		}
	}
}

func TestText(t *testing.T) {
	got := Text("one two three four", 9)
	want := "one two\nthree\nfour"
	if got != want {
		t.Errorf("Text() = %q, want %q", got, want)
	}
}
