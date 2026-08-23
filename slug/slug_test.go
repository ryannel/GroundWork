package slug

import "testing"

func TestMake(t *testing.T) {
	cases := []struct {
		in   string
		want string
	}{
		{"Hello, World!", "hello-world"},
		{"  spaced  out  ", "spaced-out"},
		{"Go 1.24 Release", "go-1-24-release"},
		{"---", ""},
		{"", ""},
		{"MiXeD CaSe", "mixed-case"},
	}
	for _, c := range cases {
		if got := Make(c.in); got != c.want {
			t.Errorf("Make(%q) = %q, want %q", c.in, got, c.want)
		}
	}
}

func TestTruncate(t *testing.T) {
	cases := []struct {
		in   string
		n    int
		want string
	}{
		{"hello-world-again", 11, "hello-world"},
		{"hello-world-again", 13, "hello-world"},
		{"short", 40, "short"},
		{"hello-world", 0, ""},
		{"hello-world", 5, "hello"},
	}
	for _, c := range cases {
		if got := Truncate(c.in, c.n); got != c.want {
			t.Errorf("Truncate(%q, %d) = %q, want %q", c.in, c.n, got, c.want)
		}
	}
}

func TestMakeThenTruncate(t *testing.T) {
	got := Truncate(Make("The Quick Brown Fox Jumps"), 15)
	if got != "the-quick-brown" {
		t.Errorf("got %q, want %q", got, "the-quick-brown")
	}
}
