// Package csvlite reads and writes simple comma-separated records.
//
// It handles quoted fields and doubled quotes inside them. It does not handle
// newlines inside fields.
package csvlite

import "strings"

// ParseLine splits one CSV line into fields.
func ParseLine(line string) []string {
	var (
		fields []string
		cur    strings.Builder
		quoted bool
	)
	for i := 0; i < len(line); i++ {
		c := line[i]
		switch {
		case quoted && c == '"':
			if i+1 < len(line) && line[i+1] == '"' {
				cur.WriteByte('"')
				i++
				continue
			}
			quoted = false
		case c == '"':
			quoted = true
		case c == ',' && !quoted:
			fields = append(fields, cur.String())
			cur.Reset()
		default:
			cur.WriteByte(c)
		}
	}
	return append(fields, cur.String())
}

// FormatLine joins fields into one CSV line, quoting where needed.
func FormatLine(fields []string) string {
	out := make([]string, len(fields))
	for i, f := range fields {
		if strings.ContainsAny(f, `",`) {
			out[i] = `"` + strings.ReplaceAll(f, `"`, `""`) + `"`
		} else {
			out[i] = f
		}
	}
	return strings.Join(out, ",")
}

// Header maps column names to their index.
func Header(line string) map[string]int {
	m := map[string]int{}
	for i, f := range ParseLine(line) {
		m[strings.TrimSpace(f)] = i
	}
	return m
}
