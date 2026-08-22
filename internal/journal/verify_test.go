package journal

import (
	"bytes"
	"errors"
	"fmt"
	"math"
	"os"
	"path/filepath"
	"slices"
	"strings"
	"testing"
)

// writeSidecar writes a host-usage sidecar file at the given repo root, for
// the given session, with the given raw JSON body. It makes the directory
// the file lives in if that directory does not exist yet.
func writeSidecar(t *testing.T, root, session, body string) {
	t.Helper()

	dir := filepath.Join(root, ".groundwork", "host-usage")
	if err := os.MkdirAll(dir, 0o750); err != nil {
		t.Fatalf("could not make the sidecar directory: %v", err)
	}

	path := filepath.Join(dir, session+".json")
	if err := os.WriteFile(path, []byte(body), 0o600); err != nil {
		t.Fatalf("could not write the sidecar: %v", err)
	}
}

// sidecarBody builds the JSON body of a host-usage sidecar from a session
// and a list of "seq,tokens_total" dispatch entries.
func sidecarBody(session string, entries ...[2]int) string {
	parts := make([]string, len(entries))
	for i, e := range entries {
		parts[i] = fmt.Sprintf(`{"seq":%d,"tokens_total":%d}`, e[0], e[1])
	}

	return fmt.Sprintf(`{"session":%q,"dispatches":[%s]}`, session, strings.Join(parts, ","))
}

// rowAt returns the row for a seq, or fails the test if VerifyTokens did not
// return one.
func rowAt(t *testing.T, rows []VerifyRow, seq int) VerifyRow {
	t.Helper()

	for _, r := range rows {
		if r.Seq == seq {
			return r
		}
	}

	t.Fatalf("no row for seq %d in %+v", seq, rows)
	return VerifyRow{}
}

func TestVerifyTokensExactMatchIsOK(t *testing.T) {
	dir := newRepo(t)
	t.Setenv("GROUNDWORK_SESSION", "s-alpha")

	// tokens.total is 100 + 20 = 120.
	if _, err := WriteDispatch(dir, dispatchWith("worker", "execution", 100, 20, 0)); err != nil {
		t.Fatalf("the dispatch returned an error: %v", err)
	}

	writeSidecar(t, dir, "s-alpha", sidecarBody("s-alpha", [2]int{1, 120}))

	result, err := VerifyTokens(dir, "s-alpha", 0)
	if err != nil {
		t.Fatalf("VerifyTokens returned an error: %v", err)
	}
	if len(result.Rows) != 1 {
		t.Fatalf("VerifyTokens returned %d rows, want 1: %+v", len(result.Rows), result.Rows)
	}

	row := rowAt(t, result.Rows, 1)
	if row.Status != VerifyOK {
		t.Errorf("row status is %q, want %q", row.Status, VerifyOK)
	}
	if want := []int64{120}; !slices.Equal(row.JournalTokens, want) {
		t.Errorf("row journal tokens is %v, want %v", row.JournalTokens, want)
	}
	if row.HostTokens != 120 {
		t.Errorf("row host tokens is %d, want 120", row.HostTokens)
	}
	if result.Unchecked != 0 {
		t.Errorf("Unchecked is %d, want 0", result.Unchecked)
	}
}

func TestVerifyTokensMismatchBeyondTolerance(t *testing.T) {
	dir := newRepo(t)
	t.Setenv("GROUNDWORK_SESSION", "s-alpha")

	if _, err := WriteDispatch(dir, dispatchWith("worker", "execution", 100, 20, 0)); err != nil {
		t.Fatalf("the dispatch returned an error: %v", err)
	}

	// The journal says 120, the host says 200: a mismatch of 80.
	writeSidecar(t, dir, "s-alpha", sidecarBody("s-alpha", [2]int{1, 200}))

	result, err := VerifyTokens(dir, "s-alpha", 0)
	if err != nil {
		t.Fatalf("VerifyTokens returned an error: %v", err)
	}

	row := rowAt(t, result.Rows, 1)
	if row.Status != VerifyMismatch {
		t.Errorf("row status is %q, want %q", row.Status, VerifyMismatch)
	}
}

func TestVerifyTokensToleranceAllowsANearMiss(t *testing.T) {
	dir := newRepo(t)
	t.Setenv("GROUNDWORK_SESSION", "s-alpha")

	if _, err := WriteDispatch(dir, dispatchWith("worker", "execution", 100, 20, 0)); err != nil {
		t.Fatalf("the dispatch returned an error: %v", err)
	}

	// The journal says 120, the host says 122: off by 2.
	writeSidecar(t, dir, "s-alpha", sidecarBody("s-alpha", [2]int{1, 122}))

	tooTight, err := VerifyTokens(dir, "s-alpha", 1)
	if err != nil {
		t.Fatalf("VerifyTokens returned an error: %v", err)
	}
	if got := rowAt(t, tooTight.Rows, 1).Status; got != VerifyMismatch {
		t.Errorf("with tolerance 1, status is %q, want %q", got, VerifyMismatch)
	}

	loose, err := VerifyTokens(dir, "s-alpha", 2)
	if err != nil {
		t.Fatalf("VerifyTokens returned an error: %v", err)
	}
	if got := rowAt(t, loose.Rows, 1).Status; got != VerifyOK {
		t.Errorf("with tolerance 2, status is %q, want %q", got, VerifyOK)
	}
}

func TestVerifyTokensNeverJournaledSeq(t *testing.T) {
	dir := newRepo(t)
	t.Setenv("GROUNDWORK_SESSION", "s-alpha")

	// The journal holds seq 1. The sidecar claims seq 7, which was never
	// written.
	if _, err := WriteDispatch(dir, sampleDispatch()); err != nil {
		t.Fatalf("the dispatch returned an error: %v", err)
	}

	writeSidecar(t, dir, "s-alpha", sidecarBody("s-alpha", [2]int{7, 999}))

	result, err := VerifyTokens(dir, "s-alpha", 0)
	if err != nil {
		t.Fatalf("VerifyTokens returned an error: %v", err)
	}

	row := rowAt(t, result.Rows, 7)
	if row.Status != VerifyNeverJournaled {
		t.Errorf("row status is %q, want %q", row.Status, VerifyNeverJournaled)
	}
	if len(row.JournalTokens) != 0 {
		t.Errorf("row journal tokens is %v, want none: seq 7 was never written", row.JournalTokens)
	}
}

func TestVerifyTokensUnclaimedJournalDispatchesAreUnchecked(t *testing.T) {
	dir := newRepo(t)
	t.Setenv("GROUNDWORK_SESSION", "s-alpha")

	// Two dispatches in the journal, seq 1 and seq 2. The sidecar only
	// claims seq 1.
	if _, err := WriteDispatch(dir, dispatchWith("worker", "execution", 100, 20, 0)); err != nil {
		t.Fatalf("the first dispatch returned an error: %v", err)
	}
	if _, err := WriteDispatch(dir, dispatchWith("worker", "execution", 50, 10, 0)); err != nil {
		t.Fatalf("the second dispatch returned an error: %v", err)
	}

	writeSidecar(t, dir, "s-alpha", sidecarBody("s-alpha", [2]int{1, 120}))

	result, err := VerifyTokens(dir, "s-alpha", 0)
	if err != nil {
		t.Fatalf("VerifyTokens returned an error: %v", err)
	}
	if len(result.Rows) != 1 {
		t.Fatalf("VerifyTokens returned %d rows, want 1: %+v", len(result.Rows), result.Rows)
	}
	if result.Unchecked != 1 {
		t.Errorf("Unchecked is %d, want 1 (seq 2 was never claimed by the sidecar)", result.Unchecked)
	}
	// seq 2 does not fail the run: it does not appear as a row at all, and
	// it is counted, never rejected.
	for _, row := range result.Rows {
		if row.Seq == 2 {
			t.Errorf("an unclaimed journal dispatch produced a row: %+v", row)
		}
	}
}

// TestVerifyTokensUnclaimedCollisionGetsItsOwnAmbiguousRow is D17's amended
// ruling: a seq the journal holds more than once is ambiguous whether or
// not the sidecar ever claims it. Here the sidecar claims only seq 2; seq 1
// is the real merge shape (two clones, same session, both writing seq 1,
// later merged) and the sidecar never mentions it at all. It must still get
// its own row, with both journal figures and no host figure, and it must
// still fail the run.
func TestVerifyTokensUnclaimedCollisionGetsItsOwnAmbiguousRow(t *testing.T) {
	dir := newRepo(t)
	t.Setenv("GROUNDWORK_SESSION", "s-alpha")

	// Here: seq 1, tokens.total = 120.
	if _, err := WriteDispatch(dir, dispatchWith("worker", "execution", 100, 20, 0)); err != nil {
		t.Fatalf("the local dispatch returned an error: %v", err)
	}

	// Another clone, sharing the session id, writes its own seq 1.
	other := filepath.Join(t.TempDir(), "other")
	runGit(t, dir, "clone", "--quiet", dir, other)

	t.Setenv("GROUNDWORK_SESSION", "s-alpha")
	// There: seq 1, tokens.total = 707.
	if _, err := WriteDispatch(other, dispatchWith("worker", "execution", 700, 7, 0)); err != nil {
		t.Fatalf("the other clone's dispatch returned an error: %v", err)
	}

	const incoming = "refs/groundwork/incoming"
	runGit(t, dir, "fetch", "--quiet", other, Ref+":"+incoming)

	if _, err := Merge(dir, incoming); err != nil {
		t.Fatalf("Merge returned an error: %v", err)
	}

	// Now, after the merge: seq 2, a plain single dispatch.
	if _, err := WriteDispatch(dir, dispatchWith("worker", "execution", 40, 10, 0)); err != nil {
		t.Fatalf("the seq 2 dispatch returned an error: %v", err)
	}

	// The sidecar claims only seq 2.
	writeSidecar(t, dir, "s-alpha", sidecarBody("s-alpha", [2]int{2, 50}))

	result, err := VerifyTokens(dir, "s-alpha", 0)
	if err != nil {
		t.Fatalf("VerifyTokens returned an error: %v", err)
	}
	if len(result.Rows) != 2 {
		t.Fatalf("VerifyTokens returned %d rows, want 2 (the unclaimed collision and seq 2): %+v", len(result.Rows), result.Rows)
	}

	collision := rowAt(t, result.Rows, 1)
	if collision.Status != VerifyAmbiguous {
		t.Errorf("seq 1's status is %q, want %q", collision.Status, VerifyAmbiguous)
	}
	if collision.HostClaimed {
		t.Errorf("seq 1 is reported as host-claimed, but the sidecar never mentions it")
	}
	if want := []int64{120, 707}; !slices.Equal(collision.JournalTokens, want) {
		t.Errorf("seq 1's journal tokens is %v, want %v", collision.JournalTokens, want)
	}

	claimed := rowAt(t, result.Rows, 2)
	if claimed.Status != VerifyOK {
		t.Errorf("seq 2's status is %q, want %q", claimed.Status, VerifyOK)
	}

	// The collision is not merely unchecked: it gets a row and fails the
	// run. Nothing else in the journal is unclaimed here.
	if result.Unchecked != 0 {
		t.Errorf("Unchecked is %d, want 0: the collision must be a row, not folded into unchecked", result.Unchecked)
	}
}

func TestVerifyTokensMissingSidecar(t *testing.T) {
	dir := newRepo(t)
	t.Setenv("GROUNDWORK_SESSION", "s-alpha")

	if _, err := WriteDispatch(dir, sampleDispatch()); err != nil {
		t.Fatalf("the dispatch returned an error: %v", err)
	}

	// No sidecar written at all.
	result, err := VerifyTokens(dir, "s-alpha", 0)
	if err == nil {
		t.Fatalf("VerifyTokens accepted a missing sidecar and returned %+v", result)
	}
	if !errors.Is(err, ErrSidecarMissing) {
		t.Errorf("VerifyTokens returned %v, want ErrSidecarMissing", err)
	}
}

func TestVerifyTokensMalformedSidecarJSON(t *testing.T) {
	dir := newRepo(t)
	t.Setenv("GROUNDWORK_SESSION", "s-alpha")

	writeSidecar(t, dir, "s-alpha", "not json at all")

	result, err := VerifyTokens(dir, "s-alpha", 0)
	if err == nil {
		t.Fatalf("VerifyTokens accepted malformed JSON and returned %+v", result)
	}
	if errors.Is(err, ErrSidecarMissing) {
		t.Errorf("VerifyTokens reported a missing sidecar for one that exists but is malformed")
	}
	if !strings.Contains(err.Error(), "not valid JSON") {
		t.Errorf("the error %q does not say the sidecar is not valid JSON", err)
	}
}

func TestVerifyTokensWrongSessionSidecar(t *testing.T) {
	dir := newRepo(t)
	t.Setenv("GROUNDWORK_SESSION", "s-alpha")

	// The file lives at s-alpha.json, as asked, but its own session field
	// names a different session. That makes it the wrong file, not just a
	// wrong value inside the right one.
	writeSidecar(t, dir, "s-alpha", sidecarBody("s-beta", [2]int{1, 120}))

	result, err := VerifyTokens(dir, "s-alpha", 0)
	if err == nil {
		t.Fatalf("VerifyTokens accepted a sidecar for the wrong session and returned %+v", result)
	}
	if errors.Is(err, ErrSidecarMissing) {
		t.Errorf("VerifyTokens reported a missing sidecar for one that exists under the wrong session")
	}
	if !strings.Contains(err.Error(), "s-alpha") || !strings.Contains(err.Error(), "s-beta") {
		t.Errorf("the error %q does not name both sessions", err)
	}
}

func TestVerifyTokensFromASubdirectory(t *testing.T) {
	dir := newRepo(t)
	t.Setenv("GROUNDWORK_SESSION", "s-alpha")

	if _, err := WriteDispatch(dir, dispatchWith("worker", "execution", 100, 20, 0)); err != nil {
		t.Fatalf("the dispatch returned an error: %v", err)
	}

	// The sidecar sits at the repo root, as the design says it always does.
	writeSidecar(t, dir, "s-alpha", sidecarBody("s-alpha", [2]int{1, 120}))

	sub := filepath.Join(dir, "internal", "deeper")
	if err := os.MkdirAll(sub, 0o750); err != nil {
		t.Fatalf("could not make a subdirectory: %v", err)
	}

	result, err := VerifyTokens(sub, "s-alpha", 0)
	if err != nil {
		t.Fatalf("VerifyTokens from a subdirectory returned an error: %v", err)
	}
	if len(result.Rows) != 1 {
		t.Fatalf("VerifyTokens from a subdirectory returned %d rows, want 1: %+v", len(result.Rows), result.Rows)
	}
	if rowAt(t, result.Rows, 1).Status != VerifyOK {
		t.Errorf("row status is %q, want %q", rowAt(t, result.Rows, 1).Status, VerifyOK)
	}
}

func TestVerifyTokensOutsideARepo(t *testing.T) {
	dir := t.TempDir()

	result, err := VerifyTokens(dir, "s-alpha", 0)
	if err == nil {
		t.Fatalf("VerifyTokens worked outside a git repository and returned %+v", result)
	}
	if !errors.Is(err, ErrNotARepo) {
		t.Errorf("VerifyTokens returned %v, want ErrNotARepo", err)
	}
}

func TestVerifyTokensOnASessionTheJournalNeverWroteTo(t *testing.T) {
	dir := newRepo(t)

	// The journal ref does not exist at all yet. Every sidecar entry is
	// still a claim about a dispatch that was never journaled.
	writeSidecar(t, dir, "s-alpha", sidecarBody("s-alpha", [2]int{1, 120}))

	result, err := VerifyTokens(dir, "s-alpha", 0)
	if err != nil {
		t.Fatalf("VerifyTokens returned an error: %v", err)
	}
	if len(result.Rows) != 1 {
		t.Fatalf("VerifyTokens returned %d rows, want 1: %+v", len(result.Rows), result.Rows)
	}
	if rowAt(t, result.Rows, 1).Status != VerifyNeverJournaled {
		t.Errorf("row status is %q, want %q", rowAt(t, result.Rows, 1).Status, VerifyNeverJournaled)
	}
	if result.Unchecked != 0 {
		t.Errorf("Unchecked is %d, want 0", result.Unchecked)
	}
}

func TestVerifyTokensIgnoresDialAndSealLinesInTheSameSession(t *testing.T) {
	dir := newRepo(t)
	t.Setenv("GROUNDWORK_SESSION", "s-alpha")

	tagAnnotated(t, dir, "seal-1")

	if _, err := WriteDial(dir, sampleDial()); err != nil {
		t.Fatalf("the dial returned an error: %v", err)
	}
	if _, err := WriteSeal(dir, sampleSeal()); err != nil {
		t.Fatalf("the seal returned an error: %v", err)
	}
	// seq 3: 100 + 20 = 120 tokens total.
	if _, err := WriteDispatch(dir, dispatchWith("worker", "execution", 100, 20, 0)); err != nil {
		t.Fatalf("the dispatch returned an error: %v", err)
	}

	writeSidecar(t, dir, "s-alpha", sidecarBody("s-alpha", [2]int{3, 120}))

	result, err := VerifyTokens(dir, "s-alpha", 0)
	if err != nil {
		t.Fatalf("VerifyTokens returned an error: %v", err)
	}
	if rowAt(t, result.Rows, 3).Status != VerifyOK {
		t.Errorf("row status is %q, want %q", rowAt(t, result.Rows, 3).Status, VerifyOK)
	}
	// The dial and the seal share this session but are not dispatches. They
	// must not turn up as unchecked dispatch lines.
	if result.Unchecked != 0 {
		t.Errorf("Unchecked is %d, want 0", result.Unchecked)
	}
}

func TestVerifyTokensRowsAreSortedBySeq(t *testing.T) {
	dir := newRepo(t)
	t.Setenv("GROUNDWORK_SESSION", "s-alpha")

	for range 3 {
		if _, err := WriteDispatch(dir, dispatchWith("worker", "execution", 10, 0, 0)); err != nil {
			t.Fatalf("a dispatch returned an error: %v", err)
		}
	}

	// Listed out of order in the sidecar's own array.
	writeSidecar(t, dir, "s-alpha", sidecarBody("s-alpha",
		[2]int{3, 10}, [2]int{1, 10}, [2]int{2, 10}))

	result, err := VerifyTokens(dir, "s-alpha", 0)
	if err != nil {
		t.Fatalf("VerifyTokens returned an error: %v", err)
	}
	if len(result.Rows) != 3 {
		t.Fatalf("VerifyTokens returned %d rows, want 3: %+v", len(result.Rows), result.Rows)
	}
	for i, row := range result.Rows {
		if row.Seq != i+1 {
			t.Errorf("row %d has seq %d, want %d", i, row.Seq, i+1)
		}
	}
}

// TestVerifyTokensRowsSortCorrectlyAtExtremeSeqValues plants two seq values
// at the extremes of what int can hold. A sort comparator built from plain
// subtraction (a.Seq - b.Seq) wraps there, the same way the token
// comparison used to: cmp.Compare is what keeps the ordering correct.
func TestVerifyTokensRowsSortCorrectlyAtExtremeSeqValues(t *testing.T) {
	dir := newRepo(t)

	writeSidecar(t, dir, "s-extreme", fmt.Sprintf(
		`{"session":"s-extreme","dispatches":[{"seq":%d,"tokens_total":0},{"seq":%d,"tokens_total":0}]}`,
		math.MaxInt, math.MinInt))

	result, err := VerifyTokens(dir, "s-extreme", 0)
	if err != nil {
		t.Fatalf("VerifyTokens returned an error: %v", err)
	}
	if len(result.Rows) != 2 {
		t.Fatalf("VerifyTokens returned %d rows, want 2: %+v", len(result.Rows), result.Rows)
	}
	if result.Rows[0].Seq != math.MinInt || result.Rows[1].Seq != math.MaxInt {
		t.Errorf("rows are in order %d, %d, want %d then %d",
			result.Rows[0].Seq, result.Rows[1].Seq, math.MinInt, math.MaxInt)
	}
}

// TestVerifyTokensAmbiguousSeqFromARealMerge is D17 ruling A's own scenario,
// built the way it really happens: two clones share a session id, each
// writes its own dispatch at seq 1 through the real writer, and the two
// journals are joined through the real merge verb. The journal then holds
// two lines that both claim seq 1. Neither can be picked over the other.
func TestVerifyTokensAmbiguousSeqFromARealMerge(t *testing.T) {
	dir := newRepo(t)
	t.Setenv("GROUNDWORK_SESSION", "s-alpha")

	// Here: seq 1, tokens.total = 100 + 20 = 120.
	if _, err := WriteDispatch(dir, dispatchWith("worker", "execution", 100, 20, 0)); err != nil {
		t.Fatalf("the local dispatch returned an error: %v", err)
	}

	// Another clone of the same repo, before it ever saw the local write.
	// It shares the session id, so its own first dispatch is also seq 1.
	other := filepath.Join(t.TempDir(), "other")
	runGit(t, dir, "clone", "--quiet", dir, other)

	t.Setenv("GROUNDWORK_SESSION", "s-alpha")
	// There: seq 1, tokens.total = 40 + 10 = 50.
	if _, err := WriteDispatch(other, dispatchWith("worker", "execution", 40, 10, 0)); err != nil {
		t.Fatalf("the other clone's dispatch returned an error: %v", err)
	}

	const incoming = "refs/groundwork/incoming"
	runGit(t, dir, "fetch", "--quiet", other, Ref+":"+incoming)

	if _, err := Merge(dir, incoming); err != nil {
		t.Fatalf("Merge returned an error: %v", err)
	}

	writeSidecar(t, dir, "s-alpha", sidecarBody("s-alpha", [2]int{1, 120}))

	result, err := VerifyTokens(dir, "s-alpha", 0)
	if err != nil {
		t.Fatalf("VerifyTokens returned an error: %v", err)
	}

	row := rowAt(t, result.Rows, 1)
	if row.Status != VerifyAmbiguous {
		t.Errorf("row status is %q, want %q", row.Status, VerifyAmbiguous)
	}
	if want := []int64{50, 120}; !slices.Equal(row.JournalTokens, want) {
		t.Errorf("row journal tokens is %v, want %v: both figures must survive the merge, not just one", row.JournalTokens, want)
	}
}

// TestVerifyTokensComparisonDoesNotWrapAtTheExtremes plants a journal line
// no real writer would ever produce, but an adversarial or corrupted one
// might: a tokens.total of math.MinInt64. A naive int64 subtraction against
// the sidecar's 0 either overflows or, worse, comes out small enough to
// slip under a tolerance of 0 and be reported ok. Neither is acceptable:
// this is an enormous mismatch and must be reported as one.
func TestVerifyTokensComparisonDoesNotWrapAtTheExtremes(t *testing.T) {
	dir := newRepo(t)
	t.Setenv("GROUNDWORK_SESSION", "s-min")

	plant(t, dir, "s-min", fmt.Sprintf(`{"kind":"dispatch","seq":1,"tokens":{"total":%d}}`, math.MinInt64))

	writeSidecar(t, dir, "s-min", sidecarBody("s-min", [2]int{1, 0}))

	result, err := VerifyTokens(dir, "s-min", 0)
	if err != nil {
		t.Fatalf("VerifyTokens returned an error: %v", err)
	}

	row := rowAt(t, result.Rows, 1)
	if row.Status != VerifyMismatch {
		t.Errorf("row status is %q, want %q (a wrapped comparison could report this as ok)", row.Status, VerifyMismatch)
	}
}

func TestVerifyTokensRejectsANegativeTokensTotalInTheSidecar(t *testing.T) {
	dir := newRepo(t)
	t.Setenv("GROUNDWORK_SESSION", "s-alpha")

	writeSidecar(t, dir, "s-alpha", `{"session":"s-alpha","dispatches":[{"seq":1,"tokens_total":-5}]}`)

	result, err := VerifyTokens(dir, "s-alpha", 0)
	if err == nil {
		t.Fatalf("VerifyTokens accepted a negative tokens_total and returned %+v", result)
	}
	if !strings.Contains(err.Error(), "negative") {
		t.Errorf("the error %q does not say the figure is negative", err)
	}
}

func TestVerifyTokensRejectsADuplicateSeqInTheSidecar(t *testing.T) {
	dir := newRepo(t)
	t.Setenv("GROUNDWORK_SESSION", "s-alpha")

	writeSidecar(t, dir, "s-alpha",
		`{"session":"s-alpha","dispatches":[{"seq":1,"tokens_total":100},{"seq":1,"tokens_total":200}]}`)

	result, err := VerifyTokens(dir, "s-alpha", 0)
	if err == nil {
		t.Fatalf("VerifyTokens accepted a duplicate seq in the sidecar and returned %+v", result)
	}
	if !strings.Contains(err.Error(), "seq 1") {
		t.Errorf("the error %q does not name the duplicated seq", err)
	}
}

func TestVerifyTokensRejectsAnAbsentDispatchesKey(t *testing.T) {
	dir := newRepo(t)
	t.Setenv("GROUNDWORK_SESSION", "s-alpha")

	writeSidecar(t, dir, "s-alpha", `{"session":"s-alpha"}`)

	result, err := VerifyTokens(dir, "s-alpha", 0)
	if err == nil {
		t.Fatalf("VerifyTokens accepted a sidecar with no dispatches key and returned %+v", result)
	}
	if !strings.Contains(err.Error(), "dispatches") {
		t.Errorf("the error %q does not mention dispatches", err)
	}
	// A missing key is its own problem, worded apart from a present-but-empty
	// list (D17 ruling B): if the two ever collapsed onto the same message,
	// this would be the only thing left to notice.
	if strings.Contains(err.Error(), "claims no dispatches") {
		t.Errorf(`the error %q uses the empty-list wording for a key that was never there`, err)
	}
}

func TestVerifyTokensRejectsANullDispatchesList(t *testing.T) {
	dir := newRepo(t)
	t.Setenv("GROUNDWORK_SESSION", "s-alpha")

	writeSidecar(t, dir, "s-alpha", `{"session":"s-alpha","dispatches":null}`)

	result, err := VerifyTokens(dir, "s-alpha", 0)
	if err == nil {
		t.Fatalf("VerifyTokens accepted a null dispatches list and returned %+v", result)
	}
	if !strings.Contains(err.Error(), "dispatches") {
		t.Errorf("the error %q does not mention dispatches", err)
	}
	if strings.Contains(err.Error(), "claims no dispatches") {
		t.Errorf(`the error %q uses the empty-list wording for an explicit null`, err)
	}
}

func TestVerifyTokensRejectsAnEmptyDispatchesList(t *testing.T) {
	dir := newRepo(t)
	t.Setenv("GROUNDWORK_SESSION", "s-alpha")

	writeSidecar(t, dir, "s-alpha", `{"session":"s-alpha","dispatches":[]}`)

	result, err := VerifyTokens(dir, "s-alpha", 0)
	if err == nil {
		t.Fatalf("VerifyTokens accepted an empty dispatches list and returned %+v", result)
	}
	if !strings.Contains(err.Error(), "claims no dispatches") {
		t.Errorf("the error %q does not say the sidecar claims no dispatches", err)
	}
}

// TestVerifyTokensRejectsAPathEscapingSession pins the session guard on its
// own, apart from every other test: nothing else in this file ever passes a
// session id containing a slash, so nothing else would notice if the guard
// were deleted. The decoy sidecar is planted exactly where a deleted guard
// would resolve the path to (two ".." segments cancel the two path
// components of hostUsageDir), and it would even name the right session and
// pass, if VerifyTokens ever got far enough to read it.
func TestVerifyTokensRejectsAPathEscapingSession(t *testing.T) {
	dir := newRepo(t)

	decoy := filepath.Join(dir, "evil.json")
	writeFile(t, decoy, sidecarBody("../../evil", [2]int{1, 1}))

	result, err := VerifyTokens(dir, "../../evil", 0)
	if err == nil {
		t.Fatalf("VerifyTokens accepted a path-escaping session and returned %+v", result)
	}
	if !strings.Contains(err.Error(), "session") {
		t.Errorf("the error %q does not say anything about the session", err)
	}
}

func TestVerifyTokensIsReadOnly(t *testing.T) {
	dir := newRepo(t)
	t.Setenv("GROUNDWORK_SESSION", "s-alpha")

	if _, err := WriteDispatch(dir, dispatchWith("worker", "execution", 100, 20, 0)); err != nil {
		t.Fatalf("the dispatch returned an error: %v", err)
	}
	writeSidecar(t, dir, "s-alpha", sidecarBody("s-alpha", [2]int{1, 120}))

	// Make the tree dirty. A read-only check must not care, and must not
	// clean it up either.
	writeFile(t, filepath.Join(dir, "README.md"), "changed\n")
	writeFile(t, filepath.Join(dir, "scratch.txt"), "untracked\n")

	statusBefore := runGit(t, dir, "status", "--porcelain")
	if statusBefore == "" {
		t.Fatalf("the test repo should be dirty before the check")
	}
	indexBefore := readIndex(t, dir)
	tipBefore := runGit(t, dir, "rev-parse", Ref)
	headBefore := runGit(t, dir, "rev-parse", "HEAD")
	objectsBefore := runGit(t, dir, "count-objects", "-v")
	refsBefore := runGit(t, dir, "for-each-ref")

	sidecarPath := filepath.Join(dir, ".groundwork", "host-usage", "s-alpha.json")
	sidecarBefore, err := os.ReadFile(sidecarPath)
	if err != nil {
		t.Fatalf("could not read the sidecar before the check: %v", err)
	}

	if _, err := VerifyTokens(dir, "s-alpha", 0); err != nil {
		t.Fatalf("VerifyTokens returned an error: %v", err)
	}

	if got := runGit(t, dir, "rev-parse", Ref); got != tipBefore {
		t.Errorf("the journal ref moved from %s to %s", tipBefore, got)
	}
	if got := runGit(t, dir, "rev-parse", "HEAD"); got != headBefore {
		t.Errorf("HEAD moved from %s to %s", headBefore, got)
	}
	if indexAfter := readIndex(t, dir); !bytes.Equal(indexBefore, indexAfter) {
		t.Errorf("VerifyTokens changed the repo index")
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

	// The sidecar itself is never this package's to write: compared byte
	// for byte, not just "still mentions the session".
	sidecarAfter, err := os.ReadFile(sidecarPath)
	if err != nil {
		t.Fatalf("could not read the sidecar after the check: %v", err)
	}
	if !bytes.Equal(sidecarBefore, sidecarAfter) {
		t.Errorf("the sidecar changed.\nbefore:\n%s\nafter:\n%s", sidecarBefore, sidecarAfter)
	}
}
