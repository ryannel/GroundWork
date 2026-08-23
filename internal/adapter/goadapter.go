package adapter

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"go/ast"
	"go/parser"
	"go/token"
	"io"
	"io/fs"
	"os"
	"path"
	"path/filepath"
	"regexp"
	"slices"
	"strings"
	"time"
	"unicode"
)

// Go is the in-process adapter. D25: Go is the one stack the battery reads
// itself, through go/ast for discovery and mutation and go test -json for the
// run.
type Go struct{}

// NewGo returns the Go adapter.
func NewGo() *Go {
	return &Go{}
}

// Name is the stack this adapter speaks for.
func (*Go) Name() string { return "go" }

// skipDirs are the directories discovery never walks into.
//
// testdata is Go's own convention for fixtures and its tooling ignores it, so
// a battery that counted fixture suites would report on suites the project
// never ships. The rest are other people's code or build output.
var skipDirs = []string{"testdata", "vendor", "node_modules"}

// Discover lists the Go packages under dir that hold tests, and the test names
// in them.
//
// D30 rules what counts. Discovery lists what reads as a test: every Test
// function with the testing.T signature, in every _test.go file. A build tag
// that excludes the file does not hide it, and neither does a TestMain gate
// that never calls it. TestMain itself is never a test — it takes testing.M,
// so it is the harness rather than a case.
//
// The reason is the never-run scan a later slice builds. Its job is to catch
// code that reads as a test to a person and never executes. If discovery
// listed only what go test would run, discovered would always equal ran, and
// the scan could never catch anything.
//
// So this reads files rather than asking go list. A project that does not
// compile still discovers, and the battery can say "these suites exist and
// none of them ran".
//
// It walks only what the run will reach. A directory carrying its own go.mod is
// another module, and go test ./... stops at that line; a directory whose name
// starts with _ or . is one the go tool ignores outright. Discovering into
// either would list tests no run of this project can ever report.
func (*Go) Discover(ctx context.Context, dir string) ([]Suite, error) {
	root, err := filepath.Abs(dir)
	if err != nil {
		return nil, fmt.Errorf("%w: %w", ErrUnrunnable, err)
	}

	bySuite := map[string]*Suite{}

	err = filepath.WalkDir(root, func(p string, d fs.DirEntry, err error) error {
		if err != nil {
			return err
		}
		if err := ctx.Err(); err != nil {
			return err
		}
		if d.IsDir() {
			if p == root {
				return nil
			}
			name := d.Name()
			if strings.HasPrefix(name, ".") || strings.HasPrefix(name, "_") || slices.Contains(skipDirs, name) {
				return filepath.SkipDir
			}
			// A directory holding its own go.mod is another module. go test
			// ./... never crosses that line, so discovery must not either: every
			// test in a nested tools/ or examples/ module would be discovered,
			// never run, and reported as a suite nothing executes.
			if _, err := os.Stat(filepath.Join(p, "go.mod")); err == nil {
				return filepath.SkipDir
			}

			return nil
		}
		if !strings.HasSuffix(d.Name(), "_test.go") {
			return nil
		}

		fset := token.NewFileSet()
		file, err := parser.ParseFile(fset, p, nil, parser.SkipObjectResolution)
		if err != nil {
			// A test file that does not parse is still a suite that exists,
			// and hiding it would make an unreadable file look like an absent
			// one. It contributes its name and no tests.
			file = nil
		}

		id := suiteID(root, filepath.Dir(p))
		suite, ok := bySuite[id]
		if !ok {
			suite = &Suite{ID: id, Name: filepath.Base(filepath.Dir(p))}
			bySuite[id] = suite
		}
		if file == nil {
			return nil
		}

		suite.Name = strings.TrimSuffix(file.Name.Name, "_test")

		testing, ok := testingName(file)
		if !ok {
			// A test file that does not import testing holds no test this
			// tool can recognise. It is usually a file of helpers.
			return nil
		}

		for _, decl := range file.Decls {
			fn, ok := decl.(*ast.FuncDecl)
			if !ok || fn.Recv != nil || !isTest(fn, testing) {
				continue
			}
			suite.Tests = append(suite.Tests, fn.Name.Name)
		}

		return nil
	})
	if err != nil {
		return nil, fmt.Errorf("%w: could not read the project at %s: %w", ErrUnrunnable, dir, err)
	}

	suites := make([]Suite, 0, len(bySuite))
	for _, suite := range bySuite {
		slices.Sort(suite.Tests)
		suites = append(suites, *suite)
	}
	slices.SortFunc(suites, func(a, b Suite) int { return strings.Compare(a.ID, b.ID) })

	return suites, nil
}

// suiteID is a package directory named from the project root, with forward
// slashes. The root package itself is ".".
func suiteID(root, dir string) string {
	rel, err := filepath.Rel(root, dir)
	if err != nil {
		return dir
	}

	return filepath.ToSlash(rel)
}

// goListPackage is one package as go list -json describes it.
type goListPackage struct {
	Dir            string
	ImportPath     string
	GoFiles        []string
	CgoFiles       []string
	IgnoredGoFiles []string
}

// Packages asks the go toolchain which packages the build compiles under dir,
// and which source files it compiles into each.
//
// This is the build's own answer, and the deletion test needs no other. A file
// the build leaves out compiles nowhere, so no test can notice its deletion; a
// row that offered it as a target would report a survivor it invented. Discovery
// reads files instead, and for its own stated reason: a test that never runs is
// the thing it exists to catch. The two questions are different, so they are
// asked differently.
//
// It is asked with -e, so one directory that does not build cannot hide every
// other one. A package listed with a broken file still holds targets, and what
// its own tests do about them is the row's business rather than this call's.
func (*Go) Packages(ctx context.Context, dir string) ([]Package, error) {
	root, err := filepath.Abs(dir)
	if err != nil {
		return nil, fmt.Errorf("%w: %w", ErrUnrunnable, err)
	}

	cmd := child(ctx, root, "go", "list", "-e",
		"-json=Dir,ImportPath,GoFiles,CgoFiles,IgnoredGoFiles", "./...")

	var out, errOut bytes.Buffer
	cmd.Stdout = &out
	cmd.Stderr = &errOut

	runErr := cmd.Run()

	if err := ctx.Err(); err != nil {
		return nil, fmt.Errorf("%w: go list was stopped: %v", ErrUnrunnable, err)
	}
	if runErr != nil && out.Len() == 0 {
		return nil, fmt.Errorf("%w: go list named no package in %s: %v: %s",
			ErrUnrunnable, dir, runErr, tail(errOut.String()))
	}

	return packagesFrom(root, out.Bytes())
}

// packagesFrom reads what go list printed.
//
// It is split out because the go tool's output is input, and D18 says input
// gets checked rather than trusted. A package named outside the directory this
// call asked about belongs to somebody else's tree, and a mutation run writes
// files — so that one is dropped here, where a test can hand this function the
// shape without having to talk a real go tool into printing it.
func packagesFrom(root string, raw []byte) ([]Package, error) {
	var pkgs []Package

	dec := json.NewDecoder(bytes.NewReader(raw))
	for {
		var listed goListPackage
		if err := dec.Decode(&listed); err != nil {
			if errors.Is(err, io.EOF) {
				break
			}

			return nil, fmt.Errorf("%w: go list printed a line that is not a package: %w",
				ErrUnrunnable, err)
		}
		if listed.Dir == "" {
			continue
		}

		id := suiteID(root, listed.Dir)
		if !insideRoot(id) {
			continue
		}

		pkg := Package{ID: id, Ignored: len(listed.IgnoredGoFiles)}
		for _, name := range slices.Concat(listed.GoFiles, listed.CgoFiles) {
			pkg.Files = append(pkg.Files, path.Join(id, name))
		}
		slices.Sort(pkg.Files)

		pkgs = append(pkgs, pkg)
	}
	slices.SortFunc(pkgs, func(a, b Package) int { return strings.Compare(a.ID, b.ID) })

	return pkgs, nil
}

// insideRoot reports whether a package id names somewhere inside the directory
// it was measured from.
func insideRoot(id string) bool {
	return id != ".." && !strings.HasPrefix(id, "../") && !filepath.IsAbs(id)
}

// testingName returns the name a file imports testing under, and whether it
// imports it at all. Almost always it is testing; an aliased import is rare
// and cheap to honour.
func testingName(file *ast.File) (string, bool) {
	for _, imp := range file.Imports {
		if imp.Path == nil || imp.Path.Value != `"testing"` {
			continue
		}
		if imp.Name == nil {
			return "testing", true
		}
		if imp.Name.Name == "_" || imp.Name.Name == "." {
			return "", false
		}

		return imp.Name.Name, true
	}

	return "", false
}

// isTest reports whether a function reads as a test, per D30.
//
// The signature is what decides, not the name alone. A Test function takes one
// *testing.T; TestMain takes *testing.M and is the harness, so the type check
// is what keeps it out. Benchmarks take *testing.B and fuzz targets *testing.F,
// and D30 leaves both out of this bet.
//
// The name rule is go test's own: what follows Test must not be a lowercase
// letter. Testify is a helper, TestifyX is not a case, and counting either
// would put a test in the discovered set that no runner will ever report.
func isTest(fn *ast.FuncDecl, testing string) bool {
	rest, found := strings.CutPrefix(fn.Name.Name, "Test")
	if !found {
		return false
	}
	if first := []rune(rest); len(first) > 0 && unicode.IsLower(first[0]) {
		return false
	}
	if fn.Type.Params == nil || len(fn.Type.Params.List) != 1 {
		return false
	}

	param := fn.Type.Params.List[0]
	if len(param.Names) > 1 {
		return false
	}

	return isPointerTo(param.Type, testing, "T")
}

// isPointerTo reports whether a type expression is *pkg.name.
func isPointerTo(expr ast.Expr, pkg, name string) bool {
	star, ok := expr.(*ast.StarExpr)
	if !ok {
		return false
	}
	sel, ok := star.X.(*ast.SelectorExpr)
	if !ok || sel.Sel.Name != name {
		return false
	}
	ident, ok := sel.X.(*ast.Ident)

	return ok && ident.Name == pkg
}

// goTestEvent is one line of go test -json.
type goTestEvent struct {
	Action string `json:"Action"`

	// Package names the package a test event belongs to. A build event carries
	// ImportPath instead, and the two are not the same string: the import path
	// of a failed build names the test binary it was building.
	Package    string  `json:"Package"`
	ImportPath string  `json:"ImportPath"`
	Test       string  `json:"Test"`
	Elapsed    float64 `json:"Elapsed"`
	Output     string  `json:"Output"`
}

// Run runs go test -json under dir and normalizes what it prints.
//
// A failing test is not an error: it is the run log saying fail. A package
// that does not build is an error, because a build failure that came back as
// an empty green run log is exactly the "suite compiled but never ran" defect
// the battery exists to catch.
func (g *Go) Run(ctx context.Context, dir string) (RunLog, error) {
	return g.run(ctx, dir, "./...")
}

// RunPackage runs the tests of one package under dir, named the way discovery
// names a suite: a directory inside the project, with forward slashes, and "."
// for the project's own root package.
//
// The deletion test needs it. It applies one mutant at a time and asks whether
// the tests covering that package notice, so running the whole project per
// mutant would cost the whole suite times the number of mutants — the cost
// that makes a battery something people bypass.
//
// It runs the one package, never what sits under it. The mutant damaged one
// package's code, and a run that swept the subtree would judge that mutant by
// suites that never touch it.
func (g *Go) RunPackage(ctx context.Context, dir, suite string) (RunLog, error) {
	rel, err := insideProject(suite)
	if err != nil {
		return RunLog{}, err
	}

	pattern := "./" + rel
	if rel == "." {
		pattern = "."
	}

	return g.run(ctx, dir, pattern)
}

// run is the one go test invocation both shapes above are made of.
func (*Go) run(ctx context.Context, dir, pattern string) (RunLog, error) {
	module, err := modulePath(dir)
	if err != nil {
		return RunLog{}, err
	}

	// go test starts a test binary, and killing only go test would leave that
	// binary running with the machine to itself. That is exactly the shape a
	// mutant produces when it turns a loop into one that never ends.
	cmd := child(ctx, dir, "go", "test", "-json", "-count=1", pattern)

	var out, errOut bytes.Buffer
	cmd.Stdout = &out
	cmd.Stderr = &errOut

	start := time.Now()
	runErr := cmd.Run()
	elapsed := time.Since(start)

	log := RunLog{Duration: elapsed}

	// A build failure is reported over two kinds of event: build-output lines
	// carrying the compiler's own words, and one build-fail line naming the
	// import path. Both are keyed by import path, so the words are kept per
	// path and quoted back with the package that failed.
	said := map[string]*strings.Builder{}
	var buildFailed []string

	// started holds the tests that reported starting and have not reported an
	// end. A test binary that died mid-suite leaves its names here.
	started := map[string]bool{}
	var crash, running string

	dec := json.NewDecoder(bytes.NewReader(out.Bytes()))
	for {
		var ev goTestEvent
		if err := dec.Decode(&ev); err != nil {
			if errors.Is(err, io.EOF) {
				break
			}

			return RunLog{}, fmt.Errorf("%w: go test -json printed a line that is not an event: %w",
				ErrUnrunnable, err)
		}

		if ev.Action == "build-output" {
			words, ok := said[ev.ImportPath]
			if !ok {
				words = &strings.Builder{}
				said[ev.ImportPath] = words
			}
			words.WriteString(ev.Output)
			continue
		}
		if ev.Action == "build-fail" {
			buildFailed = append(buildFailed, ev.ImportPath)
			continue
		}
		if ev.Action == "output" {
			// The runtime's own words for a binary that died. They are the only
			// place the JSON stream tells a crash from a failure: a panicking
			// test still reports fail, and the tests behind it report nothing at
			// all.
			if line := crashLine(ev.Output); line != "" && crash == "" {
				crash = line
			}
			if running == "" && runningGoroutine.MatchString(ev.Output) {
				running = ev.Output
			}
			continue
		}
		if ev.Test == "" {
			continue
		}
		if ev.Action == "run" {
			started[TestID(suiteOf(module, ev.Package), ev.Test)] = true
			continue
		}

		outcome, ok := goOutcome(ev.Action)
		if !ok {
			continue
		}

		suite := suiteOf(module, ev.Package)
		delete(started, TestID(suite, ev.Test))
		log.Tests = append(log.Tests, TestRun{
			ID:       TestID(suite, ev.Test),
			Suite:    suite,
			Name:     ev.Test,
			Outcome:  outcome,
			Duration: time.Duration(ev.Elapsed * float64(time.Second)),
		})
	}

	if len(buildFailed) > 0 {
		return RunLog{}, buildFailure(buildFailed, said, errOut.String())
	}

	// A run that did not finish is unrunnable, never a partial log. The tests
	// behind the crash never ran, and handing them back as absent would make
	// the battery report them as tests nobody ever wrote a runner for. That is
	// a false red manufactured out of a stack trace.
	if err := ctx.Err(); err != nil {
		return RunLog{}, fmt.Errorf("%w: go test was stopped: %v", ErrUnrunnable, err)
	}
	if crash != "" && running != "" {
		// D35: go test's own clock writes a panic and a goroutine dump, exactly
		// like a panicking test. It is the clock noticing the suite rather than
		// the suite noticing anything, so it is named apart here — at the one
		// place that can still see the runner's own words.
		if strings.HasPrefix(crash, testTimeoutPanic) {
			return RunLog{}, fmt.Errorf("%w: %w: %s", ErrUnrunnable, ErrTimedOut, quoted(crash))
		}

		return RunLog{}, fmt.Errorf("%w: go test crashed: %s", ErrUnrunnable, quoted(crash))
	}
	if len(started) > 0 {
		return RunLog{}, fmt.Errorf("%w: go test left %s unfinished: %s",
			ErrUnrunnable, plural(len(started), "test", "tests"), firstFew(started))
	}

	if runErr != nil && len(log.Tests) == 0 {
		return RunLog{}, fmt.Errorf("%w: go test ran no tests and failed: %v: %s",
			ErrUnrunnable, runErr, tail(out.String()+errOut.String()))
	}

	// D30: subtests fold into the top-level test they belong to.
	log.Tests = collapse(log.Tests)

	// An empty run log is not a pass. A suite that ran nothing is the defect
	// the battery exists to catch, and reporting it as a clean run of no tests
	// is how that defect stays invisible.
	//
	// This one refusal carries ErrNoTests rather than a plain unrunnable,
	// because go test finished and said nothing ran. A caller has to be able to
	// tell that from a build that broke.
	if len(log.Tests) == 0 {
		return RunLog{}, fmt.Errorf("%w: go test in %s %w", ErrUnrunnable, dir, ErrNoTests)
	}

	return log, nil
}

// buildFailure says which package did not build and what the compiler said
// about it. The compiler's words are the whole point of the message: a reader
// who gets only "did not build" has to go and run the build themselves.
func buildFailure(failed []string, said map[string]*strings.Builder, stderr string) error {
	slices.Sort(failed)
	failed = slices.Compact(failed)

	var words []string
	for _, path := range failed {
		if say, ok := said[path]; ok && strings.TrimSpace(say.String()) != "" {
			words = append(words, strings.TrimSpace(say.String()))
		}
	}
	if len(words) == 0 && strings.TrimSpace(stderr) != "" {
		words = append(words, strings.TrimSpace(stderr))
	}
	if len(words) == 0 {
		words = append(words, "the build said nothing about why")
	}

	// ErrBuildFailed rides beside ErrUnrunnable so the deletion test can tell a
	// mutant that never compiled from a run that broke some other way. D26
	// calls the first one inconclusive, and only that one.
	return fmt.Errorf("%w: %s %w: %s",
		ErrUnrunnable, strings.Join(failed, ", "), ErrBuildFailed, tail(strings.Join(words, "; ")))
}

// goOutcome maps a go test action to an outcome, and says whether the action
// ends a test at all.
func goOutcome(action string) (Outcome, bool) {
	switch action {
	case "pass":
		return Pass, true
	case "fail":
		return Fail, true
	case "skip":
		return Skip, true
	default:
		return "", false
	}
}

// suiteOf turns an import path into the suite id discovery would have given
// the same package.
func suiteOf(module, pkg string) string {
	if pkg == module {
		return "."
	}

	return strings.TrimPrefix(pkg, module+"/")
}

// modulePath reads the module line out of dir/go.mod.
func modulePath(dir string) (string, error) {
	raw, err := os.ReadFile(filepath.Join(dir, "go.mod"))
	if err != nil {
		return "", fmt.Errorf("%w: %s is not a Go module: %v", ErrUnrunnable, dir, err)
	}

	for line := range strings.Lines(string(raw)) {
		line = strings.TrimSpace(line)
		if rest, found := strings.CutPrefix(line, "module "); found {
			return strings.TrimSpace(rest), nil
		}
	}

	return "", fmt.Errorf("%w: the go.mod in %s declares no module path", ErrUnrunnable, dir)
}

// crashMarkers begin the runtime's report of a binary that died: an
// unrecovered panic, or a fatal runtime error such as a deadlock or a
// concurrent map write. go test's own timeout writes the first of them too,
// which is why ErrTimedOut is picked out of it by name.
//
// Known limitation, recorded as F22 for a later bet: a marker is matched on the
// line's prefix, so a passing suite that prints one of these words at the start
// of a line of its own output reads as a crash. The goroutine-dump header is
// required alongside it, which makes that unlikely rather than impossible. The
// fix is to read go test's own per-test framing rather than its raw output, and
// that is a change to the seam's parser, not to this list.
var crashMarkers = []string{"panic: ", "fatal error: "}

// testTimeoutPanic opens the report go test writes when its own clock gives up
// on a suite: "panic: test timed out after 10m0s".
//
// It is one marker rather than a family. go test writes this one line for its
// own timeout, whether the clock came from -timeout, from GOFLAGS, or from the
// default, and it writes no fatal-error form of it. A test binary killed from
// outside prints nothing at all, which is why the seam's own clocks are tracked
// separately from this.
const testTimeoutPanic = "panic: test timed out"

// runningGoroutine matches the header of the stack dump a crash prints. It is
// required alongside a marker before a run is called crashed: a test is free to
// print the word panic, and none of them print a goroutine dump.
var runningGoroutine = regexp.MustCompile(`^goroutine \d+ \[running\]:`)

// crashLine returns one output line if it opens a crash report.
func crashLine(output string) string {
	line := strings.TrimRight(output, "\n")
	for _, marker := range crashMarkers {
		if strings.HasPrefix(line, marker) {
			return line
		}
	}

	return ""
}

// quoted shortens another tool's line so it cannot fill the caller's own
// message. A row's evidence is capped, and a stack trace would take the row's
// words with it.
func quoted(line string) string {
	const most = 60

	line = strings.Join(strings.Fields(line), " ")
	if len(line) <= most {
		return line
	}

	return line[:most-3] + "..."
}

// plural renders a count with its noun, singular for one.
func plural(n int, one, many string) string {
	if n == 1 {
		return "1 " + one
	}

	return fmt.Sprintf("%d %s", n, many)
}

// firstFew names a few of the tests left unfinished, in one order every run
// agrees on.
func firstFew(ids map[string]bool) string {
	names := make([]string, 0, len(ids))
	for id := range ids {
		names = append(names, id)
	}
	slices.Sort(names)

	const most = 3
	if len(names) <= most {
		return strings.Join(names, ", ")
	}

	return fmt.Sprintf("%s and %d more", strings.Join(names[:most], ", "), len(names)-most)
}

// tail keeps the end of a tool's output, which is where its complaint is.
func tail(s string) string {
	const most = 400

	s = strings.TrimSpace(s)
	if len(s) <= most {
		return s
	}

	return "..." + s[len(s)-most:]
}

// Mutants lists the functions in one Go file and blanks each of their bodies.
//
// A blanked body returns the zero value of every result, written as *new(T) so
// that one spelling covers every type a signature can name. The rest of the
// file is untouched, byte for byte: only the bytes between one function's
// braces move, so a reviewer diffing a mutant sees the one thing it damaged.
func (*Go) Mutants(_ context.Context, dir, file string) ([]Mutant, error) {
	rel, err := insideProject(file)
	if err != nil {
		return nil, err
	}
	if !strings.HasSuffix(rel, ".go") {
		return nil, fmt.Errorf("%w: %s is not a Go file", ErrUnrunnable, rel)
	}
	if strings.HasSuffix(rel, "_test.go") {
		return nil, fmt.Errorf("%w: %s is a test file, and the deletion test damages the code, never the tests",
			ErrUnrunnable, rel)
	}

	src, err := os.ReadFile(filepath.Join(dir, filepath.FromSlash(rel)))
	if err != nil {
		return nil, fmt.Errorf("%w: could not read %s: %v", ErrUnrunnable, rel, err)
	}

	fset := token.NewFileSet()
	parsed, err := parser.ParseFile(fset, rel, src, parser.SkipObjectResolution)
	if err != nil {
		return nil, fmt.Errorf("%w: %s does not parse: %v", ErrUnrunnable, rel, err)
	}

	var mutants []Mutant
	for _, decl := range parsed.Decls {
		fn, ok := decl.(*ast.FuncDecl)
		if !ok || fn.Body == nil || len(fn.Body.List) == 0 {
			// A body with no statements is already blank. Reporting it would
			// hand the deletion test a mutant identical to the original, which
			// can only ever look like a suite that failed to notice.
			continue
		}

		opens := fset.Position(fn.Body.Lbrace).Offset
		shuts := fset.Position(fn.Body.Rbrace).Offset

		var content bytes.Buffer
		content.Write(src[:opens])
		content.WriteString(blankBody(src, fn.Type.Results, fset))
		content.Write(src[shuts+1:])

		mutants = append(mutants, Mutant{
			File:    rel,
			Symbol:  symbolOf(src, fn, fset),
			Line:    fset.Position(fn.Pos()).Line,
			Content: content.String(),
		})
	}

	return mutants, nil
}

// blankBody writes the body that returns nothing but zero values.
func blankBody(src []byte, results *ast.FieldList, fset *token.FileSet) string {
	if results == nil || len(results.List) == 0 {
		return "{}"
	}

	var zeros []string
	for _, field := range results.List {
		typ := source(src, field.Type, fset)
		// One field can name several results of one type: (a, b int).
		count := max(len(field.Names), 1)
		for range count {
			zeros = append(zeros, "*new("+typ+")")
		}
	}

	return "{ return " + strings.Join(zeros, ", ") + " }"
}

// symbolOf names a function the way a report should: a method carries the type
// it hangs off.
func symbolOf(src []byte, fn *ast.FuncDecl, fset *token.FileSet) string {
	if fn.Recv == nil || len(fn.Recv.List) == 0 {
		return fn.Name.Name
	}

	return "(" + source(src, fn.Recv.List[0].Type, fset) + ")." + fn.Name.Name
}

// source returns the bytes a node was written as.
func source(src []byte, node ast.Node, fset *token.FileSet) string {
	from := fset.Position(node.Pos()).Offset
	to := fset.Position(node.End()).Offset
	if from < 0 || to > len(src) || from > to {
		return ""
	}

	return string(src[from:to])
}

// insideProject refuses a path that is empty, absolute, or climbs out of the
// project. A mutation writes files, so a path that could escape the project is
// a path that could damage the machine.
func insideProject(file string) (string, error) {
	if strings.TrimSpace(file) == "" {
		return "", fmt.Errorf("%w: no file was named", ErrUnrunnable)
	}
	if filepath.IsAbs(file) || path.IsAbs(file) {
		return "", fmt.Errorf("%w: %s is an absolute path, and a mutation stays inside the project",
			ErrUnrunnable, file)
	}

	clean := path.Clean(filepath.ToSlash(file))
	if clean == ".." || strings.HasPrefix(clean, "../") {
		return "", fmt.Errorf("%w: %s climbs out of the project", ErrUnrunnable, file)
	}

	return clean, nil
}
