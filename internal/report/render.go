package report

// Table renders counts as an aligned table, one kind per line, sorted by
// kind. Each line is the kind padded to six columns, then the count.
//
// A run with no records renders one plain line instead of a table.
//
// Slice s_render has not landed. Nothing is rendered yet.
func Table(counts map[string]int) string {
	return ""
}
