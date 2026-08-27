package main

import (
	"bytes"
	"encoding/json"
	"os"
	"os/exec"
	"path/filepath"
	"strconv"
	"strings"
	"testing"

	"github.com/ryannel/groundwork/internal/journal"
)

// newRepo makes a git repo with one commit in a temp dir, and moves the test
// into it. The CLI works on the current directory, like git does.
func newRepo(t *testing.T) string {
	t.Helper()

	dir := t.TempDir()
	for _, args := range [][]string{
		{"init", "-b", "main"},
		{"config", "user.name", "Test Person"},
		{"config", "user.email", "test@example.com"},
		// D64 ruling 9: a fixture has nothing to sign, and the host's signing
		// shim dies under load, which reads as a proof that failed (F104).
		{"config", "commit.gpgsign", "false"},
	} {
		runGit(t, dir, args...)
	}

	path := filepath.Join(dir, "README.md")
	if err := os.WriteFile(path, []byte("start\n"), 0o600); err != nil {
		t.Fatalf("could not write %s: %v", path, err)
	}
	runGit(t, dir, "add", "README.md")
	runGit(t, dir, "commit", "-m", "first")

	t.Chdir(dir)

	return dir
}

// runGit runs one git command in dir and returns its trimmed stdout.
func runGit(t *testing.T, dir string, args ...string) string {
	t.Helper()

	cmd := exec.Command("git", append([]string{"-C", dir}, args...)...)
	var out, errOut bytes.Buffer
	cmd.Stdout = &out
	cmd.Stderr = &errOut
	if err := cmd.Run(); err != nil {
		t.Fatalf("git %s failed: %v: %s", strings.Join(args, " "), err, errOut.String())
	}

	return strings.TrimSpace(out.String())
}

// call runs the CLI and returns its exit code, stdout and stderr.
func call(t *testing.T, args ...string) (int, string, string) {
	t.Helper()

	var out, errOut bytes.Buffer
	code := run(args, &out, &errOut)

	return code, out.String(), errOut.String()
}

// dispatchArgs is a full set of valid flags for journal dispatch.
func dispatchArgs(extra ...string) []string {
	args := []string{
		"journal", "dispatch",
		"--role", "worker",
		"--tier", "execution",
		"--tokens-in", "120",
		"--tokens-out", "45",
		"--duration-ms", "9100",
		"--outcome", "ok",
	}

	return append(args, extra...)
}

func TestRunRejectsBadUsage(t *testing.T) {
	cases := []struct {
		name string
		args []string
	}{
		{"no arguments", nil},
		{"unknown verb", []string{"jounral"}},
		{"journal with no subcommand", []string{"journal"}},
		{"unknown journal subcommand", []string{"journal", "dispatched"}},
		{"unknown flag", dispatchArgs("--colour", "blue")},
		{"missing role", []string{"journal", "dispatch", "--tier", "execution", "--outcome", "ok"}},
		{"missing outcome", []string{
			"journal", "dispatch",
			"--role", "worker", "--tier", "execution",
			"--tokens-in", "1", "--tokens-out", "1", "--duration-ms", "1",
		}},
	}

	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			newRepo(t)
			t.Setenv("GROUNDWORK_SESSION", "s-alpha")

			code, out, errOut := call(t, c.args...)
			if code != 2 {
				t.Errorf("exit code is %d, want 2", code)
			}
			if errOut == "" {
				t.Errorf("bad usage should say something on stderr")
			}
			if out != "" {
				t.Errorf("bad usage should print nothing on stdout, got %q", out)
			}
		})
	}
}

func TestRunRejectsAValueOutsideTheVocabulary(t *testing.T) {
	newRepo(t)
	t.Setenv("GROUNDWORK_SESSION", "s-alpha")

	args := dispatchArgs()
	args[3] = "supervisor"

	code, out, errOut := call(t, args...)
	if code != 1 {
		t.Errorf("exit code is %d, want 1", code)
	}
	if errOut == "" {
		t.Errorf("a failed write should say something on stderr")
	}
	if out != "" {
		t.Errorf("a failed write should print nothing on stdout, got %q", out)
	}
}

func TestRunWritesADispatch(t *testing.T) {
	dir := newRepo(t)
	t.Setenv("GROUNDWORK_SESSION", "s-alpha")

	code, out, errOut := call(t, dispatchArgs()...)
	if code != 0 {
		t.Fatalf("exit code is %d, want 0. stderr: %s", code, errOut)
	}

	path := strings.TrimSpace(out)
	if !strings.HasPrefix(path, "events/s-alpha/") {
		t.Fatalf("the CLI printed %q, want a path under events/s-alpha/", path)
	}

	raw := runGit(t, dir, "cat-file", "blob", "refs/groundwork/journal:"+path)

	var event map[string]any
	if err := json.Unmarshal([]byte(raw), &event); err != nil {
		t.Fatalf("the written event is not valid JSON: %v", err)
	}

	want := map[string]any{
		"kind":          "dispatch",
		"role":          "worker",
		"tier":          "execution",
		"tokens_source": "unset",
		"outcome":       "ok",
	}
	for field, value := range want {
		if event[field] != value {
			t.Errorf("field %q is %v, want %v", field, event[field], value)
		}
	}
	if event["duration_ms"] != float64(9100) {
		t.Errorf("field \"duration_ms\" is %v, want 9100", event["duration_ms"])
	}
}

func TestRunTakesATokensSource(t *testing.T) {
	dir := newRepo(t)
	t.Setenv("GROUNDWORK_SESSION", "s-alpha")

	code, out, errOut := call(t, dispatchArgs("--tokens-source", "estimated")...)
	if code != 0 {
		t.Fatalf("exit code is %d, want 0. stderr: %s", code, errOut)
	}

	raw := runGit(t, dir, "cat-file", "blob", "refs/groundwork/journal:"+strings.TrimSpace(out))

	var event map[string]any
	if err := json.Unmarshal([]byte(raw), &event); err != nil {
		t.Fatalf("the written event is not valid JSON: %v", err)
	}
	if event["tokens_source"] != "estimated" {
		t.Errorf("field \"tokens_source\" is %v, want \"estimated\"", event["tokens_source"])
	}
}

func TestRunSaysWhenItIsNotInARepo(t *testing.T) {
	t.Chdir(t.TempDir())
	t.Setenv("GROUNDWORK_SESSION", "s-alpha")

	code, out, errOut := call(t, dispatchArgs()...)
	if code != 1 {
		t.Errorf("exit code is %d, want 1", code)
	}
	if !strings.Contains(errOut, "not in a git repository") {
		t.Errorf("stderr is %q, want it to say it is not in a git repository", errOut)
	}
	if strings.Contains(errOut, "rev-parse") {
		t.Errorf("stderr is %q, want plain words rather than git's own output", errOut)
	}
	if out != "" {
		t.Errorf("a failed write should print nothing on stdout, got %q", out)
	}
}

func TestRunDefaultsTheTokensSourceToUnset(t *testing.T) {
	dir := newRepo(t)
	t.Setenv("GROUNDWORK_SESSION", "s-alpha")

	code, out, errOut := call(t, dispatchArgs()...)
	if code != 0 {
		t.Fatalf("exit code is %d, want 0. stderr: %s", code, errOut)
	}

	raw := runGit(t, dir, "cat-file", "blob", "refs/groundwork/journal:"+strings.TrimSpace(out))

	var event map[string]any
	if err := json.Unmarshal([]byte(raw), &event); err != nil {
		t.Fatalf("the written event is not valid JSON: %v", err)
	}
	if event["tokens_source"] != "unset" {
		t.Errorf("field \"tokens_source\" is %v, want \"unset\"", event["tokens_source"])
	}
}

// eventAt reads one journal event and unmarshals it.
func eventAt(t *testing.T, dir, path string) map[string]any {
	t.Helper()

	raw := runGit(t, dir, "cat-file", "blob", "refs/groundwork/journal:"+path)

	var event map[string]any
	if err := json.Unmarshal([]byte(raw), &event); err != nil {
		t.Fatalf("the event at %s is not valid JSON: %v", path, err)
	}

	return event
}

// dialArgs is a full set of valid flags for journal dial.
func dialArgs(extra ...string) []string {
	args := []string{
		"journal", "dial",
		"--to", "bet",
		"--scope", "bet-1",
		"--reason", "the plan is ready",
	}

	return append(args, extra...)
}

// sealArgs is a full set of valid flags for journal seal.
func sealArgs(extra ...string) []string {
	args := []string{
		"journal", "seal",
		"--kind", "acceptance",
		"--tag", "seal-1",
	}

	return append(args, extra...)
}

func TestRunWritesADial(t *testing.T) {
	dir := newRepo(t)
	t.Setenv("GROUNDWORK_SESSION", "s-alpha")

	code, out, errOut := call(t, dialArgs()...)
	if code != 0 {
		t.Fatalf("exit code is %d, want 0. stderr: %s", code, errOut)
	}

	path := strings.TrimSpace(out)
	if !strings.HasPrefix(path, "events/s-alpha/") {
		t.Fatalf("the CLI printed %q, want a path under events/s-alpha/", path)
	}

	event := eventAt(t, dir, path)
	want := map[string]any{
		"kind":   "dial",
		"from":   "slice",
		"to":     "bet",
		"scope":  "bet-1",
		"reason": "the plan is ready",
	}
	for field, value := range want {
		if event[field] != value {
			t.Errorf("field %q is %v, want %v", field, event[field], value)
		}
	}
}

func TestRunChainsTheDialFromTheRef(t *testing.T) {
	dir := newRepo(t)
	t.Setenv("GROUNDWORK_SESSION", "s-alpha")

	if code, _, errOut := call(t, dialArgs("--to", "milestone")...); code != 0 {
		t.Fatalf("the first dial exited %d. stderr: %s", code, errOut)
	}

	code, out, errOut := call(t, dialArgs()...)
	if code != 0 {
		t.Fatalf("the second dial exited %d. stderr: %s", code, errOut)
	}

	event := eventAt(t, dir, strings.TrimSpace(out))
	if event["from"] != "milestone" {
		t.Errorf("field \"from\" is %v, want \"milestone\"", event["from"])
	}
}

func TestRunRejectsAnUnknownRung(t *testing.T) {
	newRepo(t)
	t.Setenv("GROUNDWORK_SESSION", "s-alpha")

	code, out, errOut := call(t, dialArgs("--to", "everything")...)
	if code != 1 {
		t.Errorf("exit code is %d, want 1", code)
	}
	if errOut == "" {
		t.Errorf("a failed write should say something on stderr")
	}
	if out != "" {
		t.Errorf("a failed write should print nothing on stdout, got %q", out)
	}
}

func TestRunWritesASeal(t *testing.T) {
	dir := newRepo(t)
	t.Setenv("GROUNDWORK_SESSION", "s-alpha")

	head := runGit(t, dir, "rev-parse", "HEAD")
	runGit(t, dir, "tag", "-a", "seal-1", "-m", "a seal")

	code, out, errOut := call(t, sealArgs()...)
	if code != 0 {
		t.Fatalf("exit code is %d, want 0. stderr: %s", code, errOut)
	}

	event := eventAt(t, dir, strings.TrimSpace(out))
	want := map[string]any{
		"kind":      "seal",
		"seal_kind": "acceptance",
		"tag":       "seal-1",
		"target":    head,
		"action":    "granted",
	}
	for field, value := range want {
		if event[field] != value {
			t.Errorf("field %q is %v, want %v", field, event[field], value)
		}
	}
}

func TestRunTakesARevokedSeal(t *testing.T) {
	dir := newRepo(t)
	t.Setenv("GROUNDWORK_SESSION", "s-alpha")

	runGit(t, dir, "tag", "seal-1")

	code, out, errOut := call(t, sealArgs("--action", "revoked")...)
	if code != 0 {
		t.Fatalf("exit code is %d, want 0. stderr: %s", code, errOut)
	}

	if got := eventAt(t, dir, strings.TrimSpace(out))["action"]; got != "revoked" {
		t.Errorf("field \"action\" is %v, want \"revoked\"", got)
	}
}

func TestRunSaysWhenTheTagIsMissing(t *testing.T) {
	newRepo(t)
	t.Setenv("GROUNDWORK_SESSION", "s-alpha")

	code, out, errOut := call(t, sealArgs()...)
	if code != 1 {
		t.Errorf("exit code is %d, want 1", code)
	}
	if !strings.Contains(errOut, "seal-1") {
		t.Errorf("stderr is %q, want it to name the missing tag", errOut)
	}
	if out != "" {
		t.Errorf("a failed write should print nothing on stdout, got %q", out)
	}
}

func TestRunRejectsBadDialAndSealUsage(t *testing.T) {
	cases := []struct {
		name string
		args []string
	}{
		{"dial with no flags", []string{"journal", "dial"}},
		{"dial with no rung", []string{"journal", "dial", "--scope", "bet-1", "--reason", "why"}},
		{"dial with no scope", []string{"journal", "dial", "--to", "bet", "--reason", "why"}},
		{"dial with no reason", []string{"journal", "dial", "--to", "bet", "--scope", "bet-1"}},
		{"dial with an unknown flag", dialArgs("--rung", "bet")},
		{"dial with a spare argument", dialArgs("extra")},
		{"seal with no flags", []string{"journal", "seal"}},
		{"seal with no kind", []string{"journal", "seal", "--tag", "seal-1"}},
		{"seal with no tag", []string{"journal", "seal", "--kind", "acceptance"}},
		{"seal with an unknown flag", sealArgs("--target", "HEAD")},
		{"seal with a spare argument", sealArgs("extra")},
	}

	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			newRepo(t)
			t.Setenv("GROUNDWORK_SESSION", "s-alpha")

			code, out, errOut := call(t, c.args...)
			if code != 2 {
				t.Errorf("exit code is %d, want 2", code)
			}
			if errOut == "" {
				t.Errorf("bad usage should say something on stderr")
			}
			if out != "" {
				t.Errorf("bad usage should print nothing on stdout, got %q", out)
			}
		})
	}
}

func TestRunRejectsAnUnknownSealAction(t *testing.T) {
	dir := newRepo(t)
	t.Setenv("GROUNDWORK_SESSION", "s-alpha")

	runGit(t, dir, "tag", "seal-1")

	code, out, errOut := call(t, sealArgs("--action", "moved")...)
	if code != 1 {
		t.Errorf("exit code is %d, want 1", code)
	}
	if errOut == "" {
		t.Errorf("a failed write should say something on stderr")
	}
	if out != "" {
		t.Errorf("a failed write should print nothing on stdout, got %q", out)
	}
}

func TestRunCountsSeqAcrossTheVerbs(t *testing.T) {
	dir := newRepo(t)
	t.Setenv("GROUNDWORK_SESSION", "s-alpha")

	runGit(t, dir, "tag", "seal-1")

	runs := [][]string{dispatchArgs(), dialArgs(), sealArgs(), dispatchArgs("--outcome", "retry")}

	for i, args := range runs {
		code, out, errOut := call(t, args...)
		if code != 0 {
			t.Fatalf("run %d exited %d. stderr: %s", i, code, errOut)
		}

		event := eventAt(t, dir, strings.TrimSpace(out))
		if event["seq"] != float64(i+1) {
			t.Errorf("run %d has seq %v, want %d", i, event["seq"], i+1)
		}
	}
}

func TestRunSaysWhenADialIsNotInARepo(t *testing.T) {
	t.Chdir(t.TempDir())
	t.Setenv("GROUNDWORK_SESSION", "s-alpha")

	code, _, errOut := call(t, dialArgs()...)
	if code != 1 {
		t.Errorf("exit code is %d, want 1", code)
	}
	if !strings.Contains(errOut, "not in a git repository") {
		t.Errorf("stderr is %q, want it to say it is not in a git repository", errOut)
	}
}

func TestRunSaysWhenASealIsNotInARepo(t *testing.T) {
	t.Chdir(t.TempDir())
	t.Setenv("GROUNDWORK_SESSION", "s-alpha")

	code, _, errOut := call(t, sealArgs()...)
	if code != 1 {
		t.Errorf("exit code is %d, want 1", code)
	}
	if !strings.Contains(errOut, "not in a git repository") {
		t.Errorf("stderr is %q, want it to say it is not in a git repository", errOut)
	}
}

// spendDispatchArgs is a set of dispatch flags with the numbers a spend test
// wants to control.
func spendDispatchArgs(role, tier string, tokensIn, tokensOut, durationMS int) []string {
	return []string{
		"journal", "dispatch",
		"--role", role,
		"--tier", tier,
		"--tokens-in", strconv.Itoa(tokensIn),
		"--tokens-out", strconv.Itoa(tokensOut),
		"--duration-ms", strconv.Itoa(durationMS),
		"--outcome", "ok",
	}
}

func TestRunRejectsBadSpendUsage(t *testing.T) {
	cases := []struct {
		name string
		args []string
	}{
		{"spend with no flags", []string{"journal", "spend"}},
		{"spend with an unknown by", []string{"journal", "spend", "--by", "everything"}},
		{"spend with an unknown flag", []string{"journal", "spend", "--by", "role", "--group", "role"}},
		{"spend with a spare argument", []string{"journal", "spend", "--by", "role", "extra"}},
	}

	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			newRepo(t)
			t.Setenv("GROUNDWORK_SESSION", "s-alpha")

			code, out, errOut := call(t, c.args...)
			if code != 2 {
				t.Errorf("exit code is %d, want 2", code)
			}
			if errOut == "" {
				t.Errorf("bad usage should say something on stderr")
			}
			if out != "" {
				t.Errorf("bad usage should print nothing on stdout, got %q", out)
			}
		})
	}
}

func TestRunJournalSpendOnAnEmptyJournal(t *testing.T) {
	newRepo(t)
	t.Setenv("GROUNDWORK_SESSION", "s-alpha")

	code, out, errOut := call(t, "journal", "spend", "--by", "role")
	if code != 0 {
		t.Fatalf("exit code is %d, want 0. stderr: %s", code, errOut)
	}
	if out != "the journal is empty\n" {
		t.Errorf("stdout is %q, want %q", out, "the journal is empty\n")
	}
}

func TestRunJournalSpendOnAJournalWithNoDispatchLines(t *testing.T) {
	dir := newRepo(t)
	t.Setenv("GROUNDWORK_SESSION", "s-alpha")

	runGit(t, dir, "tag", "seal-1")
	if code, _, errOut := call(t, dialArgs()...); code != 0 {
		t.Fatalf("the dial exited %d. stderr: %s", code, errOut)
	}
	if code, _, errOut := call(t, sealArgs()...); code != 0 {
		t.Fatalf("the seal exited %d. stderr: %s", code, errOut)
	}

	code, out, errOut := call(t, "journal", "spend", "--by", "role")
	if code != 0 {
		t.Fatalf("exit code is %d, want 0. stderr: %s", code, errOut)
	}
	// A journal ref exists here, unlike TestRunJournalSpendOnAnEmptyJournal.
	// It just has nothing that spends: that is a different, and equally
	// honest, kind of nothing, so it gets different words.
	want := "the journal holds no dispatch lines\n"
	if out != want {
		t.Errorf("stdout is %q, want %q", out, want)
	}
}

func TestRunJournalSpendOutsideARepo(t *testing.T) {
	t.Chdir(t.TempDir())
	t.Setenv("GROUNDWORK_SESSION", "s-alpha")

	code, out, errOut := call(t, "journal", "spend", "--by", "role")
	if code != 1 {
		t.Errorf("exit code is %d, want 1", code)
	}
	if !strings.Contains(errOut, "not in a git repository") {
		t.Errorf("stderr is %q, want it to say it is not in a git repository", errOut)
	}
	if out != "" {
		t.Errorf("a failed query should print nothing on stdout, got %q", out)
	}
}

// tableRows splits a spend table's stdout into whitespace-separated fields,
// one slice per line. Splitting on whitespace recovers each cell exactly,
// because tabwriter pads with spaces rather than embedding tabs, and no
// spend field ever holds a space itself.
func tableRows(out string) [][]string {
	var rows [][]string
	for _, line := range strings.Split(strings.TrimRight(out, "\n"), "\n") {
		rows = append(rows, strings.Fields(line))
	}
	return rows
}

func TestRunJournalSpendReportsTotalsByRole(t *testing.T) {
	newRepo(t)
	t.Setenv("GROUNDWORK_SESSION", "s-alpha")

	// worker: (300+60) + (150+30) = 540 total, 2 dispatches, 4500ms.
	if code, _, errOut := call(t, spendDispatchArgs("worker", "execution", 300, 60, 3000)...); code != 0 {
		t.Fatalf("the first dispatch exited %d. stderr: %s", code, errOut)
	}
	if code, _, errOut := call(t, spendDispatchArgs("worker", "execution", 150, 30, 1500)...); code != 0 {
		t.Fatalf("the second dispatch exited %d. stderr: %s", code, errOut)
	}
	// driver: 10+5 = 15 total, 1 dispatch, 200ms.
	if code, _, errOut := call(t, spendDispatchArgs("driver", "frontier", 10, 5, 200)...); code != 0 {
		t.Fatalf("the third dispatch exited %d. stderr: %s", code, errOut)
	}

	code, out, errOut := call(t, "journal", "spend", "--by", "role")
	if code != 0 {
		t.Fatalf("exit code is %d, want 0. stderr: %s", code, errOut)
	}

	rows := tableRows(out)
	if len(rows) != 4 {
		t.Fatalf("the table has %d lines, want 4 (header, worker, driver, total): %q", len(rows), out)
	}

	if rows[0][0] != "ROLE" {
		t.Errorf("the header's first column is %q, want ROLE", rows[0][0])
	}

	// worker's total (540) beats driver's (15), so it comes first.
	want := [][]string{
		{"worker", "2", "450", "90", "540", "4500"},
		{"driver", "1", "10", "5", "15", "200"},
		{"(total)", "3", "460", "95", "555", "4700"},
	}
	for i, w := range want {
		got := rows[i+1]
		if len(got) != len(w) {
			t.Fatalf("row %d is %v, want %v", i, got, w)
		}
		for c := range w {
			if got[c] != w[c] {
				t.Errorf("row %d column %d is %q, want %q (row: %v)", i, c, got[c], w[c], got)
			}
		}
	}
}

func TestRunJournalSpendGroupsByTier(t *testing.T) {
	newRepo(t)
	t.Setenv("GROUNDWORK_SESSION", "s-alpha")

	if code, _, errOut := call(t, spendDispatchArgs("worker", "execution", 100, 20, 1000)...); code != 0 {
		t.Fatalf("the first dispatch exited %d. stderr: %s", code, errOut)
	}
	if code, _, errOut := call(t, spendDispatchArgs("driver", "frontier", 10, 5, 200)...); code != 0 {
		t.Fatalf("the second dispatch exited %d. stderr: %s", code, errOut)
	}

	code, out, errOut := call(t, "journal", "spend", "--by", "tier")
	if code != 0 {
		t.Fatalf("exit code is %d, want 0. stderr: %s", code, errOut)
	}

	rows := tableRows(out)
	if len(rows) != 4 {
		t.Fatalf("the table has %d lines, want 4: %q", len(rows), out)
	}
	if rows[0][0] != "TIER" {
		t.Errorf("the header's first column is %q, want TIER", rows[0][0])
	}
	if rows[1][0] != "execution" || rows[2][0] != "frontier" {
		t.Errorf("rows are in order %v then %v, want execution then frontier", rows[1], rows[2])
	}
}

func TestRunJournalSpendGroupsBySession(t *testing.T) {
	newRepo(t)

	t.Setenv("GROUNDWORK_SESSION", "s-alpha")
	if code, _, errOut := call(t, spendDispatchArgs("worker", "execution", 100, 20, 1000)...); code != 0 {
		t.Fatalf("the first dispatch exited %d. stderr: %s", code, errOut)
	}

	t.Setenv("GROUNDWORK_SESSION", "s-beta")
	if code, _, errOut := call(t, spendDispatchArgs("worker", "execution", 10, 5, 200)...); code != 0 {
		t.Fatalf("the second dispatch exited %d. stderr: %s", code, errOut)
	}

	code, out, errOut := call(t, "journal", "spend", "--by", "session")
	if code != 0 {
		t.Fatalf("exit code is %d, want 0. stderr: %s", code, errOut)
	}

	rows := tableRows(out)
	if len(rows) != 4 {
		t.Fatalf("the table has %d lines, want 4: %q", len(rows), out)
	}
	if rows[0][0] != "SESSION" {
		t.Errorf("the header's first column is %q, want SESSION", rows[0][0])
	}
	if rows[1][0] != "s-alpha" || rows[2][0] != "s-beta" {
		t.Errorf("rows are in order %v then %v, want s-alpha then s-beta", rows[1], rows[2])
	}
}

// spendRows is a small, direct-call fixture for the table formatter alone.
// It is not a journal fixture: it never touches git, and every number here
// is fed straight into spendTable, not read back from anything spendTable
// wrote.
func spendRows() []journal.SpendRow {
	return []journal.SpendRow{
		{Key: "worker", Dispatches: 2, TokensIn: 150, TokensOut: 30, TokensTotal: 180, DurationMS: 1500},
		{Key: "driver", Dispatches: 1, TokensIn: 10, TokensOut: 5, TokensTotal: 15, DurationMS: 200},
	}
}

func TestSpendTableRendersHeaderRowsAndTotal(t *testing.T) {
	rows := tableRows(spendTable("role", spendRows()))

	if len(rows) != 4 {
		t.Fatalf("the table has %d lines, want 4: %v", len(rows), rows)
	}

	want := [][]string{
		{"ROLE", "DISPATCHES", "TOKENS_IN", "TOKENS_OUT", "TOKENS_TOTAL", "DURATION_MS"},
		{"worker", "2", "150", "30", "180", "1500"},
		{"driver", "1", "10", "5", "15", "200"},
		{"(total)", "3", "160", "35", "195", "1700"},
	}
	for i, w := range want {
		if len(rows[i]) != len(w) {
			t.Fatalf("row %d is %v, want %v", i, rows[i], w)
		}
		for c := range w {
			if rows[i][c] != w[c] {
				t.Errorf("row %d column %d is %q, want %q", i, c, rows[i][c], w[c])
			}
		}
	}
}

func TestSpendTableOnOneRow(t *testing.T) {
	rows := tableRows(spendTable("session", []journal.SpendRow{
		{Key: "s-alpha", Dispatches: 1, TokensIn: 7, TokensOut: 3, TokensTotal: 10, DurationMS: 50},
	}))

	if len(rows) != 3 {
		t.Fatalf("the table has %d lines, want 3: %v", len(rows), rows)
	}
	if rows[0][0] != "SESSION" {
		t.Errorf("the header's first column is %q, want SESSION", rows[0][0])
	}
	if rows[1][0] != "s-alpha" {
		t.Errorf("row 1 is %v, want it to start with s-alpha", rows[1])
	}
	if rows[2][0] != "(total)" || rows[2][1] != "1" {
		t.Errorf("the total row is %v, want it to start with (total) 1", rows[2])
	}
}
