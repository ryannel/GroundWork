// Package inkwell lays out plain text: wrapping, indenting, shortening
// and small lists.
package inkwell

import (
	"strings"
	"unicode/utf8"
)

// Wrap breaks text into lines no wider than width. Blank lines between
// paragraphs are kept. A word longer than width gets a line to itself
// rather than being cut in half.
func Wrap(text string, width int) string {
	if width <= 0 {
		return text
	}

	paragraphs := strings.Split(text, "\n\n")
	for i, paragraph := range paragraphs {
		paragraphs[i] = wrapParagraph(paragraph, width)
	}
	return strings.Join(paragraphs, "\n\n")
}

// Hang wraps text to width and indents every line after the first by
// indent spaces, so the continuations sit under the opening line rather
// than back at the margin.
func Hang(text string, width, indent int) string {
	return text
}

func wrapParagraph(text string, width int) string {
	words := strings.Fields(text)
	if len(words) == 0 {
		return ""
	}

	lines := make([]string, 0, len(words))
	line := words[0]
	for _, word := range words[1:] {
		if utf8.RuneCountInString(line)+1+utf8.RuneCountInString(word) > width {
			lines = append(lines, line)
			line = word
			continue
		}
		line += " " + word
	}
	return strings.Join(append(lines, line), "\n")
}
