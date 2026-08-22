// Package quantity reads a number with a trailing unit, such as "12kg".
package quantity

import (
	"fmt"
	"strconv"
	"strings"
	"unicode"
)

// Quantity is a numeric amount together with the unit it was written in.
// The unit is kept exactly as it appeared, minus surrounding spaces.
type Quantity struct {
	Value float64
	Unit  string
}

// Parse reads a quantity such as "12kg", "3.5 m" or "900ms". The unit is
// optional; "7" parses as seven with an empty unit.
func Parse(s string) (Quantity, error) {
	trimmed := strings.TrimSpace(s)
	if trimmed == "" {
		return Quantity{}, fmt.Errorf("quantity: empty input")
	}

	split := len(trimmed)
	for i, r := range trimmed {
		if unicode.IsDigit(r) || r == '.' || r == '-' || r == '+' {
			continue
		}
		split = i
		break
	}

	number := strings.TrimSpace(trimmed[:split])
	unit := strings.TrimSpace(trimmed[split:])

	value, err := strconv.ParseFloat(number, 64)
	if err != nil {
		return Quantity{}, fmt.Errorf("quantity: %q is not a number", number)
	}
	return Quantity{Value: value, Unit: unit}, nil
}

// String renders the quantity back into the compact form.
func (q Quantity) String() string {
	return strconv.FormatFloat(q.Value, 'g', -1, 64) + q.Unit
}
