package main

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/ryannel/groundwork/internal/journal"
)

// writeSidecar writes a host-usage sidecar file at the given repo root, for
// the given session, with the given raw JSON body.
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

// verifyTokensArgs is a full set of flags for journal verify-tokens.
func verifyTokensArgs(extra ...string) []string {
	args := []string{"journal", "verify-tokens", "--session", "s-alpha"}
	return append(args, extra...)
}

func TestRunVerifyTokensExactMatchExitsOK(t *testing.T) {
	dir := newRepo(t)
	t.Setenv("GROUNDWORK_SESSION", "s-alpha")

	// tokens.total = 120 + 45 = 165, as sampled by dispatchArgs above.
	if code, _, errOut := call(t, dispatchArgs()...); code != 0 {
		t.Fatalf("the dispatch exited %d. stderr: %s", code, errOut)
	}
	writeSidecar(t, dir, "s-alpha", sidecarBody("s-alpha", [2]int{1, 165}))

	code, out, errOut := call(t, verifyTokensArgs()...)
	if code != 0 {
		t.Fatalf("exit code is %d, want 0. stderr: %s", code, errOut)
	}
	if !strings.Contains(out, "seq=1") || !strings.Contains(out, "ok") {
		t.Errorf("stdout is %q, want it to report seq 1 as ok", out)
	}
	if !strings.Contains(out, "checked 1, ok 1, mismatched 0, ambiguous 0, never-journaled 0, unchecked 0") {
		t.Errorf("stdout is %q, want a summary line of checked 1, ok 1, mismatched 0, ambiguous 0, never-journaled 0, unchecked 0", out)
	}
}

func TestRunVerifyTokensMismatchExitsFailed(t *testing.T) {
	dir := newRepo(t)
	t.Setenv("GROUNDWORK_SESSION", "s-alpha")

	if code, _, errOut := call(t, dispatchArgs()...); code != 0 {
		t.Fatalf("the dispatch exited %d. stderr: %s", code, errOut)
	}
	// The journal holds 165, the sidecar claims 999.
	writeSidecar(t, dir, "s-alpha", sidecarBody("s-alpha", [2]int{1, 999}))

	code, out, errOut := call(t, verifyTokensArgs()...)
	if code != 1 {
		t.Errorf("exit code is %d, want 1", code)
	}
	if !strings.Contains(out, "mismatch") {
		t.Errorf("stdout is %q, want it to report a mismatch", out)
	}
	if !strings.Contains(out, "checked 1, ok 0, mismatched 1, ambiguous 0, never-journaled 0, unchecked 0") {
		t.Errorf("stdout is %q, want a summary line of checked 1, ok 0, mismatched 1, ambiguous 0, never-journaled 0, unchecked 0", out)
	}
	if errOut != "" {
		t.Errorf("a mismatch is reported on stdout, not stderr, got stderr %q", errOut)
	}
}

func TestRunVerifyTokensDefaultToleranceIsZero(t *testing.T) {
	dir := newRepo(t)
	t.Setenv("GROUNDWORK_SESSION", "s-alpha")

	if code, _, errOut := call(t, dispatchArgs()...); code != 0 {
		t.Fatalf("the dispatch exited %d. stderr: %s", code, errOut)
	}
	// Off by one token, and no --tolerance flag given at all.
	writeSidecar(t, dir, "s-alpha", sidecarBody("s-alpha", [2]int{1, 166}))

	code, _, _ := call(t, verifyTokensArgs()...)
	if code != 1 {
		t.Errorf("exit code is %d, want 1: a one-token gap must fail without --tolerance", code)
	}
}

func TestRunVerifyTokensToleranceAllowsANearMiss(t *testing.T) {
	dir := newRepo(t)
	t.Setenv("GROUNDWORK_SESSION", "s-alpha")

	if code, _, errOut := call(t, dispatchArgs()...); code != 0 {
		t.Fatalf("the dispatch exited %d. stderr: %s", code, errOut)
	}
	// Off by 3 tokens: 165 journaled, 168 claimed.
	writeSidecar(t, dir, "s-alpha", sidecarBody("s-alpha", [2]int{1, 168}))

	code, out, errOut := call(t, verifyTokensArgs("--tolerance", "3")...)
	if code != 0 {
		t.Fatalf("exit code is %d, want 0. stderr: %s", code, errOut)
	}
	if !strings.Contains(out, "checked 1, ok 1, mismatched 0, ambiguous 0, never-journaled 0, unchecked 0") {
		t.Errorf("stdout is %q, want a summary line of checked 1, ok 1, mismatched 0, ambiguous 0, never-journaled 0, unchecked 0", out)
	}
}

func TestRunVerifyTokensNeverJournaledExitsFailed(t *testing.T) {
	dir := newRepo(t)
	t.Setenv("GROUNDWORK_SESSION", "s-alpha")

	if code, _, errOut := call(t, dispatchArgs()...); code != 0 {
		t.Fatalf("the dispatch exited %d. stderr: %s", code, errOut)
	}
	// seq 9 was never dispatched.
	writeSidecar(t, dir, "s-alpha", sidecarBody("s-alpha", [2]int{9, 500}))

	code, out, errOut := call(t, verifyTokensArgs()...)
	if code != 1 {
		t.Errorf("exit code is %d, want 1", code)
	}
	if !strings.Contains(out, "never-journaled") {
		t.Errorf("stdout is %q, want it to say never-journaled", out)
	}
	// The full summary line, not just the substring: never-journaled has
	// its own count, apart from mismatched, and it must land in it, not in
	// mismatched or ok. seq 1 (the dispatch just written) is itself
	// unclaimed by this sidecar, so it counts as unchecked, not ok.
	if !strings.Contains(out, "checked 1, ok 0, mismatched 0, ambiguous 0, never-journaled 1, unchecked 1") {
		t.Errorf("stdout is %q, want a summary line of checked 1, ok 0, mismatched 0, ambiguous 0, never-journaled 1, unchecked 1", out)
	}
	if errOut != "" {
		t.Errorf("a never-journaled entry is reported on stdout, not stderr, got stderr %q", errOut)
	}
}

// TestRunVerifyTokensNeverJournaledRowLineIsPinned asserts the exact row
// line for a never-journaled entry, not just a substring of it: the "-"
// placeholder where the journal figure would be, alongside the host's own
// figure and the status word, all in the one documented format.
func TestRunVerifyTokensNeverJournaledRowLineIsPinned(t *testing.T) {
	dir := newRepo(t)
	t.Setenv("GROUNDWORK_SESSION", "s-alpha")

	writeSidecar(t, dir, "s-alpha", sidecarBody("s-alpha", [2]int{9, 500}))

	code, out, errOut := call(t, verifyTokensArgs()...)
	if code != 1 {
		t.Fatalf("exit code is %d, want 1. stderr: %s", code, errOut)
	}

	lines := strings.Split(strings.TrimRight(out, "\n"), "\n")
	if len(lines) < 1 || lines[0] != "seq=9 journal=- host=500 never-journaled" {
		t.Errorf("first line is %q, want %q", firstOrEmpty(lines), "seq=9 journal=- host=500 never-journaled")
	}
}

// firstOrEmpty returns the first element of a slice, or "" for an empty one.
// A test failure message needs a value to show even when the slice it is
// reporting on turned out empty.
func firstOrEmpty(lines []string) string {
	return lineAt(lines, 0)
}

// lineAt returns lines[i], or "" if the slice is too short. A test failure
// message needs a value to show even when the slice it is reporting on
// turned out shorter than expected.
func lineAt(lines []string, i int) string {
	if i < 0 || i >= len(lines) {
		return ""
	}
	return lines[i]
}

// TestRunVerifyTokensAmbiguousSeqFromARealMergeExitsFailed is D17's amended
// ruling, exercised the way it really happens: two clones share a session
// id, each writes its own dispatch at seq 1, and the two journals are
// joined through the real merge verb. The sidecar claims seq 1, so this is
// the claimed-collision shape — every figure the journal holds for that
// seq still has to show up on its row, and the run still has to fail.
func TestRunVerifyTokensAmbiguousSeqFromARealMergeExitsFailed(t *testing.T) {
	dir := newRepo(t)
	t.Setenv("GROUNDWORK_SESSION", "s-alpha")

	// Here: seq 1, tokens.total = 100 + 20 = 120.
	if code, _, errOut := call(t, spendDispatchArgs("worker", "execution", 100, 20, 0)...); code != 0 {
		t.Fatalf("the local dispatch exited %d. stderr: %s", code, errOut)
	}

	// Another clone of the same repo, before it ever saw the local write.
	// It shares the session id, so its own first dispatch is also seq 1.
	other := filepath.Join(t.TempDir(), "other")
	runGit(t, dir, "clone", "--quiet", dir, other)

	t.Setenv("GROUNDWORK_SESSION", "s-alpha")
	// There: seq 1, tokens.total = 700 + 7 = 707.
	if _, err := journal.WriteDispatch(other, journal.Dispatch{
		Role:         "worker",
		Tier:         "execution",
		TokensIn:     700,
		TokensOut:    7,
		TokensSource: "unset",
		DurationMS:   0,
		Outcome:      "ok",
	}); err != nil {
		t.Fatalf("the other clone's dispatch returned an error: %v", err)
	}

	const incoming = "refs/groundwork/incoming"
	runGit(t, dir, "fetch", "--quiet", other, journal.Ref+":"+incoming)

	if code, _, errOut := call(t, "journal", "merge", incoming); code != 0 {
		t.Fatalf("the merge exited %d. stderr: %s", code, errOut)
	}

	// The sidecar claims seq 1, naming the figure from the other clone.
	writeSidecar(t, dir, "s-alpha", sidecarBody("s-alpha", [2]int{1, 707}))

	code, out, errOut := call(t, verifyTokensArgs()...)
	if code != 1 {
		t.Fatalf("exit code is %d, want 1. stderr: %s", code, errOut)
	}

	lines := strings.Split(strings.TrimRight(out, "\n"), "\n")

	wantLine := "seq=1 journal=120,707 host=707 ambiguous"
	if lineAt(lines, 0) != wantLine {
		t.Errorf("first line is %q, want %q", lineAt(lines, 0), wantLine)
	}

	wantSummary := "checked 1, ok 0, mismatched 0, ambiguous 1, never-journaled 0, unchecked 0"
	if lineAt(lines, 1) != wantSummary {
		t.Errorf("summary line is %q, want %q", lineAt(lines, 1), wantSummary)
	}
}

func TestRunVerifyTokensUncheckedDoesNotFail(t *testing.T) {
	dir := newRepo(t)
	t.Setenv("GROUNDWORK_SESSION", "s-alpha")

	// Two dispatches. The sidecar only claims the first, so the second is
	// unchecked, not a failure.
	if code, _, errOut := call(t, dispatchArgs()...); code != 0 {
		t.Fatalf("the first dispatch exited %d. stderr: %s", code, errOut)
	}
	if code, _, errOut := call(t, dispatchArgs()...); code != 0 {
		t.Fatalf("the second dispatch exited %d. stderr: %s", code, errOut)
	}
	writeSidecar(t, dir, "s-alpha", sidecarBody("s-alpha", [2]int{1, 165}))

	code, out, errOut := call(t, verifyTokensArgs()...)
	if code != 0 {
		t.Fatalf("exit code is %d, want 0. stderr: %s", code, errOut)
	}
	if !strings.Contains(out, "checked 1, ok 1, mismatched 0, ambiguous 0, never-journaled 0, unchecked 1") {
		t.Errorf("stdout is %q, want a summary line of checked 1, ok 1, mismatched 0, ambiguous 0, never-journaled 0, unchecked 1", out)
	}
}

func TestRunVerifyTokensMissingSidecarExitsTwo(t *testing.T) {
	newRepo(t)
	t.Setenv("GROUNDWORK_SESSION", "s-alpha")

	if code, _, errOut := call(t, dispatchArgs()...); code != 0 {
		t.Fatalf("the dispatch exited %d. stderr: %s", code, errOut)
	}

	// No sidecar written at all.
	code, out, errOut := call(t, verifyTokensArgs()...)
	if code != 2 {
		t.Errorf("exit code is %d, want 2", code)
	}
	if out != "" {
		t.Errorf("a missing sidecar should print nothing on stdout, got %q", out)
	}
	if errOut == "" {
		t.Errorf("a missing sidecar should say something on stderr")
	}
}

func TestRunVerifyTokensMalformedSidecarExitsFailed(t *testing.T) {
	dir := newRepo(t)
	t.Setenv("GROUNDWORK_SESSION", "s-alpha")

	writeSidecar(t, dir, "s-alpha", "not json at all")

	code, out, errOut := call(t, verifyTokensArgs()...)
	if code != 1 {
		t.Errorf("exit code is %d, want 1", code)
	}
	if out != "" {
		t.Errorf("a malformed sidecar should print nothing on stdout, got %q", out)
	}
	if errOut == "" {
		t.Errorf("a malformed sidecar should say something on stderr")
	}
}

func TestRunVerifyTokensWrongSessionExitsFailed(t *testing.T) {
	dir := newRepo(t)
	t.Setenv("GROUNDWORK_SESSION", "s-alpha")

	writeSidecar(t, dir, "s-alpha", sidecarBody("s-beta", [2]int{1, 165}))

	code, out, errOut := call(t, verifyTokensArgs()...)
	if code != 1 {
		t.Errorf("exit code is %d, want 1", code)
	}
	if out != "" {
		t.Errorf("a wrong-session sidecar should print nothing on stdout, got %q", out)
	}
	if !strings.Contains(errOut, "s-alpha") || !strings.Contains(errOut, "s-beta") {
		t.Errorf("stderr is %q, want it to name both sessions", errOut)
	}
}

func TestRunVerifyTokensOutsideARepo(t *testing.T) {
	t.Chdir(t.TempDir())
	t.Setenv("GROUNDWORK_SESSION", "s-alpha")

	code, out, errOut := call(t, verifyTokensArgs()...)
	if code != 1 {
		t.Errorf("exit code is %d, want 1", code)
	}
	if !strings.Contains(errOut, "not in a git repository") {
		t.Errorf("stderr is %q, want it to say it is not in a git repository", errOut)
	}
	if out != "" {
		t.Errorf("a failed check should print nothing on stdout, got %q", out)
	}
}

func TestRunVerifyTokensRejectsBadUsage(t *testing.T) {
	cases := []struct {
		name string
		args []string
	}{
		{"no flags", []string{"journal", "verify-tokens"}},
		{"no session", []string{"journal", "verify-tokens", "--tolerance", "0"}},
		{"unknown flag", verifyTokensArgs("--strict", "true")},
		{"spare argument", verifyTokensArgs("extra")},
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

// TestRunVerifyTokensRejectsANegativeTolerance is kept apart from the other
// bad-usage cases and given a sidecar that would otherwise pass. Without
// that sidecar, a missing one also exits 2, and the two failures would look
// the same from outside: this test would pass even if the --tolerance guard
// were deleted, because ErrSidecarMissing exits 2 too. Naming the usage
// wording in the assertion is what tells the two apart.
func TestRunVerifyTokensRejectsANegativeTolerance(t *testing.T) {
	dir := newRepo(t)
	t.Setenv("GROUNDWORK_SESSION", "s-alpha")

	if code, _, errOut := call(t, dispatchArgs()...); code != 0 {
		t.Fatalf("the dispatch exited %d. stderr: %s", code, errOut)
	}
	writeSidecar(t, dir, "s-alpha", sidecarBody("s-alpha", [2]int{1, 165}))

	code, out, errOut := call(t, verifyTokensArgs("--tolerance", "-1")...)
	if code != 2 {
		t.Errorf("exit code is %d, want 2", code)
	}
	if !strings.Contains(errOut, "--tolerance") {
		t.Errorf("stderr is %q, want it to name --tolerance", errOut)
	}
	if strings.Contains(errOut, "sidecar") {
		t.Errorf("stderr is %q, want a usage complaint, not a sidecar complaint", errOut)
	}
	if out != "" {
		t.Errorf("bad usage should print nothing on stdout, got %q", out)
	}
}
