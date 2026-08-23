package record_test

import (
	"testing"

	"example.com/sift/internal/record"
)

// TestProof_p_tokenize_basic_SplitsPlainFields proves i_split_fields.
func TestProof_p_tokenize_basic_SplitsPlainFields(t *testing.T) {
	got := record.Fields("info web up")
	want := []string{"info", "web", "up"}

	if len(got) != len(want) {
		t.Fatalf("Fields(%q) gave %d fields %q; want %d fields %q",
			"info web up", len(got), got, len(want), want)
	}
	for i := range want {
		if got[i] != want[i] {
			t.Errorf("field %d is %q; want %q", i, got[i], want[i])
		}
	}
}

// TestProof_p_tokenize_quoted_KeepsSpacesInsideQuotes proves i_quoted_fields.
func TestProof_p_tokenize_quoted_KeepsSpacesInsideQuotes(t *testing.T) {
	line := `warn db "disk almost full"`
	got := record.Fields(line)
	want := []string{"warn", "db", "disk almost full"}

	if len(got) != len(want) {
		t.Fatalf("Fields(%q) gave %d fields %q; want %d fields %q",
			line, len(got), got, len(want), want)
	}
	for i := range want {
		if got[i] != want[i] {
			t.Errorf("field %d is %q; want %q", i, got[i], want[i])
		}
	}
}
