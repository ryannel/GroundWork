package battery

import (
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"slices"
	"strings"
	"testing"

	"github.com/ryannel/groundwork/internal/manifest"
)

// oneGoSurface is a manifest for a repo with one Go surface and one capability
// proven by one suite. Every case below is this file with one thing changed.
const oneGoSurface = `{
  "schema": 1,
  "surfaces": [{"name": "cli", "profile": "cli", "stack": "go", "root": "."}],
  "capabilities": [{"name": "adding", "surface": "cli", "proof": ["alpha"]}]
}`

// TestManifestRowIsInTheDefaultBattery holds the wiring. A row that exists but
// is registered nowhere is a check that never runs.
func TestManifestRowIsInTheDefaultBattery(t *testing.T) {
	ids := make([]string, 0, Default().Len())
	for _, row := range Default().Rows() {
		ids = append(ids, row.ID)
	}

	if !slices.Contains(ids, "manifest") {
		t.Fatalf("the default battery holds %v, with no manifest row", ids)
	}
}

func TestManifestRowIsGreenWhenEveryCapabilityIsProven(t *testing.T) {
	dir := newRepo(t)
	writeManifest(t, dir, oneGoSurface)
	writeGoSuite(t, dir, "alpha")

	res := runManifestRow(t, dir)
	if res.Outcome != Green {
		t.Fatalf("the row came out %s: %s", res.Outcome, res.Evidence)
	}
	if !strings.Contains(res.Evidence, "adding") && !strings.Contains(res.Evidence, "1 capability") {
		t.Errorf("the evidence %q says nothing about what was proven", res.Evidence)
	}
}

// TestManifestRowIsRedWithNoManifest is the fail-closed path. A repo that never
// declared its capabilities has not proven them.
func TestManifestRowIsRedWithNoManifest(t *testing.T) {
	dir := newRepo(t)

	res := runManifestRow(t, dir)
	if res.Outcome != Red {
		t.Fatalf("a repo with no manifest came out %s: %s", res.Outcome, res.Evidence)
	}
	if !strings.Contains(res.Evidence, manifest.File) {
		t.Errorf("the evidence %q does not name %s", res.Evidence, manifest.File)
	}
}

func TestManifestRowIsRedWhenTheManifestIsUnparseable(t *testing.T) {
	cases := []struct {
		name string
		raw  string
	}{
		{"garbage", "not json at all\n"},
		{"empty", ""},
		{"an unknown profile", strings.Replace(oneGoSurface, `"profile": "cli"`, `"profile": "lambda"`, 1)},
		{"a capability on an undeclared surface", strings.Replace(oneGoSurface, `"surface": "cli"`, `"surface": "tui"`, 1)},
		{"a second object", oneGoSurface + oneGoSurface},
	}

	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			dir := newRepo(t)
			writeManifest(t, dir, c.raw)
			writeGoSuite(t, dir, "alpha")

			res := runManifestRow(t, dir)
			if res.Outcome != Red {
				t.Fatalf("%s came out %s: %s", c.name, res.Outcome, res.Evidence)
			}
		})
	}
}

// TestManifestRowIsRedWhenNothingProvesACapability is the fail-closed
// placeholder proof.md asks for: a capability with no runnable probe is red,
// never skipped.
func TestManifestRowIsRedWhenNothingProvesACapability(t *testing.T) {
	cases := []struct {
		name  string
		raw   string
		names string
	}{
		{"an empty proof list",
			strings.Replace(oneGoSurface, `"proof": ["alpha"]`, `"proof": []`, 1), "adding"},
		{"a proof nothing discovered",
			strings.Replace(oneGoSurface, `"proof": ["alpha"]`, `"proof": ["nowhere"]`, 1), "adding"},
	}

	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			dir := newRepo(t)
			writeManifest(t, dir, c.raw)
			writeGoSuite(t, dir, "alpha")

			res := runManifestRow(t, dir)
			if res.Outcome != Red {
				t.Fatalf("%s came out %s: %s", c.name, res.Outcome, res.Evidence)
			}
			if !strings.Contains(res.Evidence, c.names) {
				t.Errorf("the evidence %q does not name the unproven capability", res.Evidence)
			}
		})
	}
}

// TestManifestRowIsRedWhenTheSuiteHoldsNoTests is the fail-open the review
// caught. A capability pointed at a suite with nothing in it was proven by the
// suite merely existing. Now the tests are counted, and an empty one proves
// nothing.
func TestManifestRowIsRedWhenTheSuiteHoldsNoTests(t *testing.T) {
	cases := []struct {
		name string
		file string
	}{
		{"an empty test file", "package alpha\n"},
		{"a test file that does not parse", "package alpha\n\nthis is not go\n"},
		{"a file of harness and helpers only", "package alpha\n\nimport (\n\t\"os\"\n\t\"testing\"\n)\n\n" +
			"func TestMain(m *testing.M) { os.Exit(m.Run()) }\n\nfunc testHelper(t *testing.T) {}\n"},
	}

	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			dir := newRepo(t)
			writeManifest(t, dir, oneGoSurface)
			if err := os.MkdirAll(filepath.Join(dir, "alpha"), 0o750); err != nil {
				t.Fatalf("could not make the suite directory: %v", err)
			}
			writeFile(t, filepath.Join(dir, "alpha", "alpha_test.go"), c.file)

			res := runManifestRow(t, dir)
			if res.Outcome != Red {
				t.Fatalf("%s came out %s: %s", c.name, res.Outcome, res.Evidence)
			}
			if !strings.Contains(res.Evidence, "adding") {
				t.Errorf("the evidence %q does not name the unproven capability", res.Evidence)
			}
		})
	}
}

// TestManifestRowCountsATestABuildTagExcludes holds D30 where it lands on this
// row. A test behind a build tag reads as a test, so it proves the capability
// here. That it never runs is the never-run scan's catch, not this row's — and
// the two rows must not both claim the same failure.
func TestManifestRowCountsATestABuildTagExcludes(t *testing.T) {
	dir := newRepo(t)
	writeManifest(t, dir, oneGoSurface)
	if err := os.MkdirAll(filepath.Join(dir, "alpha"), 0o750); err != nil {
		t.Fatalf("could not make the suite directory: %v", err)
	}
	writeFile(t, filepath.Join(dir, "alpha", "alpha_test.go"),
		"//go:build never\n\npackage alpha\n\nimport \"testing\"\n\nfunc TestAddsUp(t *testing.T) {}\n")

	res := runManifestRow(t, dir)
	if res.Outcome != Green {
		t.Fatalf("the row came out %s: %s", res.Outcome, res.Evidence)
	}
}

// TestManifestRowIsRedOnADuplicateSuiteID proves the row never takes the last
// entry and moves on. Two suites under one id means one of them is invisible.
func TestManifestRowIsRedOnADuplicateSuiteID(t *testing.T) {
	needNode(t)

	script, err := filepath.Abs(filepath.Join("..", "adapter", "testdata", "scripts", "twicesuite.mjs"))
	if err != nil {
		t.Fatalf("could not resolve the script: %v", err)
	}

	dir := newRepo(t)
	writeManifest(t, dir, fmt.Sprintf(`{
  "schema": 1,
  "surfaces": [{"name": "web", "profile": "web", "stack": "node", "root": "."}],
  "capabilities": [{"name": "sign-in", "surface": "web", "proof": ["test/auth.test.mjs"]}],
  "adapters": {"node": {"command": ["node", %q]}}
}`, script))

	res := runManifestRow(t, dir)
	if res.Outcome != Red {
		t.Fatalf("a duplicate suite id came out %s: %s", res.Outcome, res.Evidence)
	}
	if !strings.Contains(res.Evidence, "twice") {
		t.Errorf("the evidence %q does not say the suite was reported twice", res.Evidence)
	}
}

// TestManifestRowIsRedOnAnUnmappedStack is D25's ruling: a stack the battery
// cannot read is a red row, never a skip.
func TestManifestRowIsRedOnAnUnmappedStack(t *testing.T) {
	dir := newRepo(t)
	writeManifest(t, dir, strings.Replace(oneGoSurface, `"stack": "go"`, `"stack": "rust"`, 1))
	writeGoSuite(t, dir, "alpha")

	res := runManifestRow(t, dir)
	if res.Outcome != Red {
		t.Fatalf("an unmapped stack came out %s: %s", res.Outcome, res.Evidence)
	}
	if !strings.Contains(res.Evidence, "rust") {
		t.Errorf("the evidence %q does not name the unmapped stack", res.Evidence)
	}
}

// TestManifestRowIsGreenThroughAnOutOfProcessAdapter runs the row's other
// shape end to end: a surface whose stack is not Go, proven by suites the
// declared command discovered.
func TestManifestRowIsGreenThroughAnOutOfProcessAdapter(t *testing.T) {
	needNode(t)

	script, err := filepath.Abs(filepath.Join("..", "adapter", "testdata", "adapters", "node.mjs"))
	if err != nil {
		t.Fatalf("could not resolve the node adapter: %v", err)
	}

	dir := newRepo(t)
	writeManifest(t, dir, fmt.Sprintf(`{
  "schema": 1,
  "surfaces": [{"name": "web", "profile": "web", "stack": "node", "root": "site"}],
  "capabilities": [{"name": "sign-in", "surface": "web", "proof": ["test/auth.test.mjs"]}],
  "adapters": {"node": {"command": ["node", %q]}}
}`, script))

	suite := filepath.Join(dir, "site", "test")
	if err := os.MkdirAll(suite, 0o750); err != nil {
		t.Fatalf("could not make %s: %v", suite, err)
	}
	writeFile(t, filepath.Join(suite, "auth.test.mjs"),
		"import test from 'node:test';\n\ntest('signs in', () => {});\n")

	res := runManifestRow(t, dir)
	if res.Outcome != Green {
		t.Fatalf("the row came out %s: %s", res.Outcome, res.Evidence)
	}
}

// TestManifestRowIsRedWhenTheAdapterCannotRun proves an out-of-process adapter
// that will not start is red rather than silently believed.
func TestManifestRowIsRedWhenTheAdapterCannotRun(t *testing.T) {
	dir := newRepo(t)
	writeManifest(t, dir, `{
  "schema": 1,
  "surfaces": [{"name": "web", "profile": "web", "stack": "node", "root": "."}],
  "capabilities": [{"name": "sign-in", "surface": "web", "proof": ["test/auth.test.mjs"]}],
  "adapters": {"node": {"command": ["groundwork-no-such-adapter"]}}
}`)

	res := runManifestRow(t, dir)
	if res.Outcome != Red {
		t.Fatalf("an adapter that cannot start came out %s: %s", res.Outcome, res.Evidence)
	}
}

// TestManifestRowIsGreenOnThisRepo runs the row against the repo it ships in.
// This repo must declare its own manifest, so the row it registers is a row it
// passes.
func TestManifestRowIsGreenOnThisRepo(t *testing.T) {
	res := runManifestRow(t, ".")
	if res.Outcome != Green {
		t.Fatalf("this repo's own manifest row came out %s: %s", res.Outcome, res.Evidence)
	}
}

// TestThisRepoDeclaresTheBumpTheNewRowNeeds holds D23 to this slice. Adding a
// row moves the declared version. The digest in the lock file must be the one
// the shipped rows compute. A lock file nobody bumped is exactly the drift the
// version row exists to catch, and CI would find it in this repo first.
func TestThisRepoDeclaresTheBumpTheNewRowNeeds(t *testing.T) {
	lock, err := ReadLock(".")
	if err != nil {
		t.Fatalf("this repo's lock file did not read: %v", err)
	}

	if lock.Digest != Default().Digest() {
		t.Errorf("%s declares the digest %s, and the shipped rows compute %s",
			LockFile, lock.Digest, Default().Digest())
	}
	// 0.1 is the version declared when the battery held the version row alone.
	// D23: a row added moves the major half, so the manifest row cannot ship
	// under it.
	if lock.Version == "0.1" {
		t.Errorf("%s still declares 0.1, and the battery has gained a row since", LockFile)
	}
}

// needNode makes sure node is there for the out-of-process rows.
//
// On a developer's machine a missing node is a skip. On CI it is a failure: a
// skipped check reads as a green one, and the out-of-process half of this row
// would go unproven every build without anyone seeing it.
func needNode(t *testing.T) {
	t.Helper()

	if _, err := exec.LookPath("node"); err == nil {
		return
	}

	if os.Getenv("CI") != "" {
		t.Fatal("node is not installed on CI, so the out-of-process adapter would go unproven")
	}
	t.Skip("node is not installed, so the out-of-process adapter cannot run")
}

// runManifestRow runs the registered manifest row against dir.
func runManifestRow(t *testing.T, dir string) Result {
	t.Helper()

	for _, row := range Default().Rows() {
		if row.ID == "manifest" {
			return row.Check(Context{RepoDir: dir})
		}
	}

	t.Fatal("the default battery holds no manifest row")

	return Result{}
}

func writeManifest(t *testing.T, dir, content string) {
	t.Helper()

	path := filepath.Join(dir, manifest.File)
	if err := os.MkdirAll(filepath.Dir(path), 0o750); err != nil {
		t.Fatalf("could not make %s: %v", filepath.Dir(path), err)
	}
	writeFile(t, path, content)
}

// writeGoSuite puts one Go package with one test in it under dir.
func writeGoSuite(t *testing.T, dir, pkg string) {
	t.Helper()

	if err := os.MkdirAll(filepath.Join(dir, pkg), 0o750); err != nil {
		t.Fatalf("could not make %s: %v", pkg, err)
	}
	writeFile(t, filepath.Join(dir, "go.mod"), "module groundwork.test/fixture\n\ngo 1.24\n")
	writeFile(t, filepath.Join(dir, pkg, pkg+".go"),
		"package "+pkg+"\n\nfunc AddsUp(a, b int) int { return a + b }\n")
	writeFile(t, filepath.Join(dir, pkg, pkg+"_test.go"),
		"package "+pkg+"\n\nimport \"testing\"\n\nfunc TestAddsUp(t *testing.T) {\n\tif AddsUp(1, 1) != 2 {\n\t\tt.Fatal(\"no\")\n\t}\n}\n")
}
