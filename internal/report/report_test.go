package report

import (
	"bytes"
	"strings"
	"testing"

	"github.com/mkerrigan/ledgerline/internal/ledger"
)

func TestReportRendersAlignedColumns(t *testing.T) {
	balances := []ledger.AccountBalance{
		{Account: "groceries", Total: -4250, Count: 2},
		{Account: "rent", Total: -120000, Count: 1},
		{Account: "salary", Total: 250000, Count: 1},
	}

	var buf bytes.Buffer
	if err := Render(&buf, balances); err != nil {
		t.Fatalf("Render: unexpected error: %v", err)
	}

	want := strings.Join([]string{
		"groceries    -42.50",
		"rent       -1200.00",
		"salary      2500.00",
		"TOTAL       1257.50",
		"",
	}, "\n")

	if got := buf.String(); got != want {
		t.Errorf("Render wrote:\n%q\nwant:\n%q", got, want)
	}
}

func TestRenderWritesNothingForNoBalances(t *testing.T) {
	var buf bytes.Buffer
	if err := Render(&buf, nil); err != nil {
		t.Fatalf("Render: unexpected error: %v", err)
	}
	if got := buf.String(); got != "" {
		t.Errorf("Render wrote %q for an empty ledger, want nothing", got)
	}
}
