// Package record turns input lines into records.
package record

// Fields splits one record line into its fields.
//
// Fields are separated by spaces. A field wrapped in double quotes may hold
// spaces, and the quotes are not part of the field.
func Fields(line string) []string {
	var out []string
	var cur []rune
	inQuote := false
	open := false

	for _, r := range line {
		switch {
		case r == '"':
			inQuote = !inQuote
			open = true
		case r == ' ' && !inQuote:
			if open {
				out = append(out, string(cur))
				cur = cur[:0]
				open = false
			}
		default:
			cur = append(cur, r)
			open = true
		}
	}
	if open {
		out = append(out, string(cur))
	}
	return out
}
