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
// package that no non-test file in the module names is not wired. Test files
// do not count as callers, and that is the point of the row: a control with a
// unit test and no consumer looks proven on every board and is not delivered.
// Package main is left alone, because the linker owns what a program reaches
// and this scan would only be guessing at it.
//
// The posture is precision over recall, on purpose. A false red here poisons
// trust in the whole battery — the bet's done condition is no false reds on
// this repo's own history — so every doubt is resolved green:
//
//   - Names are matched, not types. A function is wired if its name appears
//     anywhere outside its own declaration, in any non-test file. Another
//     package's same-named function, a struct field, a map key: all of them
//     count as a reference. That loses real dead code and never invents any.
//   - Methods are never candidates. A method can be reached through an
//     interface no file names, so judging one would be a guess.
//   - A generated file's exports are not candidates — nobody hand-wrote them —
//     but its references still count, because generated code wires real code up
//     all the time.
//   - A function that only calls itself reads as wired. Recursion in dead code
//     is rare, and the alternative is a walk that has to know which reference
//     came from inside which body.
//   - A file the scan cannot parse leaves the row unrunnable rather than red.
//     Half a tree is not enough to call anything dead.
//
// What it catches is what the design named: something exported, tested or not,
// that no shipped code path mentions.

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
	s, bad, ok := openScan("wiring", c)
	if !ok {
		return bad
	}

	var (
		candidates []hit
		offStack   []string
		notes      scanNotes
		files      int
	)
	referenced := map[string]bool{}

	for _, surface := range s.m.Surfaces {
		if surface.Stack != manifest.GoStack {
			offStack = append(offStack,
				fmt.Sprintf("the surface %q is written in %s", surface.Name, surface.Stack))
			continue
		}

		err := filepath.WalkDir(s.dir(surface), func(path string, d fs.DirEntry, err error) error {
			if err != nil {
				return err
			}
			if d.IsDir() {
				if path != s.dir(surface) && skipDir(d.Name()) {
					return filepath.SkipDir
				}

				return nil
			}
			if !strings.HasSuffix(d.Name(), ".go") || strings.HasSuffix(d.Name(), "_test.go") {
				return nil
			}

			// A generated file is read for its references and judged for
			// nothing. Everything else openFile turns away stays turned away.
			src, state := openFile(path, d, &notes)
			if state == fileSkipped {
				return nil
			}

			fset := token.NewFileSet()
			file, err := parser.ParseFile(fset, path, src, parser.SkipObjectResolution)
			if err != nil {
				line, words := parseProblem(err)

				return fmt.Errorf("%s:%d does not parse: %s", s.rel(path), line, words)
			}
			files++

			collectReferences(file, referenced)
			if state == fileGenerated || file.Name.Name == "main" {
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
				Outcome:  Unrunnable,
				Evidence: fmt.Sprintf("the wiring scan could not read the surface %q: %v", surface.Name, err),
			}
		}
	}

	var dead []hit
	for _, candidate := range candidates {
		if !referenced[candidate.subject] {
			dead = append(dead, candidate)
		}
	}

	switch {
	case len(dead) > 0:
		return Result{
			Outcome: Red,
			Evidence: hitEvidence(
				fmt.Sprintf("the wiring scan found %s nothing wires up: ",
					counted(len(dead), "exported function", "exported functions")),
				dead, notes.String()),
		}

	case len(offStack) > 0:
		return Result{
			Outcome: Unrunnable,
			Evidence: fmt.Sprintf("the wiring scan reads Go source, and %s: that shape lands in a later slice%s",
				listed(offStack, "; "), notes),
		}

	case len(candidates) == 0:
		// Green with nothing behind it says so. A row that read a tree holding
		// no exported function has judged nothing, and the evidence has to
		// admit that rather than look like a pass.
		return Result{
			Outcome: Green,
			Evidence: fmt.Sprintf("the wiring scan read %s and found no exported function outside package main, so nothing could be unwired%s",
				counted(files, "file", "files"), notes),
		}

	default:
		return Result{
			Outcome: Green,
			Evidence: fmt.Sprintf("the wiring scan read %s in %s, and a non-test file names every one%s",
				counted(len(candidates), "exported function", "exported functions"),
				counted(files, "file", "files"), notes),
		}
	}
}

// collectReferences records every name a file mentions, apart from the names
// the file's own functions are declared under.
//
// A declaration is not a reference: a file that declares Handle and never calls
// it must not be read as calling it. Everything else counts, including the
// function's own body, which is why a recursive dead function reads as wired.
func collectReferences(file *ast.File, into map[string]bool) {
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
