package main

import (
	"encoding/json"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"strings"
	"testing"

	"github.com/ryannel/groundwork/internal/battery"
	"github.com/ryannel/groundwork/internal/journal"
	"github.com/ryannel/groundwork/internal/manifest"
)

// writeLock puts a lock file at the root of the repo at dir.
func writeLock(t *testing.T, dir, version, digest string) {
	t.Helper()

	line := fmt.Sprintf("{\"version\":%q,\"digest\":%q}\n", version, digest)
	path := filepath.Join(dir, battery.LockFile)
	if err := os.WriteFile(path, []byte(line), 0o600); err != nil {
		t.Fatalf("could not write %s: %v", path, err)
	}
}

// writeManifest puts a manifest at the root of the repo at dir, with the one
// suite its one capability names. A green verify run needs every shipped row
// green, and the manifest row reads this file.
func writeManifest(t *testing.T, dir string) {
	t.Helper()

	path := filepath.Join(dir, manifest.File)
	if err := os.MkdirAll(filepath.Dir(path), 0o750); err != nil {
		t.Fatalf("could not make %s: %v", filepath.Dir(path), err)
	}

	const content = `{
  "schema": 1,
  "surfaces": [{"name": "cli", "profile": "cli", "stack": "go", "root": "."}],
  "capabilities": [{"name": "adding", "surface": "cli", "proof": ["alpha"]}]
}`
	if err := os.WriteFile(path, []byte(content), 0o600); err != nil {
		t.Fatalf("could not write %s: %v", path, err)
	}

	suite := filepath.Join(dir, "alpha")
	if err := os.MkdirAll(suite, 0o750); err != nil {
		t.Fatalf("could not make %s: %v", suite, err)
	}
	// The test asserts something. The honesty row reads this fixture, and a
	// test that cannot fail is exactly what it turns red on.
	test := "package alpha\n\nimport \"testing\"\n\nfunc TestAddsUp(t *testing.T) {\n\tif AddsUp(1, 1) != 2 {\n\t\tt.Fatal(\"arithmetic broke\")\n\t}\n}\n"
	if err := os.WriteFile(filepath.Join(suite, "alpha_test.go"), []byte(test), 0o600); err != nil {
		t.Fatalf("could not write the fixture suite: %v", err)
	}

	// The code the test proves, and a non-test file that calls it. The wiring
	// row reads both: a repo with no Go source is unrunnable, and an exported
	// function only the tests call is red.
	code := "package alpha\n\nfunc AddsUp(a, b int) int { return a + b }\n"
	if err := os.WriteFile(filepath.Join(suite, "alpha.go"), []byte(code), 0o600); err != nil {
		t.Fatalf("could not write the fixture source: %v", err)
	}

	tool := filepath.Join(dir, "cmd", "tool")
	if err := os.MkdirAll(tool, 0o750); err != nil {
		t.Fatalf("could not make %s: %v", tool, err)
	}
	caller := "package main\n\nimport \"groundwork.test/fixture/alpha\"\n\nfunc main() {\n\t_ = alpha.AddsUp(1, 1)\n}\n"
	if err := os.WriteFile(filepath.Join(tool, "main.go"), []byte(caller), 0o600); err != nil {
		t.Fatalf("could not write the fixture caller: %v", err)
	}
}

// trueDigest is what the shipped battery's rows actually compute. The literal
// it must equal is pinned in the battery package's own tests.
func trueDigest() string {
	return battery.Default().Digest()
}

// refExists reports whether the journal ref is present in the repo at dir.
func refExists(t *testing.T, dir string) bool {
	t.Helper()

	cmd := exec.Command("git", "-C", dir, "rev-parse", "--verify", "--quiet", journal.Ref)

	return cmd.Run() == nil
}

// batteryLines returns every journal line of one kind, decoded.
func batteryLines(t *testing.T, dir, kind string) []map[string]any {
	t.Helper()

	out := runGit(t, dir, "ls-tree", "-r", "--name-only", "--full-tree", journal.Ref)
	if out == "" {
		return nil
	}

	var picked []map[string]any
	for _, path := range strings.Split(out, "\n") {
		var line map[string]any
		raw := runGit(t, dir, "cat-file", "blob", journal.Ref+":"+path)
		if err := json.Unmarshal([]byte(raw), &line); err != nil {
			t.Fatalf("journal blob %s is not valid JSON: %v", path, err)
		}
		if line["kind"] == kind {
			picked = append(picked, line)
		}
	}

	return picked
}

func TestVerifyGreenExitsZero(t *testing.T) {
	dir := newRepo(t)
	writeLock(t, dir, "0.1", trueDigest())
	writeManifest(t, dir)

	code, out, errOut := call(t, "verify")
	if code != exitOK {
		t.Fatalf("verify exited %d, want %d: %s%s", code, exitOK, out, errOut)
	}

	if !strings.Contains(out, "0.1+"+trueDigest()) {
		t.Errorf("the output does not carry the version pair: %s", out)
	}
	if !strings.Contains(out, "version") || !strings.Contains(out, "green") {
		t.Errorf("the output does not show the version row green: %s", out)
	}
	if !regexp.MustCompile(`run-\d{8}T\d{6}Z-[0-9a-f]{4}`).MatchString(out) {
		t.Errorf("the output does not carry a run id: %s", out)
	}
	// D17: a run that checked nothing must never look like this one.
	if !strings.Contains(out, "5 rows") {
		t.Errorf("the output does not say how many rows ran: %s", out)
	}
}

// The summary is the line a reader trusts, so it is pinned whole. Every
// outcome appears, including the ones at zero: an outcome that showed up only
// when it happened would let a quarantined row read as an absence.
func TestVerifyPrintsTheWholeSummary(t *testing.T) {
	dir := newRepo(t)
	writeLock(t, dir, "0.1", trueDigest())
	writeManifest(t, dir)

	code, out, errOut := call(t, "verify")
	if code != exitOK {
		t.Fatalf("verify exited %d: %s%s", code, out, errOut)
	}

	const want = "5 rows: green 5, red 0, waived 0, quarantined 0, unrunnable 0"
	if !strings.Contains(out, want+"\n") {
		t.Fatalf("the summary line is not %q:\n%s", want, out)
	}
}

func TestVerifyRedPrintsTheWholeSummary(t *testing.T) {
	dir := newRepo(t)
	writeLock(t, dir, "0.1", "r0000000")

	code, out, errOut := call(t, "verify")
	if code != exitFailed {
		t.Fatalf("verify exited %d: %s%s", code, out, errOut)
	}

	// The three scans cannot run without a manifest, and unrunnable is how
	// they say so: counted and printed, never a silent skip and never green.
	const want = "5 rows: green 0, red 2, waived 0, quarantined 0, unrunnable 3"
	if !strings.Contains(out, want+"\n") {
		t.Fatalf("the summary line is not %q:\n%s", want, out)
	}
}

// One row reads "1 row"; anything else reads "N rows". The shipped battery
// never holds one row today, so the singular is proved on the renderer
// directly.
func TestSummaryCountsAndPluralisesRows(t *testing.T) {
	cases := []struct {
		name string
		res  battery.RunResult
		want string
	}{
		{
			"one row",
			runResult(map[battery.Outcome]int{battery.Green: 1}),
			"1 row: green 1, red 0, waived 0, quarantined 0, unrunnable 0",
		},
		{
			"many rows",
			runResult(map[battery.Outcome]int{
				battery.Green: 3, battery.Red: 2, battery.Waived: 1,
				battery.Quarantined: 1, battery.Unrunnable: 1,
			}),
			"8 rows: green 3, red 2, waived 1, quarantined 1, unrunnable 1",
		},
		{
			"no rows at all",
			runResult(map[battery.Outcome]int{}),
			"0 rows: green 0, red 0, waived 0, quarantined 0, unrunnable 0",
		},
	}

	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			if got := summary(c.res); got != c.want {
				t.Fatalf("the summary is %q, want %q", got, c.want)
			}
		})
	}
}

// runResult builds a result holding the given counts, with one row result per
// counted row so the row count and the counts agree.
func runResult(counts map[battery.Outcome]int) battery.RunResult {
	res := battery.RunResult{Counts: map[battery.Outcome]int{}}

	for _, outcome := range battery.Outcomes() {
		res.Counts[outcome] = counts[outcome]
		for range counts[outcome] {
			res.Rows = append(res.Rows, battery.RowResult{Outcome: outcome})
		}
	}

	return res
}

func TestVerifyRedOnDriftExitsOne(t *testing.T) {
	dir := newRepo(t)
	writeLock(t, dir, "0.1", "r0000000")

	code, out, errOut := call(t, "verify")
	if code != exitFailed {
		t.Fatalf("verify exited %d, want %d: %s%s", code, exitFailed, out, errOut)
	}
	if !strings.Contains(out+errOut, battery.LockFile) {
		t.Errorf("nothing names the lock file: %s%s", out, errOut)
	}
	if !strings.Contains(out, "red") {
		t.Errorf("the output does not show a red row: %s", out)
	}
}

func TestVerifyRedWithNoLockFileExitsOne(t *testing.T) {
	newRepo(t)

	code, out, errOut := call(t, "verify")
	if code != exitFailed {
		t.Fatalf("verify exited %d, want %d: %s%s", code, exitFailed, out, errOut)
	}
	if !strings.Contains(out+errOut, battery.LockFile) {
		t.Errorf("nothing names the lock file: %s%s", out, errOut)
	}
}

func TestVerifyWritesTheJournal(t *testing.T) {
	dir := newRepo(t)
	writeLock(t, dir, "0.1", trueDigest())
	writeManifest(t, dir)
	t.Setenv("GROUNDWORK_SESSION", "s-alpha")

	code, out, errOut := call(t, "verify")
	if code != exitOK {
		t.Fatalf("verify exited %d: %s%s", code, out, errOut)
	}

	runs := batteryLines(t, dir, "battery")
	rows := batteryLines(t, dir, "battery-row")

	if len(runs) != 1 {
		t.Fatalf("the journal holds %d battery lines, want 1", len(runs))
	}
	if len(rows) != len(battery.Default().Rows()) {
		t.Fatalf("the journal holds %d battery-row lines, want one per shipped row (%d)",
			len(rows), len(battery.Default().Rows()))
	}

	runID, ok := runs[0]["run"].(string)
	if !ok || runID == "" {
		t.Fatalf("the battery line carries no run id: %v", runs[0])
	}
	if rows[0]["run"] != runID {
		t.Errorf("the battery-row line names run %v, want %q", rows[0]["run"], runID)
	}
	if !strings.Contains(out, runID) {
		t.Errorf("the output does not print the run id it journaled: %s", out)
	}
	// The journal is read back by blob, which does not hand the lines back in
	// the order they were written, so the rows are judged as a set.
	journaled := map[string]any{}
	for _, line := range rows {
		id, ok := line["row"].(string)
		if !ok {
			t.Fatalf("a row line carries no row id: %v", line)
		}
		if _, twice := journaled[id]; twice {
			t.Errorf("the row %s was journaled twice", id)
		}
		journaled[id] = line["outcome"]
	}

	for _, row := range battery.Default().Rows() {
		outcome, ok := journaled[row.ID]
		if !ok {
			t.Errorf("the row %s wrote no journal line, so nothing says it ran", row.ID)
			continue
		}
		if outcome != "green" {
			t.Errorf("the %s row line says %v, want green", row.ID, outcome)
		}
	}
}

func TestVerifyVersionPrintsThePair(t *testing.T) {
	dir := newRepo(t)
	writeLock(t, dir, "0.1", trueDigest())

	code, out, errOut := call(t, "verify", "version")
	if code != exitOK {
		t.Fatalf("verify version exited %d, want %d: %s%s", code, exitOK, out, errOut)
	}
	if strings.TrimSpace(out) != "0.1+"+trueDigest() {
		t.Fatalf("verify version printed %q, want %q", strings.TrimSpace(out), "0.1+"+trueDigest())
	}
}

// The version verb reads the lock file. It never writes to the journal, and
// it never runs a row.
func TestVerifyVersionWritesNothing(t *testing.T) {
	dir := newRepo(t)
	writeLock(t, dir, "0.1", trueDigest())

	call(t, "verify", "version")

	if refExists(t, dir) {
		t.Fatal("verify version wrote to the journal")
	}
}

func TestVerifyVersionFailsOnDrift(t *testing.T) {
	newRepo(t)
	writeLock(t, ".", "0.1", "r0000000")

	code, out, errOut := call(t, "verify", "version")
	if code != exitFailed {
		t.Fatalf("verify version exited %d, want %d: %s%s", code, exitFailed, out, errOut)
	}
	if !strings.Contains(errOut, battery.LockFile) {
		t.Errorf("the error does not name the lock file: %s", errOut)
	}
	if !strings.Contains(errOut, "r0000000") || !strings.Contains(errOut, trueDigest()) {
		t.Errorf("the error does not show both digests: %s", errOut)
	}
}

func TestVerifyVersionFailsOnABrokenLockFile(t *testing.T) {
	cases := []struct {
		name    string
		content string
	}{
		{"missing", ""},
		{"malformed", `{"version":`},
		{"a bad digest", `{"version":"0.1","digest":"nope"}`},
		{"a bad version", `{"version":"latest","digest":"r0000000"}`},
	}

	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			dir := newRepo(t)
			if c.content != "" {
				path := filepath.Join(dir, battery.LockFile)
				if err := os.WriteFile(path, []byte(c.content), 0o600); err != nil {
					t.Fatalf("could not write %s: %v", path, err)
				}
			}

			code, out, errOut := call(t, "verify", "version")
			if code != exitFailed {
				t.Fatalf("verify version exited %d, want %d: %s%s", code, exitFailed, out, errOut)
			}
			if !strings.Contains(errOut, battery.LockFile) {
				t.Errorf("the error does not name the lock file: %s", errOut)
			}
		})
	}
}

func TestVerifyListShowsEveryRow(t *testing.T) {
	dir := newRepo(t)

	code, out, errOut := call(t, "verify", "--list")
	if code != exitOK {
		t.Fatalf("verify --list exited %d, want %d: %s%s", code, exitOK, out, errOut)
	}

	for _, want := range []string{"version", "manifest", "blocking", "KIND", "SEVERITY"} {
		if !strings.Contains(out, want) {
			t.Errorf("the listing does not carry %q: %s", want, out)
		}
	}
	if refExists(t, dir) {
		t.Fatal("verify --list wrote to the journal")
	}
}

// A listing describes the battery. It must not need a lock file, and it must
// not run a single check.
func TestVerifyListNeedsNoLockFile(t *testing.T) {
	newRepo(t)

	if code, _, errOut := call(t, "verify", "--list"); code != exitOK {
		t.Fatalf("verify --list exited %d with no lock file: %s", code, errOut)
	}
}

func TestVerifyRejectsBadUsage(t *testing.T) {
	cases := []struct {
		name string
		args []string
	}{
		{"an unknown subcommand", []string{"verify", "verison"}},
		{"an unknown flag", []string{"verify", "--lst"}},
		{"a spare argument", []string{"verify", "--list", "extra"}},
		{"an argument after version", []string{"verify", "version", "extra"}},
	}

	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			newRepo(t)
			writeLock(t, ".", "0.1", trueDigest())

			code, out, errOut := call(t, c.args...)
			if code != exitUsage {
				t.Fatalf("%v exited %d, want %d: %s%s", c.args, code, exitUsage, out, errOut)
			}
		})
	}
}

// Outside a repo the verb says so in the same plain words every other verb
// uses, rather than passing on git's.
func TestVerifyOutsideARepoSaysSo(t *testing.T) {
	cases := [][]string{
		{"verify"},
		{"verify", "version"},
	}

	for _, args := range cases {
		t.Run(strings.Join(args, " "), func(t *testing.T) {
			t.Chdir(t.TempDir())

			code, out, errOut := call(t, args...)
			if code != exitFailed {
				t.Fatalf("%v exited %d, want %d: %s%s", args, code, exitFailed, out, errOut)
			}
			if !strings.Contains(errOut, "not in a git repository") {
				t.Fatalf("the error does not say it is not in a git repository: %s", errOut)
			}
		})
	}
}

func TestUsageNamesVerify(t *testing.T) {
	_, _, errOut := call(t)
	if !strings.Contains(errOut, "verify") {
		t.Fatalf("the usage does not name verify: %s", errOut)
	}
}
