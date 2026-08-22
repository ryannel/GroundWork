package battery

import (
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"testing"

	"github.com/ryannel/groundwork/internal/journal"
)

// The three scan rows share these helpers: a way to run one registered row, a
// way to put a file inside a fixture repo, and the two manifests every fixture
// starts from.

// goCLISurface is a manifest for a repo with one Go surface on the cli
// profile. It is what this repo itself declares, so a fixture built on it is
// the shape the scans meet in real use.
const goCLISurface = `{
  "schema": 1,
  "surfaces": [{"name": "cli", "profile": "cli", "stack": "go", "root": "."}],
  "capabilities": [{"name": "adding", "surface": "cli", "proof": ["alpha"]}]
}`

// webSurface is a manifest for one web surface, which is a profile the token
// scan applies to.
const webSurface = `{
  "schema": 1,
  "surfaces": [{"name": "web", "profile": "web", "stack": "node", "root": "."}],
  "capabilities": [{"name": "sign-in", "surface": "web", "proof": ["test/auth.test.mjs"]}],
  "adapters": {"node": {"command": ["node", "adapter.mjs"]}}
}`

// runRow runs one registered row of the default battery against dir.
func runRow(t *testing.T, dir, id string) Result {
	t.Helper()

	for _, row := range Default().Rows() {
		if row.ID == id {
			return row.Check(Context{RepoDir: dir})
		}
	}

	t.Fatalf("the default battery holds no %s row", id)

	return Result{}
}

// registered reports whether the default battery holds a row with this id,
// kind and severity. A row that exists but is registered nowhere is a check
// that never runs.
func registered(t *testing.T, id, kind string) {
	t.Helper()

	for _, row := range Default().Rows() {
		if row.ID != id {
			continue
		}
		if row.Kind != kind {
			t.Fatalf("the %s row has the kind %q, want %q", id, row.Kind, kind)
		}
		if row.Severity != Blocking {
			t.Fatalf("the %s row has the severity %q, want %q", id, row.Severity, Blocking)
		}

		return
	}

	t.Fatalf("the default battery holds no %s row", id)
}

// writeSource writes one file at rel inside dir, making the directories above
// it. rel is written with forward slashes.
func writeSource(t *testing.T, dir, rel, content string) string {
	t.Helper()

	path := filepath.Join(dir, filepath.FromSlash(rel))
	if err := os.MkdirAll(filepath.Dir(path), 0o750); err != nil {
		t.Fatalf("could not make %s: %v", filepath.Dir(path), err)
	}
	writeFile(t, path, content)

	return path
}

// writeBytes writes one file of raw bytes, which the UTF-8 cases need.
func writeBytes(t *testing.T, dir, rel string, content []byte) {
	t.Helper()

	path := filepath.Join(dir, filepath.FromSlash(rel))
	if err := os.MkdirAll(filepath.Dir(path), 0o750); err != nil {
		t.Fatalf("could not make %s: %v", filepath.Dir(path), err)
	}
	if err := os.WriteFile(path, content, 0o600); err != nil {
		t.Fatalf("could not write %s: %v", path, err)
	}
}

// TestThisRepoDeclaresTheMajorBumpTheScansNeed holds D23 to this slice. Three
// rows joined the battery, and a row added moves the major half of the
// version. The digest in the lock file must be the one the shipped rows
// compute, or the version row would find the drift in this repo first.
func TestThisRepoDeclaresTheMajorBumpTheScansNeed(t *testing.T) {
	lock, err := ReadLock(".")
	if err != nil {
		t.Fatalf("this repo's lock file did not read: %v", err)
	}

	if lock.Digest != Default().Digest() {
		t.Errorf("%s declares the digest %s, and the shipped rows compute %s",
			LockFile, lock.Digest, Default().Digest())
	}

	half, _, _ := strings.Cut(lock.Version, ".")
	major, err := strconv.Atoi(half)
	if err != nil {
		t.Fatalf("%s declares the version %q, whose major half is not a number", LockFile, lock.Version)
	}
	// 1.0 is the version declared when the battery held the version and
	// manifest rows. The three scans are three new rows, so the major moves.
	if major < 2 {
		t.Errorf("%s declares %s, and the battery has gained three rows since 1.0", LockFile, lock.Version)
	}
}

// TestScanEvidenceNeverCarriesAMachinePath holds all three scans to the same
// rule. A row's evidence is read on a machine that is not the one that wrote
// it, so a temporary directory in a line of evidence says nothing to the
// reader — and it fills a line the journal caps.
func TestScanEvidenceNeverCarriesAMachinePath(t *testing.T) {
	dir := newRepo(t)
	writeManifest(t, dir, strings.Replace(goCLISurface, `"root": "."`, `"root": "nowhere"`, 1))

	for _, id := range []string{"honesty", "wiring", "token"} {
		res := runRow(t, dir, id)
		if strings.Contains(res.Evidence, dir) {
			t.Errorf("the %s row's evidence carries this machine's own path: %s", id, res.Evidence)
		}
		mustFit(t, res.Evidence)
	}
}

// mustFit is mustContain for a row that found more hits than one line holds.
// The line must also fit the journal's cap whole, because a line the journal
// trims ends mid-path, and half a path is not evidence.
func mustFit(t *testing.T, evidence string, words ...string) {
	t.Helper()

	if len(evidence) > journal.MaxTextBytes {
		t.Errorf("the evidence is %d bytes, over the journal's cap of %d: %s",
			len(evidence), journal.MaxTextBytes, evidence)
	}
	mustContain(t, evidence, words...)
}

// mustContain fails when a row's evidence does not carry a word the reader
// needs. Evidence nobody can act on is the same as no evidence.
func mustContain(t *testing.T, evidence string, words ...string) {
	t.Helper()

	for _, word := range words {
		if !strings.Contains(evidence, word) {
			t.Errorf("the evidence %q does not say %q", evidence, word)
		}
	}
}
