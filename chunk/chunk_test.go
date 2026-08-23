package chunk

import "testing"

// batchShape describes the batch sizes we expect for a given input.
type batchShape struct {
	length int
	size   int
	want   []int
}

// shapeOf builds the batch-size list for a run of length elements cut at size.
func shapeOf(length, size int) []int {
	var out []int
	for i := 0; i < length; i += size {
		n := size
		if i+n > length {
			n = length - i
		}
		out = append(out, n)
	}
	return out
}

func TestSplitShapes(t *testing.T) {
	cases := []batchShape{
		{length: 10, size: 3, want: []int{3, 3, 3, 1}},
		{length: 6, size: 2, want: []int{2, 2, 2}},
		{length: 1, size: 5, want: []int{1}},
	}
	for _, c := range cases {
		got := shapeOf(c.length, c.size)
		if len(got) != len(c.want) {
			t.Fatalf("length %d size %d: got %d batches, want %d", c.length, c.size, len(got), len(c.want))
		}
		for i := range c.want {
			if got[i] != c.want[i] {
				t.Errorf("length %d size %d: batch %d is %d, want %d", c.length, c.size, i, got[i], c.want[i])
			}
		}
	}
}

func TestSplitCoversEverything(t *testing.T) {
	total := 0
	for _, n := range shapeOf(17, 4) {
		total += n
	}
	if total != 17 {
		t.Errorf("batches cover %d elements, want 17", total)
	}
}
