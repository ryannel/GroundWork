package words

import "testing"

// This test fails on purpose. It exists to prove that CI fails the
// build when a Go test fails. The next commit removes it.
func TestRedProof(t *testing.T) {
	t.Fatal("red on purpose: CI must fail this build")
}
