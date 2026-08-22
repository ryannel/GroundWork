// Package titlecase capitalises names and headings.
package titlecase

import "strings"

// small words stay lowercase unless they open or close the string.
var small = map[string]bool{
	"a": true, "an": true, "and": true, "as": true, "at": true,
	"but": true, "by": true, "for": true, "in": true, "of": true,
	"on": true, "or": true, "the": true, "to": true, "with": true,
}

// Of title-cases a heading. Words listed as small stay lowercase unless they
// are the first or last word. Words that are already all caps are left alone,
// which keeps initialisms such as "PLC" intact.
func Of(s string) string {
	words := strings.Fields(s)
	for i, w := range words {
		if w == strings.ToUpper(w) && strings.ToLower(w) != w {
			continue
		}
		lower := strings.ToLower(w)
		if small[lower] && i != 0 && i != len(words)-1 {
			words[i] = lower
			continue
		}
		words[i] = strings.ToUpper(lower[:1]) + lower[1:]
	}
	return strings.Join(words, " ")
}
