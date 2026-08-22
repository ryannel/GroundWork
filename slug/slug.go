// Package slug turns free text into URL-safe identifiers.
package slug

import (
	"strings"
	"unicode"
)

// Make returns a lowercase, dash-separated form of s. Runs of characters
// that are neither letters nor digits collapse into a single dash, and
// leading or trailing dashes are removed.
func Make(s string) string {
	var b strings.Builder
	pendingDash := false
	for _, r := range strings.ToLower(s) {
		if unicode.IsLetter(r) || unicode.IsDigit(r) {
			if pendingDash && b.Len() > 0 {
				b.WriteRune('-')
			}
			pendingDash = false
			b.WriteRune(r)
			continue
		}
		pendingDash = true
	}
	return b.String()
}

// Truncate shortens a slug to at most max characters without cutting a word
// in half. If the first word alone is longer than max, it is cut at max.
func Truncate(s string, max int) string {
	if max <= 0 {
		return ""
	}
	if len(s) <= max {
		return s
	}
	cut := strings.LastIndex(s[:max+1], "-")
	if cut <= 0 {
		return s[:max]
	}
	return s[:cut]
}
