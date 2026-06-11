package inkwell

import (
	"strings"
	"unicode"
)

// smallWords keep their small letter in the middle of a heading.
var smallWords = map[string]bool{
	"a": true, "an": true, "and": true, "at": true, "but": true,
	"by": true, "for": true, "in": true, "nor": true, "of": true,
	"on": true, "or": true, "so": true, "the": true, "to": true,
	"up": true, "yet": true,
}

// TitleCase capitalises a heading. Small joining words keep their small
// letter unless they open the heading. A hyphenated word is capitalised
// on both sides of the hyphen.
func TitleCase(s string) string {
	words := strings.Fields(strings.ToLower(s))
	for i, word := range words {
		if i > 0 && smallWords[word] {
			continue
		}
		words[i] = upperFirst(word)
	}
	return strings.Join(words, " ")
}

func upperFirst(word string) string {
	runes := []rune(word)
	if len(runes) == 0 {
		return word
	}
	return string(unicode.ToUpper(runes[0])) + string(runes[1:])
}
