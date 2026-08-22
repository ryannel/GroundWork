package battery

import (
	"bytes"
	"encoding/json"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"slices"
	"strings"
	"testing"
	"unicode/utf8"

	"github.com/ryannel/groundwork/internal/journal"
)

// newRepo makes a git repo with one commit in a temp dir and returns its path.
func newRepo(t *testing.T) string {
	t.Helper()

	dir := t.TempDir()
	for _, args := range [][]string{
		{"init", "-b", "main"},
		{"config", "user.name", "Test Person"},
		{"config", "user.email", "test@example.com"},
	} {
		runGit(t, dir, args...)
	}

	writeFile(t, filepath.Join(dir, "README.md"), "start\n")
	runGit(t, dir, "add", "README.md")
	runGit(t, dir, "commit", "-m", "first")

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

func writeFile(t *testing.T, path, content string) {
	t.Helper()

	if err := os.WriteFile(path, []byte(content), 0o600); err != nil {
		t.Fatalf("could not write %s: %v", path, err)
	}
}

// writeLock puts a lock file at the root of the repo at dir.
func writeLock(t *testing.T, dir, version, digest string) {
	t.Helper()

	line := fmt.Sprintf("{\"version\":%q,\"digest\":%q}\n", version, digest)
	writeFile(t, filepath.Join(dir, LockFile), line)
}

// fixed returns a row that always reports the given outcome.
func fixed(id, kind, severity string, outcome Outcome) Row {
	return Row{
		ID:       id,
		Kind:     kind,
		Severity: severity,
		Check: func(Context) Result {
			return Result{Outcome: outcome, Evidence: "fixed " + string(outcome)}
		},
	}
}

// journalLines reads every event blob in the journal ref of the repo at dir
// and returns each one decoded.
func journalLines(t *testing.T, dir string) []map[string]any {
	t.Helper()

	cmd := exec.Command("git", "-C", dir, "rev-parse", "--verify", "--quiet", journal.Ref)
	if cmd.Run() != nil {
		return nil
	}

	out := runGit(t, dir, "ls-tree", "-r", "--name-only", "--full-tree", journal.Ref)
	if out == "" {
		return nil
	}

	var lines []map[string]any
	for _, path := range strings.Split(out, "\n") {
		raw := runGit(t, dir, "cat-file", "blob", journal.Ref+":"+path)

		var got map[string]any
		if err := json.Unmarshal([]byte(raw), &got); err != nil {
			t.Fatalf("journal blob %s is not valid JSON: %v", path, err)
		}
		lines = append(lines, got)
	}

	return lines
}

// seqOf returns a decoded journal line's sequence number.
func seqOf(t *testing.T, line map[string]any) int {
	t.Helper()

	seq, ok := line["seq"].(float64)
	if !ok {
		t.Fatalf("a journal line has no seq: %v", line)
	}

	return int(seq)
}

// linesOfKind picks the journal lines of one kind.
func linesOfKind(lines []map[string]any, kind string) []map[string]any {
	var picked []map[string]any
	for _, line := range lines {
		if line["kind"] == kind {
			picked = append(picked, line)
		}
	}

	return picked
}

// The digest of a registry holding only the version row. It is written out
// here rather than computed, so a change to how the digest is built shows up
// as a failure instead of moving in step with the code.
//
//	printf 'version\nversion\nblocking\n' | sha256sum
const versionOnlyDigest = "r99d3493"

// The digest of the two-row registry twoRows builds, and of the same two rows
// registered the other way round.
//
//	printf 'a\nhonesty\nblocking\nb\nwiring\nadvisory\n' | sha256sum
//	printf 'b\nwiring\nadvisory\na\nhonesty\nblocking\n' | sha256sum
const (
	twoRowDigest         = "rf9279bf"
	twoRowReversedDigest = "rb774087"
)

// twoRows is the registry both digest literals above were computed from.
func twoRows(t *testing.T) *Registry {
	t.Helper()

	reg := NewRegistry()
	reg.Register(fixed("a", "honesty", Blocking, Green))
	reg.Register(fixed("b", "wiring", Advisory, Green))

	return reg
}

func TestDigestMatchesTheLiteral(t *testing.T) {
	if got := twoRows(t).Digest(); got != twoRowDigest {
		t.Fatalf("digest is %q, want %q", got, twoRowDigest)
	}
}

func TestDigestFollowsRegistrationOrder(t *testing.T) {
	reg := NewRegistry()
	reg.Register(fixed("b", "wiring", Advisory, Green))
	reg.Register(fixed("a", "honesty", Blocking, Green))

	if got := reg.Digest(); got != twoRowReversedDigest {
		t.Fatalf("digest is %q, want %q", got, twoRowReversedDigest)
	}
	if got := reg.Digest(); got == twoRowDigest {
		t.Fatal("two registries with the same rows in different orders share a digest")
	}
}

// The digest covers id, kind and severity. Changing any one of the three must
// move it, or a row could be made stricter without the version saying so.
func TestDigestCoversEveryCanonicalField(t *testing.T) {
	base := func() *Registry {
		reg := NewRegistry()
		reg.Register(fixed("a", "honesty", Blocking, Green))
		return reg
	}

	cases := []struct {
		name string
		row  Row
	}{
		{"a different id", fixed("z", "honesty", Blocking, Green)},
		{"a different kind", fixed("a", "wiring", Blocking, Green)},
		{"a different severity", fixed("a", "honesty", Advisory, Green)},
	}

	want := base().Digest()
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			reg := NewRegistry()
			reg.Register(c.row)

			if got := reg.Digest(); got == want {
				t.Fatalf("%s left the digest at %q", c.name, got)
			}
		})
	}
}

// A row's check must not reach the digest. Two registries whose rows differ
// only in what their checks do describe the same battery.
func TestDigestIgnoresWhatACheckDoes(t *testing.T) {
	green := NewRegistry()
	green.Register(fixed("a", "honesty", Blocking, Green))

	red := NewRegistry()
	red.Register(fixed("a", "honesty", Blocking, Red))

	if green.Digest() != red.Digest() {
		t.Fatalf("the digest moved with a check's outcome: %q and %q", green.Digest(), red.Digest())
	}
}

func TestDigestHasTheDeclaredShape(t *testing.T) {
	shape := regexp.MustCompile(`^r[0-9a-f]{7}$`)

	if got := twoRows(t).Digest(); !shape.MatchString(got) {
		t.Fatalf("digest %q is not r followed by seven hex digits", got)
	}
}

func TestRegisterRefusesADuplicateID(t *testing.T) {
	reg := NewRegistry()
	reg.Register(fixed("a", "honesty", Blocking, Green))

	defer func() {
		got := recover()
		if got == nil {
			t.Fatal("registering the same id twice did not panic")
		}
		if !strings.Contains(fmt.Sprint(got), "a") {
			t.Fatalf("the panic does not name the duplicate id: %v", got)
		}
	}()

	reg.Register(fixed("a", "wiring", Blocking, Green))
}

func TestRegisterRefusesAMalformedRow(t *testing.T) {
	cases := []struct {
		name string
		row  Row
	}{
		{"an empty id", fixed("", "honesty", Blocking, Green)},
		{"an id outside the charset", fixed("row id", "honesty", Blocking, Green)},
		{"an id with a slash", fixed("a/b", "honesty", Blocking, Green)},
		{"an uppercase id", fixed("Version", "honesty", Blocking, Green)},
		{"a kind outside the vocabulary", fixed("a", "honestly", Blocking, Green)},
		{"a severity outside the vocabulary", fixed("a", "honesty", "urgent", Green)},
		{"no check at all", Row{ID: "a", Kind: "honesty", Severity: Blocking}},
	}

	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			defer func() {
				if recover() == nil {
					t.Fatalf("registering a row with %s did not panic", c.name)
				}
			}()

			NewRegistry().Register(c.row)
		})
	}
}

// Register is the only way into a registry, so it is the only way into the
// digest. A row it turned away must leave no trace: not in the row list, not
// in the digest, not in a run.
func TestRegisterIsTheOnlyPathIntoTheDigest(t *testing.T) {
	reg := NewRegistry()
	reg.Register(fixed("a", "honesty", Blocking, Green))

	before := reg.Digest()

	for _, bad := range []Row{
		fixed("b", "honestly", Blocking, Green),
		fixed("c", "wiring", "urgent", Green),
		fixed("Bad Id", "wiring", Blocking, Green),
		{ID: "d", Kind: "wiring", Severity: Blocking},
	} {
		func() {
			defer func() {
				if recover() == nil {
					t.Fatalf("the registry took the row %q", bad.ID)
				}
			}()

			reg.Register(bad)
		}()
	}

	if len(reg.Rows()) != 1 {
		t.Fatalf("the registry holds %d rows, want 1: %+v", len(reg.Rows()), reg.Rows())
	}
	if got := reg.Digest(); got != before {
		t.Fatalf("a refused row moved the digest from %q to %q", before, got)
	}
}

// A registry made without NewRegistry is a caller's mistake, and it must hear
// about the mistake it made rather than a nil map deep inside this package.
func TestAZeroRegistryStillSaysWhatIsWrong(t *testing.T) {
	var reg Registry

	func() {
		defer func() {
			got := recover()
			if got == nil {
				t.Fatal("a zero registry took a malformed row")
			}
			if !strings.HasPrefix(fmt.Sprint(got), "groundwork:") {
				t.Fatalf("the panic is not this package's own words: %v", got)
			}
		}()

		reg.Register(fixed("a", "honestly", Blocking, Green))
	}()

	reg.Register(fixed("a", "honesty", Blocking, Green))
	reg.Register(fixed("b", "wiring", Advisory, Green))

	if got := reg.Digest(); got != twoRowDigest {
		t.Fatalf("a zero registry computed the digest %q, want %q", got, twoRowDigest)
	}

	defer func() {
		if recover() == nil {
			t.Fatal("a zero registry took the same id twice")
		}
	}()

	reg.Register(fixed("a", "token", Blocking, Green))
}

// Evidence is a row's own text, and a row that shells out to another tool can
// come back holding bytes that are not UTF-8. Those bytes must not take the
// readable part of the line down with them.
func TestEvidenceSurvivesInvalidUTF8(t *testing.T) {
	cases := []struct {
		name     string
		evidence string
		want     string
	}{
		{
			"a bad byte at the front",
			"\xffthe suite ran " + strings.Repeat("and ran ", 60),
			"the suite ran",
		},
		{
			"a bad byte in the middle",
			"the suite ran \xff" + strings.Repeat("and ran ", 60),
			"the suite ran",
		},
		{
			"a bad byte and nothing long",
			"\xffthe suite ran",
			"the suite ran",
		},
	}

	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			dir := newRepo(t)

			reg := NewRegistry()
			reg.Register(Row{
				ID: "a", Kind: "honesty", Severity: Blocking,
				Check: func(Context) Result {
					return Result{Outcome: Green, Evidence: c.evidence}
				},
			})
			writeLock(t, dir, "0.1", reg.Digest())

			res, err := Run(dir, reg)
			if err != nil {
				t.Fatalf("the run failed: %v", err)
			}

			got := res.Rows[0].Evidence
			if !strings.Contains(got, c.want) {
				t.Fatalf("the readable evidence did not survive: %q", got)
			}
			if len(got) > journal.MaxTextBytes {
				t.Fatalf("the evidence is %d bytes, over the cap of %d", len(got), journal.MaxTextBytes)
			}
			if !utf8.ValidString(got) {
				t.Fatalf("the evidence is not valid UTF-8: %q", got)
			}

			line := linesOfKind(journalLines(t, dir), "battery-row")[0]
			if line["evidence"] != got {
				t.Fatalf("the journal holds %v, want the same evidence the run reports", line["evidence"])
			}
		})
	}
}

// D17: a verification that checked nothing is a failure, not a pass.
func TestRunRefusesAnEmptyRegistry(t *testing.T) {
	dir := newRepo(t)
	writeLock(t, dir, "0.1", versionOnlyDigest)

	_, err := Run(dir, NewRegistry())
	if err == nil {
		t.Fatal("a run of zero rows reported success")
	}
	if !strings.Contains(err.Error(), "no rows") {
		t.Fatalf("the error does not say the battery has no rows: %v", err)
	}
	if lines := journalLines(t, dir); len(lines) != 0 {
		t.Fatalf("a run of zero rows wrote %d journal lines", len(lines))
	}
}

func TestRunIDHasTheDeclaredShape(t *testing.T) {
	dir := newRepo(t)
	writeLock(t, dir, "0.1", twoRowDigest)

	res, err := Run(dir, twoRows(t))
	if err != nil {
		t.Fatalf("the run failed: %v", err)
	}

	shape := regexp.MustCompile(`^run-\d{8}T\d{6}Z-[0-9a-f]{4}$`)
	if !shape.MatchString(res.ID) {
		t.Fatalf("run id %q is not run-<RFC3339-compact>-<4hex>", res.ID)
	}
}

func TestRunIDIsFreshEachTime(t *testing.T) {
	dir := newRepo(t)
	writeLock(t, dir, "0.1", twoRowDigest)

	first, err := Run(dir, twoRows(t))
	if err != nil {
		t.Fatalf("the first run failed: %v", err)
	}
	second, err := Run(dir, twoRows(t))
	if err != nil {
		t.Fatalf("the second run failed: %v", err)
	}

	if first.ID == second.ID {
		t.Fatalf("two runs share the id %q", first.ID)
	}
}

func TestRunCountsEveryOutcome(t *testing.T) {
	dir := newRepo(t)

	reg := NewRegistry()
	reg.Register(fixed("a", "honesty", Blocking, Green))
	reg.Register(fixed("b", "wiring", Blocking, Red))
	reg.Register(fixed("c", "token", Blocking, Waived))
	reg.Register(fixed("d", "mutate", Blocking, Quarantined))
	reg.Register(fixed("e", "flag", Blocking, Unrunnable))
	reg.Register(fixed("f", "divergence", Blocking, Green))
	writeLock(t, dir, "0.1", reg.Digest())

	res, err := Run(dir, reg)
	if err != nil {
		t.Fatalf("the run failed: %v", err)
	}

	want := map[Outcome]int{Green: 2, Red: 1, Waived: 1, Quarantined: 1, Unrunnable: 1}
	for _, outcome := range Outcomes() {
		if res.Counts[outcome] != want[outcome] {
			t.Errorf("%s counted %d, want %d", outcome, res.Counts[outcome], want[outcome])
		}
	}
	if len(res.Rows) != 6 {
		t.Fatalf("the run reported %d rows, want 6", len(res.Rows))
	}
}

// Every outcome carries a count, including the ones no row reported. A count
// that is simply absent reads as "not measured" rather than as zero.
func TestRunCountsHoldEveryOutcomeEvenAtZero(t *testing.T) {
	dir := newRepo(t)
	writeLock(t, dir, "0.1", twoRowDigest)

	res, err := Run(dir, twoRows(t))
	if err != nil {
		t.Fatalf("the run failed: %v", err)
	}

	for _, outcome := range Outcomes() {
		if _, held := res.Counts[outcome]; !held {
			t.Errorf("the counts have no entry for %s", outcome)
		}
	}
}

// Only red fails a run. The other three non-green outcomes are counted and
// printed, and they never fail it.
func TestOnlyRedFailsTheRun(t *testing.T) {
	cases := []struct {
		outcome Outcome
		red     bool
	}{
		{Green, false},
		{Red, true},
		{Waived, false},
		{Quarantined, false},
		{Unrunnable, false},
	}

	for _, c := range cases {
		t.Run(string(c.outcome), func(t *testing.T) {
			dir := newRepo(t)

			reg := NewRegistry()
			reg.Register(fixed("a", "honesty", Blocking, c.outcome))
			writeLock(t, dir, "0.1", reg.Digest())

			res, err := Run(dir, reg)
			if err != nil {
				t.Fatalf("the run failed: %v", err)
			}
			if res.Red() != c.red {
				t.Fatalf("a run of one %s row reported red=%v, want %v", c.outcome, res.Red(), c.red)
			}
		})
	}
}

// One red row among many green ones fails the run.
func TestOneRedRowFailsAGreenRun(t *testing.T) {
	dir := newRepo(t)

	reg := NewRegistry()
	reg.Register(fixed("a", "honesty", Blocking, Green))
	reg.Register(fixed("b", "wiring", Blocking, Red))
	reg.Register(fixed("c", "token", Blocking, Green))
	writeLock(t, dir, "0.1", reg.Digest())

	res, err := Run(dir, reg)
	if err != nil {
		t.Fatalf("the run failed: %v", err)
	}
	if !res.Red() {
		t.Fatal("a run holding a red row did not report red")
	}
}

func TestRunWritesOneJournalLinePerRow(t *testing.T) {
	dir := newRepo(t)

	reg := NewRegistry()
	reg.Register(fixed("a", "honesty", Blocking, Green))
	reg.Register(fixed("b", "wiring", Blocking, Red))
	reg.Register(fixed("c", "token", Blocking, Waived))
	writeLock(t, dir, "0.1", reg.Digest())

	res, err := Run(dir, reg)
	if err != nil {
		t.Fatalf("the run failed: %v", err)
	}

	rowLines := linesOfKind(journalLines(t, dir), "battery-row")
	if len(rowLines) != 3 {
		t.Fatalf("the journal holds %d battery-row lines, want 3", len(rowLines))
	}

	byRow := map[string]map[string]any{}
	for _, line := range rowLines {
		id, ok := line["row"].(string)
		if !ok {
			t.Fatalf("a battery-row line has no row id: %v", line)
		}
		byRow[id] = line
	}

	for _, want := range []struct{ id, outcome string }{
		{"a", "green"}, {"b", "red"}, {"c", "waived"},
	} {
		line, held := byRow[want.id]
		if !held {
			t.Fatalf("the journal holds no battery-row line for row %q", want.id)
		}
		if line["outcome"] != want.outcome {
			t.Errorf("row %q was journaled as %v, want %q", want.id, line["outcome"], want.outcome)
		}
		if line["run"] != res.ID {
			t.Errorf("row %q was journaled under run %v, want %q", want.id, line["run"], res.ID)
		}
		if line["evidence"] == "" || line["evidence"] == nil {
			t.Errorf("row %q was journaled with no evidence", want.id)
		}
	}
}

// The rows are journaled as they finish and the run's own line lands last, so
// a journal holding a battery line holds every row line of that run. Sequence
// numbers are what a reader has to prove that with.
func TestTheBatteryLineIsJournaledAfterEveryRow(t *testing.T) {
	dir := newRepo(t)
	t.Setenv("GROUNDWORK_SESSION", "s-alpha")

	reg := NewRegistry()
	reg.Register(fixed("a", "honesty", Blocking, Green))
	reg.Register(fixed("b", "wiring", Blocking, Green))
	reg.Register(fixed("c", "token", Blocking, Green))
	writeLock(t, dir, "0.1", reg.Digest())

	res, err := Run(dir, reg)
	if err != nil {
		t.Fatalf("the run failed: %v", err)
	}

	lines := journalLines(t, dir)

	runLines := linesOfKind(lines, "battery")
	if len(runLines) != 1 {
		t.Fatalf("the journal holds %d battery lines, want 1", len(runLines))
	}
	runSeq := seqOf(t, runLines[0])

	rowLines := linesOfKind(lines, "battery-row")
	if len(rowLines) != 3 {
		t.Fatalf("the journal holds %d battery-row lines, want 3", len(rowLines))
	}
	for _, line := range rowLines {
		if line["run"] != res.ID {
			t.Fatalf("a battery-row line names run %v, want %q", line["run"], res.ID)
		}
		if got := seqOf(t, line); got >= runSeq {
			t.Errorf("row %v has seq %d, but the run's own line has seq %d: the run line did not land last",
				line["row"], got, runSeq)
		}
	}
}

// The battery line and its rows must be joinable. Without a shared run id the
// journal holds a pile of rows nobody can attribute to a run.
func TestJournalLinesShareTheRunID(t *testing.T) {
	dir := newRepo(t)
	writeLock(t, dir, "0.1", twoRowDigest)

	res, err := Run(dir, twoRows(t))
	if err != nil {
		t.Fatalf("the run failed: %v", err)
	}

	lines := journalLines(t, dir)

	runLines := linesOfKind(lines, "battery")
	if len(runLines) != 1 {
		t.Fatalf("the journal holds %d battery lines, want 1", len(runLines))
	}
	if runLines[0]["run"] != res.ID {
		t.Fatalf("the battery line names run %v, want %q", runLines[0]["run"], res.ID)
	}
	if runLines[0]["battery"] != res.Version {
		t.Fatalf("the battery line names version %v, want %q", runLines[0]["battery"], res.Version)
	}

	rowLines := linesOfKind(lines, "battery-row")
	if len(rowLines) != 2 {
		t.Fatalf("the journal holds %d battery-row lines, want 2", len(rowLines))
	}
	for _, line := range rowLines {
		if line["run"] != res.ID {
			t.Fatalf("a battery-row line names run %v, want %q", line["run"], res.ID)
		}
	}
}

// The battery line's counts must agree with the rows the same run journaled.
func TestBatteryLineCountsAgreeWithItsRows(t *testing.T) {
	dir := newRepo(t)

	reg := NewRegistry()
	reg.Register(fixed("a", "honesty", Blocking, Green))
	reg.Register(fixed("b", "wiring", Blocking, Red))
	reg.Register(fixed("c", "token", Blocking, Red))
	writeLock(t, dir, "0.1", reg.Digest())

	if _, err := Run(dir, reg); err != nil {
		t.Fatalf("the run failed: %v", err)
	}

	runLine := linesOfKind(journalLines(t, dir), "battery")[0]

	counts, ok := runLine["counts"].(map[string]any)
	if !ok {
		t.Fatalf("the battery line has no counts object: %v", runLine["counts"])
	}
	for outcome, want := range map[string]float64{
		"green": 1, "red": 2, "waived": 0, "quarantined": 0, "unrunnable": 0,
	} {
		if counts[outcome] != want {
			t.Errorf("counts[%s] is %v, want %v", outcome, counts[outcome], want)
		}
	}
}

// A row that reports an outcome nobody named, or reports one with nothing to
// show for it, is a defect in the row. The run says so and names the row,
// rather than journaling a verdict that cannot be read.
func TestRunRefusesARowThatReportsNonsense(t *testing.T) {
	cases := []struct {
		name   string
		result Result
	}{
		{"an unknown outcome", Result{Outcome: Outcome("greenish"), Evidence: "e"}},
		{"no outcome at all", Result{Evidence: "e"}},
		{"no evidence", Result{Outcome: Green}},
		{"evidence of nothing but bad bytes", Result{Outcome: Green, Evidence: "\xff\xfe"}},
	}

	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			dir := newRepo(t)

			reg := NewRegistry()
			reg.Register(Row{
				ID: "a", Kind: "honesty", Severity: Blocking,
				Check: func(Context) Result { return c.result },
			})
			writeLock(t, dir, "0.1", reg.Digest())

			_, err := Run(dir, reg)
			if err == nil {
				t.Fatalf("a row reporting %s was accepted", c.name)
			}
			if !strings.Contains(err.Error(), `"a"`) {
				t.Fatalf("the error does not name the row: %v", err)
			}
		})
	}
}

// A check is handed the digest of the run it is part of, so the version row
// can judge the lock file without recomputing it.
func TestACheckIsHandedItsContext(t *testing.T) {
	dir := newRepo(t)

	var got Context
	reg := NewRegistry()
	reg.Register(Row{
		ID: "a", Kind: "honesty", Severity: Blocking,
		Check: func(c Context) Result {
			got = c
			return Result{Outcome: Green, Evidence: "ok"}
		},
	})
	writeLock(t, dir, "0.1", reg.Digest())

	if _, err := Run(dir, reg); err != nil {
		t.Fatalf("the run failed: %v", err)
	}
	if got.Digest != reg.Digest() {
		t.Errorf("the check was handed the digest %q, want %q", got.Digest, reg.Digest())
	}
	if got.RepoDir != dir {
		t.Errorf("the check was handed the directory %q, want %q", got.RepoDir, dir)
	}
}

// A run that could not record itself is not evidence, so a journal it cannot
// write to fails the run rather than passing quietly.
func TestRunFailsWhenItCannotJournal(t *testing.T) {
	dir := t.TempDir()
	writeLock(t, dir, "0.1", twoRowDigest)

	if _, err := Run(dir, twoRows(t)); err == nil {
		t.Fatal("a run outside a git repository reported success")
	}
}

func TestVersionRowIsGreenWhenTheLockMatches(t *testing.T) {
	dir := newRepo(t)
	writeLock(t, dir, "0.1", versionOnlyDigest)

	res, err := Run(dir, versionOnly())
	if err != nil {
		t.Fatalf("the run failed: %v", err)
	}
	if res.Red() {
		t.Fatalf("a matching lock file made the run red: %+v", res.Rows)
	}
	if len(res.Rows) != 1 || res.Rows[0].ID != "version" {
		t.Fatalf("the default battery is not one version row: %+v", res.Rows)
	}
	if res.Rows[0].Outcome != Green {
		t.Fatalf("the version row is %s, want green: %s", res.Rows[0].Outcome, res.Rows[0].Evidence)
	}
	if res.Version != "0.1+"+versionOnlyDigest {
		t.Fatalf("the run reports version %q, want %q", res.Version, "0.1+"+versionOnlyDigest)
	}
}

func TestVersionRowIsRedOnDrift(t *testing.T) {
	dir := newRepo(t)
	writeLock(t, dir, "0.1", "r0000000")

	res, err := Run(dir, versionOnly())
	if err != nil {
		t.Fatalf("the run failed: %v", err)
	}
	if !res.Red() {
		t.Fatal("a drifted lock file left the run green")
	}

	row := res.Rows[0]
	if row.Outcome != Red {
		t.Fatalf("the version row is %s, want red", row.Outcome)
	}
	if !strings.Contains(row.Evidence, LockFile) {
		t.Fatalf("the evidence does not name the lock file: %q", row.Evidence)
	}
	if !strings.Contains(row.Evidence, "r0000000") || !strings.Contains(row.Evidence, versionOnlyDigest) {
		t.Fatalf("the evidence does not show both digests: %q", row.Evidence)
	}
}

// Drift is red, and it is red through the ordinary row path: the run still
// records itself, so the journal shows the battery caught the drift.
func TestDriftIsJournaledLikeAnyOtherRedRow(t *testing.T) {
	dir := newRepo(t)
	writeLock(t, dir, "0.1", "r0000000")

	res, err := Run(dir, versionOnly())
	if err != nil {
		t.Fatalf("the run failed: %v", err)
	}

	rowLines := linesOfKind(journalLines(t, dir), "battery-row")
	if len(rowLines) != 1 {
		t.Fatalf("the journal holds %d battery-row lines, want 1", len(rowLines))
	}
	if rowLines[0]["outcome"] != "red" {
		t.Fatalf("the drift row was journaled as %v, want red", rowLines[0]["outcome"])
	}
	if rowLines[0]["run"] != res.ID {
		t.Fatalf("the drift row was journaled under run %v, want %q", rowLines[0]["run"], res.ID)
	}
}

// A lock file the tool cannot read is a red version row, not a crash. The run
// still records itself, and the declared half of the version says it is not
// known rather than inventing one.
func TestVersionRowIsRedWhenTheLockCannotBeRead(t *testing.T) {
	dir := newRepo(t)

	res, err := Run(dir, versionOnly())
	if err != nil {
		t.Fatalf("the run failed: %v", err)
	}
	if !res.Red() {
		t.Fatal("a missing lock file left the run green")
	}
	if res.Rows[0].Outcome != Red {
		t.Fatalf("the version row is %s, want red", res.Rows[0].Outcome)
	}
	if !strings.Contains(res.Rows[0].Evidence, LockFile) {
		t.Fatalf("the evidence does not name the lock file: %q", res.Rows[0].Evidence)
	}
	if !strings.HasPrefix(res.Version, unknownVersion+"+") {
		t.Fatalf("the run reports version %q, want the declared half to be %q", res.Version, unknownVersion)
	}
}

// Evidence goes on a journal line, and the journal caps free text. A row that
// produced a long line must be cut to fit rather than fail the write.
func TestLongEvidenceIsCutToTheJournalCap(t *testing.T) {
	dir := newRepo(t)

	long := strings.Repeat("x", 5_000)
	reg := NewRegistry()
	reg.Register(Row{
		ID: "a", Kind: "honesty", Severity: Blocking,
		Check: func(Context) Result { return Result{Outcome: Green, Evidence: long} },
	})
	writeLock(t, dir, "0.1", reg.Digest())

	res, err := Run(dir, reg)
	if err != nil {
		t.Fatalf("the run failed: %v", err)
	}

	got := res.Rows[0].Evidence
	if len(got) > journal.MaxTextBytes {
		t.Fatalf("the evidence is %d bytes, over the journal's cap of %d", len(got), journal.MaxTextBytes)
	}
	if !strings.HasSuffix(got, "...") {
		t.Fatalf("cut evidence does not say it was cut: %q", got)
	}

	line := linesOfKind(journalLines(t, dir), "battery-row")[0]
	if line["evidence"] != got {
		t.Fatalf("the journal holds %v, want the same evidence the run reports", line["evidence"])
	}
}

// The battery names its outcomes and the journal validates them. Two lists
// that must agree are one list with a test holding them together.
func TestTheJournalAcceptsEveryOutcomeTheBatteryReports(t *testing.T) {
	var mine []string
	for _, outcome := range Outcomes() {
		mine = append(mine, string(outcome))
	}

	theirs := journal.BatteryOutcomes()

	if !slices.Equal(mine, theirs) {
		t.Fatalf("the battery reports %v, the journal accepts %v", mine, theirs)
	}
}

func TestDefaultHoldsTheVersionRowFirst(t *testing.T) {
	rows := Default().Rows()
	if len(rows) == 0 {
		t.Fatal("the default battery holds no rows")
	}

	row := rows[0]
	if row.ID != "version" || row.Kind != "version" || row.Severity != Blocking {
		t.Fatalf("the first row is %q/%q/%q, want version/version/blocking", row.ID, row.Kind, row.Severity)
	}
	if versionOnly().Digest() != versionOnlyDigest {
		t.Fatalf("the version row alone digests to %q, want %q", versionOnly().Digest(), versionOnlyDigest)
	}
}

// Every row the default battery ships is one this package registered on
// purpose: a row list nobody pinned is a version that moves by accident.
func TestDefaultHoldsExactlyTheShippedRows(t *testing.T) {
	var got []string
	for _, row := range Default().Rows() {
		got = append(got, row.ID+"/"+row.Kind+"/"+row.Severity)
	}

	want := []string{
		"version/version/blocking",
		"manifest/manifest/blocking",
	}
	if !slices.Equal(got, want) {
		t.Fatalf("the default battery holds %v, want %v", got, want)
	}
}

// versionOnly is a registry holding the version row and nothing else. The
// version row's own tests run it, so they judge that row rather than every row
// the battery has since gained.
func versionOnly() *Registry {
	reg := NewRegistry()
	reg.Register(versionRow())

	return reg
}

// Two calls must not hand back the same registry, or one caller's extra row
// would show up in another's digest.
func TestDefaultIsFreshEachTime(t *testing.T) {
	first := Default()
	first.Register(fixed("a", "honesty", Blocking, Green))

	if len(first.Rows()) != len(Default().Rows())+1 {
		t.Fatal("registering a row on one Default() registry changed the next one")
	}
}
