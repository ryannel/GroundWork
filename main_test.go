package main

import (
	"bytes"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

const sampleLedger = `# january
2026-01-04  groceries  -42.50   # weekly shop
2026-01-05  salary      2500.00
2026-01-06  rent       -1200.00
`

func writeLedger(t *testing.T, body string) string {
	t.Helper()
	path := filepath.Join(t.TempDir(), "january.ledger")
	if err := os.WriteFile(path, []byte(body), 0o644); err != nil {
		t.Fatalf("writing the sample ledger: %v", err)
	}
	return path
}

func TestRunTotalsCommandWritesReport(t *testing.T) {
	path := writeLedger(t, sampleLedger)

	var out, errs bytes.Buffer
	if code := run([]string{"totals", path}, &out, &errs); code != 0 {
		t.Fatalf("run returned %d, want 0 (stderr: %s)", code, errs.String())
	}

	lines := strings.Split(strings.TrimSuffix(out.String(), "\n"), "\n")
	if len(lines) != 4 {
		t.Fatalf("run wrote %d lines, want 4:\n%s", len(lines), out.String())
	}
	for i, line := range lines {
		if len(line) != len(lines[0]) {
			t.Errorf("line %d is %d wide, line 0 is %d wide: %q", i, len(line), len(lines[0]), line)
		}
	}
	if !strings.HasPrefix(lines[0], "groceries") {
		t.Errorf("first line = %q, want it to start with groceries", lines[0])
	}
	if !strings.HasPrefix(lines[3], "TOTAL") {
		t.Errorf("last line = %q, want it to start with TOTAL", lines[3])
	}
	if !strings.HasSuffix(lines[3], "1257.50") {
		t.Errorf("last line = %q, want it to end with 1257.50", lines[3])
	}
}

func TestRunWithNoArgumentsPrintsUsage(t *testing.T) {
	var out, errs bytes.Buffer
	if code := run(nil, &out, &errs); code == 0 {
		t.Error("run with no arguments returned 0, want non-zero")
	}
	if !strings.Contains(errs.String(), "usage") {
		t.Errorf("stderr = %q, want it to mention usage", errs.String())
	}
}

func TestRunOnAMissingFileFails(t *testing.T) {
	var out, errs bytes.Buffer
	if code := run([]string{"totals", filepath.Join(t.TempDir(), "gone.ledger")}, &out, &errs); code == 0 {
		t.Error("run on a missing file returned 0, want non-zero")
	}
	if out.Len() != 0 {
		t.Errorf("run wrote %q to stdout for a missing file, want nothing", out.String())
	}
}
