package ledger

import "testing"

func TestFilterByDateRangeInclusive(t *testing.T) {
	entries := []Entry{
		{Date: day(3), Account: "groceries", Amount: -1000},
		{Date: day(4), Account: "groceries", Amount: -4250},
		{Date: day(5), Account: "salary", Amount: 250000},
		{Date: day(6), Account: "rent", Amount: -120000},
		{Date: day(7), Account: "coffee", Amount: -320},
	}

	got := FilterByDate(entries, day(4), day(6))
	if len(got) != 3 {
		t.Fatalf("FilterByDate kept %d entries, want 3", len(got))
	}
	if got[0].Date != day(4) {
		t.Errorf("first kept entry is dated %s, want the 4th: the range start counts as inside",
			got[0].Date.Format(DateLayout))
	}
	if got[2].Date != day(6) {
		t.Errorf("last kept entry is dated %s, want the 6th: the range end counts as inside",
			got[2].Date.Format(DateLayout))
	}
	if got[1].Account != "salary" {
		t.Errorf("middle kept entry is %q, want salary: order should be left alone", got[1].Account)
	}
}
