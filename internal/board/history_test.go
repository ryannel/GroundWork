package board

import (
	"bytes"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"testing"
)

// git runs one git command in dir and returns its trimmed stdout.
func git(t *testing.T, dir string, args ...string) string {
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

// newRepo makes a git repo with one commit and returns its path.
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
		git(t, dir, args...)
	}
	commit(t, dir, "first", "start")

	return dir
}

// commit writes one file and commits it with the given message.
func commit(t *testing.T, dir, message, content string) string {
	t.Helper()

	name := strings.Fields(message)[0] + ".txt"
	if err := os.WriteFile(filepath.Join(dir, name), []byte(content+"\n"), 0o600); err != nil {
		t.Fatalf("could not write %s: %v", name, err)
	}
	git(t, dir, "add", "-A")
	git(t, dir, "commit", "-m", message)

	return git(t, dir, "rev-parse", "HEAD")
}

// The trailer is read with git's own trailer parser, so a Slice line that is
// not a trailer is not one here either, and a folded value comes back as one
// line.
func TestReadHistoryReadsTheTrailerGitItselfReads(t *testing.T) {
	dir := newRepo(t)
	commit(t, dir, "one\n\nBet: bet 3\nSlice: s_one\nTests: yes", "one")
	commit(t, dir, "two, with no trailer at all", "two")
	commit(t, dir, "three\n\nSlice: s_two\n  and more", "three")

	h, err := ReadHistory(dir)
	if err != nil {
		t.Fatalf("reading the history failed: %v", err)
	}

	if h.Commits != 4 {
		t.Errorf("the history holds %d commits, want 4", h.Commits)
	}
	if len(h.Claims) != 2 {
		t.Fatalf("the history holds %d claims, want 2: %+v", len(h.Claims), h.Claims)
	}

	// Newest first, and a folded value joined into one line.
	if h.Claims[0].Value != "s_two and more" {
		t.Errorf("the folded value came back %q", h.Claims[0].Value)
	}
	if h.Claims[1].Value != "s_one" {
		t.Errorf("the plain value came back %q", h.Claims[1].Value)
	}
	for _, claim := range h.Claims {
		if !claim.Alone {
			t.Errorf("the claim %+v is marked as one of several", claim)
		}
		if claim.Merge {
			t.Errorf("the claim %+v sits on an ordinary commit and is marked a merge", claim)
		}
	}
}

// A merge commit is a commit like any other to git, and the reader marks it so
// the derivation can decline to read it.
func TestReadHistoryMarksATrailerOnAMergeCommit(t *testing.T) {
	dir := newRepo(t)
	git(t, dir, "checkout", "-q", "-b", "side")
	commit(t, dir, "side work", "side")
	git(t, dir, "checkout", "-q", "main")
	commit(t, dir, "main work", "main")
	git(t, dir, "merge", "--no-ff", "-m", "merge side\n\nSlice: s_one", "side")

	h, err := ReadHistory(dir)
	if err != nil {
		t.Fatalf("reading the history failed: %v", err)
	}

	if len(h.Claims) != 1 {
		t.Fatalf("the history holds %d claims, want 1: %+v", len(h.Claims), h.Claims)
	}
	if !h.Claims[0].Merge {
		t.Errorf("the claim on the merge commit is not marked a merge: %+v", h.Claims[0])
	}
}

// Two trailers on one commit: one slice is one commit, so the reader says the
// claim did not stand alone and lets the derivation refuse it.
func TestReadHistoryMarksTwoTrailersOnOneCommit(t *testing.T) {
	dir := newRepo(t)
	commit(t, dir, "two at once\n\nSlice: s_one\nSlice: s_two", "both")

	h, err := ReadHistory(dir)
	if err != nil {
		t.Fatalf("reading the history failed: %v", err)
	}

	if len(h.Claims) != 2 {
		t.Fatalf("the history holds %d claims, want 2: %+v", len(h.Claims), h.Claims)
	}
	for _, claim := range h.Claims {
		if claim.Alone {
			t.Errorf("the claim %+v is marked as the only one on its commit", claim)
		}
	}
}

// A shallow clone cannot see all of its own history, so the landed set it reads
// may be short. That is said rather than guessed at.
func TestReadHistorySaysWhenTheHistoryIsShallow(t *testing.T) {
	dir := newRepo(t)
	commit(t, dir, "one\n\nSlice: s_one", "one")
	commit(t, dir, "two\n\nSlice: s_two", "two")

	clone := filepath.Join(t.TempDir(), "shallow")
	git(t, t.TempDir(), "clone", "-q", "--depth", "1", "file://"+dir, clone)

	h, err := ReadHistory(clone)
	if err != nil {
		t.Fatalf("reading the shallow history failed: %v", err)
	}

	if !h.Shallow {
		t.Error("a shallow clone did not read as shallow")
	}
	if len(h.Claims) != 1 {
		t.Errorf("the shallow clone read %d claims, want the 1 it can see", len(h.Claims))
	}

	full, err := ReadHistory(dir)
	if err != nil {
		t.Fatalf("reading the whole history failed: %v", err)
	}
	if full.Shallow {
		t.Error("a whole history read as shallow")
	}
}

// A repo with no commit at all has landed nothing, and that is an answer, not
// a failure.
func TestReadHistoryOnARepoWithNoCommits(t *testing.T) {
	dir := t.TempDir()
	for _, args := range [][]string{
		{"init", "-b", "main"},
		{"config", "user.name", "Test Person"},
		{"config", "user.email", "test@example.com"},
		// D64 ruling 9: a fixture has nothing to sign, and the host's signing
		// shim dies under load, which reads as a proof that failed (F104).
		{"config", "commit.gpgsign", "false"},
	} {
		git(t, dir, args...)
	}

	h, err := ReadHistory(dir)
	if err != nil {
		t.Fatalf("reading an empty history failed: %v", err)
	}
	if h.Commits != 0 || len(h.Claims) != 0 {
		t.Errorf("an empty repo read %d commits and %d claims", h.Commits, len(h.Claims))
	}
}

// Outside a repository the reader says so rather than passing on git's own
// words about a directory.
func TestReadHistoryOutsideARepo(t *testing.T) {
	if _, err := ReadHistory(t.TempDir()); err == nil {
		t.Fatal("reading the history outside a repo did not fail")
	}
}

// D65 ruling 4: the keys this repo writes as trailers are a list, and it is the
// list the pages declare. A reader that tells a quoted trailer block from prose
// stands on it, so a key added here without a page saying so is a key nobody
// agreed to.
//
// The pin reads the structure, not the words: the working agreement's own
// commit-message block, and the derivation contract's section on this trailer.
func TestTheTrailerKeysAreTheOnesThePagesDeclare(t *testing.T) {
	agreement := readRepoFile(t, "CLAUDE.md")

	// The fenced block under "Committing" is where the agreement fixes the
	// trailers a commit message ends with.
	block := between(t, agreement, "```\nBet:", "```")

	declared := map[string]bool{TrailerKey: true}
	for _, line := range strings.Split(block, "\n") {
		if key, _, found := strings.Cut(strings.TrimSpace(line), ":"); found && key != "" {
			declared[key] = true
		}
	}

	for _, key := range TrailerKeys() {
		if !declared[key] {
			t.Errorf("TrailerKeys holds %q, and no page declares it", key)
		}
		delete(declared, key)
	}
	for key := range declared {
		t.Errorf("the pages declare the trailer %q, and TrailerKeys does not hold it", key)
	}

	// And the contract page spells this package's own key, so a reader of the
	// page and a reader of the code look for the same word.
	page := readRepoFile(t, "docs/derivation-contract.md")
	if !strings.Contains(page, "`"+TrailerKey+"` trailer") {
		t.Errorf("the derivation contract never writes the %q trailer this package reads", TrailerKey)
	}
}

// readRepoFile reads one file from the repo root.
func readRepoFile(t *testing.T, name string) string {
	t.Helper()

	raw, err := os.ReadFile(filepath.Join("..", "..", filepath.FromSlash(name)))
	if err != nil {
		t.Fatalf("%s did not read: %v", name, err)
	}

	return string(raw)
}

// between returns the text of the first block opening with start and closing
// with end.
func between(t *testing.T, text, start, end string) string {
	t.Helper()

	at := strings.Index(text, start)
	if at < 0 {
		t.Fatalf("no block opens with %q", start)
	}

	rest := text[at+len("```\n"):]
	stop := strings.Index(rest, end)
	if stop < 0 {
		t.Fatalf("the block opening with %q never closes", start)
	}

	return rest[:stop]
}
