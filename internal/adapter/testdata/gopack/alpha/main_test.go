package alpha

import (
	"os"
	"testing"
)

// TestMain is the pack's harness, and the shape D30 rules on: it takes
// testing.M, so it is never a test. Discovery must not count it, and the run
// never reports it.
//
// The gate is real. With GROUNDWORK_PACK_GATE set to closed, this suite runs
// nothing at all — the shape a never-run scan has to be able to catch.
func TestMain(m *testing.M) {
	if os.Getenv("GROUNDWORK_PACK_GATE") == "closed" {
		os.Exit(0)
	}

	os.Exit(m.Run())
}

// BenchmarkAddsUp is a benchmark, not a test. D30 leaves benchmarks out of this
// bet, so discovery must not list it and the run must not report it.
func BenchmarkAddsUp(b *testing.B) {
	for b.Loop() {
		AddsUp(2, 2)
	}
}

// testHelper is not a test either: the name is right and the signature is not.
func testHelper(t *testing.T) {
	t.Helper()
}
