package manifest

import (
	"bytes"
	"encoding/json"
	"os"
	"os/exec"
	"path/filepath"
	"slices"
	"strings"
	"testing"
)

// good is a manifest that must parse. Every hostile case below is this file
// with one thing wrong, so a case that fails proves the one thing it changed.
const good = `{
  "schema": 1,
  "surfaces": [
    {"name": "cli", "profile": "cli", "stack": "go", "root": "."},
    {"name": "web", "profile": "web", "stack": "node", "root": "site"}
  ],
  "capabilities": [
    {"name": "verify", "surface": "cli", "proof": ["internal/battery"]},
    {"name": "sign-in", "surface": "web", "proof": ["test/auth.test.mjs"]}
  ],
  "adapters": {
    "node": {"command": ["node", "adapters/node.mjs"]}
  }
}`

func TestParseReadsTheWholeManifest(t *testing.T) {
	m, err := Parse([]byte(good))
	if err != nil {
		t.Fatalf("the good manifest did not parse: %v", err)
	}

	if m.Schema != Schema {
		t.Errorf("schema is %d, want %d", m.Schema, Schema)
	}
	if len(m.Surfaces) != 2 {
		t.Fatalf("read %d surfaces, want 2", len(m.Surfaces))
	}
	if m.Surfaces[0].Name != "cli" || m.Surfaces[0].Profile != "cli" ||
		m.Surfaces[0].Stack != "go" || m.Surfaces[0].Root != "." {
		t.Errorf("the first surface reads %+v", m.Surfaces[0])
	}
	if len(m.Capabilities) != 2 {
		t.Fatalf("read %d capabilities, want 2", len(m.Capabilities))
	}
	if got := m.Capabilities[0].Proof; len(got) != 1 || got[0] != "internal/battery" {
		t.Errorf("the first capability's proof reads %v", got)
	}
	cmd, ok := m.Adapters["node"]
	if !ok {
		t.Fatalf("the node adapter is missing from %v", m.Adapters)
	}
	if !slices.Equal(cmd.Command, []string{"node", "adapters/node.mjs"}) {
		t.Errorf("the node adapter's command reads %v", cmd.Command)
	}
}

func TestSurfaceFindsADeclaredSurface(t *testing.T) {
	m, err := Parse([]byte(good))
	if err != nil {
		t.Fatalf("the good manifest did not parse: %v", err)
	}

	s, ok := m.Surface("web")
	if !ok {
		t.Fatalf("the web surface was not found")
	}
	if s.Stack != "node" {
		t.Errorf("the web surface's stack reads %q, want node", s.Stack)
	}
	if _, ok := m.Surface("desktop"); ok {
		t.Errorf("a surface nobody declared was found")
	}
}

func TestProfilesAreTheSpecsSix(t *testing.T) {
	want := []string{"server", "web", "desktop", "cli", "mobile", "library"}
	if got := Profiles(); !slices.Equal(got, want) {
		t.Errorf("the profile list reads %v, want %v", got, want)
	}
}

// TestParseRefusesHostileShapes is the D18 table. The manifest is written by
// the project, not by this tool, so every shape a hand or a hostile branch can
// produce must fail loudly and name what is wrong.
func TestParseRefusesHostileShapes(t *testing.T) {
	huge := strings.Repeat("x", maxBytes+1)
	long := strings.Repeat("x", maxNameBytes+1)

	cases := []struct {
		name string
		raw  string
		says string
	}{
		{"empty", "", "empty"},
		{"whitespace only", "   \n\t ", "empty"},
		{"not json", "profile: cli\n", "valid JSON"},
		{"a list, not an object", `[{"schema":1}]`, "valid JSON"},
		{"a string, not an object", `"cli"`, "valid JSON"},
		{"a number, not an object", `7`, "valid JSON"},
		{"null", `null`, "valid JSON"},
		{"trailing garbage", good + " and then some", "more than one thing"},
		{"a second object", good + "\n" + good, "more than one thing"},
		{"an unknown top-level field", strings.Replace(good, `"schema": 1,`, `"schema": 1, "profile": "cli",`, 1), "profile"},
		{"a duplicate key", strings.Replace(good, `"schema": 1,`, `"schema": 1, "schema": 2,`, 1), "twice"},
		{"a duplicate key deeper in", strings.Replace(good,
			`{"name": "cli", "profile": "cli", "stack": "go", "root": "."}`,
			`{"name": "cli", "profile": "cli", "profile": "server", "stack": "go", "root": "."}`, 1), "twice"},
		{"no schema", strings.Replace(good, `"schema": 1,`, ``, 1), "schema"},
		{"a schema from the future", strings.Replace(good, `"schema": 1`, `"schema": 2`, 1), "schema"},
		{"a schema that is not a number", strings.Replace(good, `"schema": 1`, `"schema": "1"`, 1), "valid JSON"},
		{"no surfaces", strings.Replace(good, `"surfaces"`, `"surfaced"`, 1), "surfaced"},
		{"an empty surface list", replaceSurfaces(`[]`), "no surfaces"},
		{"a surface with no name", replaceSurfaces(`[{"profile":"cli","stack":"go","root":"."}]`), "name"},
		{"a surface named in capitals", replaceSurfaces(`[{"name":"CLI","profile":"cli","stack":"go","root":"."}]`), "name"},
		{"a surface with a runaway name", replaceSurfaces(`[{"name":"` + long + `","profile":"cli","stack":"go","root":"."}]`), "bytes"},
		{"two surfaces with one name", replaceSurfaces(
			`[{"name":"cli","profile":"cli","stack":"go","root":"."},{"name":"cli","profile":"web","stack":"node","root":"site"}]`), "twice"},
		{"an unknown profile", replaceSurfaces(`[{"name":"cli","profile":"lambda","stack":"go","root":"."}]`), "lambda"},
		{"an empty profile", replaceSurfaces(`[{"name":"cli","profile":"","stack":"go","root":"."}]`), "profile"},
		{"a profile in capitals", replaceSurfaces(`[{"name":"cli","profile":"CLI","stack":"go","root":"."}]`), "CLI"},
		{"a surface with no stack", replaceSurfaces(`[{"name":"cli","profile":"cli","root":"."}]`), "stack"},
		{"a surface with no root", replaceSurfaces(`[{"name":"cli","profile":"cli","stack":"go"}]`), "root"},
		{"a root that climbs out", replaceSurfaces(`[{"name":"cli","profile":"cli","stack":"go","root":"../elsewhere"}]`), "root"},
		{"an absolute root", replaceSurfaces(`[{"name":"cli","profile":"cli","stack":"go","root":"/etc"}]`), "root"},
		{"an unknown surface field", replaceSurfaces(`[{"name":"cli","profile":"cli","stack":"go","root":".","probe":"x"}]`), "probe"},
		{"no capabilities", strings.Replace(good, `"capabilities"`, `"capability"`, 1), "capability"},
		{"an empty capability list", replaceCapabilities(`[]`), "no capabilities"},
		{"a capability with no name", replaceCapabilities(`[{"surface":"cli","proof":["x"]}]`), "name"},
		{"two capabilities with one name", replaceCapabilities(
			`[{"name":"verify","surface":"cli","proof":["a"]},{"name":"verify","surface":"cli","proof":["b"]}]`), "twice"},
		{"a capability on no surface", replaceCapabilities(`[{"name":"verify","proof":["x"]}]`), "surface"},
		{"a capability on an undeclared surface", replaceCapabilities(`[{"name":"verify","surface":"tui","proof":["x"]}]`), "tui"},
		{"a capability with no proof key", replaceCapabilities(`[{"name":"verify","surface":"cli"}]`), "proof"},
		{"a proof entry that is empty", replaceCapabilities(`[{"name":"verify","surface":"cli","proof":[""]}]`), "proof"},
		{"a proof entry that climbs out", replaceCapabilities(`[{"name":"verify","surface":"cli","proof":["../../etc"]}]`), "proof"},
		{"a proof entry that is absolute", replaceCapabilities(`[{"name":"verify","surface":"cli","proof":["/etc/passwd"]}]`), "proof"},
		{"a proof entry that is not a string", replaceCapabilities(`[{"name":"verify","surface":"cli","proof":[7]}]`), "valid JSON"},
		{"an adapter with no command", strings.Replace(good, `{"command": ["node", "adapters/node.mjs"]}`, `{"command": []}`, 1), "command"},
		{"an adapter whose command is not a list", strings.Replace(good, `["node", "adapters/node.mjs"]`, `"node adapters/node.mjs"`, 1), "valid JSON"},
		{"an adapter named go", strings.Replace(good, `"node": {"command"`, `"go": {"command"`, 1), "go"},
		{"an adapter with an empty name", strings.Replace(good, `"node": {"command"`, `"": {"command"`, 1), "name"},
		{"a manifest bigger than the cap", `{"schema":1,"note":"` + huge + `"}`, "bytes"},
	}

	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			_, err := Parse([]byte(c.raw))
			if err == nil {
				t.Fatalf("Parse accepted %s", c.name)
			}
			if !strings.Contains(err.Error(), c.says) {
				t.Errorf("Parse refused %s with %q, which does not say %q", c.name, err, c.says)
			}
		})
	}
}

// TestParseAcceptsACapabilityWithNoProof holds the fail-closed placeholder
// open. proof.md says a capability with no runnable probe gets a fail-closed
// placeholder, never a skip — so an empty list is a declaration the file may
// make, and the battery row is what turns it red.
func TestParseAcceptsACapabilityWithNoProof(t *testing.T) {
	m, err := Parse([]byte(replaceCapabilities(`[{"name":"verify","surface":"cli","proof":[]}]`)))
	if err != nil {
		t.Fatalf("a capability with an empty proof list did not parse: %v", err)
	}
	if len(m.Capabilities) != 1 || len(m.Capabilities[0].Proof) != 0 {
		t.Fatalf("the capability reads %+v", m.Capabilities)
	}
}

// TestParseAcceptsAnUnmappedStack holds D25's other fail-closed path open: an
// unmapped stack is a red row, not a parse error, so the file must load.
func TestParseAcceptsAnUnmappedStack(t *testing.T) {
	raw := strings.Replace(good, `"node": {"command": ["node", "adapters/node.mjs"]}`, ``, 1)

	m, err := Parse([]byte(raw))
	if err != nil {
		t.Fatalf("a manifest with no adapter for its node surface did not parse: %v", err)
	}
	if len(m.Adapters) != 0 {
		t.Fatalf("the adapters read %v, want none", m.Adapters)
	}
}

func TestParseAcceptsAMissingAdaptersKey(t *testing.T) {
	raw := strings.Replace(good, `,
  "adapters": {
    "node": {"command": ["node", "adapters/node.mjs"]}
  }`, ``, 1)

	if _, err := Parse([]byte(raw)); err != nil {
		t.Fatalf("a manifest with no adapters key did not parse: %v", err)
	}
}

func TestLoadReadsTheManifestFromTheRepoRoot(t *testing.T) {
	dir := newRepo(t)
	writeManifest(t, dir, good)

	deep := filepath.Join(dir, "internal", "battery")
	if err := os.MkdirAll(deep, 0o750); err != nil {
		t.Fatalf("could not make %s: %v", deep, err)
	}

	m, err := Load(deep)
	if err != nil {
		t.Fatalf("Load from a subdirectory failed: %v", err)
	}
	if len(m.Surfaces) != 2 {
		t.Errorf("read %d surfaces, want 2", len(m.Surfaces))
	}
}

func TestLoadSaysSoWhenTheManifestIsMissing(t *testing.T) {
	dir := newRepo(t)

	_, err := Load(dir)
	if err == nil {
		t.Fatal("Load passed on a repo with no manifest")
	}
	if !strings.Contains(err.Error(), File) {
		t.Errorf("the error %q does not name %s", err, File)
	}
}

func TestLoadRefusesAManifestThatIsADirectory(t *testing.T) {
	dir := newRepo(t)
	if err := os.MkdirAll(filepath.Join(dir, File), 0o750); err != nil {
		t.Fatalf("could not make the directory: %v", err)
	}

	if _, err := Load(dir); err == nil {
		t.Fatal("Load passed on a manifest that is a directory")
	}
}

func TestLoadOutsideARepositorySaysSo(t *testing.T) {
	if _, err := Load(t.TempDir()); err == nil {
		t.Fatal("Load passed outside a git repository")
	}
}

// TestThisRepoManifestIsSound reads the manifest this repo commits. It is the
// one case in this file that reads a real file, and it is here because a
// manifest that stopped parsing would otherwise only show up as a red row.
func TestThisRepoManifestIsSound(t *testing.T) {
	m, err := Load(".")
	if err != nil {
		t.Fatalf("this repo's own manifest did not load: %v", err)
	}
	if len(m.Surfaces) == 0 || len(m.Capabilities) == 0 {
		t.Fatalf("this repo's manifest declares %d surfaces and %d capabilities",
			len(m.Surfaces), len(m.Capabilities))
	}
}

// TestTheManifestIsCommitted proves the file is not ignored. A manifest git
// does not track is a manifest one clone has and the next does not.
func TestTheManifestIsCommitted(t *testing.T) {
	root, err := exec.Command("git", "rev-parse", "--show-toplevel").Output()
	if err != nil {
		t.Fatalf("could not find the repo root: %v", err)
	}
	top := strings.TrimSpace(string(root))

	out, err := exec.Command("git", "-C", top, "check-ignore", "-q", File).CombinedOutput()
	if err == nil {
		t.Fatalf("git ignores %s, so it can never be committed", File)
	}
	if len(bytes.TrimSpace(out)) != 0 {
		t.Fatalf("git check-ignore said: %s", out)
	}

	// Not ignored is not the same as tracked. A manifest git does not hold is a
	// manifest one clone has and the next does not, and the row that reads it
	// would go red on a fresh checkout.
	if out, err := exec.Command("git", "-C", top, "ls-files", "--error-unmatch", File).
		CombinedOutput(); err != nil {
		t.Fatalf("git does not track %s: %s", File, out)
	}
}

func replaceSurfaces(with string) string {
	var m map[string]any
	if err := json.Unmarshal([]byte(good), &m); err != nil {
		panic(err)
	}
	var surfaces any
	if err := json.Unmarshal([]byte(with), &surfaces); err != nil {
		panic(err)
	}
	m["surfaces"] = surfaces
	// The capabilities point at surfaces that may no longer exist, so they are
	// cut down to nothing that references one.
	m["capabilities"] = []any{map[string]any{"name": "verify", "surface": "cli", "proof": []any{"x"}}}

	raw, err := json.Marshal(m)
	if err != nil {
		panic(err)
	}

	return string(raw)
}

func replaceCapabilities(with string) string {
	var m map[string]any
	if err := json.Unmarshal([]byte(good), &m); err != nil {
		panic(err)
	}
	var caps any
	if err := json.Unmarshal([]byte(with), &caps); err != nil {
		panic(err)
	}
	m["capabilities"] = caps

	raw, err := json.Marshal(m)
	if err != nil {
		panic(err)
	}

	return string(raw)
}

func newRepo(t *testing.T) string {
	t.Helper()

	dir := t.TempDir()
	for _, args := range [][]string{
		{"init", "-b", "main"},
		{"config", "user.name", "Test Person"},
		{"config", "user.email", "test@example.com"},
	} {
		cmd := exec.Command("git", append([]string{"-C", dir}, args...)...)
		if out, err := cmd.CombinedOutput(); err != nil {
			t.Fatalf("git %s failed: %v: %s", strings.Join(args, " "), err, out)
		}
	}

	return dir
}

func writeManifest(t *testing.T, dir, content string) {
	t.Helper()

	path := filepath.Join(dir, File)
	if err := os.MkdirAll(filepath.Dir(path), 0o750); err != nil {
		t.Fatalf("could not make %s: %v", filepath.Dir(path), err)
	}
	if err := os.WriteFile(path, []byte(content), 0o600); err != nil {
		t.Fatalf("could not write %s: %v", path, err)
	}
}
