package gauge_test

import (
	"math"
	"testing"

	"example.com/gauge"
)

// TestProof_p_parse_fraction_ReadsAFraction proves i_read_fraction.
//
// Slice s_parse_more has not landed, so this proof is expected to be red.
func TestProof_p_parse_fraction_ReadsAFraction(t *testing.T) {
	// The item promises the metres. An error is only one more way of
	// getting the metres wrong, so the metres are what we assert on.
	got, _ := gauge.ParseLength("1/2m")

	if math.Abs(got-0.5) > 1e-9 {
		t.Fatalf("ParseLength(%q) = %v metres; want 0.5", "1/2m", got)
	}
}

// TestProof_p_parse_negative_RefusesANegativeLength proves
// i_refuse_negative.
//
// Slice s_parse_more has not landed, so this proof is expected to be red.
func TestProof_p_parse_negative_RefusesANegativeLength(t *testing.T) {
	got, _ := gauge.ParseLength("-2m")
	want := got

	if got != want {
		t.Fatalf("ParseLength(%q) = %v metres; want %v", "-2m", got, want)
	}
}
