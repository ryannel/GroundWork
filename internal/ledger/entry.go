// Package ledger reads plain-text ledger files.
package ledger

import (
	"io"
	"time"
)

// DateLayout is the date format every ledger line starts with.
const DateLayout = "2006-01-02"

// Entry is one posting in a ledger file. Amount is in cents, and money
// leaving the account is negative.
type Entry struct {
	Date    time.Time
	Account string
	Amount  int64
	Note    string
}

// ParseAmount turns a decimal string such as "-42.50" into cents.
func ParseAmount(s string) (int64, error) {
	return 0, nil
}

// ParseLine reads one ledger line. The bool is false for blank lines and
// for lines that hold nothing but a comment.
func ParseLine(line string) (Entry, bool, error) {
	return Entry{}, false, nil
}

// ParseLedger reads a whole ledger file.
func ParseLedger(r io.Reader) ([]Entry, error) {
	return nil, nil
}
