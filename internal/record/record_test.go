package record_test

import (
	"errors"
	"testing"

	"example.com/sift/internal/record"
)

// TestProof_p_record_parse_ReadsAKindHostAndMessage proves two items in one
// test: i_named_record and i_short_line_error. Both facts come from the same
// call, so they are asserted side by side.
func TestProof_p_record_parse_ReadsAKindHostAndMessage(t *testing.T) {
	// i_named_record
	line := `warn db "disk almost full"`
	got, err := record.Parse(line)
	if err != nil {
		t.Fatalf("Parse(%q) returned error %v; want no error", line, err)
	}
	if got.Kind != "warn" {
		t.Errorf("Parse(%q).Kind is %q; want %q", line, got.Kind, "warn")
	}
	if got.Host != "db" {
		t.Errorf("Parse(%q).Host is %q; want %q", line, got.Host, "db")
	}
	if got.Msg != "disk almost full" {
		t.Errorf("Parse(%q).Msg is %q; want %q", line, got.Msg, "disk almost full")
	}

	// i_short_line_error
	short := "info web"
	if _, err := record.Parse(short); !errors.Is(err, record.ErrShortLine) {
		t.Errorf("Parse(%q) returned error %v; want %v", short, err, record.ErrShortLine)
	}
}
