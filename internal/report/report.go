// Package report renders account balances as aligned columns.
package report

import (
	"fmt"
	"io"

	"github.com/mkerrigan/ledgerline/internal/ledger"
)

// TotalLabel is the label on the last row of a report.
const TotalLabel = "TOTAL"

// widths returns how wide the account column and the amount column have
// to be to hold every row without wrapping.
func widths(balances []ledger.AccountBalance) (account, amount int) {
	for _, balance := range balances {
		if n := len(balance.Account); n > account {
			account = n
		}
		if n := len(ledger.FormatAmount(balance.Total)); n > amount {
			amount = n
		}
	}
	return account, amount
}

// Render writes one row per balance and a total row underneath. Account
// names are left aligned, amounts right aligned, and every row is the
// same width.
func Render(w io.Writer, balances []ledger.AccountBalance) error {
	if len(balances) == 0 {
		return nil
	}

	accountWidth, amountWidth := widths(balances)
	for _, balance := range balances {
		_, err := fmt.Fprintf(w, "%-*s  %*s\n",
			accountWidth, balance.Account,
			amountWidth, ledger.FormatAmount(balance.Total))
		if err != nil {
			return err
		}
	}

	// TODO: the total row still has to go here, and the label may be
	// wider than the widest account name.
	return nil
}
