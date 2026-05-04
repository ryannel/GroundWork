package ledger

import (
	"strings"
	"testing"
)

func TestParseAmountReadsSignedCents(t *testing.T) {
	cases := []struct {
		in   string
		want int64
	}{
		{"0.00", 0},
		{"12.34", 1234},
		{"-42.50", -4250},
		{"+7.05", 705},
		{"2500", 250000},
	}
	for _, c := range cases {
		got, err := ParseAmount(c.in)
		if err != nil {
			t.Errorf("ParseAmount(%q): unexpected error: %v", c.in, err)
			continue
		}
		if got != c.want {
			t.Errorf("ParseAmount(%q) = %d, want %d", c.in, got, c.want)
		}
	}
}

func TestParseEntryRejectsMalformedAmount(t *testing.T) {
	bad := []string{
		"2026-01-04 groceries 42.5",
		"2026-01-04 groceries twelve",
		"2026-01-04 groceries -",
		"2026-01-04 groceries 1.234",
	}
	for _, line := range bad {
		if _, _, err := ParseLine(line); err == nil {
			t.Errorf("ParseLine(%q): want an error, got none", line)
		}
	}
}

func TestParseLedgerSkipsCommentLines(t *testing.T) {
	input := "# january\n" +
		"2026-01-04  groceries  -42.50   # weekly shop\n" +
		"\n" +
		"   \n" +
		"2026-01-05  salary      2500.00\n"

	entries, err := ParseLedger(strings.NewReader(input))
	if err != nil {
		t.Fatalf("ParseLedger: unexpected error: %v", err)
	}
	if len(entries) != 2 {
		t.Fatalf("ParseLedger returned %d entries, want 2", len(entries))
	}
	if entries[0].Account != "groceries" || entries[0].Amount != -4250 {
		t.Errorf("first entry = %+v, want groceries at -4250", entries[0])
	}
	if entries[0].Note != "weekly shop" {
		t.Errorf("first entry note = %q, want %q", entries[0].Note, "weekly shop")
	}
	if entries[1].Account != "salary" || entries[1].Amount != 250000 {
		t.Errorf("second entry = %+v, want salary at 250000", entries[1])
	}
	if entries[1].Date.Format(DateLayout) != "2026-01-05" {
		t.Errorf("second entry date = %s, want 2026-01-05", entries[1].Date.Format(DateLayout))
	}
}

func TestParseLineReportsTheLineNumber(t *testing.T) {
	input := "2026-01-04 groceries -42.50\n2026-01-05 salary nope\n"
	_, err := ParseLedger(strings.NewReader(input))
	if err == nil {
		t.Fatal("ParseLedger: want an error for the bad second line, got none")
	}
	if !strings.Contains(err.Error(), "line 2") {
		t.Errorf("error %q does not name line 2", err)
	}
}
