package alpha

// Counter counts.
type Counter struct {
	n int
}

// Add adds n to the count and reports the total.
func (c Counter) Add(n int) int {
	return c.n + n
}

// AddsUp adds two numbers.
func AddsUp(a, b int) int {
	return a + b
}

// Name is what this suite is called.
func Name() string {
	return "alpha"
}
