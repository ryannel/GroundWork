package budget

import (
	"testing"

	"github.com/mkerrigan/ledgerline/internal/ledger"
)

func TestBudgetFlagsOverspentCategories(t *testing.T) {
	balances := []ledger.AccountBalance{
		{Account: "coffee", Total: -4500, Count: 9},
		{Account: "groceries", Total: -26000, Count: 6},
		{Account: "rent", Total: -120000, Count: 1},
		{Account: "salary", Total: 250000, Count: 1},
	}
	limits := map[string]int64{
		"coffee":    3000,
		"groceries": 30000,
		"rent":      120000,
	}

	got := Check(balances, limits)
	if len(got) != 1 {
		t.Fatalf("Check flagged %d accounts, want 1", len(got))
	}
	if got[0].Account != "coffee" {
		t.Fatalf("Check flagged %q, want coffee", got[0].Account)
	}
	if got[0].Spent != 4500 || got[0].Limit != 3000 {
		t.Errorf("flagged %+v, want 4500 spent against a 3000 limit", got[0])
	}
	if got[0].Over() != 1500 {
		t.Errorf("Over() = %d, want 1500", got[0].Over())
	}
}
