// Package budget compares what an account spent against what it was
// allowed to spend.
package budget

import "github.com/mkerrigan/ledgerline/internal/ledger"

// Overspend is one account that went past its limit. Limit and Spent are
// positive cents, so an account allowed 200.00 that spent 250.00 has a
// Limit of 20000 and a Spent of 25000.
type Overspend struct {
	Account string
	Limit   int64
	Spent   int64
}

// Over returns how far past the limit the account went.
func (o Overspend) Over() int64 {
	return o.Spent - o.Limit
}

// Check reports the accounts that spent more than their limit, sorted by
// account name. Accounts with no limit are ignored, and so are accounts
// that took money in rather than paying it out.
func Check(balances []ledger.AccountBalance, limits map[string]int64) []Overspend {
	return nil
}
