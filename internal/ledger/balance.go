package ledger

// AccountBalance is what one account nets out to across a run of entries.
type AccountBalance struct {
	Account string
	Total   int64
	Count   int
}

// Balances folds entries into one balance per account, sorted by account
// name. Accounts that net out to zero are left out.
func Balances(entries []Entry) []AccountBalance {
	return nil
}

// GrandTotal adds up every balance.
func GrandTotal(balances []AccountBalance) int64 {
	return 0
}
