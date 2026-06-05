package inkwell

import (
	"strings"
	"unicode/utf8"
)

// Ellipsis is what Truncate puts on the end of a string it had to cut.
const Ellipsis = "..."

// Indent puts prefix in front of every line of text. Blank lines are
// left alone, so no line ends up as trailing whitespace.
func Indent(text, prefix string) string {
	lines := strings.Split(text, "\n")
	for i, line := range lines {
		if line == "" {
			continue
		}
		lines[i] = prefix + line
	}
	return strings.Join(lines, "\n")
}

// Truncate shortens s to at most max characters, ending it with an
// ellipsis when it had to cut something off.
func Truncate(s string, max int) string {
	if max <= 0 {
		return ""
	}
	if utf8.RuneCountInString(s) <= max {
		return s
	}
	if max <= len(Ellipsis) {
		return strings.Repeat(".", max)
	}
	return s[:max-len(Ellipsis)] + Ellipsis
}
