package journal

import (
	"bytes"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"sync"
	"testing"
	"time"
)

// newRepo makes an empty git repo in a temp dir and returns its path.
// The repo has one commit, so HEAD resolves.
func newRepo(t *testing.T) string {
	t.Helper()

	dir := newEmptyRepo(t)
	writeFile(t, filepath.Join(dir, "README.md"), "start\n")
	runGit(t, dir, "add", "README.md")
	runGit(t, dir, "commit", "-m", "first")

	return dir
}

// newEmptyRepo makes a git repo with no commits at all.
func newEmptyRepo(t *testing.T) string {
	t.Helper()

	dir := t.TempDir()
	runGit(t, dir, "init", "-b", "main")
	runGit(t, dir, "config", "user.name", "Test Person")
	runGit(t, dir, "config", "user.email", "test@example.com")

	return dir
}

// runGit runs one git command in dir and returns its trimmed stdout.
// It fails the test if git fails.
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

// journalPaths returns every blob path in the journal ref, sorted by git.
// It returns nil if the ref does not exist.
func journalPaths(t *testing.T, dir string) []string {
	t.Helper()

	if !refExists(t, dir) {
		return nil
	}

	out := runGit(t, dir, "ls-tree", "-r", "--name-only", Ref)
	if out == "" {
		return nil
	}

	return strings.Split(out, "\n")
}

// refExists reports whether the journal ref is present in the repo.
func refExists(t *testing.T, dir string) bool {
	t.Helper()

	cmd := exec.Command("git", "-C", dir, "rev-parse", "--verify", "--quiet", Ref)
	return cmd.Run() == nil
}

// readEvent returns the raw bytes of one journal blob.
func readEvent(t *testing.T, dir, path string) []byte {
	t.Helper()

	cmd := exec.Command("git", "-C", dir, "cat-file", "blob", Ref+":"+path)
	var out bytes.Buffer
	cmd.Stdout = &out
	if err := cmd.Run(); err != nil {
		t.Fatalf("could not read %s from the journal: %v", path, err)
	}

	return out.Bytes()
}

// decodeEvent reads one journal blob and unmarshals it into a map.
func decodeEvent(t *testing.T, dir, path string) map[string]any {
	t.Helper()

	raw := readEvent(t, dir, path)
	if !bytes.HasSuffix(raw, []byte("\n")) {
		t.Fatalf("event %s does not end in a newline", path)
	}
	if bytes.Count(raw, []byte("\n")) != 1 {
		t.Fatalf("event %s is not one line: %q", path, raw)
	}

	var got map[string]any
	if err := json.Unmarshal(raw, &got); err != nil {
		t.Fatalf("event %s is not valid JSON: %v", path, err)
	}

	return got
}

// sampleDispatch returns a dispatch with every field set to a known value.
func sampleDispatch() Dispatch {
	return Dispatch{
		Role:         "worker",
		Tier:         "execution",
		TokensIn:     120,
		TokensOut:    45,
		TokensSource: "host-report",
		DurationMS:   9100,
		Outcome:      "ok",
	}
}

// wantNumber fails the test unless the field holds the number it wants.
// JSON numbers decode as float64, so the compare goes through float64.
func wantNumber(t *testing.T, event map[string]any, field string, want float64) {
	t.Helper()

	got, ok := event[field].(float64)
	if !ok {
		t.Fatalf("field %q is not a number: %v", field, event[field])
	}
	if got != want {
		t.Errorf("field %q is %v, want %v", field, got, want)
	}
}

// wantString fails the test unless the field holds the string it wants.
func wantString(t *testing.T, event map[string]any, field, want string) {
	t.Helper()

	got, ok := event[field].(string)
	if !ok {
		t.Fatalf("field %q is not a string: %v", field, event[field])
	}
	if got != want {
		t.Errorf("field %q is %q, want %q", field, got, want)
	}
}

func TestWriteDispatchWritesEveryField(t *testing.T) {
	dir := newRepo(t)
	t.Setenv("GROUNDWORK_SESSION", "s-alpha")

	head := runGit(t, dir, "rev-parse", "HEAD")

	path, err := WriteDispatch(dir, sampleDispatch())
	if err != nil {
		t.Fatalf("WriteDispatch returned an error: %v", err)
	}

	paths := journalPaths(t, dir)
	if len(paths) != 1 {
		t.Fatalf("the journal holds %d events, want 1: %v", len(paths), paths)
	}
	if paths[0] != path {
		t.Errorf("WriteDispatch returned path %q, but the journal holds %q", path, paths[0])
	}

	event := decodeEvent(t, dir, path)

	wantNumber(t, event, "v", 1)
	wantString(t, event, "kind", "dispatch")
	wantString(t, event, "session", "s-alpha")
	wantNumber(t, event, "seq", 1)
	wantString(t, event, "commit", head)
	wantString(t, event, "branch", "main")

	ts, ok := event["ts"].(string)
	if !ok {
		t.Fatalf("field \"ts\" is not a string: %v", event["ts"])
	}
	parsed, err := time.Parse(time.RFC3339, ts)
	if err != nil {
		t.Fatalf("field \"ts\" is not RFC3339: %q", ts)
	}
	if !strings.HasSuffix(ts, "Z") {
		t.Errorf("field \"ts\" is not UTC: %q", ts)
	}
	if age := time.Since(parsed); age < -time.Minute || age > time.Minute {
		t.Errorf("field \"ts\" is %v away from now: %q", age, ts)
	}

	wantString(t, event, "role", "worker")
	wantString(t, event, "tier", "execution")
	wantString(t, event, "tokens_source", "host-report")
	wantNumber(t, event, "duration_ms", 9100)
	wantString(t, event, "outcome", "ok")

	tokens, ok := event["tokens"].(map[string]any)
	if !ok {
		t.Fatalf("field \"tokens\" is not an object: %v", event["tokens"])
	}
	wantNumber(t, tokens, "in", 120)
	wantNumber(t, tokens, "out", 45)
	wantNumber(t, tokens, "total", 165)
	if len(tokens) != 3 {
		t.Errorf("field \"tokens\" has keys %v, want in, out and total", keysOf(tokens))
	}

	if _, found := event["session_source"]; found {
		t.Errorf("a session from the environment should not be marked as generated")
	}

	wantKeys := []string{
		"v", "ts", "kind", "session", "seq", "commit", "branch",
		"role", "tier", "tokens", "tokens_source", "duration_ms", "outcome",
	}
	if len(event) != len(wantKeys) {
		t.Errorf("the event has keys %v, want exactly %v", keysOf(event), wantKeys)
	}
	for _, key := range wantKeys {
		if _, found := event[key]; !found {
			t.Errorf("the event is missing field %q", key)
		}
	}
}

// keysOf returns the keys of a decoded event, for failure messages.
func keysOf(event map[string]any) []string {
	keys := make([]string, 0, len(event))
	for key := range event {
		keys = append(keys, key)
	}
	return keys
}

func TestWriteDispatchPathIsSessionAndLineHash(t *testing.T) {
	dir := newRepo(t)
	t.Setenv("GROUNDWORK_SESSION", "s-alpha")

	path, err := WriteDispatch(dir, sampleDispatch())
	if err != nil {
		t.Fatalf("WriteDispatch returned an error: %v", err)
	}

	line := readEvent(t, dir, path)
	sum := sha256.Sum256(line)
	want := "events/s-alpha/" + hex.EncodeToString(sum[:]) + ".json"

	if path != want {
		t.Errorf("WriteDispatch wrote to %q, want %q", path, want)
	}
}

func TestWriteDispatchCountsSeqPerSession(t *testing.T) {
	dir := newRepo(t)
	t.Setenv("GROUNDWORK_SESSION", "s-alpha")

	firstPath, err := WriteDispatch(dir, sampleDispatch())
	if err != nil {
		t.Fatalf("the first write returned an error: %v", err)
	}

	second := sampleDispatch()
	second.Outcome = "retry"
	secondPath, err := WriteDispatch(dir, second)
	if err != nil {
		t.Fatalf("the second write returned an error: %v", err)
	}

	if got := decodeEvent(t, dir, firstPath)["seq"]; got != float64(1) {
		t.Errorf("the first event has seq %v, want 1", got)
	}
	if got := decodeEvent(t, dir, secondPath)["seq"]; got != float64(2) {
		t.Errorf("the second event has seq %v, want 2", got)
	}

	if paths := journalPaths(t, dir); len(paths) != 2 {
		t.Errorf("the journal holds %d events, want 2: %v", len(paths), paths)
	}

	t.Setenv("GROUNDWORK_SESSION", "s-beta")
	otherPath, err := WriteDispatch(dir, sampleDispatch())
	if err != nil {
		t.Fatalf("the write for the second session returned an error: %v", err)
	}
	if got := decodeEvent(t, dir, otherPath)["seq"]; got != float64(1) {
		t.Errorf("a new session starts at seq %v, want 1", got)
	}
}

func TestWriteDispatchKeepsEarlierEvents(t *testing.T) {
	dir := newRepo(t)
	t.Setenv("GROUNDWORK_SESSION", "s-alpha")

	first, err := WriteDispatch(dir, sampleDispatch())
	if err != nil {
		t.Fatalf("the first write returned an error: %v", err)
	}

	second := sampleDispatch()
	second.Outcome = "retry"
	if _, err := WriteDispatch(dir, second); err != nil {
		t.Fatalf("the second write returned an error: %v", err)
	}

	found := false
	for _, path := range journalPaths(t, dir) {
		if path == first {
			found = true
		}
	}
	if !found {
		t.Errorf("the second write dropped the first event %q", first)
	}
}

// badDispatches are the dispatches the journal must refuse.
var badDispatches = []struct {
	name string
	bad  func(d *Dispatch)
}{
	{"unknown role", func(d *Dispatch) { d.Role = "supervisor" }},
	{"empty role", func(d *Dispatch) { d.Role = "" }},
	{"role in the wrong case", func(d *Dispatch) { d.Role = "Worker" }},
	{"unknown tier", func(d *Dispatch) { d.Tier = "middle" }},
	{"empty tier", func(d *Dispatch) { d.Tier = "" }},
	{"outcome over the limit", func(d *Dispatch) { d.Outcome = strings.Repeat("x", maxTextBytes+1) }},
	{"tokens source over the limit", func(d *Dispatch) {
		d.TokensSource = strings.Repeat("x", maxTextBytes+1)
	}},
}

func TestWriteDispatchRejectsABadDispatch(t *testing.T) {
	for _, c := range badDispatches {
		t.Run(c.name, func(t *testing.T) {
			dir := newRepo(t)
			t.Setenv("GROUNDWORK_SESSION", "s-alpha")

			d := sampleDispatch()
			c.bad(&d)

			path, err := WriteDispatch(dir, d)
			if err == nil {
				t.Fatalf("WriteDispatch accepted %s and wrote %q", c.name, path)
			}
			if path != "" {
				t.Errorf("WriteDispatch returned path %q on failure, want an empty string", path)
			}
			if refExists(t, dir) {
				t.Errorf("WriteDispatch made the journal ref for a rejected event")
			}
		})
	}
}

func TestWriteDispatchLeavesAFullJournalAloneWhenItRejects(t *testing.T) {
	for _, c := range badDispatches {
		t.Run(c.name, func(t *testing.T) {
			dir := newRepo(t)
			t.Setenv("GROUNDWORK_SESSION", "s-alpha")

			if _, err := WriteDispatch(dir, sampleDispatch()); err != nil {
				t.Fatalf("the first write returned an error: %v", err)
			}
			tip := runGit(t, dir, "rev-parse", Ref)

			d := sampleDispatch()
			c.bad(&d)

			if _, err := WriteDispatch(dir, d); err == nil {
				t.Fatalf("WriteDispatch accepted %s", c.name)
			}

			if got := runGit(t, dir, "rev-parse", Ref); got != tip {
				t.Errorf("the journal ref moved from %s to %s", tip, got)
			}
			if paths := journalPaths(t, dir); len(paths) != 1 {
				t.Errorf("the journal holds %d events, want 1: %v", len(paths), paths)
			}
		})
	}
}

func TestWriteDispatchAcceptsTextAtTheLimit(t *testing.T) {
	dir := newRepo(t)
	t.Setenv("GROUNDWORK_SESSION", "s-alpha")

	d := sampleDispatch()
	d.Outcome = strings.Repeat("x", maxTextBytes)
	d.TokensSource = strings.Repeat("y", maxTextBytes)

	path, err := WriteDispatch(dir, d)
	if err != nil {
		t.Fatalf("WriteDispatch rejected text at the limit: %v", err)
	}

	event := decodeEvent(t, dir, path)
	wantString(t, event, "outcome", d.Outcome)
	wantString(t, event, "tokens_source", d.TokensSource)
}

func TestWriteDispatchAcceptsEveryRoleAndTier(t *testing.T) {
	roles := []string{"driver", "worker", "adversary", "blind-author", "capsule-writer", "advisor", "sim"}
	tiers := []string{"frontier", "execution"}

	for _, role := range roles {
		for _, tier := range tiers {
			dir := newRepo(t)
			t.Setenv("GROUNDWORK_SESSION", "s-alpha")

			d := sampleDispatch()
			d.Role = role
			d.Tier = tier

			path, err := WriteDispatch(dir, d)
			if err != nil {
				t.Fatalf("WriteDispatch rejected role %q with tier %q: %v", role, tier, err)
			}

			event := decodeEvent(t, dir, path)
			wantString(t, event, "role", role)
			wantString(t, event, "tier", tier)
		}
	}
}

func TestWriteDispatchRejectsAnUnsafeSession(t *testing.T) {
	cases := []struct {
		name    string
		session string
	}{
		{"a path upwards", "../escape"},
		{"a slash", "a/b"},
		{"a leading dot", ".hidden"},
		{"a space", "a b"},
		{"a newline", "a\nb"},
		{"over the limit", strings.Repeat("s", maxSessionBytes+1)},
	}

	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			dir := newRepo(t)
			t.Setenv("GROUNDWORK_SESSION", c.session)

			path, err := WriteDispatch(dir, sampleDispatch())
			if err == nil {
				t.Fatalf("WriteDispatch accepted the session %q and wrote %q", c.session, path)
			}
			if !strings.Contains(err.Error(), "session") {
				t.Errorf("the error is %q, want the journal's own words about the session", err)
			}
			if refExists(t, dir) {
				t.Errorf("WriteDispatch made the journal ref for a rejected event")
			}
			if paths := journalPaths(t, dir); len(paths) != 0 {
				t.Errorf("WriteDispatch wrote %v for a rejected event", paths)
			}
		})
	}
}

func TestWriteDispatchAcceptsASessionAtTheLimit(t *testing.T) {
	dir := newRepo(t)
	session := strings.Repeat("s", maxSessionBytes)
	t.Setenv("GROUNDWORK_SESSION", session)

	path, err := WriteDispatch(dir, sampleDispatch())
	if err != nil {
		t.Fatalf("WriteDispatch rejected a session at the limit: %v", err)
	}
	if !strings.HasPrefix(path, "events/"+session+"/") {
		t.Errorf("the event went to %q, want a path under %q", path, session)
	}
}

func TestCheckSessionRejectsAnEmptyID(t *testing.T) {
	// WriteDispatch cannot reach this through the environment: an unset or
	// empty GROUNDWORK_SESSION means "generate one". The check guards every
	// other caller of the id.
	err := checkSession("")
	if err == nil {
		t.Fatalf("checkSession accepted an empty session id")
	}
	if !strings.Contains(err.Error(), "session") {
		t.Errorf("the error is %q, want the journal's own words about the session", err)
	}
}

func TestWriteDispatchLeavesTheWorkingTreeAlone(t *testing.T) {
	dir := newRepo(t)
	t.Setenv("GROUNDWORK_SESSION", "s-alpha")

	// Make the tree dirty. A journal write must not care.
	writeFile(t, filepath.Join(dir, "README.md"), "changed\n")
	writeFile(t, filepath.Join(dir, "scratch.txt"), "untracked\n")

	before := runGit(t, dir, "status", "--porcelain")
	if before == "" {
		t.Fatalf("the test repo should be dirty before the write")
	}

	// Read the index after status, so any refresh status does has happened.
	indexBefore := readIndex(t, dir)

	if _, err := WriteDispatch(dir, sampleDispatch()); err != nil {
		t.Fatalf("WriteDispatch returned an error in a dirty repo: %v", err)
	}

	if indexAfter := readIndex(t, dir); !bytes.Equal(indexBefore, indexAfter) {
		t.Errorf("WriteDispatch changed the repo index")
	}

	if after := runGit(t, dir, "status", "--porcelain"); after != before {
		t.Errorf("the working tree changed.\nbefore:\n%s\nafter:\n%s", before, after)
	}

	if got := readFile(t, filepath.Join(dir, "README.md")); got != "changed\n" {
		t.Errorf("README.md now holds %q, want %q", got, "changed\n")
	}
}

// readIndex returns the bytes of the repo's real index file.
func readIndex(t *testing.T, dir string) []byte {
	t.Helper()

	raw, err := os.ReadFile(filepath.Join(dir, ".git", "index"))
	if err != nil {
		t.Fatalf("could not read the repo index: %v", err)
	}

	return raw
}

func readFile(t *testing.T, path string) string {
	t.Helper()

	raw, err := os.ReadFile(path)
	if err != nil {
		t.Fatalf("could not read %s: %v", path, err)
	}

	return string(raw)
}

func TestWriteDispatchLeavesHeadAlone(t *testing.T) {
	dir := newRepo(t)
	t.Setenv("GROUNDWORK_SESSION", "s-alpha")

	head := runGit(t, dir, "rev-parse", "HEAD")
	branch := runGit(t, dir, "rev-parse", "--abbrev-ref", "HEAD")

	if _, err := WriteDispatch(dir, sampleDispatch()); err != nil {
		t.Fatalf("WriteDispatch returned an error: %v", err)
	}

	if got := runGit(t, dir, "rev-parse", "HEAD"); got != head {
		t.Errorf("HEAD moved from %s to %s", head, got)
	}
	if got := runGit(t, dir, "rev-parse", "--abbrev-ref", "HEAD"); got != branch {
		t.Errorf("the branch changed from %s to %s", branch, got)
	}
}

// clearSession unsets GROUNDWORK_SESSION for one test.
// t.Setenv first, so the test framework puts the old value back afterwards.
func clearSession(t *testing.T) {
	t.Helper()

	t.Setenv("GROUNDWORK_SESSION", "")
	if err := os.Unsetenv("GROUNDWORK_SESSION"); err != nil {
		t.Fatalf("could not clear GROUNDWORK_SESSION: %v", err)
	}
}

func TestWriteDispatchGeneratesASessionWhenTheEnvironmentIsSilent(t *testing.T) {
	dir := newRepo(t)
	clearSession(t)

	path, err := WriteDispatch(dir, sampleDispatch())
	if err != nil {
		t.Fatalf("WriteDispatch returned an error: %v", err)
	}

	event := decodeEvent(t, dir, path)
	wantString(t, event, "session_source", "generated")

	session, ok := event["session"].(string)
	if !ok {
		t.Fatalf("field \"session\" is not a string: %v", event["session"])
	}
	if !strings.HasPrefix(session, "gen-") {
		t.Errorf("a generated session is %q, want a gen- prefix", session)
	}

	random, err := hex.DecodeString(strings.TrimPrefix(session, "gen-"))
	if err != nil {
		t.Fatalf("a generated session is %q, want hex after the prefix", session)
	}
	if len(random) != sessionBytes {
		t.Errorf("a generated session carries %d random bytes, want %d", len(random), sessionBytes)
	}

	if !strings.HasPrefix(path, "events/"+session+"/") {
		t.Errorf("the event went to %q, want a path under the generated session %q", path, session)
	}
}

func TestWriteDispatchGeneratesADifferentSessionEachTime(t *testing.T) {
	dir := newRepo(t)
	clearSession(t)

	firstPath, err := WriteDispatch(dir, sampleDispatch())
	if err != nil {
		t.Fatalf("the first write returned an error: %v", err)
	}
	secondPath, err := WriteDispatch(dir, sampleDispatch())
	if err != nil {
		t.Fatalf("the second write returned an error: %v", err)
	}

	first := decodeEvent(t, dir, firstPath)["session"]
	second := decodeEvent(t, dir, secondPath)["session"]
	if first == second {
		t.Errorf("two generated sessions are both %v, want different ones", first)
	}
}

func TestWriteDispatchInARepoWithNoCommits(t *testing.T) {
	dir := newEmptyRepo(t)
	t.Setenv("GROUNDWORK_SESSION", "s-alpha")

	path, err := WriteDispatch(dir, sampleDispatch())
	if err != nil {
		t.Fatalf("WriteDispatch returned an error in a repo with no commits: %v", err)
	}

	event := decodeEvent(t, dir, path)
	wantString(t, event, "commit", "")
	wantString(t, event, "branch", "main")
}

func TestWriteDispatchBuildsARefWithHistory(t *testing.T) {
	dir := newRepo(t)
	t.Setenv("GROUNDWORK_SESSION", "s-alpha")

	if _, err := WriteDispatch(dir, sampleDispatch()); err != nil {
		t.Fatalf("the first write returned an error: %v", err)
	}
	first := runGit(t, dir, "rev-parse", Ref)

	second := sampleDispatch()
	second.Outcome = "retry"
	if _, err := WriteDispatch(dir, second); err != nil {
		t.Fatalf("the second write returned an error: %v", err)
	}

	parent := runGit(t, dir, "rev-parse", Ref+"^")
	if parent != first {
		t.Errorf("the second journal commit has parent %s, want %s", parent, first)
	}
}

// seqOf returns the seq of one stored event.
func seqOf(t *testing.T, dir, path string) int {
	t.Helper()

	got, ok := decodeEvent(t, dir, path)["seq"].(float64)
	if !ok {
		t.Fatalf("event %s has no seq", path)
	}

	return int(got)
}

func TestWriteDispatchCountsSeqFromASubdirectory(t *testing.T) {
	dir := newRepo(t)
	t.Setenv("GROUNDWORK_SESSION", "s-alpha")

	sub := filepath.Join(dir, "internal", "deeper")
	if err := os.MkdirAll(sub, 0o750); err != nil {
		t.Fatalf("could not make a subdirectory: %v", err)
	}

	if _, err := WriteDispatch(dir, sampleDispatch()); err != nil {
		t.Fatalf("the write from the repo root returned an error: %v", err)
	}

	second := sampleDispatch()
	second.Outcome = "retry"
	path, err := WriteDispatch(sub, second)
	if err != nil {
		t.Fatalf("the write from a subdirectory returned an error: %v", err)
	}

	if got := seqOf(t, dir, path); got != 2 {
		t.Errorf("an event written from a subdirectory has seq %d, want 2", got)
	}
	if !strings.HasPrefix(path, "events/s-alpha/") {
		t.Errorf("an event written from a subdirectory went to %q", path)
	}
	if paths := journalPaths(t, dir); len(paths) != 2 {
		t.Errorf("the journal holds %d events, want 2: %v", len(paths), paths)
	}
}

func TestStoreRefusesALineTheJournalAlreadyHolds(t *testing.T) {
	dir := newRepo(t)
	t.Setenv("GROUNDWORK_SESSION", "s-alpha")

	path, err := WriteDispatch(dir, sampleDispatch())
	if err != nil {
		t.Fatalf("the first write returned an error: %v", err)
	}

	line := readEvent(t, dir, path)
	tip := runGit(t, dir, "rev-parse", Ref)

	// Storing the same line again would add nothing. Adding nothing must
	// not look like success.
	if err := store(dir, tip, path, line, "journal: duplicate"); err == nil {
		t.Fatalf("store accepted a line the journal already holds")
	}

	if got := runGit(t, dir, "rev-parse", Ref); got != tip {
		t.Errorf("the journal ref moved from %s to %s", tip, got)
	}
	if paths := journalPaths(t, dir); len(paths) != 1 {
		t.Errorf("the journal holds %d events, want 1: %v", len(paths), paths)
	}
}

func TestStoreRefusesAStaleTip(t *testing.T) {
	dir := newRepo(t)
	t.Setenv("GROUNDWORK_SESSION", "s-alpha")

	if _, err := WriteDispatch(dir, sampleDispatch()); err != nil {
		t.Fatalf("the first write returned an error: %v", err)
	}
	stale := runGit(t, dir, "rev-parse", Ref)

	second := sampleDispatch()
	second.Outcome = "retry"
	if _, err := WriteDispatch(dir, second); err != nil {
		t.Fatalf("the second write returned an error: %v", err)
	}
	tip := runGit(t, dir, "rev-parse", Ref)
	if tip == stale {
		t.Fatalf("the second write did not move the journal ref")
	}

	// A write built on the old tip would drop the second event.
	path := "events/s-alpha/" + strings.Repeat("a", 64) + ".json"
	err := store(dir, stale, path, []byte("{\"seq\":9}\n"), "journal: stale")
	if err == nil {
		t.Fatalf("store accepted a stale tip")
	}
	if !errors.Is(err, errRefMoved) {
		t.Errorf("store returned %v, want an error that says the ref moved", err)
	}

	if got := runGit(t, dir, "rev-parse", Ref); got != tip {
		t.Errorf("the journal ref moved from %s to %s", tip, got)
	}
	if paths := journalPaths(t, dir); len(paths) != 2 {
		t.Errorf("the journal holds %d events, want 2: %v", len(paths), paths)
	}
}

func TestWriteDispatchKeepsEveryConcurrentWrite(t *testing.T) {
	dir := newRepo(t)
	t.Setenv("GROUNDWORK_SESSION", "s-alpha")

	const writers = 8

	paths := make([]string, writers)
	errs := make([]error, writers)

	var wg sync.WaitGroup
	for i := range writers {
		wg.Add(1)
		go func() {
			defer wg.Done()

			d := sampleDispatch()
			d.Outcome = fmt.Sprintf("ok-%d", i)
			paths[i], errs[i] = WriteDispatch(dir, d)
		}()
	}
	wg.Wait()

	for i, err := range errs {
		if err != nil {
			t.Fatalf("writer %d returned an error: %v", i, err)
		}
	}

	stored := journalPaths(t, dir)
	if len(stored) != writers {
		t.Fatalf("the journal holds %d events, want %d: %v", len(stored), writers, stored)
	}

	held := make(map[string]bool, len(stored))
	for _, path := range stored {
		held[path] = true
	}
	for i, path := range paths {
		if !held[path] {
			t.Errorf("writer %d wrote %q, which the journal does not hold", i, path)
		}
	}

	// Every writer took its own place in the sequence.
	seen := make(map[int]bool, len(stored))
	for _, path := range stored {
		seq := seqOf(t, dir, path)
		if seen[seq] {
			t.Errorf("two events share seq %d", seq)
		}
		seen[seq] = true
	}
	for n := 1; n <= writers; n++ {
		if !seen[n] {
			t.Errorf("no event has seq %d", n)
		}
	}
}

func TestWriteDispatchOutsideARepo(t *testing.T) {
	dir := t.TempDir()
	t.Setenv("GROUNDWORK_SESSION", "s-alpha")

	path, err := WriteDispatch(dir, sampleDispatch())
	if err == nil {
		t.Fatalf("WriteDispatch worked outside a git repository and wrote %q", path)
	}
	if !errors.Is(err, ErrNotARepo) {
		t.Errorf("WriteDispatch returned %v, want ErrNotARepo", err)
	}
}
