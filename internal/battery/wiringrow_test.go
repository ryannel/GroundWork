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

// D41.2 put a price on this slice: tuning a row after a graded run burns both
// holdouts and moves the battery's major version. No row's identity changed, so
// the digest did not move and the version row is content either way — nothing
// else in the tree would notice the lock file going back to 4.0. This is what
// notices.
func TestThisRepoDeclaresTheBumpTheHoldoutCost(t *testing.T) {
	lock, err := ReadLock(".")
	if err != nil {
		t.Fatalf("this repo's lock file did not read: %v", err)
	}

	half, _, _ := strings.Cut(lock.Version, ".")
	major, err := strconv.Atoi(half)
	if err != nil {
		t.Fatalf("%s declares the version %q, whose major half is not a number", LockFile, lock.Version)
	}
	// 4.0 is the version the held-out set was graded at. The wiring row was
	// tuned after that grading, so the major moves and the grading stands as
	// the record of a burned holdout.
	if major < 5 {
		t.Errorf("%s declares %s, and D41.2 puts this battery at 5.0 or past it",
			LockFile, lock.Version)
	}
}

// The library profile. F27: on the held-out go-fieldkit this row called the
// public API of three honest packages dead code, because a library's callers
// live in other people's repos. D41 rules that the row reads the profile, the
// way the token row already does, and keeps its teeth only where they are
// honest.

// libraryTest is a test file naming one exported function and nothing else.
func libraryTest(fn string) string {
	return "package alpha\n\nimport \"testing\"\n\nfunc TestIt(t *testing.T) {\n\tif " +
		fn + "(1, 1) != 2 {\n\t\tt.Fatal(\"no\")\n\t}\n}\n"
}

// TestWiringRowOnALibraryJudgesOnlyWhatIsHonest holds the three cases D41
// names. An export the tests name is the product. An unexported function no
// shipped file reaches is dead. An export nothing at all names is dead too.
func TestWiringRowOnALibraryJudgesOnlyWhatIsHonest(t *testing.T) {
	cases := []struct {
		name    string
		source  string
		outcome Outcome
		words   []string
	}{
		{
			name:    "an exported function only the tests name is the product",
			source:  "package alpha\n\nfunc AddsUp(a, b int) int { return a + b }\n",
			outcome: Green,
			// The weaker sentence is the only honest one here. No non-test file
			// names AddsUp, and a green claiming one did would be a lie about
			// the very case this row was changed for.
			words: []string{libraryDeclared, "every one is named"},
		},
		{
			name: "an unexported function no non-test file reaches is dead",
			source: "package alpha\n\nfunc AddsUp(a, b int) int { return a + b }\n\n" +
				"func stranded() int { return 1 }\n",
			outcome: Red,
			words:   []string{"alpha/alpha.go:", "stranded", "unexported"},
		},
		{
			name: "an exported function nothing at all names is dead",
			source: "package alpha\n\nfunc AddsUp(a, b int) int { return a + b }\n\n" +
				"func Orphan() int { return 1 }\n",
			outcome: Red,
			words:   []string{"alpha/alpha.go:", "Orphan", "nothing in the module names it"},
		},
	}

	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			dir := newRepo(t)
			writeManifest(t, dir, goLibrarySurface)
			writeSource(t, dir, "alpha/alpha.go", c.source)
			writeSource(t, dir, "alpha/alpha_test.go", libraryTest("AddsUp"))

			res := runRow(t, dir, "wiring")
			if res.Outcome != c.outcome {
				t.Fatalf("the row came out %s, want %s: %s", res.Outcome, c.outcome, res.Evidence)
			}
			mustFit(t, res.Evidence, c.words...)
			if c.outcome == Green && strings.Contains(res.Evidence, "a non-test file names every one") {
				t.Errorf("the green claims a caller no file in this repo is: %s", res.Evidence)
			}
			if c.outcome == Red && strings.Contains(res.Evidence, "AddsUp") {
				t.Errorf("the row named a library's tested public API: %s", res.Evidence)
			}
		})
	}
}

// TestWiringRowLeavesAnHonestLibrarysPublicAPIAlone is F27's own shape: several
// packages, each exporting a function its own tests name and nothing else. That
// is what go-fieldkit is, and the row flagged 8 of its 11 exported functions.
func TestWiringRowLeavesAnHonestLibrarysPublicAPIAlone(t *testing.T) {
	dir := newRepo(t)
	writeManifest(t, dir, goLibrarySurface)

	for _, pkg := range []string{"slug", "wrap", "csvline"} {
		writeSource(t, dir, pkg+"/"+pkg+".go",
			"package "+pkg+"\n\nfunc Make(a, b int) int { return a + b }\n")
		writeSource(t, dir, pkg+"/"+pkg+"_test.go",
			"package "+pkg+"\n\nimport \"testing\"\n\nfunc TestMake(t *testing.T) {\n\tif Make(1, 1) != 2 {\n\t\tt.Fatal(\"no\")\n\t}\n}\n")
	}

	res := runRow(t, dir, "wiring")
	if res.Outcome != Green {
		t.Fatalf("a library's tested public API came out %s: %s", res.Outcome, res.Evidence)
	}
}

// Every profile but library keeps today's rule. An export only the tests call
// is not delivered on a cli, a server, or anything else whose callers ship in
// the same repo.
func TestWiringRowKeepsItsRuleOnEveryOtherProfile(t *testing.T) {
	for _, profile := range []string{"cli", "server", "web", "desktop", "mobile"} {
		t.Run(profile, func(t *testing.T) {
			dir := newRepo(t)
			writeManifest(t, dir, strings.Replace(goCLISurface, `"profile": "cli"`, `"profile": "`+profile+`"`, 1))
			writeSource(t, dir, "alpha/alpha.go", "package alpha\n\nfunc AddsUp(a, b int) int { return a + b }\n")
			writeSource(t, dir, "alpha/alpha_test.go", libraryTest("AddsUp"))

			res := runRow(t, dir, "wiring")
			if res.Outcome != Red {
				t.Fatalf("profile %s came out %s: %s", profile, res.Outcome, res.Evidence)
			}
			mustFit(t, res.Evidence, "AddsUp", "no file outside the tests names it")
			if strings.Contains(res.Evidence, "library") {
				t.Errorf("profile %s was judged as a library: %s", profile, res.Evidence)
			}
		})
	}
}

// This repo is a cli surface, so the row must say about it exactly what it said
// before it learned profiles. A profile read the wrong way round would show up
// here first.
func TestWiringRowSpeaksToThisRepoAsItAlwaysDid(t *testing.T) {
	res := runRow(t, ".", "wiring")

	mustFit(t, res.Evidence, "exported functions in", "and a non-test file names every one")
	if strings.Contains(res.Evidence, "library") {
		t.Errorf("this repo declares a cli surface and the row spoke about a library: %s", res.Evidence)
	}
}

// A library's test files decide whether an export is dead, so a test file the
// scan cannot read leaves the row unrunnable. Without this the row would call
// an export dead because the only file naming it went unread.
func TestWiringRowIsUnrunnableOnALibraryTestFileThatDoesNotParse(t *testing.T) {
	dir := newRepo(t)
	writeManifest(t, dir, goLibrarySurface)
	writeSource(t, dir, "alpha/alpha.go", "package alpha\n\nfunc AddsUp(a, b int) int { return a + b }\n")
	writeSource(t, dir, "alpha/alpha_test.go", "package alpha\n\nthis is not go\n")

	res := runRow(t, dir, "wiring")
	if res.Outcome != Unrunnable {
		t.Fatalf("the row came out %s: %s", res.Outcome, res.Evidence)
	}
	mustFit(t, res.Evidence, "alpha/alpha_test.go", "does not parse")
}

// D42.2's rule is about the sweep being complete, not about the parser. A test
// file the scan declines to read for any other reason leaves the same hole, and
// on a library that hole decides the verdict: the export whose only namer went
// unread reads as dead. The reviewer proved green flipping to red on both
// shapes below.
func TestWiringRowIsUnrunnableOnALibraryTestFileItDeclinesToRead(t *testing.T) {
	cases := []struct {
		name  string
		make  func(t *testing.T, path string)
		words []string
	}{
		{
			name: "a symlinked test file",
			make: func(t *testing.T, path string) {
				outside := filepath.Join(t.TempDir(), "outside_test.go")
				writeFile(t, outside, libraryTest("AddsUp"))
				if err := os.Symlink(outside, path); err != nil {
					t.Skipf("this machine cannot make symlinks: %v", err)
				}
			},
			words: []string{"symlink"},
		},
		{
			name: "a test file that is not a regular file",
			make: func(t *testing.T, path string) {
				makeFIFO(t, path)
			},
			words: []string{"regular file"},
		},
	}

	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			dir := newRepo(t)
			writeManifest(t, dir, goLibrarySurface)
			writeSource(t, dir, "alpha/alpha.go", "package alpha\n\nfunc AddsUp(a, b int) int { return a + b }\n")
			c.make(t, filepath.Join(dir, "alpha", "alpha_test.go"))

			res := runRow(t, dir, "wiring")
			if res.Outcome != Unrunnable {
				t.Fatalf("the row came out %s: %s", res.Outcome, res.Evidence)
			}
			mustFit(t, res.Evidence, append(c.words, "alpha/alpha_test.go")...)
		})
	}
}

// Every other profile keeps the counted-note behaviour. A test file is not read
// on a cli surface at all, so one the scan would decline changes nothing.
func TestWiringRowIgnoresAnUnreadableTestFileOffTheLibraryProfile(t *testing.T) {
	dir := newRepo(t)
	writeManifest(t, dir, goCLISurface)
	writeSource(t, dir, "alpha/alpha.go", "package alpha\n\nfunc AddsUp(a, b int) int { return a + b }\n")
	writeSource(t, dir, "beta/beta.go", wiringUser)
	makeFIFO(t, filepath.Join(dir, "alpha", "alpha_test.go"))

	res := runRow(t, dir, "wiring")
	if res.Outcome != Green {
		t.Fatalf("the row came out %s: %s", res.Outcome, res.Evidence)
	}
}

// scan.go's contract: nothing is skipped in silence. A file the scan turns away
// because it is not a regular file left no trace at all, on any profile.
func TestWiringRowCountsAFileItTurnedAwayForNotBeingRegular(t *testing.T) {
	dir := newRepo(t)
	writeManifest(t, dir, goCLISurface)
	writeSource(t, dir, "alpha/alpha.go", "package alpha\n\nfunc AddsUp(a, b int) int { return a + b }\n")
	writeSource(t, dir, "beta/beta.go", wiringUser)
	makeFIFO(t, filepath.Join(dir, "alpha", "pipe.go"))

	res := runRow(t, dir, "wiring")
	if res.Outcome != Green {
		t.Fatalf("the row came out %s: %s", res.Outcome, res.Evidence)
	}
	mustFit(t, res.Evidence, "not read")
}

// D17: a library holding only test files has had nothing judged, and green
// would say it had.
func TestWiringRowIsUnrunnableOnALibraryOfOnlyTestFiles(t *testing.T) {
	dir := newRepo(t)
	writeManifest(t, dir, goLibrarySurface)
	writeSource(t, dir, "alpha/alpha_test.go",
		"package alpha\n\nimport \"testing\"\n\nfunc TestNothing(t *testing.T) {}\n")

	res := runRow(t, dir, "wiring")
	if res.Outcome != Unrunnable {
		t.Fatalf("the row came out %s: %s", res.Outcome, res.Evidence)
	}
	mustContain(t, res.Evidence, "no Go source")
}

// init is called by the runtime, so no file has to name it. It is never a
// candidate, on a library or anywhere else.
func TestWiringRowNeverJudgesInit(t *testing.T) {
	dir := newRepo(t)
	writeManifest(t, dir, goLibrarySurface)
	writeSource(t, dir, "alpha/alpha.go",
		"package alpha\n\nvar ready bool\n\nfunc init() { ready = true }\n\n"+
			"func AddsUp(a, b int) int { return a + b }\n")
	writeSource(t, dir, "alpha/alpha_test.go", libraryTest("AddsUp"))

	res := runRow(t, dir, "wiring")
	if res.Outcome != Green {
		t.Fatalf("the row came out %s: %s", res.Outcome, res.Evidence)
	}
}

// A dot import writes the caller with no package name in front of it. The
// identifier is still there, so the sweep sees it.
func TestWiringRowSeesADotImportedCaller(t *testing.T) {
	dir := newRepo(t)
	writeManifest(t, dir, strings.Replace(goLibrarySurface, `"root": "."`, `"root": "alpha"`, 1))
	writeSource(t, dir, "alpha/alpha.go", "package alpha\n\nfunc AddsUp(a, b int) int { return a + b }\n")
	writeSource(t, dir, "beta/beta.go",
		"package beta\n\nimport . \"groundwork.test/fixture/alpha\"\n\nfunc use() int { return AddsUp(1, 1) }\n")

	res := runRow(t, dir, "wiring")
	if res.Outcome != Green {
		t.Fatalf("a dot-imported caller came out %s: %s", res.Outcome, res.Evidence)
	}
}

// A library that exports nothing is still read, and the row says what it found
// rather than passing on nothing.
func TestWiringRowOnALibraryThatExportsNothing(t *testing.T) {
	t.Run("nothing it could judge", func(t *testing.T) {
		dir := newRepo(t)
		writeManifest(t, dir, goLibrarySurface)
		writeSource(t, dir, "alpha/alpha.go",
			"package alpha\n\ntype Thing struct{}\n\nfunc (Thing) Method() int { return 1 }\n")

		res := runRow(t, dir, "wiring")
		if res.Outcome != Green {
			t.Fatalf("the row came out %s: %s", res.Outcome, res.Evidence)
		}
		mustFit(t, res.Evidence, "no function it could judge")
	})

	t.Run("one unexported function, and it is reached", func(t *testing.T) {
		dir := newRepo(t)
		writeManifest(t, dir, goLibrarySurface)
		writeSource(t, dir, "alpha/alpha.go",
			"package alpha\n\ntype Thing struct{}\n\nfunc (Thing) Method() int { return step() }\n\n"+
				"func step() int { return 1 }\n")

		res := runRow(t, dir, "wiring")
		if res.Outcome != Green {
			t.Fatalf("the row came out %s: %s", res.Outcome, res.Evidence)
		}
		mustFit(t, res.Evidence, "1 function")
	})
}

// A manifest that names no profile, or names one this tool does not know, is
// refused before the scan starts. The row reports that it could not reach what
// it checks, and never guesses a profile.
func TestWiringRowIsUnrunnableOnAManifestItCannotReadTheProfileOf(t *testing.T) {
	cases := []struct {
		name     string
		manifest string
	}{
		{
			"no profile field",
			`{"schema":1,"surfaces":[{"name":"kit","stack":"go","root":"."}],` +
				`"capabilities":[{"name":"adding","surface":"kit","proof":["alpha"]}]}`,
		},
		{
			"a profile nobody declares",
			strings.Replace(goLibrarySurface, `"library"`, `"libary"`, 1),
		},
	}

	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			dir := newRepo(t)
			writeManifest(t, dir, c.manifest)
			writeSource(t, dir, "alpha/alpha.go", "package alpha\n\nfunc AddsUp(a, b int) int { return a + b }\n")

			res := runRow(t, dir, "wiring")
			if res.Outcome != Unrunnable {
				t.Fatalf("the row came out %s: %s", res.Outcome, res.Evidence)
			}
			mustFit(t, res.Evidence, "profile")
		})
	}
}

// A repo with one library surface and one cli surface judges each by its own
// declaration.
func TestWiringRowJudgesEachSurfaceByItsOwnProfile(t *testing.T) {
	dir := newRepo(t)
	writeManifest(t, dir, `{
  "schema": 1,
  "surfaces": [
    {"name": "kit", "profile": "library", "stack": "go", "root": "kit"},
    {"name": "cli", "profile": "cli", "stack": "go", "root": "zapp"}
  ],
  "capabilities": [{"name": "adding", "surface": "kit", "proof": ["kit"]}]
}`)
	writeSource(t, dir, "kit/kit.go", "package kit\n\nfunc Exported(a, b int) int { return a + b }\n")
	writeSource(t, dir, "kit/kit_test.go",
		"package kit\n\nimport \"testing\"\n\nfunc TestIt(t *testing.T) {\n\tif Exported(1, 1) != 2 {\n\t\tt.Fatal(\"no\")\n\t}\n}\n")
	writeSource(t, dir, "zapp/zapp.go", "package zapp\n\nfunc Wired(a, b int) int { return a + b }\n")
	writeSource(t, dir, "zapp/zapp_test.go",
		"package zapp\n\nimport \"testing\"\n\nfunc TestIt(t *testing.T) {\n\tif Wired(1, 1) != 2 {\n\t\tt.Fatal(\"no\")\n\t}\n}\n")

	res := runRow(t, dir, "wiring")
	if res.Outcome != Red {
		t.Fatalf("the cli surface's untouched export came out %s: %s", res.Outcome, res.Evidence)
	}
	mustFit(t, res.Evidence, "Wired", "exported function", "no file outside the tests names it")
	if strings.Contains(res.Evidence, "Exported") {
		t.Errorf("the library surface's tested export was named: %s", res.Evidence)
	}
	// The sentence has to follow the surface that judged the hit. This one was
	// judged by the old rule, so it must not ride under a clause about
	// libraries — the reader would take it for a library's export.
	if strings.Contains(res.Evidence, libraryDeclared) {
		t.Errorf("a cli surface's hit rode under the library declaration: %s", res.Evidence)
	}
}

// A mixed repo whose surfaces each hold a dead function reports both, and
// neither rule's clause is stretched over the other's hit. The shapes are what
// tell them apart, one hit at a time.
func TestWiringRowSharesNoBlanketClauseAcrossTwoRules(t *testing.T) {
	dir := newRepo(t)
	writeManifest(t, dir, `{
  "schema": 1,
  "surfaces": [
    {"name": "kit", "profile": "library", "stack": "go", "root": "kit"},
    {"name": "cli", "profile": "cli", "stack": "go", "root": "zapp"}
  ],
  "capabilities": [{"name": "adding", "surface": "kit", "proof": ["kit"]}]
}`)
	writeSource(t, dir, "kit/kit.go", "package kit\n\nfunc stranded() int { return 1 }\n")
	writeSource(t, dir, "zapp/zapp.go", "package zapp\n\nfunc Wired(a, b int) int { return a + b }\n")
	writeSource(t, dir, "zapp/zapp_test.go",
		"package zapp\n\nimport \"testing\"\n\nfunc TestIt(t *testing.T) {\n\tif Wired(1, 1) != 2 {\n\t\tt.Fatal(\"no\")\n\t}\n}\n")

	res := runRow(t, dir, "wiring")
	if res.Outcome != Red {
		t.Fatalf("the row came out %s: %s", res.Outcome, res.Evidence)
	}
	// Two hits, judged by two rules, so the noun is the one that covers both
	// and no clause claims either.
	mustFit(t, res.Evidence, "2 functions", "stranded", "is unexported")
	if strings.Contains(res.Evidence, libraryDeclared) {
		t.Errorf("one clause was stretched over hits from two rules: %s", res.Evidence)
	}
}

// A red whose every hit came from a library does carry the declaration: there
// is nothing else on the line for it to misdescribe.
func TestWiringRowDeclaresTheLibraryRuleWhenItJudgedEveryHit(t *testing.T) {
	dir := newRepo(t)
	writeManifest(t, dir, goLibrarySurface)
	writeSource(t, dir, "alpha/alpha.go",
		"package alpha\n\nfunc AddsUp(a, b int) int { return a + b }\n\nfunc stranded() int { return 1 }\n")
	writeSource(t, dir, "alpha/alpha_test.go", libraryTest("AddsUp"))

	res := runRow(t, dir, "wiring")
	if res.Outcome != Red {
		t.Fatalf("the row came out %s: %s", res.Outcome, res.Evidence)
	}
	mustFit(t, res.Evidence, "stranded", libraryDeclared)
}
