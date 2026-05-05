// Package ledger reads plain-text ledger files.
package ledger

import (
	"bufio"
	"fmt"
	"io"
	"strconv"
	"strings"
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
// Two decimal places, or none at all. Anything else is an error.
func ParseAmount(s string) (int64, error) {
	digits := s
	negative := false
	switch {
	case strings.HasPrefix(digits, "-"):
		negative = true
		digits = digits[1:]
	case strings.HasPrefix(digits, "+"):
		digits = digits[1:]
	}

	whole, frac, hasFrac := strings.Cut(digits, ".")
	units, err := strconv.ParseInt(whole, 10, 64)
	if err != nil {
		return 0, fmt.Errorf("bad amount %q", s)
	}

	var cents int64
	if hasFrac {
		if len(frac) != 2 {
			return 0, fmt.Errorf("bad amount %q: want two decimal places", s)
		}
		cents, err = strconv.ParseInt(frac, 10, 64)
		if err != nil {
			return 0, fmt.Errorf("bad amount %q", s)
		}
	}

	total := units*100 + cents
	if negative {
		total = -total
	}
	return total, nil
}

// FormatAmount is the inverse of ParseAmount.
func FormatAmount(cents int64) string {
	sign := ""
	if cents < 0 {
		sign = "-"
		cents = -cents
	}
	return fmt.Sprintf("%s%d.%02d", sign, cents/100, cents%100)
}

// ParseLine reads one ledger line. The bool is false for blank lines and
// for lines that hold nothing but a comment.
func ParseLine(line string) (Entry, bool, error) {
	var entry Entry

	text := line
	if hash := strings.Index(text, "#"); hash >= 0 {
		entry.Note = strings.TrimSpace(text[hash+1:])
		text = text[:hash]
	}

	fields := strings.Fields(text)
	if len(fields) == 0 {
		return Entry{}, false, nil
	}
	if len(fields) != 3 {
		return Entry{}, false, fmt.Errorf("want date, account and amount, got %d fields", len(fields))
	}

	date, err := time.Parse(DateLayout, fields[0])
	if err != nil {
		return Entry{}, false, fmt.Errorf("bad date %q", fields[0])
	}
	amount, err := ParseAmount(fields[2])
	if err != nil {
		return Entry{}, false, err
	}

	entry.Date = date
	entry.Account = fields[1]
	entry.Amount = amount
	return entry, true, nil
}

// ParseLedger reads a whole ledger file.
func ParseLedger(r io.Reader) ([]Entry, error) {
	var entries []Entry

	scanner := bufio.NewScanner(r)
	number := 0
	for scanner.Scan() {
		number++
		entry, ok, err := ParseLine(scanner.Text())
		if err != nil {
			return nil, fmt.Errorf("line %d: %w", number, err)
		}
		if ok {
			entries = append(entries, entry)
		}
	}
	if err := scanner.Err(); err != nil {
		return nil, err
	}
	return entries, nil
}
