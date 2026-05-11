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
// to be to hold every row without wrapping. The total row counts as a
// row, so its label and its amount are measured too.
func widths(balances []ledger.AccountBalance) (account, amount int) {
	account = len(TotalLabel)
	amount = len(ledger.FormatAmount(ledger.GrandTotal(balances)))
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
	row := func(label string, cents int64) error {
		_, err := fmt.Fprintf(w, "%-*s  %*s\n",
			accountWidth, label, amountWidth, ledger.FormatAmount(cents))
		return err
	}

	for _, balance := range balances {
		if err := row(balance.Account, balance.Total); err != nil {
			return err
		}
	}
	return row(TotalLabel, ledger.GrandTotal(balances))
}
