package journal

import (
	"bytes"
	"errors"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

// dispatchWith returns a dispatch with the given role, tier and numbers. The
// other fields are filled with harmless values, since spend does not read
// them.
func dispatchWith(role, tier string, tokensIn, tokensOut, durationMS int) Dispatch {
	return Dispatch{
		Role:         role,
		Tier:         tier,
		TokensIn:     tokensIn,
		TokensOut:    tokensOut,
		TokensSource: "host-report",
		DurationMS:   durationMS,
		Outcome:      "ok",
	}
}

// rowFor returns the row for a key, or fails the test if Spend did not
// return one.
func rowFor(t *testing.T, rows []SpendRow, key string) SpendRow {
	t.Helper()

	for _, r := range rows {
		if r.Key == key {
			return r
		}
	}

	t.Fatalf("no row for key %q in %+v", key, rows)
	return SpendRow{}
}

func wantRow(t *testing.T, got SpendRow, dispatches, in, out, total, durationMS int64) {
	t.Helper()

	if got.Dispatches != dispatches {
		t.Errorf("row %q has %d dispatches, want %d", got.Key, got.Dispatches, dispatches)
	}
	if got.TokensIn != in {
		t.Errorf("row %q has tokens in %d, want %d", got.Key, got.TokensIn, in)
	}
	if got.TokensOut != out {
		t.Errorf("row %q has tokens out %d, want %d", got.Key, got.TokensOut, out)
	}
	if got.TokensTotal != total {
		t.Errorf("row %q has tokens total %d, want %d", got.Key, got.TokensTotal, total)
	}
	if got.DurationMS != durationMS {
		t.Errorf("row %q has duration_ms %d, want %d", got.Key, got.DurationMS, durationMS)
	}
}

func TestSpendGroupsByRole(t *testing.T) {
	dir := newRepo(t)
	t.Setenv("GROUNDWORK_SESSION", "s-alpha")

	// worker: (100+20) + (50+10) = 180 total, 2 dispatches, 1500ms.
	if _, err := WriteDispatch(dir, dispatchWith("worker", "execution", 100, 20, 1000)); err != nil {
		t.Fatalf("the first dispatch returned an error: %v", err)
	}
	if _, err := WriteDispatch(dir, dispatchWith("worker", "execution", 50, 10, 500)); err != nil {
		t.Fatalf("the second dispatch returned an error: %v", err)
	}
	// driver: 10+5 = 15 total, 1 dispatch, 200ms.
	if _, err := WriteDispatch(dir, dispatchWith("driver", "frontier", 10, 5, 200)); err != nil {
		t.Fatalf("the third dispatch returned an error: %v", err)
	}

	rows, hasRef, err := Spend(dir, "role")
	if err != nil {
		t.Fatalf("Spend returned an error: %v", err)
	}
	if !hasRef {
		t.Errorf("Spend says the journal has no ref, but three dispatches were written")
	}
	if len(rows) != 2 {
		t.Fatalf("Spend returned %d rows, want 2: %+v", len(rows), rows)
	}

	// worker's total (180) beats driver's (15), so it sorts first.
	if rows[0].Key != "worker" || rows[1].Key != "driver" {
		t.Fatalf("rows are in order %v, want worker then driver", []string{rows[0].Key, rows[1].Key})
	}

	wantRow(t, rowFor(t, rows, "worker"), 2, 150, 30, 180, 1500)
	wantRow(t, rowFor(t, rows, "driver"), 1, 10, 5, 15, 200)
}

func TestSpendGroupsByTier(t *testing.T) {
	dir := newRepo(t)
	t.Setenv("GROUNDWORK_SESSION", "s-alpha")

	// execution: (200+40) + (100+20) = 360 total, 2 dispatches, 3000ms.
	if _, err := WriteDispatch(dir, dispatchWith("worker", "execution", 200, 40, 2000)); err != nil {
		t.Fatalf("the first dispatch returned an error: %v", err)
	}
	if _, err := WriteDispatch(dir, dispatchWith("adversary", "execution", 100, 20, 1000)); err != nil {
		t.Fatalf("the second dispatch returned an error: %v", err)
	}
	// frontier: 30+6 = 36 total, 1 dispatch, 400ms.
	if _, err := WriteDispatch(dir, dispatchWith("driver", "frontier", 30, 6, 400)); err != nil {
		t.Fatalf("the third dispatch returned an error: %v", err)
	}

	rows, hasRef, err := Spend(dir, "tier")
	if err != nil {
		t.Fatalf("Spend returned an error: %v", err)
	}
	if !hasRef {
		t.Errorf("Spend says the journal has no ref, but three dispatches were written")
	}
	if len(rows) != 2 {
		t.Fatalf("Spend returned %d rows, want 2: %+v", len(rows), rows)
	}

	if rows[0].Key != "execution" || rows[1].Key != "frontier" {
		t.Fatalf("rows are in order %v, want execution then frontier", []string{rows[0].Key, rows[1].Key})
	}

	wantRow(t, rowFor(t, rows, "execution"), 2, 300, 60, 360, 3000)
	wantRow(t, rowFor(t, rows, "frontier"), 1, 30, 6, 36, 400)
}

func TestSpendGroupsBySession(t *testing.T) {
	dir := newRepo(t)

	t.Setenv("GROUNDWORK_SESSION", "s-alpha")
	// s-alpha: (40+10) + (20+5) = 75 total, 2 dispatches, 900ms.
	if _, err := WriteDispatch(dir, dispatchWith("worker", "execution", 40, 10, 600)); err != nil {
		t.Fatalf("the first dispatch returned an error: %v", err)
	}
	if _, err := WriteDispatch(dir, dispatchWith("worker", "execution", 20, 5, 300)); err != nil {
		t.Fatalf("the second dispatch returned an error: %v", err)
	}

	t.Setenv("GROUNDWORK_SESSION", "s-beta")
	// s-beta: 8+2 = 10 total, 1 dispatch, 100ms.
	if _, err := WriteDispatch(dir, dispatchWith("worker", "execution", 8, 2, 100)); err != nil {
		t.Fatalf("the third dispatch returned an error: %v", err)
	}

	rows, hasRef, err := Spend(dir, "session")
	if err != nil {
		t.Fatalf("Spend returned an error: %v", err)
	}
	if !hasRef {
		t.Errorf("Spend says the journal has no ref, but three dispatches were written")
	}
	if len(rows) != 2 {
		t.Fatalf("Spend returned %d rows, want 2: %+v", len(rows), rows)
	}

	if rows[0].Key != "s-alpha" || rows[1].Key != "s-beta" {
		t.Fatalf("rows are in order %v, want s-alpha then s-beta", []string{rows[0].Key, rows[1].Key})
	}

	wantRow(t, rowFor(t, rows, "s-alpha"), 2, 60, 15, 75, 900)
	wantRow(t, rowFor(t, rows, "s-beta"), 1, 8, 2, 10, 100)
}

// TestSpendFromASubdirectory proves the query works from anywhere in the
// repo, the same way the write path does (see
// TestWriteDispatchCountsSeqFromASubdirectory in journal_test.go).
func TestSpendFromASubdirectory(t *testing.T) {
	dir := newRepo(t)
	t.Setenv("GROUNDWORK_SESSION", "s-alpha")

	if _, err := WriteDispatch(dir, dispatchWith("worker", "execution", 40, 10, 600)); err != nil {
		t.Fatalf("the dispatch returned an error: %v", err)
	}

	sub := filepath.Join(dir, "internal", "deeper")
	if err := os.MkdirAll(sub, 0o750); err != nil {
		t.Fatalf("could not make a subdirectory: %v", err)
	}

	rows, hasRef, err := Spend(sub, "role")
	if err != nil {
		t.Fatalf("Spend from a subdirectory returned an error: %v", err)
	}
	if !hasRef {
		t.Errorf("Spend from a subdirectory says the journal has no ref")
	}
	if len(rows) != 1 {
		t.Fatalf("Spend from a subdirectory returned %d rows, want 1: %+v", len(rows), rows)
	}
	wantRow(t, rowFor(t, rows, "worker"), 1, 40, 10, 50, 600)
}

func TestSpendIgnoresDialAndSealLines(t *testing.T) {
	dir := newRepo(t)
	t.Setenv("GROUNDWORK_SESSION", "s-alpha")

	tagAnnotated(t, dir, "seal-1")

	if _, err := WriteDial(dir, sampleDial()); err != nil {
		t.Fatalf("the dial returned an error: %v", err)
	}
	if _, err := WriteSeal(dir, sampleSeal()); err != nil {
		t.Fatalf("the seal returned an error: %v", err)
	}
	// The only dispatch: 7+3 = 10 total, 1 dispatch, 50ms.
	if _, err := WriteDispatch(dir, dispatchWith("worker", "execution", 7, 3, 50)); err != nil {
		t.Fatalf("the dispatch returned an error: %v", err)
	}
	if _, err := WriteDial(dir, sampleDial()); err != nil {
		t.Fatalf("the second dial returned an error: %v", err)
	}

	rows, hasRef, err := Spend(dir, "role")
	if err != nil {
		t.Fatalf("Spend returned an error: %v", err)
	}
	if !hasRef {
		t.Errorf("Spend says the journal has no ref, but lines were written")
	}
	if len(rows) != 1 {
		t.Fatalf("Spend returned %d rows, want 1: %+v", len(rows), rows)
	}

	wantRow(t, rowFor(t, rows, "worker"), 1, 7, 3, 10, 50)
}

// TestSpendIgnoresAnUnknownKind plants a line of a kind Spend has never
// heard of, carrying fields that look like a dispatch's. It proves Spend
// checks kind before it ever looks at role, tier or tokens.
func TestSpendIgnoresAnUnknownKind(t *testing.T) {
	dir := newRepo(t)
	t.Setenv("GROUNDWORK_SESSION", "s-alpha")

	// A future kind, not yet named in this bet. If Spend counted it, the
	// total below would be 1000, not 10.
	plant(t, dir, "s-future", `{"v":1,"ts":"2026-08-22T14:00:00Z","kind":"lane","session":"s-future","seq":1,"commit":"","branch":"main","role":"worker","tier":"execution","tokens":{"in":800,"out":200,"total":1000},"duration_ms":9000}`)

	// The only real dispatch: 7+3 = 10 total, 1 dispatch, 50ms.
	if _, err := WriteDispatch(dir, dispatchWith("worker", "execution", 7, 3, 50)); err != nil {
		t.Fatalf("the dispatch returned an error: %v", err)
	}

	rows, hasRef, err := Spend(dir, "role")
	if err != nil {
		t.Fatalf("Spend returned an error: %v", err)
	}
	if !hasRef {
		t.Errorf("Spend says the journal has no ref, but lines were written")
	}
	if len(rows) != 1 {
		t.Fatalf("Spend returned %d rows, want 1: %+v", len(rows), rows)
	}

	wantRow(t, rowFor(t, rows, "worker"), 1, 7, 3, 10, 50)
}

// TestSpendTakesAnOlderDispatchLine plants a dispatch line missing fields a
// current writer always fills: v is 0, and tier, tokens and duration_ms are
// absent. Spend must not fail on it, and must count what the line does
// carry.
func TestSpendTakesAnOlderDispatchLine(t *testing.T) {
	dir := newRepo(t)
	t.Setenv("GROUNDWORK_SESSION", "s-alpha")

	plant(t, dir, "s-old", `{"v":0,"kind":"dispatch","session":"s-old","seq":1,"role":"worker"}`)

	rows, hasRef, err := Spend(dir, "role")
	if err != nil {
		t.Fatalf("Spend rejected an older dispatch line: %v", err)
	}
	if !hasRef {
		t.Errorf("Spend says the journal has no ref, but a line was planted")
	}
	if len(rows) != 1 {
		t.Fatalf("Spend returned %d rows, want 1: %+v", len(rows), rows)
	}

	// Every number the old line omits comes back zero, not an error.
	wantRow(t, rowFor(t, rows, "worker"), 1, 0, 0, 0, 0)
}

// TestSpendGroupsAMissingFieldUnderNoKey plants a dispatch line with no tier
// at all, then groups by tier. The row it lands in must be nameable and
// must not collide with a real tier called "".
func TestSpendGroupsAMissingFieldUnderNoKey(t *testing.T) {
	dir := newRepo(t)
	t.Setenv("GROUNDWORK_SESSION", "s-alpha")

	plant(t, dir, "s-old", `{"v":0,"kind":"dispatch","session":"s-old","seq":1,"role":"worker","tokens":{"in":4,"out":1,"total":5},"duration_ms":30}`)

	rows, hasRef, err := Spend(dir, "tier")
	if err != nil {
		t.Fatalf("Spend returned an error: %v", err)
	}
	if !hasRef {
		t.Errorf("Spend says the journal has no ref, but a line was planted")
	}
	if len(rows) != 1 {
		t.Fatalf("Spend returned %d rows, want 1: %+v", len(rows), rows)
	}
	if rows[0].Key != "(none)" {
		t.Errorf("a missing tier grouped under %q, want \"(none)\"", rows[0].Key)
	}
	wantRow(t, rows[0], 1, 4, 1, 5, 30)
}

func TestSpendFailsLoudOnACorruptBlob(t *testing.T) {
	dir := newRepo(t)
	t.Setenv("GROUNDWORK_SESSION", "s-alpha")

	if _, err := WriteDispatch(dir, sampleDispatch()); err != nil {
		t.Fatalf("the dispatch returned an error: %v", err)
	}

	const corrupt = "not json at all"
	plant(t, dir, "s-corrupt", corrupt)

	// The same content, hashed the same way store() hashes it, names the
	// object the query must complain about.
	oid, err := gitOut(dir, nil, []byte(corrupt+"\n"), "hash-object", "--stdin")
	if err != nil {
		t.Fatalf("could not compute the corrupt blob's own oid: %v", err)
	}
	oid = strings.TrimSpace(oid)

	rows, hasRef, err := Spend(dir, "role")
	if err == nil {
		t.Fatalf("Spend accepted a corrupt blob and returned %+v", rows)
	}
	if rows != nil {
		t.Errorf("Spend returned rows %+v on a corrupt blob, want none", rows)
	}
	if !hasRef {
		t.Errorf("Spend says the journal has no ref, but the corrupt blob is in one")
	}
	if !strings.Contains(err.Error(), oid) {
		t.Errorf("the error %q does not name the object %s", err, oid)
	}
	if !strings.Contains(err.Error(), "not valid JSON") {
		t.Errorf("the error %q does not say the object is not valid JSON", err)
	}
}

func TestSpendOnAJournalWithNoRef(t *testing.T) {
	dir := newRepo(t)

	rows, hasRef, err := Spend(dir, "role")
	if err != nil {
		t.Fatalf("Spend returned an error on a repo with no journal ref: %v", err)
	}
	if hasRef {
		t.Errorf("Spend says a repo with no journal writes has a journal ref")
	}
	if len(rows) != 0 {
		t.Errorf("Spend returned %d rows, want 0: %+v", len(rows), rows)
	}
	if refExists(t, dir) {
		t.Errorf("Spend made the journal ref")
	}
}

func TestSpendOnAJournalWithNoDispatchLines(t *testing.T) {
	dir := newRepo(t)
	t.Setenv("GROUNDWORK_SESSION", "s-alpha")

	tagAnnotated(t, dir, "seal-1")

	if _, err := WriteDial(dir, sampleDial()); err != nil {
		t.Fatalf("the dial returned an error: %v", err)
	}
	if _, err := WriteSeal(dir, sampleSeal()); err != nil {
		t.Fatalf("the seal returned an error: %v", err)
	}

	rows, hasRef, err := Spend(dir, "role")
	if err != nil {
		t.Fatalf("Spend returned an error: %v", err)
	}
	if !hasRef {
		t.Errorf("Spend says the journal has no ref, but a dial and a seal were written")
	}
	if len(rows) != 0 {
		t.Errorf("Spend returned %d rows, want 0: %+v", len(rows), rows)
	}
}

func TestSpendBreaksATieByKey(t *testing.T) {
	dir := newRepo(t)
	t.Setenv("GROUNDWORK_SESSION", "s-alpha")

	// Both roles land on tokens total 30. Alphabetical order breaks the tie.
	if _, err := WriteDispatch(dir, dispatchWith("worker", "execution", 20, 10, 100)); err != nil {
		t.Fatalf("the first dispatch returned an error: %v", err)
	}
	if _, err := WriteDispatch(dir, dispatchWith("driver", "frontier", 25, 5, 100)); err != nil {
		t.Fatalf("the second dispatch returned an error: %v", err)
	}

	rows, _, err := Spend(dir, "role")
	if err != nil {
		t.Fatalf("Spend returned an error: %v", err)
	}
	if len(rows) != 2 {
		t.Fatalf("Spend returned %d rows, want 2: %+v", len(rows), rows)
	}
	if rows[0].TokensTotal != rows[1].TokensTotal {
		t.Fatalf("the test needs a tie, got %d and %d", rows[0].TokensTotal, rows[1].TokensTotal)
	}
	if rows[0].Key != "driver" || rows[1].Key != "worker" {
		t.Errorf("a tie sorts as %v, want driver before worker", []string{rows[0].Key, rows[1].Key})
	}
}

func TestSpendRejectsAnUnknownBy(t *testing.T) {
	dir := newRepo(t)
	t.Setenv("GROUNDWORK_SESSION", "s-alpha")

	if _, err := WriteDispatch(dir, sampleDispatch()); err != nil {
		t.Fatalf("the dispatch returned an error: %v", err)
	}

	rows, hasRef, err := Spend(dir, "project")
	if err == nil {
		t.Fatalf("Spend accepted --by project and returned %+v", rows)
	}
	if hasRef {
		t.Errorf("Spend reported hasRef on a rejected by value")
	}
	if !strings.Contains(err.Error(), "project") {
		t.Errorf("the error is %q, want it to name the bad value", err)
	}
	for _, key := range []string{"role", "tier", "session"} {
		if !strings.Contains(err.Error(), key) {
			t.Errorf("the error is %q, want it to list %q among the choices", err, key)
		}
	}
}

func TestSpendOutsideARepo(t *testing.T) {
	dir := t.TempDir()

	rows, hasRef, err := Spend(dir, "role")
	if err == nil {
		t.Fatalf("Spend worked outside a git repository and returned %+v", rows)
	}
	if hasRef {
		t.Errorf("Spend reported hasRef outside a git repository")
	}
	if !errors.Is(err, ErrNotARepo) {
		t.Errorf("Spend returned %v, want ErrNotARepo", err)
	}
}

func TestSpendIsReadOnly(t *testing.T) {
	dir := newRepo(t)
	t.Setenv("GROUNDWORK_SESSION", "s-alpha")

	if _, err := WriteDispatch(dir, sampleDispatch()); err != nil {
		t.Fatalf("the dispatch returned an error: %v", err)
	}

	// Make the tree dirty. A read-only query must not care, and must not
	// clean it up either.
	writeFile(t, filepath.Join(dir, "README.md"), "changed\n")
	writeFile(t, filepath.Join(dir, "scratch.txt"), "untracked\n")

	statusBefore := runGit(t, dir, "status", "--porcelain")
	if statusBefore == "" {
		t.Fatalf("the test repo should be dirty before the query")
	}
	indexBefore := readIndex(t, dir)
	tipBefore := runGit(t, dir, "rev-parse", Ref)
	headBefore := runGit(t, dir, "rev-parse", "HEAD")
	objectsBefore := runGit(t, dir, "count-objects", "-v")
	refsBefore := runGit(t, dir, "for-each-ref")

	for _, by := range []string{"role", "tier", "session"} {
		if _, _, err := Spend(dir, by); err != nil {
			t.Fatalf("Spend(%q) returned an error: %v", by, err)
		}
	}

	if got := runGit(t, dir, "rev-parse", Ref); got != tipBefore {
		t.Errorf("the journal ref moved from %s to %s", tipBefore, got)
	}
	if got := runGit(t, dir, "rev-parse", "HEAD"); got != headBefore {
		t.Errorf("HEAD moved from %s to %s", headBefore, got)
	}
	if indexAfter := readIndex(t, dir); !bytes.Equal(indexBefore, indexAfter) {
		t.Errorf("Spend changed the repo index")
	}
	if statusAfter := runGit(t, dir, "status", "--porcelain"); statusAfter != statusBefore {
		t.Errorf("the working tree changed.\nbefore:\n%s\nafter:\n%s", statusBefore, statusAfter)
	}
	if objectsAfter := runGit(t, dir, "count-objects", "-v"); objectsAfter != objectsBefore {
		t.Errorf("the object count changed.\nbefore:\n%s\nafter:\n%s", objectsBefore, objectsAfter)
	}
	if refsAfter := runGit(t, dir, "for-each-ref"); refsAfter != refsBefore {
		t.Errorf("the refs changed.\nbefore:\n%s\nafter:\n%s", refsBefore, refsAfter)
	}
}
