package ledger

import "sort"

// AccountBalance is what one account nets out to across a run of entries.
type AccountBalance struct {
	Account string
	Total   int64
	Count   int
}

// Balances folds entries into one balance per account, sorted by account
// name. Accounts that net out to zero are left out.
func Balances(entries []Entry) []AccountBalance {
	running := make(map[string]AccountBalance, len(entries))
	for _, entry := range entries {
		balance := running[entry.Account]
		balance.Account = entry.Account
		balance.Total += entry.Amount
		balance.Count++
		running[entry.Account] = balance
	}

	out := make([]AccountBalance, 0, len(running))
	for _, balance := range running {
		if balance.Total == 0 {
			continue
		}
		out = append(out, balance)
	}
	sort.Slice(out, func(i, j int) bool { return out[i].Account < out[j].Account })
	return out
}

// GrandTotal adds up every balance.
func GrandTotal(balances []AccountBalance) int64 {
	var total int64
	for _, balance := range balances {
		total += balance.Total
	}
	return total
}
