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

	"github.com/ryannel/groundwork/internal/adapter"
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

	// The fixture is a real module. The run-evidence row runs the suite rather
	// than reading it, so a directory of Go files with no go.mod is a surface
	// it cannot run at all.
	mod := "module groundwork.test/fixture\n\ngo 1.24\n"
	if err := os.WriteFile(filepath.Join(dir, "go.mod"), []byte(mod), 0o600); err != nil {
		t.Fatalf("could not write the fixture go.mod: %v", err)
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

// wantsARealRun clears the recursion guard the seam sets on every suite it
// starts. A test that asserts on a whole green battery has to be the one doing
// the running: under the guard, the row that runs the suite reports unrunnable
// instead, which is the right answer everywhere except here.
func wantsARealRun(t *testing.T) {
	t.Helper()
	t.Setenv(adapter.RunGuardEnv, "")
}

func TestVerifyGreenExitsZero(t *testing.T) {
	dir := newRepo(t)
	writeLock(t, dir, "0.1", trueDigest())
	writeManifest(t, dir)
	wantsARealRun(t)

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
	if !strings.Contains(out, "11 rows") {
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
	wantsARealRun(t)

	code, out, errOut := call(t, "verify")
	if code != exitOK {
		t.Fatalf("verify exited %d: %s%s", code, out, errOut)
	}

	const want = "11 rows: green 11, red 0, waived 0, quarantined 0, unrunnable 0"
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

	// The three scans, the run-evidence row and the deletion test cannot run
	// without a manifest, and unrunnable is how they say so: counted and
	// printed, never a silent skip and never green. That is five. Two rows are
	// red: the version row, because the lock file declares a digest the rows do
	// not compute, and the manifest row, because a repo with no manifest
	// declares nothing and D25 fails closed.
	//
	// The other four are green. The plan row, because a repo with no docs/plan
	// has no plan to misstate. The board row, because a board is derived from a
	// plan and there is none, so it derives nothing and claims nothing — and it
	// answers that before it ever looks for a manifest, which is why it is green
	// here rather than unrunnable beside the scans. The chain row, because the
	// run journals each row as it finishes, so by the time the chain row runs
	// the ref holds this run's own lines — and they are chained. The seal-verify
	// row, because a repo with no seal tag has sealed nothing, so nothing it
	// sealed can have moved.
	const want = "11 rows: green 4, red 2, waived 0, quarantined 0, unrunnable 5"
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
	wantsARealRun(t)
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

// A row that gave no verdict is never left to a reader's eye on a wide table.
// The loud block says it again, in words, under the table.
func TestTheLoudBlockNamesEveryRowWithoutAVerdict(t *testing.T) {
	res := battery.RunResult{
		Counts: map[battery.Outcome]int{},
		Rows: []battery.RowResult{
			{ID: "honesty", Outcome: battery.Green, Evidence: "all sound"},
			{ID: "wiring", Outcome: battery.Waived, Evidence: "waived by wiring-1.json until 2026-09-05: wrong check"},
			{ID: "token", Outcome: battery.Quarantined, Evidence: "red then green across two runs"},
		},
		Waivers: []battery.WaiverNote{
			{File: ".groundwork/waivers/wiring-1.json", Row: "wiring", Status: battery.WaiverUsed, Why: "it stands"},
			{File: ".groundwork/waivers/old.json", Row: "mutate", Status: battery.WaiverIgnored, Why: "it expired on 2026-08-01"},
			{File: ".groundwork/waivers/spare.json", Row: "honesty", Status: battery.WaiverUnused, Why: "the row did not go red"},
		},
	}

	got := notes(res)

	// D38 ruling 5: a blank line and a heading, so nothing in the block can be
	// read as another row of the table above it.
	if !strings.HasPrefix(got, "\n") {
		t.Errorf("the loud block does not start with a blank line:\n%q", got)
	}
	if !strings.Contains(got, loudHeading) {
		t.Errorf("the loud block has no heading:\n%s", got)
	}
	for _, line := range strings.Split(strings.Trim(got, "\n"), "\n") {
		if line == "" || line == loudHeading {
			continue
		}
		if !strings.HasPrefix(line, "  ") {
			t.Errorf("the loud block line %q is not indented, so it reads as a table row", line)
		}
	}

	for _, want := range []string{
		"waived", "wiring", "waived by wiring-1.json until 2026-09-05: wrong check",
		"quarantined", "token", "red then green across two runs",
		"ignored", ".groundwork/waivers/old.json", "it expired on 2026-08-01",
		"unused", ".groundwork/waivers/spare.json", "the row did not go red",
	} {
		if !strings.Contains(got, want) {
			t.Errorf("the loud block does not hold %q:\n%s", want, got)
		}
	}

	// A green row with nothing standing over it has nothing to say twice.
	if strings.Contains(got, "all sound") {
		t.Errorf("the loud block repeats a green row:\n%s", got)
	}
	// A waiver that did its job is already the row's own line.
	if strings.Contains(got, "wiring-1.json\tit stands") {
		t.Errorf("the loud block repeats a used waiver:\n%s", got)
	}
}

// A run where everything gave a verdict and nothing was waived prints no loud
// block at all.
func TestTheLoudBlockIsEmptyWhenThereIsNothingToSay(t *testing.T) {
	res := battery.RunResult{
		Counts: map[battery.Outcome]int{},
		Rows: []battery.RowResult{
			{ID: "honesty", Outcome: battery.Green, Evidence: "all sound"},
			{ID: "wiring", Outcome: battery.Red, Evidence: "one function no caller reaches"},
			{ID: "token", Outcome: battery.Unrunnable, Evidence: "the adapter is not installed"},
		},
	}

	if got := notes(res); got != "" {
		t.Fatalf("the loud block is %q, want nothing", got)
	}
}

// The whole slice, end to end: a real waiver, committed on its own, turns a
// real red row waived in a real run, and the run says so where a person reads
// it.
func TestVerifyPrintsAWaivedRowLoudly(t *testing.T) {
	dir := newRepo(t)
	writeLock(t, dir, "0.1", "r0000000")

	code, out, errOut := call(t, "waive", "version",
		"--reason", "the digest moved on purpose", "--expires", day(5))
	if code != exitOK {
		t.Fatalf("the waive exited %d. stderr: %s", code, errOut)
	}
	path := strings.Fields(out)[0]
	runGit(t, dir, "add", path)
	runGit(t, dir, "commit", "-m", "waive the version row")

	_, out, errOut = call(t, "verify")

	rows := tableRows(out)
	found := false
	for _, row := range rows {
		if len(row) >= 2 && row[0] == "version" {
			found = true
			if row[1] != "waived" {
				t.Errorf("the version row reads %q, want waived. output: %s%s", row[1], out, errOut)
			}
		}
	}
	if !found {
		t.Fatalf("the output holds no version row: %s%s", out, errOut)
	}

	if !strings.Contains(out, filepath.Base(path)) {
		t.Errorf("the output does not name the waiver file: %s", out)
	}
	if !strings.Contains(out, "waived 1") {
		t.Errorf("the summary does not count the waived row: %s", out)
	}

	// The loud block says it again under the table, the other way round: the
	// outcome first, then the row. That shape is what tells the two apart.
	loud := false
	for _, row := range rows {
		if len(row) >= 2 && row[0] == "waived" && row[1] == "version" {
			loud = true
		}
	}
	if !loud {
		t.Errorf("the waived row is only on the table, and never said loudly: %s", out)
	}
}

// D38 ruling 6, through the verb: a file in the waiver directory that is not a
// waiver leaves the report standing. The table renders, every row is there,
// the file is named, and the run exits 1.
func TestVerifyNamesAFileThatIsNotAWaiverAndStillReports(t *testing.T) {
	dir := newRepo(t)
	writeLock(t, dir, "0.1", trueDigest())

	path := filepath.Join(dir, battery.WaiverDir)
	if err := os.MkdirAll(path, 0o750); err != nil {
		t.Fatalf("could not make the waiver directory: %v", err)
	}
	if err := os.WriteFile(filepath.Join(path, "notes.txt"), []byte("what I waived\n"), 0o600); err != nil {
		t.Fatalf("could not write the stray file: %v", err)
	}
	runGit(t, dir, "add", battery.WaiverDir)
	runGit(t, dir, "commit", "-m", "a stray file among the waivers")

	code, out, errOut := call(t, "verify")
	if code != exitFailed {
		t.Fatalf("verify exited %d, want %d: %s%s", code, exitFailed, out, errOut)
	}

	rows := tableRows(out)
	found := map[string]bool{}
	for _, row := range rows {
		if len(row) >= 2 {
			found[row[0]] = true
		}
	}
	for _, row := range battery.Default().Rows() {
		if !found[row.ID] {
			t.Errorf("the table has no %s row: %s", row.ID, out)
		}
	}
	if !strings.Contains(out, "notes.txt") {
		t.Errorf("the output does not name the stray file: %s", out)
	}
}

// A stray file left to hold the directory open is a stray file. It is named
// and it fails the run, and the report still renders.
func TestVerifyStillPrintsItsTableWithAStrayGitkeep(t *testing.T) {
	dir := newRepo(t)
	writeLock(t, dir, "0.1", trueDigest())

	path := filepath.Join(dir, battery.WaiverDir)
	if err := os.MkdirAll(path, 0o750); err != nil {
		t.Fatalf("could not make the waiver directory: %v", err)
	}
	if err := os.WriteFile(filepath.Join(path, ".gitkeep"), nil, 0o600); err != nil {
		t.Fatalf("could not write the stray file: %v", err)
	}
	runGit(t, dir, "add", "-f", battery.WaiverDir)
	runGit(t, dir, "commit", "-m", "hold the waiver directory open")

	code, out, errOut := call(t, "verify")
	if code != exitFailed {
		t.Fatalf("verify exited %d, want %d: %s%s", code, exitFailed, out, errOut)
	}
	if !strings.Contains(out, "ROW") || !strings.Contains(out, "version") {
		t.Errorf("the table did not render: %s", out)
	}
	if !strings.Contains(out, ".gitkeep") {
		t.Errorf("the output does not name the stray file: %s", out)
	}
}

// The verb's own half of D38 ruling 6: the exit code comes from the whole
// report, not from the rows alone. Here the only row that went red is properly
// waived, so nothing is red, and the stray file is the only reason to fail.
func TestVerifyFailsOnAStrayFileWithNothingRed(t *testing.T) {
	dir := newRepo(t)
	writeLock(t, dir, "0.1", "r0000000")

	// Both rows that would otherwise be red, waived: the version row because
	// the lock file is wrong, and the manifest row because this fixture has no
	// manifest. One waiver-only commit carries them both.
	for _, row := range []string{"version", "manifest"} {
		code, out, errOut := call(t, "waive", row,
			"--reason", "waived so that nothing here is red", "--expires", day(5))
		if code != exitOK {
			t.Fatalf("the waive of %s exited %d. stderr: %s", row, code, errOut)
		}
		runGit(t, dir, "add", strings.Fields(out)[0])
	}
	runGit(t, dir, "commit", "-m", "waive the two red rows")

	keep := filepath.Join(dir, battery.WaiverDir, ".gitkeep")
	if err := os.WriteFile(keep, nil, 0o600); err != nil {
		t.Fatalf("could not write the stray file: %v", err)
	}
	runGit(t, dir, "add", "-f", keep)
	runGit(t, dir, "commit", "-m", "hold the waiver directory open")

	code, out, errOut := call(t, "verify")
	if !strings.Contains(out, "red 0") {
		t.Fatalf("the fixture has a red row, so it cannot prove what fails the verb: %s%s", out, errOut)
	}
	if code != exitFailed {
		t.Fatalf("verify exited %d, want %d with a file that is not a waiver: %s%s",
			code, exitFailed, out, errOut)
	}
	if !strings.Contains(out, ".gitkeep") {
		t.Errorf("the output does not name the stray file: %s", out)
	}
}
