package gauge

import "strconv"

// FormatLength prints metres in the shortest sensible unit.
//
// A thousand metres or more prints in kilometres. A metre or more prints
// in metres. Anything smaller prints in centimetres.
func FormatLength(metres float64) string {
	switch {
	case metres >= 1000:
		return trim(metres/1000) + "km"
	case metres >= 1:
		return trim(metres) + "m"
	default:
		return trim(metres*100) + "cm"
	}
}

// trim prints a number with no trailing zeros.
func trim(n float64) string {
	return strconv.FormatFloat(n, 'f', -1, 64)
}
