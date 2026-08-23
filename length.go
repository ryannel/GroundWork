// Package gauge holds lengths and does small sums on them.
//
// Every length in this package is a float64 count of metres.
package gauge

import (
	"errors"
	"strconv"
	"strings"
)

// ErrBadLength reports text that is not a length this package can read.
var ErrBadLength = errors.New("gauge: cannot read that as a length")

// metresPerUnit says how many metres one of each unit is worth.
// Longer suffixes come first so "km" is tried before "m".
var metresPerUnit = []struct {
	suffix string
	metres float64
}{
	{"km", 1000},
	{"cm", 0.01},
	{"mm", 0.001},
	{"m", 1},
}

// ParseLength reads a length such as "3m" or "250cm" and returns metres.
func ParseLength(s string) (float64, error) {
	s = strings.TrimSpace(s)

	for _, u := range metresPerUnit {
		if !strings.HasSuffix(s, u.suffix) {
			continue
		}
		digits := strings.TrimSpace(strings.TrimSuffix(s, u.suffix))
		n, err := strconv.ParseFloat(digits, 64)
		if err != nil {
			return 0, ErrBadLength
		}
		return n * u.metres, nil
	}
	return 0, ErrBadLength
}
