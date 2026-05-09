// Package report renders account balances as aligned columns.
package report

import (
	"io"

	"github.com/mkerrigan/ledgerline/internal/ledger"
)

// TotalLabel is the label on the last row of a report.
const TotalLabel = "TOTAL"

// Render writes one row per balance and a total row underneath. Account
// names are left aligned, amounts right aligned, and every row is the
// same width.
func Render(w io.Writer, balances []ledger.AccountBalance) error {
	return nil
}
