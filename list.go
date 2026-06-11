package inkwell

import (
	"fmt"
	"strings"
)

// Bullets renders items one per line, each behind the marker the caller
// asked for.
func Bullets(items []string, marker string) string {
	var b strings.Builder
	for i, item := range items {
		if i > 0 {
			b.WriteByte('\n')
		}
		fmt.Fprintf(&b, "- %s", item)
	}
	return b.String()
}

// Numbered renders items one per line, counting from one.
func Numbered(items []string) string {
	var b strings.Builder
	for i, item := range items {
		if i > 0 {
			b.WriteByte('\n')
		}
		fmt.Fprintf(&b, "%d. %s", i+1, item)
	}
	return b.String()
}
