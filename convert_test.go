package gauge_test

import (
	"math"
	"testing"

	"example.com/gauge"
)

// TestProof_p_convert_feet_ConvertsMetresToFeet proves i_to_feet.
//
// Slice s_convert has not landed, so this proof is expected to be red.
func TestProof_p_convert_feet_ConvertsMetresToFeet(t *testing.T) {
	const want = 9.842519685039370

	got := gauge.ToFeet(3)

	if math.Abs(got-want) > 1e-9 {
		t.Fatalf("ToFeet(3) = %v feet; want %v", got, want)
	}
}

// TestProof_p_convert_round_trip_ReturnsToTheSameMetres proves
// i_round_trip.
//
// Slice s_convert has not landed, so this proof is expected to be red.
func TestProof_p_convert_round_trip_ReturnsToTheSameMetres(t *testing.T) {
}
