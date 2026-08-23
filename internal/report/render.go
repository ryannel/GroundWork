package report

// Table renders counts as an aligned table, one kind per line, sorted by
// kind. Each line is the kind padded to six columns, then the count.
//
// A run with no records renders one plain line instead of a table. That
// empty case is written here ahead of its slice, because cmd/sift needs
// something sane to print on an empty run.
//
// The rest of slice s_render has not landed. A table with rows in it is
// still missing.
func Table(counts map[string]int) string {
	if len(counts) == 0 {
		return "no records\n"
	}
	return ""
}
