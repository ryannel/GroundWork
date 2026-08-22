package battery

import (
	"context"
	"errors"
	"fmt"
	"go/ast"
	"go/parser"
	"go/scanner"
	"go/token"
	"os"
	"path/filepath"
	"regexp"
	"slices"
	"strings"

	"github.com/ryannel/groundwork/internal/adapter"
	"github.com/ryannel/groundwork/internal/manifest"
)

// The honesty scan reads the tests a project ships and asks the one question a
// green board cannot answer: could this test ever fail?
//
// proof.md names the shapes — tests that assert nothing, assertions commented
// out or skipped, proofs quietly redefined down to what a stub can pass. Each
// one leaves a suite green while it proves nothing, and each one is here.
//
// What the scan reads is Go, this bet. D25 puts every other stack out of
// process, and the seam's shape for a scan lands later; until then a surface
// the scan cannot read reports unrunnable with its reason. That is the rule
// D25 already fixed: a stack the battery cannot read never passes in silence.
//
// Which functions are tests is not decided here. Discovery decides it, through
// the adapter, under D30's ruling — a Test function with the testing.T
// signature in a _test.go file. A second definition of "a test" living in this
// file would drift from the first one, and proof.md says a checker imports the
// real thing rather than reimplementing it.
//
// Precision over recall, deliberately. The old world's honesty count died on a
// false red against table-driven tests, so a test this scan cannot follow — a
// helper from another file, an assertion library, anything holding the test's
// own *testing.T — is read as honest. A shape below fires only when the scan
// can see the whole path and that path holds nothing that can fail.

// honestyRow is the vacuous-assertion scan.
func honestyRow() Row {
	return Row{
		ID:       "honesty",
		Kind:     "honesty",
		Severity: Blocking,
		Check:    checkHonesty,
	}
}

func checkHonesty(c Context) Result {
	s, bad, ok := openScan("honesty", c)
	if !ok {
		return bad
	}

	var (
		hits     []hit
		notes    scanNotes
		offStack []string
		tests    int
		suites   int
	)

	for _, surface := range s.m.Surfaces {
		if surface.Stack != manifest.GoStack {
			offStack = append(offStack,
				fmt.Sprintf("the surface %q is written in %s", surface.Name, surface.Stack))
			continue
		}

		ctx, cancel := context.WithTimeout(context.Background(), discoverTimeout)
		found, err := adapter.NewGo().Discover(ctx, s.dir(surface))
		cancel()
		if err != nil {
			return Result{
				Outcome:  Unrunnable,
				Evidence: fmt.Sprintf("the honesty scan could not read the surface %q: %v", surface.Name, err),
			}
		}

		for _, suite := range found {
			suites++
			read, suiteHits, suiteNotes := readSuite(s, filepath.Join(s.dir(surface), filepath.FromSlash(suite.ID)), suite.Tests)
			tests += read
			hits = append(hits, suiteHits...)
			notes.add(suiteNotes)
		}
	}

	switch {
	case len(hits) > 0:
		return Result{
			Outcome: Red,
			Evidence: hitEvidence(
				fmt.Sprintf("the honesty scan found %s that cannot fail: ",
					counted(len(hits), "test", "tests")),
				hits, notes.String()),
		}

	case len(offStack) > 0:
		return Result{
			Outcome: Unrunnable,
			Evidence: fmt.Sprintf("the honesty scan reads Go test source, and %s: that shape lands in a later slice%s",
				listed(offStack, "; "), notes),
		}

	case tests == 0:
		// D17: a verifier may never pass on nothing. A scan that read no test
		// is not a project whose tests are honest.
		return Result{
			Outcome: Unrunnable,
			Evidence: fmt.Sprintf("the honesty scan read no tests in %s, so it checked nothing%s",
				counted(suites, "suite", "suites"), notes),
		}

	default:
		return Result{
			Outcome: Green,
			Evidence: fmt.Sprintf("the honesty scan read %s in %s, and every one can fail%s",
				counted(tests, "test", "tests"), counted(suites, "suite", "suites"), notes),
		}
	}
}

// readSuite scans one suite's directory and judges the tests discovery named
// in it.
//
// Only the files of that one directory are read, never its subdirectories: a
// Go suite is a package, and a package is one directory. Discovery walked the
// tree already, so a nested package arrives here as its own suite.
func readSuite(s scanned, dir string, tests []string) (int, []hit, scanNotes) {
	var (
		hits  []hit
		notes scanNotes
		read  int
	)

	entries, err := os.ReadDir(dir)
	if err != nil {
		notes.unreadable++
		return 0, nil, notes
	}

	wanted := map[string]bool{}
	for _, name := range tests {
		wanted[name] = true
	}

	for _, entry := range entries {
		if entry.IsDir() || !strings.HasSuffix(entry.Name(), "_test.go") {
			continue
		}

		path := filepath.Join(dir, entry.Name())
		src, state := openFile(path, entry, &notes)
		if state != fileRead {
			continue
		}

		rel := s.rel(path)
		fset := token.NewFileSet()
		file, err := parser.ParseFile(fset, path, src, parser.ParseComments|parser.SkipObjectResolution)
		if err != nil {
			// A test file nobody can parse is a test file nobody can trust. The
			// suite still exists, so hiding it would make an unreadable file
			// look like an absent one — the same direction discovery takes with
			// a suite that holds no test.
			line, words := parseProblem(err)
			hits = append(hits, hit{file: rel, line: line, shape: "does not parse: " + words})
			continue
		}

		for _, decl := range file.Decls {
			fn, ok := decl.(*ast.FuncDecl)
			if !ok || fn.Recv != nil || !wanted[fn.Name.Name] {
				continue
			}
			read++

			if shape := vacuousShape(file, fn, src, fset); shape != "" {
				hits = append(hits, hit{
					file:    rel,
					line:    fset.Position(fn.Pos()).Line,
					subject: fn.Name.Name,
					shape:   shape,
				})
			}
		}
	}

	return read, hits, notes
}

// parseProblem returns the line a parse error points at and the parser's own
// words for it.
//
// The words matter: a reader who gets only "does not parse" has to go and run
// the parser themselves. The position and the file come off the front, because
// the hit already carries both.
func parseProblem(err error) (int, string) {
	var list scanner.ErrorList
	if errors.As(err, &list) && len(list) > 0 {
		return list[0].Pos.Line, list[0].Msg
	}

	return 1, err.Error()
}

// vacuousShape says what is wrong with one test function, or "" when nothing
// is.
//
// The order matters. A test skipped at its first statement never reaches
// whatever it holds, so the skip is what a reader needs to hear, whatever else
// is written below it.
func vacuousShape(file *ast.File, fn *ast.FuncDecl, src []byte, fset *token.FileSet) string {
	if fn.Body == nil {
		return "asserts nothing"
	}

	a := newAssertions(file, src, fset)
	a.handlesOf(fn.Type)
	ast.Inspect(fn.Body, func(n ast.Node) bool {
		if lit, ok := n.(*ast.FuncLit); ok {
			a.handlesOf(lit.Type)
		}

		return true
	})

	if a.skipsFirst(fn) {
		return "is skipped at its first statement"
	}

	a.walk(fn.Body, false)

	switch {
	case a.total == 0 && !a.unknown:
		if commentedAssertion(file, fn) {
			return "asserts nothing: the only assertion is commented out"
		}
		if a.logs > 0 {
			return "logs but never asserts"
		}

		return "asserts nothing"

	case a.total > 0 && a.total == a.vacuous:
		return "only asserts under a condition that compares a value to itself"

	default:
		return ""
	}
}

// failureMethods are the methods that make a test fail. A test whose every
// path avoids all of them cannot fail.
var failureMethods = []string{"Error", "Errorf", "Fatal", "Fatalf", "Fail", "FailNow"}

// logMethods say something without judging it. A test that only logs is the
// shape that reads as thorough and proves nothing.
var logMethods = []string{"Log", "Logf"}

// skipMethods stop a test before it runs.
var skipMethods = []string{"Skip", "Skipf", "SkipNow"}

// maxHelperDepth bounds how far the scan follows helpers into each other. A
// test whose assertion is six calls down is beyond what this scan claims to
// see, and a bound is what keeps a hostile file from walking forever.
const maxHelperDepth = 8

// assertions counts what one test function can do to fail.
type assertions struct {
	src  []byte
	fset *token.FileSet

	// helpers are the file's own top-level functions, which the scan follows
	// into when a test hands one the testing handle.
	helpers map[string]*ast.FuncDecl

	// handles are the names the testing handle goes by in this function and
	// the helpers walked from it — t, tb, whatever the source called it.
	handles map[string]bool

	// walking guards against helpers that call each other in a circle.
	walking map[string]bool
	depth   int

	// testing is the name the file imports the testing package under.
	testing string

	total   int
	vacuous int
	logs    int

	// unknown records that the test handed its testing handle to something
	// this file cannot see. The scan cannot follow it, so it must not call the
	// test vacuous.
	unknown bool
}

func newAssertions(file *ast.File, src []byte, fset *token.FileSet) *assertions {
	a := &assertions{
		src:     src,
		fset:    fset,
		helpers: map[string]*ast.FuncDecl{},
		handles: map[string]bool{},
		walking: map[string]bool{},
		testing: testingImport(file),
	}

	for _, decl := range file.Decls {
		if fn, ok := decl.(*ast.FuncDecl); ok && fn.Recv == nil {
			a.helpers[fn.Name.Name] = fn
		}
	}

	return a
}

// testingImport returns the name a file imports the testing package under.
func testingImport(file *ast.File) string {
	for _, imp := range file.Imports {
		if imp.Path == nil || imp.Path.Value != `"testing"` {
			continue
		}
		if imp.Name == nil {
			return "testing"
		}

		return imp.Name.Name
	}

	return "testing"
}

// handlesOf records the parameter names that carry a testing handle.
func (a *assertions) handlesOf(sig *ast.FuncType) {
	if sig == nil || sig.Params == nil {
		return
	}

	for _, param := range sig.Params.List {
		if !a.isHandle(param.Type) {
			continue
		}
		for _, name := range param.Names {
			a.handles[name.Name] = true
		}
	}
}

// takesHandle reports whether a function is handed a testing handle.
//
// It is asked of the declaration rather than of the names already collected: a
// helper whose parameter is called t, in a test whose parameter is also called
// t, is the commonest shape there is, and counting names would miss every one
// of them.
func (a *assertions) takesHandle(sig *ast.FuncType) bool {
	if sig == nil || sig.Params == nil {
		return false
	}

	for _, param := range sig.Params.List {
		if a.isHandle(param.Type) {
			return true
		}
	}

	return false
}

// isHandle reports whether a type expression is one of the testing handles a
// test can fail through: *testing.T, *testing.B, *testing.F, or testing.TB.
func (a *assertions) isHandle(expr ast.Expr) bool {
	if star, ok := expr.(*ast.StarExpr); ok {
		expr = star.X
	}

	sel, ok := expr.(*ast.SelectorExpr)
	if !ok {
		return false
	}
	pkg, ok := sel.X.(*ast.Ident)
	if !ok || pkg.Name != a.testing {
		return false
	}

	return slices.Contains([]string{"T", "B", "F", "TB"}, sel.Sel.Name)
}

// skipsFirst reports whether the first statement of a test skips it.
//
// Only the first statement counts, and only a direct call on the test's own
// handle. A skip under a condition is a test that runs when the condition is
// false, and a helper that may skip is a helper — reading either as a dead
// test would be the false red this row cannot afford.
func (a *assertions) skipsFirst(fn *ast.FuncDecl) bool {
	if len(fn.Body.List) == 0 {
		return false
	}

	stmt, ok := fn.Body.List[0].(*ast.ExprStmt)
	if !ok {
		return false
	}
	call, ok := stmt.X.(*ast.CallExpr)
	if !ok {
		return false
	}
	sel, ok := call.Fun.(*ast.SelectorExpr)
	if !ok {
		return false
	}
	recv, ok := sel.X.(*ast.Ident)

	return ok && a.handles[recv.Name] && slices.Contains(skipMethods, sel.Sel.Name)
}

// walk counts the failure calls under one node.
//
// vacuous says whether everything under this node sits inside a condition that
// compares a value to itself. Such a condition has one answer whatever the code
// does, so an assertion under it is not judging anything.
func (a *assertions) walk(node ast.Node, vacuous bool) {
	ast.Inspect(node, func(n ast.Node) bool {
		switch n := n.(type) {
		case *ast.IfStmt:
			if n.Init != nil {
				a.walk(n.Init, vacuous)
			}
			a.walk(n.Cond, vacuous)
			a.walk(n.Body, vacuous || a.selfComparison(n.Cond))
			if n.Else != nil {
				a.walk(n.Else, vacuous)
			}

			return false

		case *ast.CallExpr:
			a.call(n, vacuous)

			return true
		}

		return true
	})
}

// call judges one call: a failure, a log, a skip, a helper to follow, or
// something this file cannot see.
func (a *assertions) call(call *ast.CallExpr, vacuous bool) {
	switch fun := call.Fun.(type) {
	case *ast.SelectorExpr:
		if _, ok := fun.X.(*ast.Ident); ok {
			name := fun.Sel.Name
			switch {
			case slices.Contains(failureMethods, name):
				a.total++
				if vacuous {
					a.vacuous++
				}

				return
			case slices.Contains(logMethods, name):
				a.logs++

				return
			case slices.Contains(skipMethods, name):
				return
			}
		}

	case *ast.Ident:
		if a.follow(fun.Name, vacuous) {
			return
		}
	}

	// A call this file cannot follow, handed the testing handle, may assert
	// anything at all. It is also how a test built on an assertion library
	// looks. The scan says so and stops judging this test.
	for _, arg := range call.Args {
		if a.passesHandle(arg, vacuous) {
			a.unknown = true
		}
	}
}

// passesHandle reports whether one argument hands over the testing handle, and
// follows a helper passed as a function value on the way.
func (a *assertions) passesHandle(arg ast.Expr, vacuous bool) bool {
	ident, ok := arg.(*ast.Ident)
	if !ok {
		return false
	}
	if a.handles[ident.Name] {
		return true
	}

	// t.Run("case", check) hands a helper over rather than calling it. It runs
	// all the same, so the scan follows it.
	a.follow(ident.Name, vacuous)

	return false
}

// follow walks a helper this file declares, when the helper takes a testing
// handle. It reports whether it followed one.
func (a *assertions) follow(name string, vacuous bool) bool {
	helper, ok := a.helpers[name]
	if !ok || helper.Body == nil || a.walking[name] || a.depth >= maxHelperDepth {
		return false
	}

	if !a.takesHandle(helper.Type) {
		// A helper that never sees a testing handle cannot fail the test.
		return false
	}
	a.handlesOf(helper.Type)

	a.walking[name] = true
	a.depth++
	a.walk(helper.Body, vacuous)
	a.depth--
	a.walking[name] = false

	return true
}

// selfComparison reports whether a condition compares a value to itself.
//
// Both sides are compared as the source wrote them, with the spaces taken out,
// so `got != got` fires and `got != want` does not. A side holding a call is
// left alone: two calls can return two answers, and calling that vacuous would
// be a false red.
func (a *assertions) selfComparison(cond ast.Expr) bool {
	bin, ok := cond.(*ast.BinaryExpr)
	if !ok {
		return false
	}

	switch bin.Op {
	case token.EQL, token.NEQ, token.LSS, token.LEQ, token.GTR, token.GEQ:
	default:
		return false
	}

	if holdsCall(bin.X) || holdsCall(bin.Y) {
		return false
	}

	left := a.source(bin.X)

	return left != "" && left == a.source(bin.Y)
}

// holdsCall reports whether an expression calls anything.
func holdsCall(expr ast.Expr) bool {
	found := false
	ast.Inspect(expr, func(n ast.Node) bool {
		if _, ok := n.(*ast.CallExpr); ok {
			found = true
		}

		return !found
	})

	return found
}

// source returns the bytes an expression was written as, with every space
// taken out so that two spellings of one expression compare equal.
func (a *assertions) source(expr ast.Expr) string {
	from := a.fset.Position(expr.Pos()).Offset
	to := a.fset.Position(expr.End()).Offset
	if from < 0 || to > len(a.src) || from >= to {
		return ""
	}

	return strings.Join(strings.Fields(string(a.src[from:to])), "")
}

// assertionInWords matches an assertion that has been commented out. The
// receiver is left open because a comment is not code, and what is written
// there is whatever the author last called the handle.
var assertionInWords = regexp.MustCompile(`\.(?:Error|Errorf|Fatal|Fatalf|Fail|FailNow)\b`)

// commentedAssertion reports whether the comments inside one function hold an
// assertion. It is asked only of a test that asserts nothing, so what it finds
// is the only assertion the test ever had.
func commentedAssertion(file *ast.File, fn *ast.FuncDecl) bool {
	for _, group := range file.Comments {
		if group.Pos() < fn.Pos() || group.End() > fn.End() {
			continue
		}
		if assertionInWords.MatchString(group.Text()) {
			return true
		}
	}

	return false
}
