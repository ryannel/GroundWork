// Package csvline splits a single CSV record into its fields.
//
// The standard library reader wants a whole document and a consistent field
// count. Import files are rarely that tidy, so this package works one line at
// a time and leaves the caller to decide what a short record means.
package csvline

import "strings"

// Split returns the comma-separated fields of one record. A field wrapped in
// double quotes may contain commas, and a doubled quote inside such a field
// stands for one literal quote. Unquoted fields are trimmed of surrounding
// spaces.
func Split(line string) []string {
	var (
		fields  []string
		field   strings.Builder
		quoted  bool
		wasQuot bool
	)

	flush := func() {
		s := field.String()
		if !wasQuot {
			s = strings.TrimSpace(s)
		}
		fields = append(fields, s)
		field.Reset()
		wasQuot = false
	}

	for i := 0; i < len(line); i++ {
		c := line[i]
		switch {
		case quoted && c == '"':
			if i+1 < len(line) && line[i+1] == '"' {
				field.WriteByte('"')
				i++
				continue
			}
			quoted = false
		case c == '"' && field.Len() == 0 && !wasQuot:
			quoted = true
			wasQuot = true
		case c == ',' && !quoted:
			flush()
		default:
			field.WriteByte(c)
		}
	}
	flush()
	return fields
}
