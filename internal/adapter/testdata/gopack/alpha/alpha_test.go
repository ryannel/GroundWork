package alpha

import "testing"

func TestAddsUp(t *testing.T) {
	if got := AddsUp(2, 2); got != 4 {
		t.Fatalf("AddsUp(2, 2) is %d, want 4", got)
	}
}

// TestAddsUpWrong fails on purpose. The fixture pack needs one failing test,
// or an adapter that reported everything as passing would conform.
func TestAddsUpWrong(t *testing.T) {
	if got := AddsUp(2, 2); got != 5 {
		t.Fatalf("AddsUp(2, 2) is %d, and this test insists on 5", got)
	}
}

func TestCounterAdds(t *testing.T) {
	if got := (Counter{n: 1}).Add(2); got != 3 {
		t.Fatalf("Counter{1}.Add(2) is %d, want 3", got)
	}
}

// TestTable runs subtests. D30 folds them into this one name, because
// discovery cannot see a name that is built at run time.
func TestTable(t *testing.T) {
	cases := []struct {
		name string
		a, b int
		want int
	}{
		{"zeroes", 0, 0, 0},
		{"ones", 1, 1, 2},
		{"mixed", 2, 3, 5},
	}

	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			if got := AddsUp(c.a, c.b); got != c.want {
				t.Fatalf("AddsUp(%d, %d) is %d, want %d", c.a, c.b, got, c.want)
			}
		})
	}
}
