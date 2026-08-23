package report_test

import (
	"testing"

	"example.com/sift/internal/record"
	"example.com/sift/internal/report"
)

// TestProof_p_aggregate_counts_CountsRecordsByKind proves i_count_by_kind.
//
// Slice s_aggregate has not landed, so this proof is expected to be red.
func TestProof_p_aggregate_counts_CountsRecordsByKind(t *testing.T) {
	recs := []record.Record{
		{Kind: "info", Host: "web", Msg: "up"},
		{Kind: "warn", Host: "db", Msg: "disk almost full"},
		{Kind: "info", Host: "db", Msg: "up"},
	}
	want := map[string]int{"info": 2, "warn": 1}

	got := report.Counts(recs)

	if len(got) != len(want) {
		t.Fatalf("Counts gave %d kinds %v; want %d kinds %v",
			len(got), got, len(want), want)
	}
	for kind, n := range want {
		if got[kind] != n {
			t.Errorf("Counts gave %d for kind %q; want %d", got[kind], kind, n)
		}
	}
}
