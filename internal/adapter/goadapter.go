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
	"os/exec"
	"path"
	"path/filepath"
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
			if strings.HasPrefix(name, ".") || slices.Contains(skipDirs, name) {
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
func (*Go) Run(ctx context.Context, dir string) (RunLog, error) {
	module, err := modulePath(dir)
	if err != nil {
		return RunLog{}, err
	}

	cmd := exec.CommandContext(ctx, "go", "test", "-json", "-count=1", "./...")
	cmd.Dir = dir

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
		if ev.Test == "" {
			continue
		}

		outcome, ok := goOutcome(ev.Action)
		if !ok {
			continue
		}

		suite := suiteOf(module, ev.Package)
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
	if runErr != nil && len(log.Tests) == 0 {
		return RunLog{}, fmt.Errorf("%w: go test ran no tests and failed: %v: %s",
			ErrUnrunnable, runErr, tail(out.String()+errOut.String()))
	}

	// D30: subtests fold into the top-level test they belong to.
	log.Tests = collapse(log.Tests)

	// An empty run log is not a pass. A suite that ran nothing is the defect
	// the battery exists to catch, and reporting it as a clean run of no tests
	// is how that defect stays invisible.
	if len(log.Tests) == 0 {
		return RunLog{}, fmt.Errorf("%w: go test reported no tests at all in %s", ErrUnrunnable, dir)
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

	return fmt.Errorf("%w: %s did not build: %s",
		ErrUnrunnable, strings.Join(failed, ", "), tail(strings.Join(words, "; ")))
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
