package ledger

import "time"

// FilterByDate keeps the entries that fall inside the range. Both ends
// count as inside. Order is left alone.
func FilterByDate(entries []Entry, from, to time.Time) []Entry {
	return nil
}
