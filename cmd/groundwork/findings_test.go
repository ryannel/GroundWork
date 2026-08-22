package main

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

// fixtureEntry builds one entry of a findings ledger: a heading, one line of
// prose, then the lines given, which are usually the two labels.
func fixtureEntry(id, title string, rest ...string) string {
	lines := []string{
		"## " + id + " — 2026-08-22 — " + title,
		"",
		"What it is: something went wrong.",
		"",
	}
	lines = append(lines, rest...)

	return strings.Join(lines, "\n") + "\n\n"
}

// writeLedgers writes a findings ledger, and a decisions ledger, under the
// repo root at dir. Either body may be empty, which writes nothing.
func writeLedgers(t *testing.T, dir, findings, decisions string) {
	t.Helper()

	docs := filepath.Join(dir, "docs")
	if err := os.MkdirAll(docs, 0o750); err != nil {
		t.Fatalf("could not make the docs directory: %v", err)
	}

	for name, body := range map[string]string{"findings.md": findings, "decisions.md": decisions} {
		if body == "" {
			continue
		}
		path := filepath.Join(docs, name)
		if err := os.WriteFile(path, []byte(body), 0o600); err != nil {
			t.Fatalf("could not write %s: %v", path, err)
		}
	}
}

// goodLedger is a findings ledger whose every entry is attributed and
// classified, with no class anywhere near the recurrence threshold.
func goodLedger() string {
	return "# Findings\n\n" +
		fixtureEntry("F1", "One", "Caught by: driver — the pre-push check", "Class: other — a git slip") +
		fixtureEntry("F2", "Two", "Caught by: blind-review — slice 1's review", "Class: green-but-wrong")
}

func TestRunFindingsCheckExitsOKOnAGoodLedger(t *testing.T) {
	dir := newRepo(t)
	writeLedgers(t, dir, goodLedger(), "")

	code, out, errOut := call(t, "findings", "check")
	if code != 0 {
		t.Fatalf("exit code is %d, want 0. stderr: %s", code, errOut)
	}
	if !strings.Contains(out, "2 findings") {
		t.Errorf("stdout is %q, want it to say how many findings it read", out)
	}
	if errOut != "" {
		t.Errorf("stderr is %q, want it empty on a pass", errOut)
	}
}

func TestRunFindingsCheckNamesEveryBadEntry(t *testing.T) {
	dir := newRepo(t)
	writeLedgers(t, dir, "# Findings\n\n"+
		fixtureEntry("F1", "One", "Caught by: driver — the pre-push check", "Class: register")+
		fixtureEntry("F2", "Two", "Class: register")+
		fixtureEntry("F3", "Three", "Caught by: reviewer — a review", "Class: register")+
		fixtureEntry("F4", "Four", "Caught by: driver", "Class: register")+
		fixtureEntry("F5", "Five", "Caught by: driver — a check")+
		fixtureEntry("F6", "Six", "Caught by: driver — a check", "Class: flaky-test")+
		fixtureEntry("F7", "Seven", "Caught by: driver — a check", "Class: other"), "")

	code, _, errOut := call(t, "findings", "check")
	if code != 1 {
		t.Fatalf("exit code is %d, want 1", code)
	}
	for _, id := range []string{"F2", "F3", "F4", "F5", "F6", "F7"} {
		if !strings.Contains(errOut, id+":") {
			t.Errorf("stderr does not name %s:\n%s", id, errOut)
		}
	}
	if strings.Contains(errOut, "F1:") {
		t.Errorf("stderr names F1, which is well-formed:\n%s", errOut)
	}
}

// One problem is one problem, not "1 problems". And a problem points at the
// file and the line a reader has to open.
func TestRunFindingsCheckCountsOneProblemInTheSingular(t *testing.T) {
	dir := newRepo(t)
	writeLedgers(t, dir, "# Findings\n\n"+
		fixtureEntry("F1", "One", "Caught by: driver — a check", "Class: register")+
		fixtureEntry("F2", "Two", "Caught by: driver — a check"), "")

	code, _, errOut := call(t, "findings", "check")
	if code != 1 {
		t.Fatalf("exit code is %d, want 1", code)
	}
	if !strings.Contains(errOut, "1 problem in") {
		t.Errorf("stderr is %q, want it to count one problem in the singular", errOut)
	}
	if strings.Contains(errOut, "1 problems") {
		t.Errorf("stderr is %q, want no plural on a count of one", errOut)
	}
	if !strings.Contains(errOut, "findings.md:") {
		t.Errorf("stderr is %q, want it to point at the file and line", errOut)
	}
}

// A heading that means to be an entry heading, and is not one, fails the run
// rather than dropping a finding out of the ledger without a word.
func TestRunFindingsCheckFailsAHeadingAtTheWrongLevel(t *testing.T) {
	dir := newRepo(t)
	writeLedgers(t, dir, "# Findings\n\n"+
		fixtureEntry("F1", "One", "Caught by: driver — a check", "Class: register")+
		"### F2 — 2026-08-22 — Written at the wrong level\n\n"+
		"Caught by: driver — a check\nClass: register\n", "")

	code, _, errOut := call(t, "findings", "check")
	if code != 1 {
		t.Fatalf("exit code is %d, want 1", code)
	}
	if !strings.Contains(errOut, "### F2") {
		t.Errorf("stderr is %q, want it to quote the heading it refused", errOut)
	}
}

func TestRunFindingsCheckReadsTheLedgerFromTheRepoRoot(t *testing.T) {
	dir := newRepo(t)
	writeLedgers(t, dir, goodLedger(), "")

	sub := filepath.Join(dir, "internal", "deep")
	if err := os.MkdirAll(sub, 0o750); err != nil {
		t.Fatalf("could not make a subdirectory: %v", err)
	}
	t.Chdir(sub)

	code, out, errOut := call(t, "findings", "check")
	if code != 0 {
		t.Fatalf("exit code is %d, want 0. stderr: %s", code, errOut)
	}
	if !strings.Contains(out, "2 findings") {
		t.Errorf("stdout is %q, want it to say how many findings it read", out)
	}
}

func TestRunFindingsCheckFailsWithNoLedger(t *testing.T) {
	newRepo(t)

	code, _, errOut := call(t, "findings", "check")
	if code != 1 {
		t.Errorf("exit code is %d, want 1", code)
	}
	if !strings.Contains(errOut, "findings.md") {
		t.Errorf("stderr is %q, want it to name the file it could not read", errOut)
	}
}

func TestRunFindingsCheckFailsOutsideARepo(t *testing.T) {
	t.Chdir(t.TempDir())

	code, _, errOut := call(t, "findings", "check")
	if code != 1 {
		t.Errorf("exit code is %d, want 1", code)
	}
	if !strings.Contains(errOut, "git repository") {
		t.Errorf("stderr is %q, want it to say this is not a git repository", errOut)
	}
}

func TestRunFindingsRecurExitsOKWhenTheClassIsNamed(t *testing.T) {
	dir := newRepo(t)
	writeLedgers(t, dir, "# Findings\n\n"+
		fixtureEntry("F1", "One", "Caught by: driver — a check", "Class: green-but-wrong")+
		fixtureEntry("F2", "Two", "Caught by: driver — a check", "Class: green-but-wrong")+
		fixtureEntry("F3", "Three", "Caught by: driver — a check", "Class: green-but-wrong"),
		"# Decisions\n\n## D18 — the green-but-wrong class tripped its threshold\n")

	code, out, errOut := call(t, "findings", "recur")
	if code != 0 {
		t.Fatalf("exit code is %d, want 0. stderr: %s", code, errOut)
	}
	if !strings.Contains(out, "green-but-wrong") || !strings.Contains(out, "3") {
		t.Errorf("stdout is %q, want the class and its count", out)
	}
}

func TestRunFindingsRecurFailsAnOverThresholdClassWithNoDecision(t *testing.T) {
	dir := newRepo(t)
	writeLedgers(t, dir, "# Findings\n\n"+
		fixtureEntry("F1", "One", "Caught by: driver — a check", "Class: green-but-wrong")+
		fixtureEntry("F2", "Two", "Caught by: driver — a check", "Class: green-but-wrong")+
		fixtureEntry("F3", "Three", "Caught by: driver — a check", "Class: green-but-wrong"),
		"# Decisions\n\nNothing about that class here.\n")

	code, out, errOut := call(t, "findings", "recur")
	if code != 1 {
		t.Fatalf("exit code is %d, want 1. stderr: %s", code, errOut)
	}
	// The counts print whether the run passes or fails, so a reader can
	// see where every class stands, not only the one that failed.
	if !strings.Contains(out, "green-but-wrong") {
		t.Errorf("stdout is %q, want the counts printed on a failure too", out)
	}
	if !strings.Contains(errOut, "green-but-wrong") {
		t.Errorf("stderr is %q, want it to name the class with no decision", errOut)
	}
}

func TestRunFindingsRecurFailsWithNoDecisionsLedger(t *testing.T) {
	dir := newRepo(t)
	writeLedgers(t, dir, goodLedger(), "")

	code, _, errOut := call(t, "findings", "recur")
	if code != 1 {
		t.Errorf("exit code is %d, want 1", code)
	}
	if !strings.Contains(errOut, "decisions.md") {
		t.Errorf("stderr is %q, want it to name the file it could not read", errOut)
	}
}

func TestRunFindingsRejectsBadUsage(t *testing.T) {
	cases := []struct {
		name string
		args []string
	}{
		{"no subcommand", []string{"findings"}},
		{"unknown subcommand", []string{"findings", "checked"}},
		{"an argument check does not take", []string{"findings", "check", "docs/findings.md"}},
		{"an argument recur does not take", []string{"findings", "recur", "docs/findings.md"}},
	}

	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			newRepo(t)

			code, out, errOut := call(t, c.args...)
			if code != 2 {
				t.Errorf("exit code is %d, want 2", code)
			}
			if out != "" {
				t.Errorf("stdout is %q, want usage errors on stderr only", out)
			}
			if !strings.Contains(errOut, "usage:") {
				t.Errorf("stderr is %q, want it to show the usage", errOut)
			}
		})
	}
}
