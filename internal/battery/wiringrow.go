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
		judged  []string
		blocked []string
	)
	for _, surface := range s.m.Surfaces {
		if surface.Stack != manifest.GoStack {
			blocked = append(blocked,
				fmt.Sprintf("the surface %q is written in %s, which this scan cannot read yet",
					surface.Name, surface.Stack))
			continue
		}
		judged = append(judged, s.dir(surface))
	}

	if len(judged) == 0 {
		return Result{
			Outcome: Unrunnable,
			Evidence: cut(fmt.Sprintf("the wiring scan reads Go source, and %s",
				listed(blocked, "; "))),
		}
	}

	var (
		candidates []hit
		notes      scanNotes
		files      int
	)
	referenced := map[string]bool{}

	// One walk, from the repo root: every non-test Go file in the module is
	// swept for the names it uses, and only the files inside a declared surface
	// offer candidates.
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
		if !strings.HasSuffix(d.Name(), ".go") || strings.HasSuffix(d.Name(), "_test.go") {
			return nil
		}

		// A generated file is read for its references and judged for nothing.
		// Everything else openFile turns away stays turned away.
		src, state := openFile(path, d, &notes)
		if state == fileSkipped {
			return nil
		}

		fset := token.NewFileSet()
		file, err := parser.ParseFile(fset, path, src, parser.ParseComments|parser.SkipObjectResolution)
		if err != nil {
			line, words := parseProblem(err)

			return fmt.Errorf("%s:%d does not parse: %s", s.rel(path), line, words)
		}
		files++

		collectReferences(file, referenced)
		if state == fileGenerated || file.Name.Name == "main" || !inside(judged, path) {
			return nil
		}

		rel := s.rel(path)
		for _, decl := range file.Decls {
			fn, ok := decl.(*ast.FuncDecl)
			if !ok || fn.Recv != nil || !fn.Name.IsExported() {
				continue
			}
			candidates = append(candidates, hit{
				file:    rel,
				line:    fset.Position(fn.Pos()).Line,
				subject: fn.Name.Name,
				shape:   "is exported and no file outside the tests names it",
			})
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

	var dead []hit
	for _, candidate := range candidates {
		if !referenced[candidate.subject] {
			dead = append(dead, candidate)
		}
	}

	tail := notes.String()
	if len(blocked) > 0 {
		tail = "; " + listed(blocked, "; ") + tail
	}

	switch {
	case len(dead) > 0:
		return Result{
			Outcome: Red,
			Evidence: hitEvidence(
				fmt.Sprintf("the wiring scan found %s nothing wires up: ",
					counted(len(dead), "exported function", "exported functions")),
				dead, tail),
		}

	case files == 0:
		// D17: a verifier may never pass on nothing.
		return Result{
			Outcome:  Unrunnable,
			Evidence: "the wiring scan read no Go source in the module, so it checked nothing" + tail,
		}

	case len(candidates) == 0:
		// Green with nothing behind it says so. A row that read a tree holding
		// no exported function has judged nothing, and the evidence has to
		// admit that rather than look like a pass.
		return Result{
			Outcome: Green,
			Evidence: fmt.Sprintf("the wiring scan read %s and found no exported function outside package main, so nothing could be unwired%s",
				counted(files, "file", "files"), tail),
		}

	default:
		return Result{
			Outcome: Green,
			Evidence: fmt.Sprintf("the wiring scan read %s in %s, and a non-test file names every one%s",
				counted(len(candidates), "exported function", "exported functions"),
				counted(files, "file", "files"), tail),
		}
	}
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
