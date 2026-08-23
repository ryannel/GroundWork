package battery

import (
	"fmt"
	"go/ast"
	"go/parser"
	"go/token"
	"io/fs"
	"path/filepath"
	"strings"

	"github.com/ryannel/groundwork/internal/manifest"
)

// The wiring scan looks for controls built but never wired: the empty or
// TODO-only handler, and the function no caller reaches (proof.md).
//
// The rule it applies is one sentence. An exported function in a non-main
// package inside a declared surface, that no non-test Go file anywhere in the
// module names, is not wired. Test files do not count as callers, and that is
// the point of the row: a control with a unit test and no consumer looks proven
// on every board and is not delivered. Package main is left alone, because the
// linker owns what a program reaches and this scan would only be guessing at
// it.
//
// Where it looks and what it judges are two different questions. Judgment stays
// inside the surfaces the manifest declares. The sweep for callers is the whole
// module, because a caller does not have to live in a declared surface — a
// generator under tools/, a build script, a package the manifest never named
// are all real wiring, and a scan that only read the surface would call their
// callees dead.
//
// The posture is precision over recall, on purpose. A false red here poisons
// trust in the whole battery — the bet's done condition is no false reds on
// this repo's own history — so every doubt is resolved green:
//
//   - Names are matched, not types. A function is wired if its name appears
//     anywhere outside its own declaration, in any non-test Go file in the
//     module. Another package's same-named function, a struct field, a map key:
//     all of them count as a reference. That loses real dead code, and it very
//     rarely invents any.
//   - Methods are never candidates. A method can be reached through an
//     interface no file names, so judging one would be a guess.
//   - A generated file's exports are not candidates — nobody hand-wrote them —
//     but its references still count, because generated code wires real code up
//     all the time.
//   - A function that only calls itself reads as wired. Recursion in dead code
//     is rare, and the alternative is a walk that has to know which reference
//     came from inside which body.
//   - A caller written in a compiler directive counts. //go:linkname and cgo's
//     //export name a function from a comment, where no identifier appears, so
//     the words of those directives are read as references too.
//   - A file the scan cannot parse leaves the row unrunnable rather than red,
//     and so does a walk that failed. This row's verdict rests on the sweep
//     being complete: half a sweep can only produce a function that looks dead
//     because the file naming it went unread. That is why an unreadable tree
//     outranks a hit here, where in the honesty and token scans a hit outranks
//     an unreadable surface — those two judge each file on its own.
//
// What it catches is what the design named: something exported, tested or not,
// that no shipped code path mentions.
//
// The residue this leaves is a caller no Go source names at all: a function
// reached only through reflection by name, or named only from another language.
// Neither shape appears in this repo, and both would show up as a red naming a
// function the reader knows is live — which is the moment to widen the rule or
// waive it, not to guess now.
//
// One profile is judged by a different rule, and the manifest is what says so
// (D41). A library's callers live in other people's repos, so an exported
// function with no caller in this one proves nothing — it is the product. On
// the held-out go-fieldkit the rule above flagged 8 of 11 exported functions,
// including the public API of every capability that repo's sealed key calls
// honest (F27). So the row reads the profile, the way the token row beside it
// already does, and on a library it keeps only the teeth that stay honest:
//
//   - An exported function is dead when nothing in the module names it at all,
//     tests included. A test naming it is not proof of a consumer, but it is
//     proof somebody meant it to exist.
//   - An unexported function is dead on the rule above: no non-test file names
//     it. Nothing outside this repo can reach an unexported function, so its
//     absence from every shipped file is the whole story.
//   - init is never a candidate. The runtime calls it and no file names it.
//
// A directory declared under two surfaces, one of them a library, is judged as
// a library. That is this row's standing posture — every doubt is resolved
// green — and the library declaration is the one that says the callers may be
// somewhere this scan cannot look.
//
// The deferral this leaves, named rather than found later: proving a library's
// exports for real needs a consumer that is not this repo. The spec's library
// profile says the front door is a consumer example, and the consumer-fixture
// round trip arrives with that machinery (D41).

// libraryDeclared is what the row says out loud when it read the library
// profile, whose name it takes from the manifest package. A rule that changed
// in silence would leave a reader unable to tell a scan that stood its ground
// from one that gave way.
const libraryDeclared = "on profile library an export needs no in-repo caller"

// wiringRow is the dead-code scan.
func wiringRow() Row {
	return Row{
		ID:       "wiring",
		Kind:     "wiring",
		Severity: Blocking,
		Check:    checkWiring,
	}
}

func checkWiring(c Context) Result {
	s, bad, ok := openScan("wiring scan", c)
	if !ok {
		return bad
	}

	var (
		judged    []string
		libraries []string
		blocked   []string
	)
	for _, surface := range s.m.Surfaces {
		if surface.Stack != manifest.GoStack {
			blocked = append(blocked,
				fmt.Sprintf("the surface %q is written in %s, which this scan cannot read yet",
					surface.Name, surface.Stack))
			continue
		}
		judged = append(judged, s.dir(surface))
		if surface.Profile == manifest.LibraryProfile {
			libraries = append(libraries, s.dir(surface))
		}
	}

	if len(judged) == 0 {
		return Result{
			Outcome: Unrunnable,
			Evidence: cut(fmt.Sprintf("the wiring scan reads Go source, and %s",
				listed(blocked, "; "))),
		}
	}

	var (
		candidates []candidate
		notes      scanNotes
		files      int
	)

	// Two reference sets. shipped is what the non-test files name, and it is
	// what every profile but library is judged on. tested is what the test
	// files name, and it is only filled when a library surface was declared —
	// a repo with none is swept exactly as it was before this rule existed.
	shipped := map[string]bool{}
	tested := map[string]bool{}

	// One walk, from the repo root: every Go file in the module the row reads
	// is swept for the names it uses, and only the files inside a declared
	// surface offer candidates.
	err := filepath.WalkDir(s.root, func(path string, d fs.DirEntry, err error) error {
		if err != nil {
			return err
		}
		if d.IsDir() {
			if path != s.root && skipDir(d.Name()) {
				return filepath.SkipDir
			}

			return nil
		}
		if !strings.HasSuffix(d.Name(), ".go") {
			return nil
		}
		// Once a library is declared, every test file in the module is part of
		// the sweep, not only the ones inside a surface: a name is a name
		// wherever it is written. So a test file anywhere the walk reaches can
		// leave the row unrunnable. testdata stays out, because skipDir keeps
		// the walk out of it.
		test := strings.HasSuffix(d.Name(), "_test.go")
		if test && len(libraries) == 0 {
			return nil
		}

		// A generated file is read for its references and judged for nothing.
		// Everything else openFile turns away stays turned away.
		src, state, why := openFile(path, d, &notes)
		if state == fileSkipped {
			// D42.2's completeness rule, and it is about the sweep rather than
			// about the parser. On a library the test files decide whether an
			// export is dead, so a test file left unread for any reason — a
			// symlink, a named pipe, a permission — leaves the same hole a file
			// that will not parse leaves, and the row must not deliver a
			// verdict through it. Every other profile never reads a test file
			// at all, so this cannot reach one.
			if test {
				return fmt.Errorf("%s %s", s.rel(path), why)
			}

			return nil
		}

		fset := token.NewFileSet()
		file, err := parser.ParseFile(fset, path, src, parser.ParseComments|parser.SkipObjectResolution)
		if err != nil {
			line, words := parseProblem(err)

			return fmt.Errorf("%s:%d does not parse: %s", s.rel(path), line, words)
		}

		if test {
			// A library's exports are judged on what its tests name too, so a
			// test file is swept for references and judged for nothing. It is
			// not counted as source: a repo holding only tests has still had
			// nothing judged, and D17 says so.
			collectReferences(file, tested)

			return nil
		}
		files++

		collectReferences(file, shipped)
		if state == fileGenerated || file.Name.Name == "main" || !inside(judged, path) {
			return nil
		}

		library := inside(libraries, path)
		rel := s.rel(path)
		for _, decl := range file.Decls {
			fn, ok := decl.(*ast.FuncDecl)
			if !ok || fn.Recv != nil {
				continue
			}
			found, ok := candidateOf(fn, library)
			if !ok {
				continue
			}
			found.file = rel
			found.line = fset.Position(fn.Pos()).Line
			candidates = append(candidates, found)
		}

		return nil
	})
	if err != nil {
		return Result{
			Outcome: Unrunnable,
			Evidence: cut(fmt.Sprintf("the wiring scan could not read the module, so nothing it found would be safe to call dead: %s",
				s.reason(err))),
		}
	}

	var dead []candidate
	for _, c := range candidates {
		if shipped[c.subject] || (c.tested && tested[c.subject]) {
			continue
		}
		dead = append(dead, c)
	}

	// The tail, ordered most droppable first. A red line gives up a clause
	// before it gives up the name of a hit, and it gives up the front one.
	var rest []string
	if len(blocked) > 0 {
		rest = append(rest, listed(blocked, "; "))
	}
	rest = append(rest, notes.clauses()...)

	// declaring puts the library declaration in front of the rest. It may only
	// go on a line whose every function was judged by that rule: the judgment
	// is per surface, so a cli surface's export must never ride under a clause
	// saying an export needs no in-repo caller.
	declaring := func(declare bool) []string {
		if !declare {
			return rest
		}

		return append([]string{libraryDeclared}, rest...)
	}

	switch {
	case len(dead) > 0:
		said := spokenOf(dead)

		return Result{
			Outcome: Red,
			Evidence: hitEvidence(
				fmt.Sprintf("the wiring scan found %s nothing wires up: ",
					counted(len(dead), said.one, said.many)),
				hitsIn(dead), declaring(said.declare)),
		}

	case files == 0:
		// D17: a verifier may never pass on nothing. No function was judged, so
		// there is nothing for the library declaration to explain.
		return Result{
			Outcome: Unrunnable,
			Evidence: "the wiring scan read no Go source in the module, so it checked nothing" +
				tailOf(declaring(false)),
		}

	case len(candidates) == 0:
		// Green with nothing behind it says so. A row that read a tree holding
		// no function it judges has judged nothing, and the evidence has to
		// admit that rather than look like a pass.
		//
		// There is no candidate to read the wording off here, so what the scan
		// went looking for decides it: a declared library puts unexported
		// functions in the search too.
		found := "no exported function outside package main"
		if len(libraries) > 0 {
			found = "no function it could judge"
		}

		return Result{
			Outcome: Green,
			Evidence: fmt.Sprintf("the wiring scan read %s and found %s, so nothing could be unwired%s",
				counted(files, "file", "files"), found, tailOf(declaring(len(libraries) > 0))),
		}

	default:
		said := spokenOf(candidates)

		return Result{
			Outcome: Green,
			Evidence: fmt.Sprintf("the wiring scan read %s in %s, and %s%s",
				counted(len(candidates), said.one, said.many),
				counted(files, "file", "files"), said.named, tailOf(declaring(said.declare))),
		}
	}
}

// candidate is one function the row may call dead, the reference set that
// decides it, and what the row may say about it.
type candidate struct {
	hit

	// tested says a test naming this function counts as wiring. Only a
	// library's exports are judged that way: an exported function is what a
	// library ships, and its callers are in repos this scan cannot read.
	tested bool

	// exported and library are what the surface's own rule made of this
	// function. They are carried rather than worked out again at the end,
	// because by then a hit no longer knows which surface it came from.
	exported bool
	library  bool
}

// hitsIn takes the hits out of a set of candidates, which is what a line of
// evidence is rendered from.
func hitsIn(all []candidate) []hit {
	found := make([]hit, 0, len(all))
	for _, c := range all {
		found = append(found, c.hit)
	}

	return found
}

// spoken is how the row talks about one set of functions it judged.
//
// The judgment is per surface, so the sentence has to be too. A repo that
// declares a library beside a cli surface has its functions judged by two
// different rules, and one blanket clause over both would tell the reader
// something untrue about half of them.
type spoken struct {
	one, many string

	// named is what the line claims was true of every one of them. A library's
	// export needs no caller in this repo, so once one is in the set the weaker
	// sentence is the only honest one.
	named string

	// declare says the library declaration may ride on this line. It may only
	// when every function the line is about was judged by that rule.
	declare bool
}

// spokenOf works out how to talk about one set of candidates.
func spokenOf(all []candidate) spoken {
	said := spoken{
		one:     "exported function",
		many:    "exported functions",
		named:   "a non-test file names every one",
		declare: len(all) > 0,
	}

	for _, c := range all {
		if !c.exported {
			said.one, said.many = "function", "functions"
		}
		if c.library {
			said.named = "every one is named"
		} else {
			said.declare = false
		}
	}

	return said
}

// candidateOf reads one function declaration into a candidate, or says the row
// does not judge it.
func candidateOf(fn *ast.FuncDecl, library bool) (candidate, bool) {
	// The runtime calls init, and no file names it, so an init nothing
	// mentions is not dead code — it is every init ever written.
	if fn.Name.Name == "init" {
		return candidate{}, false
	}

	exported := fn.Name.IsExported()
	found := candidate{
		hit:      hit{subject: fn.Name.Name},
		exported: exported,
		library:  library,
	}

	switch {
	case !library && !exported:
		return candidate{}, false

	case !library:
		found.shape = "is exported and no file outside the tests names it"

	case exported:
		found.shape = "is exported and nothing in the module names it"
		found.tested = true

	default:
		found.shape = "is unexported and no file outside the tests names it"
	}

	return found, true
}

// inside reports whether a file sits under one of the directories a scan
// judges.
func inside(dirs []string, path string) bool {
	for _, dir := range dirs {
		if path == dir || strings.HasPrefix(path, dir+string(filepath.Separator)) {
			return true
		}
	}

	return false
}

// collectReferences records every name a file mentions, apart from the names
// the file's own functions are declared under.
//
// A declaration is not a reference: a file that declares Handle and never calls
// it must not be read as calling it. Everything else counts, including the
// function's own body, which is why a recursive dead function reads as wired.
//
// Compiler directives count too. //go:linkname and //export wire a function up
// from a comment, where the parser sees no identifier at all, so the words of
// those lines join the reference set. Without that, a function whose only
// caller is a directive reads as dead, and the reviewer found that shape.
func collectReferences(file *ast.File, into map[string]bool) {
	for _, group := range file.Comments {
		for _, line := range group.List {
			if !strings.Contains(line.Text, "go:linkname") && !strings.Contains(line.Text, "//export") {
				continue
			}
			for _, word := range strings.Fields(line.Text) {
				// A linkname names a symbol by its import path, and the last
				// element of that path is the function's own name.
				if cut := strings.LastIndex(word, "."); cut >= 0 {
					word = word[cut+1:]
				}
				into[word] = true
			}
		}
	}

	ast.Inspect(file, func(n ast.Node) bool {
		switch n := n.(type) {
		case *ast.FuncDecl:
			if n.Recv != nil {
				ast.Inspect(n.Recv, identsInto(into))
			}
			ast.Inspect(n.Type, identsInto(into))
			if n.Body != nil {
				ast.Inspect(n.Body, identsInto(into))
			}

			return false

		case *ast.Ident:
			into[n.Name] = true
		}

		return true
	})
}

// identsInto records every identifier under a node.
func identsInto(into map[string]bool) func(ast.Node) bool {
	return func(n ast.Node) bool {
		if ident, ok := n.(*ast.Ident); ok {
			into[ident.Name] = true
		}

		return true
	}
}
