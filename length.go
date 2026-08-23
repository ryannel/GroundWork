// Package gauge holds lengths and does small sums on them.
//
// Every length in this package is a float64 count of metres.
package gauge

import "errors"

// ErrBadLength reports text that is not a length this package can read.
var ErrBadLength = errors.New("gauge: cannot read that as a length")

// ParseLength reads a length such as "3m" or "250cm" and returns metres.
//
// Reading the number and its unit is slice s_parse_units, which has not
// landed yet.
func ParseLength(s string) (float64, error) {
	return 0, ErrBadLength
}
