package battery

import (
	"os"
	"os/exec"
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

// goLibrarySurface is a manifest for one Go surface on the library profile.
// It is the shape the held-out go-fieldkit declared: a repo whose callers live
// in other people's repos.
const goLibrarySurface = `{
  "schema": 1,
  "surfaces": [{"name": "kit", "profile": "library", "stack": "go", "root": "."}],
  "capabilities": [{"name": "adding", "surface": "kit", "proof": ["alpha"]}]
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

// makeFIFO puts a named pipe where a file would go. It is the plainest file a
// scan must turn away without reading: not a symlink, not unreadable, just not
// a regular file. mkfifo is shelled out to rather than called, so a machine
// without it skips the case instead of failing to build.
func makeFIFO(t *testing.T, path string) {
	t.Helper()

	if err := os.MkdirAll(filepath.Dir(path), 0o750); err != nil {
		t.Fatalf("could not make %s: %v", filepath.Dir(path), err)
	}
	if err := exec.Command("mkfifo", path).Run(); err != nil {
		t.Skipf("this machine cannot make a named pipe: %v", err)
	}
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

// The tail must never starve the evidence. A hit names a file, a line and a
// function somebody has to go and look at; a clause of the tail explains the
// scan. So the clause gives way first.
//
// The arithmetic is the reviewer's: a prefix of 51 bytes, one hit of 70, and a
// tail of 82 come to 203, three over the journal's cap of 200. Before the fix
// the whole line was thrown away for a nameless "the first is in <file>", and
// the tail went with it — 80 bytes of budget left unspent.
func TestHitEvidenceDropsAClauseBeforeItDropsAName(t *testing.T) {
	one := hit{file: "slug/slug.go", line: 5, subject: "Truncate", shape: "is exported and nothing in the module names it"}
	prefix := "the wiring scan found 1 function nothing wires up: "
	clauses := []string{libraryDeclared, "1 symlink was not followed"}

	// The case only proves what it claims if the arithmetic is the reviewer's.
	if got := len(prefix); got != 51 {
		t.Fatalf("the prefix is %d bytes, and this case is written for 51", got)
	}
	if got := len(one.String()); got != 70 {
		t.Fatalf("the hit renders to %d bytes, and this case is written for 70", got)
	}
	if got := len(tailOf(clauses)); got != 82 {
		t.Fatalf("the tail is %d bytes, and this case is written for 82", got)
	}

	got := hitEvidence(prefix, []hit{one}, clauses)

	// The whole hit, shape and all — not a fragment of it. Dropping the front
	// clause buys 54 bytes, which is more than the three the line was over.
	mustFit(t, got, one.String())
	if !strings.Contains(got, clauses[len(clauses)-1]) {
		t.Errorf("the scan's own notes vanished while %d bytes were still free: %s",
			journal.MaxTextBytes-len(got), got)
	}
	if strings.Contains(got, clauses[0]) {
		t.Errorf("the droppable clause was kept and something else gave way: %s", got)
	}
}

// When not one whole hit fits, what is left of the budget still goes on what a
// reader can act on: the name, the line, and the row's own notes. A nameless
// line spends nothing.
func TestHitEvidenceSpendsItsBudgetWhenNoWholeHitFits(t *testing.T) {
	one := hit{
		file:    "internal/somewhere/deep/wiringrow.go",
		line:    2140,
		subject: "CheckTheWiringOfEverything",
		shape:   "is exported and no file outside the tests names it, which is a great many words indeed",
	}
	prefix := "the wiring scan found 1 exported function nothing wires up: "
	clauses := []string{"1 file was not read"}

	// The case only proves what it claims if no whole hit can fit, tail or no
	// tail, and the ladder's top rung can.
	if len(prefix)+len(one.String()) <= journal.MaxTextBytes {
		t.Fatalf("one whole hit fits in %d bytes, so this case never reaches the fallback",
			len(prefix)+len(one.String()))
	}

	got := hitEvidence(prefix, []hit{one}, clauses)

	mustFit(t, got, one.subject, "2140", clauses[0])
	if len(got) < journal.MaxTextBytes/2 {
		t.Errorf("the line spent %d of %d bytes: %s", len(got), journal.MaxTextBytes, got)
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
