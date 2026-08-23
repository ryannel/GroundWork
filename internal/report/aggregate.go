// Package report summarises parsed records.
package report

import "example.com/sift/internal/record"

// Counts says how many records carry each kind.
//
// Slice s_aggregate has not landed. The grouping is missing, so the map
// comes back empty whatever it is given.
func Counts(recs []record.Record) map[string]int {
	return map[string]int{}
}
