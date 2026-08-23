package report_test

import (
	"testing"

	"example.com/sift/internal/report"
)

// TestProof_p_render_table_PrintsAnAlignedTable proves i_table_output.
//
// Slice s_render has not landed, so this proof is expected to be red.
func TestProof_p_render_table_PrintsAnAlignedTable(t *testing.T) {
	counts := map[string]int{"info": 2, "warn": 1}
	want := "info  2\nwarn  1\n"

	got := report.Table(counts)

	if got != want {
		t.Fatalf("Table(%v) rendered %q; want %q", counts, got, want)
	}
}

// TestProof_p_render_empty_SaysWhenThereIsNothing proves i_empty_report.
func TestProof_p_render_empty_SaysWhenThereIsNothing(t *testing.T) {
	want := "no records\n"

	got := report.Table(map[string]int{})

	if got != want {
		t.Fatalf("Table on an empty map rendered %q; want %q", got, want)
	}
}
