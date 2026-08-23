package beta

import "testing"

func TestGreets(t *testing.T) {
	if got := Greets("alpha"); got != "hello alpha" {
		t.Fatalf("Greets(alpha) is %q, want %q", got, "hello alpha")
	}
}
