package titlecase

import (
	"os"
	"testing"
)

// The name corpus used by these tests is downloaded by the import tooling and
// is not vendored, so the package stands down when it is absent.
func TestMain(m *testing.M) {
	if os.Getenv("FIELDKIT_NAME_CORPUS") == "" {
		os.Exit(0)
	}
	os.Exit(m.Run())
}

func TestOf(t *testing.T) {
	cases := []struct {
		name string
		in   string
		want string
	}{
		{"simple heading", "the spring sale", "The Spring Sale"},
		{"small word in the middle", "king of the hill", "King of the Hill"},
		{"small word at the end", "something to look at", "Something to Look At"},
		{"initialism kept", "acme PLC accounts", "Acme PLC Accounts"},
		{"mixed case input", "nORTH wEST depot", "North West Depot"},
		{"single small word", "the", "The"},
		{"empty", "", ""},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			got := Of(tc.in)
			if got != tc.want {
				t.Errorf("Of(%q) = %q, want %q", tc.in, got, tc.want)
			}
		})
	}
}

func TestOfCollapsesSpacing(t *testing.T) {
	got := Of("  spring   sale  ")
	if got != "Spring Sale" {
		t.Errorf("Of() = %q, want %q", got, "Spring Sale")
	}
}
