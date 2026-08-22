// Package wrap breaks text into lines of a fixed column width.
package wrap

import "strings"

// Lines splits text into lines no longer than width, breaking only at
// whitespace. A word longer than width gets a line of its own. Runs of
// whitespace in the input collapse to a single space.
func Lines(text string, width int) []string {
	words := strings.Fields(text)
	if len(words) == 0 {
		return nil
	}
	if width <= 0 {
		return words
	}

	var out []string
	current := words[0]
	for _, w := range words[1:] {
		if len(current)+1+len(w) <= width {
			current += " " + w
			continue
		}
		out = append(out, current)
		current = w
	}
	return append(out, current)
}

// Text is Lines joined back together with newlines.
func Text(text string, width int) string {
	return strings.Join(Lines(text, width), "\n")
}
