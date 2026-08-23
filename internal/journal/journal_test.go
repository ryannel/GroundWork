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
	"slices"
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
	{"outcome over the limit", func(d *Dispatch) { d.Outcome = strings.Repeat("x", MaxTextBytes+1) }},
	{"tokens source over the limit", func(d *Dispatch) {
		d.TokensSource = strings.Repeat("x", MaxTextBytes+1)
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
	d.Outcome = strings.Repeat("x", MaxTextBytes)
	d.TokensSource = strings.Repeat("y", MaxTextBytes)

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

// sampleDial returns a dial with every field set to a known value.
func sampleDial() Dial {
	return Dial{
		To:     "bet",
		Scope:  "bet-1",
		Reason: "the plan is ready",
	}
}

// sampleSeal returns a seal with every field set to a known value.
func sampleSeal() Seal {
	return Seal{
		Kind:   "acceptance",
		Tag:    "seal-1",
		Action: "granted",
	}
}

// tagAnnotated makes an annotated tag on HEAD. An annotated tag is its own
// object, so the tag's own id is not the commit's id.
func tagAnnotated(t *testing.T, dir, name string) {
	t.Helper()

	runGit(t, dir, "-c", "user.name=Test Person", "-c", "user.email=test@example.com",
		"tag", "-a", name, "-m", "a seal")
}

// tagLightweight makes a lightweight tag on HEAD. It is a ref straight to the
// commit, with no tag object at all.
func tagLightweight(t *testing.T, dir, name string) {
	t.Helper()

	runGit(t, dir, "tag", name)
}

func TestWriteDialWritesEveryField(t *testing.T) {
	dir := newRepo(t)
	t.Setenv("GROUNDWORK_SESSION", "s-alpha")

	head := runGit(t, dir, "rev-parse", "HEAD")

	path, err := WriteDial(dir, sampleDial())
	if err != nil {
		t.Fatalf("WriteDial returned an error: %v", err)
	}

	event := decodeEvent(t, dir, path)

	wantNumber(t, event, "v", 1)
	wantString(t, event, "kind", "dial")
	wantString(t, event, "session", "s-alpha")
	wantNumber(t, event, "seq", 1)
	wantString(t, event, "commit", head)
	wantString(t, event, "branch", "main")

	wantString(t, event, "from", "slice")
	wantString(t, event, "to", "bet")
	wantString(t, event, "scope", "bet-1")
	wantString(t, event, "reason", "the plan is ready")

	wantKeys := []string{
		"v", "ts", "kind", "session", "seq", "commit", "branch",
		"from", "to", "scope", "reason",
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

func TestWriteDialTakesFromFromTheRef(t *testing.T) {
	dir := newRepo(t)
	t.Setenv("GROUNDWORK_SESSION", "s-alpha")

	first := sampleDial()
	first.To = "milestone"
	firstPath, err := WriteDial(dir, first)
	if err != nil {
		t.Fatalf("the first dial returned an error: %v", err)
	}

	second := sampleDial()
	second.To = "bet"
	secondPath, err := WriteDial(dir, second)
	if err != nil {
		t.Fatalf("the second dial returned an error: %v", err)
	}

	third := sampleDial()
	third.To = "program"
	thirdPath, err := WriteDial(dir, third)
	if err != nil {
		t.Fatalf("the third dial returned an error: %v", err)
	}

	wantString(t, decodeEvent(t, dir, firstPath), "from", "slice")
	wantString(t, decodeEvent(t, dir, secondPath), "from", "milestone")
	wantString(t, decodeEvent(t, dir, thirdPath), "from", "bet")
}

func TestWriteDialKeepsScopesApart(t *testing.T) {
	dir := newRepo(t)
	t.Setenv("GROUNDWORK_SESSION", "s-alpha")

	here := sampleDial()
	here.Scope = "bet-1"
	here.To = "program"
	if _, err := WriteDial(dir, here); err != nil {
		t.Fatalf("the dial on bet-1 returned an error: %v", err)
	}

	elsewhere := sampleDial()
	elsewhere.Scope = "bet-2"
	elsewhere.To = "milestone"
	elsewherePath, err := WriteDial(dir, elsewhere)
	if err != nil {
		t.Fatalf("the dial on bet-2 returned an error: %v", err)
	}

	// bet-2 has no dial of its own yet, so it starts at the floor. The dial
	// on bet-1 must not reach it.
	wantString(t, decodeEvent(t, dir, elsewherePath), "from", "slice")

	back := sampleDial()
	back.Scope = "bet-1"
	back.To = "slice"
	backPath, err := WriteDial(dir, back)
	if err != nil {
		t.Fatalf("the second dial on bet-1 returned an error: %v", err)
	}
	wantString(t, decodeEvent(t, dir, backPath), "from", "program")
}

func TestWriteDialChainsAcrossSessions(t *testing.T) {
	dir := newRepo(t)

	t.Setenv("GROUNDWORK_SESSION", "s-alpha")
	first := sampleDial()
	first.To = "milestone"
	if _, err := WriteDial(dir, first); err != nil {
		t.Fatalf("the dial in the first session returned an error: %v", err)
	}

	t.Setenv("GROUNDWORK_SESSION", "s-beta")
	second := sampleDial()
	second.To = "program"
	path, err := WriteDial(dir, second)
	if err != nil {
		t.Fatalf("the dial in the second session returned an error: %v", err)
	}

	// The dial belongs to the scope, not to the session that moved it.
	wantString(t, decodeEvent(t, dir, path), "from", "milestone")
}

func TestWriteDialStartsAtTheFloor(t *testing.T) {
	dir := newRepo(t)
	t.Setenv("GROUNDWORK_SESSION", "s-alpha")

	// A journal with dispatches in it, but no dial, still starts at the floor.
	if _, err := WriteDispatch(dir, sampleDispatch()); err != nil {
		t.Fatalf("the dispatch returned an error: %v", err)
	}

	path, err := WriteDial(dir, sampleDial())
	if err != nil {
		t.Fatalf("WriteDial returned an error: %v", err)
	}

	wantString(t, decodeEvent(t, dir, path), "from", "slice")
}

func TestWriteDialAcceptsEveryRung(t *testing.T) {
	for _, rung := range []string{"slice", "milestone", "bet", "program"} {
		dir := newRepo(t)
		t.Setenv("GROUNDWORK_SESSION", "s-alpha")

		d := sampleDial()
		d.To = rung

		path, err := WriteDial(dir, d)
		if err != nil {
			t.Fatalf("WriteDial rejected the rung %q: %v", rung, err)
		}
		wantString(t, decodeEvent(t, dir, path), "to", rung)
	}
}

// badDials are the dials the journal must refuse.
var badDials = []struct {
	name string
	bad  func(d *Dial)
}{
	{"unknown rung", func(d *Dial) { d.To = "everything" }},
	{"empty rung", func(d *Dial) { d.To = "" }},
	{"rung in the wrong case", func(d *Dial) { d.To = "Bet" }},
	{"empty scope", func(d *Dial) { d.Scope = "" }},
	{"empty reason", func(d *Dial) { d.Reason = "" }},
	{"scope over the limit", func(d *Dial) { d.Scope = strings.Repeat("x", MaxTextBytes+1) }},
	{"reason over the limit", func(d *Dial) { d.Reason = strings.Repeat("x", MaxTextBytes+1) }},
}

func TestWriteDialRejectsABadDial(t *testing.T) {
	for _, c := range badDials {
		t.Run(c.name, func(t *testing.T) {
			dir := newRepo(t)
			t.Setenv("GROUNDWORK_SESSION", "s-alpha")

			d := sampleDial()
			c.bad(&d)

			path, err := WriteDial(dir, d)
			if err == nil {
				t.Fatalf("WriteDial accepted %s and wrote %q", c.name, path)
			}
			if path != "" {
				t.Errorf("WriteDial returned path %q on failure, want an empty string", path)
			}
			if refExists(t, dir) {
				t.Errorf("WriteDial made the journal ref for a rejected event")
			}
		})
	}
}

func TestWriteDialLeavesAFullJournalAloneWhenItRejects(t *testing.T) {
	for _, c := range badDials {
		t.Run(c.name, func(t *testing.T) {
			dir := newRepo(t)
			t.Setenv("GROUNDWORK_SESSION", "s-alpha")

			if _, err := WriteDial(dir, sampleDial()); err != nil {
				t.Fatalf("the first dial returned an error: %v", err)
			}
			tip := runGit(t, dir, "rev-parse", Ref)

			d := sampleDial()
			c.bad(&d)

			if _, err := WriteDial(dir, d); err == nil {
				t.Fatalf("WriteDial accepted %s", c.name)
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

func TestWriteDialAcceptsTextAtTheLimit(t *testing.T) {
	dir := newRepo(t)
	t.Setenv("GROUNDWORK_SESSION", "s-alpha")

	d := sampleDial()
	d.Scope = strings.Repeat("x", MaxTextBytes)
	d.Reason = strings.Repeat("y", MaxTextBytes)

	path, err := WriteDial(dir, d)
	if err != nil {
		t.Fatalf("WriteDial rejected text at the limit: %v", err)
	}

	event := decodeEvent(t, dir, path)
	wantString(t, event, "scope", d.Scope)
	wantString(t, event, "reason", d.Reason)
}

func TestWriteSealWritesEveryField(t *testing.T) {
	dir := newRepo(t)
	t.Setenv("GROUNDWORK_SESSION", "s-alpha")

	head := runGit(t, dir, "rev-parse", "HEAD")
	tagAnnotated(t, dir, "seal-1")

	path, err := WriteSeal(dir, sampleSeal())
	if err != nil {
		t.Fatalf("WriteSeal returned an error: %v", err)
	}

	event := decodeEvent(t, dir, path)

	wantNumber(t, event, "v", 1)
	wantString(t, event, "kind", "seal")
	wantString(t, event, "session", "s-alpha")
	wantNumber(t, event, "seq", 1)
	wantString(t, event, "commit", head)
	wantString(t, event, "branch", "main")

	wantString(t, event, "seal_kind", "acceptance")
	wantString(t, event, "tag", "seal-1")
	wantString(t, event, "target", head)
	wantString(t, event, "action", "granted")

	wantKeys := []string{
		"v", "ts", "kind", "session", "seq", "commit", "branch",
		"seal_kind", "tag", "target", "action",
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

func TestWriteSealPeelsAnAnnotatedTag(t *testing.T) {
	dir := newRepo(t)
	t.Setenv("GROUNDWORK_SESSION", "s-alpha")

	head := runGit(t, dir, "rev-parse", "HEAD")
	tagAnnotated(t, dir, "seal-1")

	object := runGit(t, dir, "rev-parse", "seal-1")
	if object == head {
		t.Fatalf("the test needs an annotated tag, whose own id is not the commit's")
	}

	path, err := WriteSeal(dir, sampleSeal())
	if err != nil {
		t.Fatalf("WriteSeal returned an error: %v", err)
	}

	event := decodeEvent(t, dir, path)
	wantString(t, event, "target", head)
	if got := event["target"]; got == object {
		t.Errorf("the target is the tag object %v, want the commit it points at", got)
	}
}

func TestWriteSealResolvesALightweightTag(t *testing.T) {
	dir := newRepo(t)
	t.Setenv("GROUNDWORK_SESSION", "s-alpha")

	head := runGit(t, dir, "rev-parse", "HEAD")
	tagLightweight(t, dir, "seal-1")

	path, err := WriteSeal(dir, sampleSeal())
	if err != nil {
		t.Fatalf("WriteSeal returned an error: %v", err)
	}

	wantString(t, decodeEvent(t, dir, path), "target", head)
}

func TestWriteSealFollowsTheTagToItsOwnCommit(t *testing.T) {
	dir := newRepo(t)
	t.Setenv("GROUNDWORK_SESSION", "s-alpha")

	first := runGit(t, dir, "rev-parse", "HEAD")
	tagAnnotated(t, dir, "seal-1")

	// Move on. The seal must still name the commit the tag holds, not HEAD.
	writeFile(t, filepath.Join(dir, "README.md"), "more\n")
	runGit(t, dir, "add", "README.md")
	runGit(t, dir, "commit", "-m", "second")
	second := runGit(t, dir, "rev-parse", "HEAD")

	path, err := WriteSeal(dir, sampleSeal())
	if err != nil {
		t.Fatalf("WriteSeal returned an error: %v", err)
	}

	event := decodeEvent(t, dir, path)
	wantString(t, event, "target", first)
	wantString(t, event, "commit", second)
}

func TestWriteSealOnAMissingTag(t *testing.T) {
	dir := newRepo(t)
	t.Setenv("GROUNDWORK_SESSION", "s-alpha")

	path, err := WriteSeal(dir, sampleSeal())
	if err == nil {
		t.Fatalf("WriteSeal accepted a missing tag and wrote %q", path)
	}
	if path != "" {
		t.Errorf("WriteSeal returned path %q on failure, want an empty string", path)
	}
	if !strings.Contains(err.Error(), "seal-1") {
		t.Errorf("the error is %q, want it to name the tag", err)
	}
	if refExists(t, dir) {
		t.Errorf("WriteSeal made the journal ref for a missing tag")
	}
}

func TestWriteSealDoesNotTakeABranchForATag(t *testing.T) {
	dir := newRepo(t)
	t.Setenv("GROUNDWORK_SESSION", "s-alpha")

	// A branch named like the seal is not a tag. The seal must not take it.
	runGit(t, dir, "branch", "seal-1")

	if _, err := WriteSeal(dir, sampleSeal()); err == nil {
		t.Fatalf("WriteSeal took a branch for a tag")
	}
	if paths := journalPaths(t, dir); len(paths) != 0 {
		t.Errorf("WriteSeal wrote %v for a missing tag", paths)
	}
}

func TestWriteSealLeavesAFullJournalAloneOnAMissingTag(t *testing.T) {
	dir := newRepo(t)
	t.Setenv("GROUNDWORK_SESSION", "s-alpha")

	tagAnnotated(t, dir, "seal-1")
	if _, err := WriteSeal(dir, sampleSeal()); err != nil {
		t.Fatalf("the first seal returned an error: %v", err)
	}
	tip := runGit(t, dir, "rev-parse", Ref)

	s := sampleSeal()
	s.Tag = "seal-2"
	if _, err := WriteSeal(dir, s); err == nil {
		t.Fatalf("WriteSeal accepted a missing tag")
	}

	if got := runGit(t, dir, "rev-parse", Ref); got != tip {
		t.Errorf("the journal ref moved from %s to %s", tip, got)
	}
	if paths := journalPaths(t, dir); len(paths) != 1 {
		t.Errorf("the journal holds %d events, want 1: %v", len(paths), paths)
	}
}

func TestWriteSealRecordsARevoke(t *testing.T) {
	dir := newRepo(t)
	t.Setenv("GROUNDWORK_SESSION", "s-alpha")

	tagAnnotated(t, dir, "seal-1")

	s := sampleSeal()
	s.Action = "revoked"

	path, err := WriteSeal(dir, s)
	if err != nil {
		t.Fatalf("WriteSeal returned an error: %v", err)
	}
	wantString(t, decodeEvent(t, dir, path), "action", "revoked")
}

// badSeals are the seals the journal must refuse.
var badSeals = []struct {
	name string
	bad  func(s *Seal)
}{
	{"unknown action", func(s *Seal) { s.Action = "moved" }},
	{"empty action", func(s *Seal) { s.Action = "" }},
	{"empty kind", func(s *Seal) { s.Kind = "" }},
	{"empty tag", func(s *Seal) { s.Tag = "" }},
	{"kind over the limit", func(s *Seal) { s.Kind = strings.Repeat("x", MaxTextBytes+1) }},
	{"tag over the limit", func(s *Seal) { s.Tag = strings.Repeat("x", MaxTextBytes+1) }},
}

func TestWriteSealRejectsABadSeal(t *testing.T) {
	for _, c := range badSeals {
		t.Run(c.name, func(t *testing.T) {
			dir := newRepo(t)
			t.Setenv("GROUNDWORK_SESSION", "s-alpha")

			tagAnnotated(t, dir, "seal-1")

			s := sampleSeal()
			c.bad(&s)

			path, err := WriteSeal(dir, s)
			if err == nil {
				t.Fatalf("WriteSeal accepted %s and wrote %q", c.name, path)
			}
			if path != "" {
				t.Errorf("WriteSeal returned path %q on failure, want an empty string", path)
			}
			if refExists(t, dir) {
				t.Errorf("WriteSeal made the journal ref for a rejected event")
			}
		})
	}
}

func TestWriteSealAcceptsAKindAtTheLimit(t *testing.T) {
	dir := newRepo(t)
	t.Setenv("GROUNDWORK_SESSION", "s-alpha")

	tagAnnotated(t, dir, "seal-1")

	s := sampleSeal()
	s.Kind = strings.Repeat("x", MaxTextBytes)

	path, err := WriteSeal(dir, s)
	if err != nil {
		t.Fatalf("WriteSeal rejected a kind at the limit: %v", err)
	}
	wantString(t, decodeEvent(t, dir, path), "seal_kind", s.Kind)
}

func TestSeqCountsEveryKindOfEvent(t *testing.T) {
	dir := newRepo(t)
	t.Setenv("GROUNDWORK_SESSION", "s-alpha")

	tagAnnotated(t, dir, "seal-1")

	var paths []string

	first, err := WriteDispatch(dir, sampleDispatch())
	if err != nil {
		t.Fatalf("the dispatch returned an error: %v", err)
	}
	paths = append(paths, first)

	second, err := WriteDial(dir, sampleDial())
	if err != nil {
		t.Fatalf("the dial returned an error: %v", err)
	}
	paths = append(paths, second)

	third, err := WriteSeal(dir, sampleSeal())
	if err != nil {
		t.Fatalf("the seal returned an error: %v", err)
	}
	paths = append(paths, third)

	fourth := sampleDispatch()
	fourth.Outcome = "retry"
	last, err := WriteDispatch(dir, fourth)
	if err != nil {
		t.Fatalf("the second dispatch returned an error: %v", err)
	}
	paths = append(paths, last)

	for i, path := range paths {
		if got := seqOf(t, dir, path); got != i+1 {
			t.Errorf("event %d has seq %d, want %d", i, got, i+1)
		}
	}

	if stored := journalPaths(t, dir); len(stored) != len(paths) {
		t.Errorf("the journal holds %d events, want %d: %v", len(stored), len(paths), stored)
	}
}

func TestWriteDialOutsideARepo(t *testing.T) {
	dir := t.TempDir()
	t.Setenv("GROUNDWORK_SESSION", "s-alpha")

	if _, err := WriteDial(dir, sampleDial()); !errors.Is(err, ErrNotARepo) {
		t.Errorf("WriteDial returned %v, want ErrNotARepo", err)
	}
}

func TestWriteSealOutsideARepo(t *testing.T) {
	dir := t.TempDir()
	t.Setenv("GROUNDWORK_SESSION", "s-alpha")

	if _, err := WriteSeal(dir, sampleSeal()); !errors.Is(err, ErrNotARepo) {
		t.Errorf("WriteSeal returned %v, want ErrNotARepo", err)
	}
}

func TestWriteDialKeepsEveryConcurrentWriteInOneChain(t *testing.T) {
	dir := newRepo(t)
	t.Setenv("GROUNDWORK_SESSION", "s-alpha")

	// Every writer dials the same scope. A writer that loses the race must
	// read from again against the winner's line, not keep the one it read
	// before. So the lines have to come out as one unbroken chain.
	writers := Rungs()

	paths := make([]string, len(writers))
	errs := make([]error, len(writers))

	var wg sync.WaitGroup
	for i, rung := range writers {
		wg.Add(1)
		go func() {
			defer wg.Done()

			d := sampleDial()
			d.To = rung
			paths[i], errs[i] = WriteDial(dir, d)
		}()
	}
	wg.Wait()

	for i, err := range errs {
		if err != nil {
			t.Fatalf("writer %d returned an error: %v", i, err)
		}
	}

	stored := journalPaths(t, dir)
	if len(stored) != len(writers) {
		t.Fatalf("the journal holds %d events, want %d: %v", len(stored), len(writers), stored)
	}

	// Read the lines back in the order they were written.
	bySeq := make(map[int]map[string]any, len(stored))
	for _, path := range stored {
		event := decodeEvent(t, dir, path)

		seq := seqOf(t, dir, path)
		if _, taken := bySeq[seq]; taken {
			t.Fatalf("two events share seq %d", seq)
		}
		bySeq[seq] = event
	}

	from := "slice"
	for seq := 1; seq <= len(writers); seq++ {
		event, found := bySeq[seq]
		if !found {
			t.Fatalf("no event has seq %d", seq)
		}

		wantString(t, event, "from", from)

		to, ok := event["to"].(string)
		if !ok {
			t.Fatalf("the event at seq %d has no to", seq)
		}
		from = to
	}
}

// plant stores one line in the journal by hand. A test uses it to set a ts, a
// seq or a kind together that the writer itself would never produce.
func plant(t *testing.T, dir, session, line string) {
	t.Helper()

	raw := []byte(line + "\n")
	sum := sha256.Sum256(raw)
	path := "events/" + session + "/" + hex.EncodeToString(sum[:]) + ".json"

	tip, err := resolve(dir, Ref)
	if err != nil {
		t.Fatalf("could not read the journal ref: %v", err)
	}
	if err := store(dir, tip, path, raw, "journal: planted"); err != nil {
		t.Fatalf("could not plant a line: %v", err)
	}
}

func TestWriteDialOrdersByTSAcrossSeconds(t *testing.T) {
	dir := newRepo(t)
	t.Setenv("GROUNDWORK_SESSION", "s-alpha")

	// Two dials on one scope, five minutes apart. The later one carries the
	// lower seq, because seq counts within a session and these are two.
	plant(t, dir, "s-early", `{"v":1,"ts":"2026-08-22T14:00:00Z","kind":"dial","session":"s-early","seq":9,"commit":"","branch":"main","from":"slice","to":"milestone","scope":"bet-1","reason":"early"}`)
	plant(t, dir, "s-late", `{"v":1,"ts":"2026-08-22T14:05:00Z","kind":"dial","session":"s-late","seq":1,"commit":"","branch":"main","from":"milestone","to":"program","scope":"bet-1","reason":"late"}`)

	path, err := WriteDial(dir, sampleDial())
	if err != nil {
		t.Fatalf("WriteDial returned an error: %v", err)
	}

	// The clock decides, so the dial leaves the rung the late line set.
	wantString(t, decodeEvent(t, dir, path), "from", "program")
}

func TestWriteDialOrdersByTSAcrossSessions(t *testing.T) {
	dir := newRepo(t)

	t.Setenv("GROUNDWORK_SESSION", "s-alpha")
	first := sampleDial()
	first.To = "milestone"
	if _, err := WriteDial(dir, first); err != nil {
		t.Fatalf("the first dial returned an error: %v", err)
	}

	second := sampleDial()
	second.To = "program"
	if _, err := WriteDial(dir, second); err != nil {
		t.Fatalf("the second dial returned an error: %v", err)
	}

	// A third dial, written last, from a session with a lower count.
	t.Setenv("GROUNDWORK_SESSION", "s-beta")
	third := sampleDial()
	third.To = "bet"
	thirdPath, err := WriteDial(dir, third)
	if err != nil {
		t.Fatalf("the third dial returned an error: %v", err)
	}
	if got := seqOf(t, dir, thirdPath); got != 1 {
		t.Fatalf("the third dial has seq %d, want 1: the test needs the lower seq to be the later line", got)
	}

	t.Setenv("GROUNDWORK_SESSION", "s-gamma")
	path, err := WriteDial(dir, sampleDial())
	if err != nil {
		t.Fatalf("the fourth dial returned an error: %v", err)
	}

	wantString(t, decodeEvent(t, dir, path), "from", "bet")
}

func TestWriteDialReadsDialLinesOnly(t *testing.T) {
	dir := newRepo(t)
	t.Setenv("GROUNDWORK_SESSION", "s-alpha")

	// Later bets add kinds of their own, and a kind may well carry a scope.
	// Only a dial line moves the dial. The ts here is far ahead, so this line
	// would win on order if the kind were not checked.
	plant(t, dir, "s-other", `{"v":1,"ts":"2099-01-01T00:00:00Z","kind":"lane","session":"s-other","seq":1,"commit":"","branch":"main","scope":"bet-1","to":"program"}`)

	path, err := WriteDial(dir, sampleDial())
	if err != nil {
		t.Fatalf("WriteDial returned an error: %v", err)
	}

	wantString(t, decodeEvent(t, dir, path), "from", "slice")
}

// newRepoWithHistory makes a repo with two commits and an annotated tag v1 on
// the second. It returns the repo and both commits, oldest first.
func newRepoWithHistory(t *testing.T) (string, string, string) {
	t.Helper()

	dir := newRepo(t)
	first := runGit(t, dir, "rev-parse", "HEAD")

	writeFile(t, filepath.Join(dir, "README.md"), "more\n")
	runGit(t, dir, "add", "README.md")
	runGit(t, dir, "commit", "-m", "second")
	second := runGit(t, dir, "rev-parse", "HEAD")

	tagAnnotated(t, dir, "v1")

	return dir, first, second
}

func TestWriteSealRefusesRevisionSyntaxInATagName(t *testing.T) {
	// Each of these resolves to a real commit that no tag points at. Taking
	// them would seal the parent of v1 while the line claims v1.
	for _, tag := range []string{"v1~1", "v1^", "v1^{commit}"} {
		t.Run(tag, func(t *testing.T) {
			dir, _, _ := newRepoWithHistory(t)
			t.Setenv("GROUNDWORK_SESSION", "s-alpha")

			s := sampleSeal()
			s.Tag = tag

			path, err := WriteSeal(dir, s)
			if err == nil {
				t.Fatalf("WriteSeal took %q for a tag and wrote %q", tag, path)
			}
			if path != "" {
				t.Errorf("WriteSeal returned path %q on failure, want an empty string", path)
			}
			if refExists(t, dir) {
				t.Errorf("WriteSeal made the journal ref for a name that is not a tag")
			}
		})
	}
}

func TestWriteSealTakesAPlainTagName(t *testing.T) {
	dir, first, second := newRepoWithHistory(t)
	t.Setenv("GROUNDWORK_SESSION", "s-alpha")

	s := sampleSeal()
	s.Tag = "v1"

	path, err := WriteSeal(dir, s)
	if err != nil {
		t.Fatalf("WriteSeal returned an error: %v", err)
	}

	event := decodeEvent(t, dir, path)
	wantString(t, event, "tag", "v1")
	wantString(t, event, "target", second)
	if got := event["target"]; got == first {
		t.Errorf("the target is the parent commit %v, want the commit the tag holds", got)
	}
}

// The closed vocabularies, each named from the ledger rather than from the
// code beside them. D12 fixes roles and tiers; D13 fixes rungs and seal
// actions. Every accessor hands back a copy, so a caller cannot edit the
// vocabulary through it.
//
// The deletion test caught the gap these fill: Rungs had one caller in this
// suite, a concurrency test that used it only to decide how many writers to
// start, so blanking it left the suite green over a vocabulary that was gone.
func TestTheClosedVocabulariesAreWhatTheLedgerNames(t *testing.T) {
	for _, v := range []struct {
		name string
		read func() []string
		want []string
	}{
		{
			"roles",
			Roles,
			[]string{"driver", "worker", "adversary", "blind-author", "capsule-writer", "advisor", "sim"},
		},
		{"tiers", Tiers, []string{"frontier", "execution"}},
		{"rungs", Rungs, []string{"slice", "milestone", "bet", "program"}},
		{"seal actions", SealActions, []string{"granted", "revoked"}},
	} {
		t.Run(v.name, func(t *testing.T) {
			got := v.read()
			if !slices.Equal(got, v.want) {
				t.Fatalf("the %s vocabulary is %v, want %v", v.name, got, v.want)
			}

			v.read()[0] = "tampered"
			if v.read()[0] != v.want[0] {
				t.Fatalf("a caller changed the %s vocabulary through the accessor", v.name)
			}
		})
	}
}
