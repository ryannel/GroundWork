//go:build csvlite_slow

// These tests are held behind a tag while the fixture corpus is sorted out.
// Run them with: go test -tags csvlite_slow ./csvlite

package csvlite

import "testing"

func TestParseLine(t *testing.T) {
	got := ParseLine(`a,"b,c",d`)
	want := []string{"a", "b,c", "d"}
	if len(got) != len(want) {
		t.Fatalf("got %d fields %q, want %d", len(got), got, len(want))
	}
	for i := range want {
		if got[i] != want[i] {
			t.Errorf("field %d = %q, want %q", i, got[i], want[i])
		}
	}
}

func TestParseLineDoubledQuote(t *testing.T) {
	got := ParseLine(`"say ""hi""",end`)
	if got[0] != `say "hi"` {
		t.Errorf("field 0 = %q, want %q", got[0], `say "hi"`)
	}
}

func TestFormatLine(t *testing.T) {
	got := FormatLine([]string{"a", "b,c", `d"e`})
	want := `a,"b,c","d""e"`
	if got != want {
		t.Errorf("FormatLine = %q, want %q", got, want)
	}
}

func TestHeader(t *testing.T) {
	h := Header("id, name ,email")
	if h["name"] != 1 || h["email"] != 2 {
		t.Errorf("Header = %v, want name at 1 and email at 2", h)
	}
}

func TestRoundTrip(t *testing.T) {
	in := []string{"plain", "with,comma", `with"quote`}
	out := ParseLine(FormatLine(in))
	for i := range in {
		if out[i] != in[i] {
			t.Errorf("round trip field %d = %q, want %q", i, out[i], in[i])
		}
	}
}
