// Package romanize converts between integers and Roman numerals.
package romanize

import (
	"errors"
	"strings"
)

// ErrRange is returned for values outside 1..3999.
var ErrRange = errors.New("romanize: value out of range 1..3999")

// ErrSyntax is returned when a string is not a well-formed numeral.
var ErrSyntax = errors.New("romanize: not a roman numeral")

type pair struct {
	val int
	sym string
}

var table = []pair{
	{1000, "M"}, {900, "CM"}, {500, "D"}, {400, "CD"},
	{100, "C"}, {90, "XC"}, {50, "L"}, {40, "XL"},
	{10, "X"}, {9, "IX"}, {5, "V"}, {4, "IV"}, {1, "I"},
}

// Format renders n as an upper-case Roman numeral.
func Format(n int) (string, error) {
	if n < 1 || n > 3999 {
		return "", ErrRange
	}
	var b strings.Builder
	for _, p := range table {
		for n >= p.val {
			b.WriteString(p.sym)
			n -= p.val
		}
	}
	return b.String(), nil
}

// Parse reads an upper-case Roman numeral. It rejects any string that Format
// would not have produced.
func Parse(s string) (int, error) {
	if s == "" {
		return 0, ErrSyntax
	}
	n := 0
	rest := s
	for _, p := range table {
		for strings.HasPrefix(rest, p.sym) {
			n += p.val
			rest = rest[len(p.sym):]
		}
	}
	if rest != "" {
		return 0, ErrSyntax
	}
	round, err := Format(n)
	if err != nil || round != s {
		return 0, ErrSyntax
	}
	return n, nil
}
