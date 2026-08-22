package battery

import (
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"testing"
)

// The wiring scan looks for controls built but never wired: an exported
// function in a non-main package that no non-test file in the module calls.
//
// Every case below is a fixture repo with one Go surface, because that is the
// only stack this slice reads.

// wiringUser is a file that calls what another package exports, standing in
// for the code that wires a control up. Its own function is unexported so the
// fixture holds exactly one candidate.
const wiringUser = `package beta

import "groundwork.test/fixture/alpha"

func use() int {
	return alpha.AddsUp(1, 1)
}
`

func TestWiringRowIsInTheDefaultBattery(t *testing.T) {
	registered(t, "wiring", "wiring")
}

// TestWiringRowIsRedOnAnUnwiredExportedFunction holds the two shapes the
// design names: a handler that only holds a TODO, and a function no caller
// reaches.
func TestWiringRowIsRedOnAnUnwiredExportedFunction(t *testing.T) {
	cases := []struct {
		name string
		file string
		fn   string
	}{
		{
			"a TODO-only handler",
			"package alpha\n\n// HandleExport is the export button's handler.\nfunc HandleExport() error {\n\t// TODO: write the file\n\treturn nil\n}\n",
			"HandleExport",
		},
		{
			"a function no caller reaches",
			"package alpha\n\nfunc Unreachable(a, b int) int {\n\treturn a + b\n}\n",
			"Unreachable",
		},
	}

	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			dir := newRepo(t)
			writeManifest(t, dir, goCLISurface)
			writeSource(t, dir, "alpha/alpha.go", c.file)

			res := runRow(t, dir, "wiring")
			if res.Outcome != Red {
				t.Fatalf("%s came out %s: %s", c.name, res.Outcome, res.Evidence)
			}
			mustContain(t, res.Evidence, "alpha/alpha.go:", c.fn)
		})
	}
}

// TestWiringRowSweepsCallersFromTheWholeModule is the reviewer's repro. The
// caller lives outside every declared surface — a generator under tools/ —
// and it is real wiring all the same. Judgment stays inside the surface; the
// sweep for callers does not.
func TestWiringRowSweepsCallersFromTheWholeModule(t *testing.T) {
	dir := newRepo(t)
	writeManifest(t, dir, strings.Replace(goCLISurface, `"root": "."`, `"root": "app"`, 1))
	writeSource(t, dir, "app/alpha.go", "package alpha\n\nfunc AddsUp(a, b int) int { return a + b }\n")
	writeSource(t, dir, "tools/gen/main.go",
		"package main\n\nimport \"groundwork.test/fixture/app\"\n\nfunc main() {\n\t_ = alpha.AddsUp(1, 1)\n}\n")

	res := runRow(t, dir, "wiring")
	if res.Outcome != Green {
		t.Fatalf("a caller outside the surface came out %s: %s", res.Outcome, res.Evidence)
	}
}

// A function only a compiler directive names is wired. //go:linkname writes
// the caller in a comment, where the parser sees no identifier at all.
func TestWiringRowCountsALinknameCaller(t *testing.T) {
	dir := newRepo(t)
	writeManifest(t, dir, goCLISurface)
	writeSource(t, dir, "alpha/alpha.go", "package alpha\n\nfunc AddsUp(a, b int) int { return a + b }\n")
	writeSource(t, dir, "beta/beta.go",
		"package beta\n\nimport _ \"unsafe\"\n\n//go:linkname adds groundwork.test/fixture/alpha.AddsUp\nfunc adds(a, b int) int\n")

	res := runRow(t, dir, "wiring")
	if res.Outcome != Green {
		t.Fatalf("the row came out %s: %s", res.Outcome, res.Evidence)
	}
}

// A function a non-test file calls is wired, and the row says so.
func TestWiringRowIsGreenWhenANonTestFileCalls(t *testing.T) {
	dir := newRepo(t)
	writeManifest(t, dir, goCLISurface)
	writeSource(t, dir, "alpha/alpha.go", "package alpha\n\nfunc AddsUp(a, b int) int { return a + b }\n")
	writeSource(t, dir, "beta/beta.go", wiringUser)

	res := runRow(t, dir, "wiring")
	if res.Outcome != Green {
		t.Fatalf("the row came out %s: %s", res.Outcome, res.Evidence)
	}
}

// A function only the tests call is not wired. This is the shape the row
// exists for: a control with a unit test and no consumer looks proven and is
// not delivered.
func TestWiringRowIsRedWhenOnlyATestCalls(t *testing.T) {
	dir := newRepo(t)
	writeManifest(t, dir, goCLISurface)
	writeSource(t, dir, "alpha/alpha.go", "package alpha\n\nfunc AddsUp(a, b int) int { return a + b }\n")
	writeSource(t, dir, "alpha/alpha_test.go",
		"package alpha\n\nimport \"testing\"\n\nfunc TestAddsUp(t *testing.T) {\n\tif AddsUp(1, 1) != 2 {\n\t\tt.Fatal(\"no\")\n\t}\n}\n")

	res := runRow(t, dir, "wiring")
	if res.Outcome != Red {
		t.Fatalf("the row came out %s: %s", res.Outcome, res.Evidence)
	}
	mustContain(t, res.Evidence, "AddsUp")
}

// Package main is the linker's business, so its exported functions are never
// candidates.
func TestWiringRowSkipsPackageMain(t *testing.T) {
	dir := newRepo(t)
	writeManifest(t, dir, goCLISurface)
	writeSource(t, dir, "cmd/tool/main.go",
		"package main\n\nfunc main() {}\n\nfunc Unused() int { return 1 }\n")

	res := runRow(t, dir, "wiring")
	if res.Outcome != Green {
		t.Fatalf("the row came out %s: %s", res.Outcome, res.Evidence)
	}
}

// Unexported functions and methods are out of the candidate set. A method can
// be reached through an interface this scan cannot see, so judging one would
// be a guess, and a guess here is a false red.
func TestWiringRowSkipsUnexportedFunctionsAndMethods(t *testing.T) {
	dir := newRepo(t)
	writeManifest(t, dir, goCLISurface)
	writeSource(t, dir, "alpha/alpha.go",
		"package alpha\n\ntype Thing struct{}\n\nfunc (Thing) Method() int { return 1 }\n\nfunc helper() int { return 2 }\n")

	res := runRow(t, dir, "wiring")
	if res.Outcome != Green {
		t.Fatalf("the row came out %s: %s", res.Outcome, res.Evidence)
	}
}

// A generated file holds nobody's hand-written control, so its exports are
// not candidates. Its references still count: generated code wires real code
// up all the time.
func TestWiringRowSkipsGeneratedExportsAndKeepsTheirReferences(t *testing.T) {
	dir := newRepo(t)
	writeManifest(t, dir, goCLISurface)
	writeSource(t, dir, "alpha/alpha.go", "package alpha\n\nfunc AddsUp(a, b int) int { return a + b }\n")
	writeSource(t, dir, "beta/gen.go",
		"// Code generated by a generator. DO NOT EDIT.\n\npackage beta\n\nimport \"groundwork.test/fixture/alpha\"\n\n"+
			"func Generated() int { return alpha.AddsUp(1, 1) }\n")

	res := runRow(t, dir, "wiring")
	if res.Outcome != Green {
		t.Fatalf("the row came out %s: %s", res.Outcome, res.Evidence)
	}
}

// One red row, whatever the count, with as many hits as fit named whole.
func TestWiringRowReportsManyHitsAsOneRowWithACappedList(t *testing.T) {
	dir := newRepo(t)
	writeManifest(t, dir, goCLISurface)

	var file strings.Builder
	file.WriteString("package alpha\n")
	for i := range 5 {
		file.WriteString("\nfunc Dead" + strconv.Itoa(i) + "() int { return " + strconv.Itoa(i) + " }\n")
	}
	writeSource(t, dir, "alpha/alpha.go", file.String())

	res := runRow(t, dir, "wiring")
	if res.Outcome != Red {
		t.Fatalf("the row came out %s: %s", res.Outcome, res.Evidence)
	}
	mustFit(t, res.Evidence, "5", "Dead0", "more")
	if strings.Contains(res.Evidence, "Dead4") {
		t.Errorf("the evidence lists every hit rather than the first few: %s", res.Evidence)
	}
}

// A source file the scan cannot parse is a tree it cannot walk, so it reports
// unrunnable with the file named. Calling a function dead on a half-read tree
// would be a false red, and a false red here poisons trust in the row.
//
// A file outside the surface counts the same way: it is part of the sweep for
// callers, so a hit found elsewhere would rest on a sweep with a hole in it.
func TestWiringRowIsUnrunnableOnAFileThatDoesNotParse(t *testing.T) {
	cases := []struct {
		name string
		path string
	}{
		{"inside the surface", "app/alpha.go"},
		{"outside every surface", "tools/gen/gen.go"},
	}

	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			dir := newRepo(t)
			writeManifest(t, dir, strings.Replace(goCLISurface, `"root": "."`, `"root": "app"`, 1))
			writeSource(t, dir, "app/alpha.go", "package alpha\n\nfunc AddsUp(a, b int) int { return a + b }\n")
			writeSource(t, dir, c.path, "package alpha\n\nthis is not go\n")

			res := runRow(t, dir, "wiring")
			if res.Outcome != Unrunnable {
				t.Fatalf("the row came out %s: %s", res.Outcome, res.Evidence)
			}
			mustFit(t, res.Evidence, c.path, "does not parse")
		})
	}
}

// A repo holding no Go source at all is not a repo whose wiring is sound.
// D17: a verifier may never pass on nothing.
func TestWiringRowIsUnrunnableWhenItReadNoSource(t *testing.T) {
	dir := newRepo(t)
	writeManifest(t, dir, goCLISurface)

	res := runRow(t, dir, "wiring")
	if res.Outcome != Unrunnable {
		t.Fatalf("the row came out %s: %s", res.Outcome, res.Evidence)
	}
	mustContain(t, res.Evidence, "no Go source")
}

// Bytes that are not UTF-8 are a file the parser refuses, and the row says so
// rather than reading the rest of the tree and calling something dead.
func TestWiringRowIsUnrunnableOnAFileOfBadBytes(t *testing.T) {
	dir := newRepo(t)
	writeManifest(t, dir, goCLISurface)
	writeBytes(t, dir, "alpha/alpha.go", []byte("package alpha\n\nfunc AddsUp() string { return \"\xff\xfe\" }\n"))

	res := runRow(t, dir, "wiring")
	if res.Outcome != Unrunnable {
		t.Fatalf("the row came out %s: %s", res.Outcome, res.Evidence)
	}
	mustContain(t, res.Evidence, "alpha/alpha.go")
}

// A file that is all one line is read like any other, and its hits carry the
// line it is on.
func TestWiringRowReadsAMinifiedFile(t *testing.T) {
	dir := newRepo(t)
	writeManifest(t, dir, goCLISurface)
	writeSource(t, dir, "alpha/alpha.go", "package alpha; func Dead() int { return 1 }\n")

	res := runRow(t, dir, "wiring")
	if res.Outcome != Red {
		t.Fatalf("the row came out %s: %s", res.Outcome, res.Evidence)
	}
	mustContain(t, res.Evidence, "alpha/alpha.go:1", "Dead")
}

// A symlink is never followed out of the surface. The linked file's caller
// lives outside the project, so following it would prove wiring the project
// does not ship.
func TestWiringRowDoesNotFollowASymlink(t *testing.T) {
	outside := t.TempDir()
	target := filepath.Join(outside, "outside.go")
	writeFile(t, target, "package alpha\n\nfunc Outside() int { return 1 }\n")

	dir := newRepo(t)
	writeManifest(t, dir, goCLISurface)
	writeSource(t, dir, "alpha/alpha.go", "package alpha\n\nfunc AddsUp(a, b int) int { return a + b }\n")
	writeSource(t, dir, "beta/beta.go", wiringUser)

	link := filepath.Join(dir, "alpha", "linked.go")
	if err := os.Symlink(target, link); err != nil {
		t.Skipf("this machine cannot make symlinks: %v", err)
	}

	res := runRow(t, dir, "wiring")
	if res.Outcome != Green {
		t.Fatalf("the row came out %s: %s", res.Outcome, res.Evidence)
	}
	mustContain(t, res.Evidence, "symlink")
}

func TestWiringRowIsUnrunnableOnANonGoSurface(t *testing.T) {
	dir := newRepo(t)
	writeManifest(t, dir, webSurface)

	res := runRow(t, dir, "wiring")
	if res.Outcome != Unrunnable {
		t.Fatalf("the row came out %s: %s", res.Outcome, res.Evidence)
	}
	mustContain(t, res.Evidence, "node", "web")
}

func TestWiringRowIsUnrunnableWithNoManifest(t *testing.T) {
	dir := newRepo(t)

	res := runRow(t, dir, "wiring")
	if res.Outcome != Unrunnable {
		t.Fatalf("the row came out %s: %s", res.Outcome, res.Evidence)
	}
	mustContain(t, res.Evidence, ".groundwork/manifest.json")
}

// A repo with nothing to judge says so. Green with no exported function
// behind it is a pass on nothing, and the evidence has to admit that.
func TestWiringRowSaysWhenThereIsNothingToJudge(t *testing.T) {
	dir := newRepo(t)
	writeManifest(t, dir, goCLISurface)
	writeSource(t, dir, "alpha/alpha.go", "package alpha\n\nfunc helper() int { return 1 }\n")

	res := runRow(t, dir, "wiring")
	if res.Outcome != Green {
		t.Fatalf("the row came out %s: %s", res.Outcome, res.Evidence)
	}
	mustContain(t, res.Evidence, "no exported function")
}

// TestWiringRowIsGreenOnThisRepo runs the row against the repo it ships in.
func TestWiringRowIsGreenOnThisRepo(t *testing.T) {
	res := runRow(t, ".", "wiring")
	if res.Outcome != Green {
		t.Fatalf("this repo's own wiring row came out %s: %s", res.Outcome, res.Evidence)
	}
}
