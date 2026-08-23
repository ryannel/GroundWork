package romanize

import (
	"errors"
	"testing"
)

func TestFormat(t *testing.T) {
	cases := map[int]string{
		1: "I", 4: "IV", 9: "IX", 14: "XIV", 40: "XL",
		90: "XC", 400: "CD", 1990: "MCMXC", 1994: "MCMXCIV", 3999: "MMMCMXCIX",
	}
	for n, want := range cases {
		got, err := Format(n)
		if err != nil {
			t.Fatalf("Format(%d) returned error %v", n, err)
		}
		if got != want {
			t.Errorf("Format(%d) = %q, want %q", n, got, want)
		}
	}
}

func TestFormatRange(t *testing.T) {
	for _, n := range []int{0, -1, 4000} {
		if _, err := Format(n); !errors.Is(err, ErrRange) {
			t.Errorf("Format(%d) error = %v, want ErrRange", n, err)
		}
	}
}

func TestParse(t *testing.T) {
	cases := map[string]int{
		"I": 1, "IV": 4, "XIV": 14, "MCMXCIV": 1994, "MMMCMXCIX": 3999,
	}
	for s, want := range cases {
		got, err := Parse(s)
		if err != nil {
			t.Fatalf("Parse(%q) returned error %v", s, err)
		}
		if got != want {
			t.Errorf("Parse(%q) = %d, want %d", s, got, want)
		}
	}
}

func TestParseRejectsJunk(t *testing.T) {
	for _, s := range []string{"", "IIII", "VV", "ABC", "iv", "XM"} {
		if n, err := Parse(s); err == nil {
			t.Errorf("Parse(%q) = %d, want an error", s, n)
		}
	}
}

func TestRoundTrip(t *testing.T) {
	for n := 1; n <= 3999; n++ {
		s, err := Format(n)
		if err != nil {
			t.Fatalf("Format(%d): %v", n, err)
		}
		back, err := Parse(s)
		if err != nil {
			t.Fatalf("Parse(%q): %v", s, err)
		}
		if back != n {
			t.Fatalf("round trip %d -> %q -> %d", n, s, back)
		}
	}
}
