package chunk

// Split cuts s into batches of at most size elements. The last batch may be
// short. A size of zero or less returns one batch holding everything.
func Split[T any](s []T, size int) [][]T {
	if len(s) == 0 {
		return nil
	}
	if size <= 0 {
		return [][]T{s}
	}
	out := make([][]T, 0, (len(s)+size-1)/size)
	for i := 0; i < len(s); i += size {
		end := i + size
		if end > len(s) {
			end = len(s)
		}
		out = append(out, s[i:end])
	}
	return out
}

// Count reports how many batches Split would produce.
func Count(length, size int) int {
	if length <= 0 {
		return 0
	}
	if size <= 0 {
		return 1
	}
	return (length + size - 1) / size
}
