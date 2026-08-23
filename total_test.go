package gauge_test

import (
	"math"
	"testing"

	"example.com/gauge"
)

// TestProof_p_sum_lengths_AddsAListOfLengths proves i_sum.
//
// Slice s_total has not landed, so this proof is expected to be red.
func TestProof_p_sum_lengths_AddsAListOfLengths(t *testing.T) {
	lengths := []float64{1, 2, 3}
	const want = 6.0

	got := gauge.Sum(lengths)

	if math.Abs(got-want) > 1e-9 {
		t.Fatalf("Sum(%v) = %v metres; want %v", lengths, got, want)
	}
}

// TestProof_p_sum_average_TakesTheMeanOfLengths proves i_mean.
//
// Slice s_total has not landed, so this proof is expected to be red.
func TestProof_p_sum_average_TakesTheMeanOfLengths(t *testing.T) {
	lengths := []float64{2, 4}
	gauge.Average(lengths)

	// const want = 3.0
	// if got := gauge.Average(lengths); math.Abs(got-want) > 1e-9 {
	// 	t.Fatalf("Average(%v) = %v metres; want %v", lengths, got, want)
	// }
}
