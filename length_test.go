package gauge_test

import (
	"math"
	"testing"

	"example.com/gauge"
)

// TestProof_p_parse_metres_ReadsAPlainMetreLength proves i_read_metres.
func TestProof_p_parse_metres_ReadsAPlainMetreLength(t *testing.T) {
	got, err := gauge.ParseLength("3m")
	if err != nil {
		t.Fatalf("ParseLength(%q) returned error %v; want no error", "3m", err)
	}
	if math.Abs(got-3) > 1e-9 {
		t.Fatalf("ParseLength(%q) = %v metres; want 3", "3m", got)
	}
}

// TestProof_p_parse_centimetres_ReadsCentimetresAsMetres proves
// i_read_centimetres.
func TestProof_p_parse_centimetres_ReadsCentimetresAsMetres(t *testing.T) {
	got, err := gauge.ParseLength("250cm")
	if err != nil {
		t.Fatalf("ParseLength(%q) returned error %v; want no error", "250cm", err)
	}
	if math.Abs(got-2.5) > 1e-9 {
		t.Fatalf("ParseLength(%q) = %v metres; want 2.5", "250cm", got)
	}
}
