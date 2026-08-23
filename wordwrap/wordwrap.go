// Package wordwrap breaks plain text into lines of a fixed width.
package wordwrap

import "strings"

// Lines splits s into lines no longer than width, breaking only at spaces.
// A word longer than width gets a line of its own. The result is never nil.
func Lines(s string, width int) []string {
	words := strings.Fields(s)
	out := []string{}
	if len(words) == 0 {
		return out
	}
	if width <= 0 {
		return words
	}
	cur := words[0]
	for _, w := range words[1:] {
		if len(cur)+1+len(w) <= width {
			cur += " " + w
			continue
		}
		out = append(out, cur)
		cur = w
	}
	return append(out, cur)
}

// Wrap is Lines joined with newlines.
func Wrap(s string, width int) string {
	return strings.Join(Lines(s, width), "\n")
}

// Indent puts prefix in front of every line of s.
func Indent(s, prefix string) string {
	if s == "" {
		return ""
	}
	parts := strings.Split(s, "\n")
	for i, p := range parts {
		parts[i] = prefix + p
	}
	return strings.Join(parts, "\n")
}
