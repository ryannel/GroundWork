package ledger

import (
	"testing"
	"time"
)

func day(d int) time.Time {
	return time.Date(2026, time.January, d, 0, 0, 0, 0, time.UTC)
}

func TestBalancesGroupByAccount(t *testing.T) {
	entries := []Entry{
		{Date: day(4), Account: "groceries", Amount: -4250},
		{Date: day(5), Account: "salary", Amount: 250000},
		{Date: day(6), Account: "groceries", Amount: -1800},
		{Date: day(7), Account: "rent", Amount: -120000},
	}

	got := Balances(entries)
	if len(got) != 3 {
		t.Fatalf("Balances returned %d accounts, want 3", len(got))
	}

	want := []AccountBalance{
		{Account: "groceries", Total: -6050, Count: 2},
		{Account: "rent", Total: -120000, Count: 1},
		{Account: "salary", Total: 250000, Count: 1},
	}
	for i, w := range want {
		if got[i] != w {
			t.Errorf("balance %d = %+v, want %+v", i, got[i], w)
		}
	}
}

func TestBalancesIgnoreZeroNetAccounts(t *testing.T) {
	entries := []Entry{
		{Date: day(4), Account: "loan-to-sam", Amount: -5000},
		{Date: day(9), Account: "loan-to-sam", Amount: 5000},
		{Date: day(5), Account: "salary", Amount: 250000},
	}

	got := Balances(entries)
	if len(got) != 1 {
		t.Fatalf("Balances returned %d accounts, want 1", len(got))
	}
	if got[0].Account != "salary" {
		t.Errorf("kept account %q, want salary", got[0].Account)
	}
}

func TestGrandTotalAddsEveryBalance(t *testing.T) {
	balances := []AccountBalance{
		{Account: "groceries", Total: -6050},
		{Account: "rent", Total: -120000},
		{Account: "salary", Total: 250000},
	}
	if got, want := GrandTotal(balances), int64(123950); got != want {
		t.Errorf("GrandTotal = %d, want %d", got, want)
	}
}
