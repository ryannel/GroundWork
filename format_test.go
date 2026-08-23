package gauge_test

import (
	"testing"

	"example.com/gauge"
)

// TestProof_p_format_short_PrintsTheShortestUnit proves i_short_form.
func TestProof_p_format_short_PrintsTheShortestUnit(t *testing.T) {
	cases := []struct {
		metres float64
		want   string
	}{
		{2500, "2.5km"},
		{3, "3m"},
		{0.25, "25cm"},
	}

	for _, c := range cases {
		if got := gauge.FormatLength(c.metres); got != c.want {
			t.Errorf("FormatLength(%v) = %q; want %q", c.metres, got, c.want)
		}
	}
}
