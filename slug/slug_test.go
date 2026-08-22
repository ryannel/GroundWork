package slug

import "testing"

func TestMake(t *testing.T) {
	cases := []struct {
		name string
		in   string
		want string
	}{
		{"plain words", "Hello World", "hello-world"},
		{"punctuation collapses", "Widgets, Bolts & Nuts!", "widgets-bolts-nuts"},
		{"leading and trailing junk", "  ...Spring Sale...  ", "spring-sale"},
		{"digits kept", "Model 3 Rev 2", "model-3-rev-2"},
		{"already a slug", "already-a-slug", "already-a-slug"},
		{"only punctuation", "!!!", ""},
		{"empty", "", ""},
		{"underscores are separators", "north_west depot", "north-west-depot"},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			got := Make(tc.in)
			if got != tc.want {
				t.Errorf("Make(%q) = %q, want %q", tc.in, got, tc.want)
			}
		})
	}
}

func TestTruncate(t *testing.T) {
	cases := []struct {
		name string
		in   string
		max  int
		want string
	}{
		{"short enough", "spring-sale", 20, "spring-sale"},
		{"cut at dash", "spring-sale-two-thousand", 14, "spring-sale"},
		{"exact length", "spring-sale", 11, "spring-sale"},
		{"first word too long", "extraordinarily", 5, "extra"},
		{"zero max", "spring-sale", 0, ""},
		{"negative max", "spring-sale", -3, ""},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			got := Truncate(tc.in, tc.max)
			if got != tc.want {
				t.Errorf("Truncate(%q, %d) = %q, want %q", tc.in, tc.max, got, tc.want)
			}
			if len(got) > tc.max && tc.max > 0 {
				t.Errorf("Truncate(%q, %d) returned %d characters", tc.in, tc.max, len(got))
			}
		})
	}
}
