// Package slug turns free text into URL-safe slugs.
package slug

import (
	"strings"
	"unicode"
)

// Make converts s into a lower-case slug. Runs of characters that are not
// letters or digits become a single hyphen. Leading and trailing hyphens are
// removed.
func Make(s string) string {
	var b strings.Builder
	lastHyphen := true // suppress a leading hyphen
	for _, r := range s {
		switch {
		case unicode.IsLetter(r) || unicode.IsDigit(r):
			b.WriteRune(unicode.ToLower(r))
			lastHyphen = false
		default:
			if !lastHyphen {
				b.WriteByte('-')
				lastHyphen = true
			}
		}
	}
	return strings.TrimSuffix(b.String(), "-")
}

// Truncate shortens a slug to at most n characters without leaving a partial
// word. It never returns a trailing hyphen.
func Truncate(s string, n int) string {
	if n <= 0 {
		return ""
	}
	if len(s) <= n {
		return s
	}
	cut := s[:n]
	if s[n] != '-' {
		// The cut landed inside a word, so drop that partial word.
		if i := strings.LastIndexByte(cut, '-'); i >= 0 {
			cut = cut[:i]
		}
	}
	return strings.TrimSuffix(cut, "-")
}
