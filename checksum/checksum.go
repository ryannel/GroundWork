// Package checksum validates account numbers with the Luhn check digit.
package checksum

// Digits returns the decimal digits of s, ignoring spaces and dashes.
// Any other character makes the number unusable, so nil comes back.
func Digits(s string) []int {
	out := make([]int, 0, len(s))
	for _, r := range s {
		switch {
		case r >= '0' && r <= '9':
			out = append(out, int(r-'0'))
		case r == ' ' || r == '-':
			continue
		default:
			return nil
		}
	}
	return out
}

// Valid reports whether s passes the Luhn check. Numbers shorter than two
// digits are never valid.
func Valid(s string) bool {
	digits := Digits(s)
	if len(digits) < 2 {
		return false
	}
	sum := 0
	double := false
	for i := len(digits) - 1; i >= 0; i-- {
		d := digits[i]
		if double {
			d *= 2
			if d > 9 {
				d -= 9
			}
		}
		sum += d
		double = !double
	}
	return sum%10 == 0
}

// CheckDigit returns the digit that would make body a valid number.
func CheckDigit(body string) int {
	digits := Digits(body)
	if digits == nil {
		return -1
	}
	sum := 0
	double := true
	for i := len(digits) - 1; i >= 0; i-- {
		d := digits[i]
		if double {
			d *= 2
			if d > 9 {
				d -= 9
			}
		}
		sum += d
		double = !double
	}
	return (10 - sum%10) % 10
}
