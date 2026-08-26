package main

import (
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"io/fs"
	"os"
	"path/filepath"
	"slices"
	"strings"
	"testing"

	"github.com/ryannel/groundwork/internal/adapter"
	"github.com/ryannel/groundwork/internal/manifest"
)

// boardRepo makes a repo the board verb can derive a board from: a plan, a Go
// module whose tests carry the plan's markers, and one commit per landed slice.
func boardRepo(t *testing.T, failing bool, landed ...string) string {
	t.Helper()

	dir := newRepo(t)
	writeManifest(t, dir)
	put(t, dir, "docs/design.md", "# The design\n\n## one\n\nThe shape.\n")
	put(t, dir, "docs/plan/demo/program.md", `---
id: demo
title: A demo program
goal: To prove a board derives
done: The board derives
ladder:
  - id: demo_bet
    line: The one bet
    proof_sketch: The board derives
---
`)
	put(t, dir, "docs/plan/demo/demo_bet/bet.md", `---
id: demo_bet
title: The one bet
program: demo
design:
  - docs/design.md
milestones:
  - id: m_one
    title: The first milestone
slices:
  - id: s_one
    milestone: m_one
---
`)
	put(t, dir, "docs/plan/demo/demo_bet/s_one.md", `---
id: s_one
bet: demo_bet
milestone: m_one
proofs:
  - id: p_one
    marker: TestProof_p_one_it_holds
    from: docs/design.md#one
    headline: true
    retire_at_close: false
fixtures: []
real: []
faked: []
---
`)

	body := "\tif AddsUp(1, 1) != 2 {\n\t\tt.Fatal(\"arithmetic broke\")\n\t}\n"
	if failing {
		body = "\tt.Fatal(\"this proof is not green yet\")\n"
	}
	put(t, dir, "alpha/proof_test.go", fmt.Sprintf(
		"package alpha\n\nimport \"testing\"\n\nfunc TestProof_p_one_it_holds(t *testing.T) {\n%s}\n", body))

	runGit(t, dir, "add", "-A")
	runGit(t, dir, "commit", "-m", "the plan and the proof")

	for _, id := range landed {
		put(t, dir, "landed/"+id+".txt", id+"\n")
		runGit(t, dir, "add", "-A")
		runGit(t, dir, "commit", "-m", "land "+id+"\n\nBet: demo\nSlice: "+id)
	}

	return dir
}

// put writes one file inside a fixture repo, making the directories above it.
func put(t *testing.T, dir, rel, content string) {
	t.Helper()

	path := filepath.Join(dir, filepath.FromSlash(rel))
	if err := os.MkdirAll(filepath.Dir(path), 0o750); err != nil {
		t.Fatalf("could not make %s: %v", filepath.Dir(path), err)
	}
	if err := os.WriteFile(path, []byte(content), 0o600); err != nil {
		t.Fatalf("could not write %s: %v", path, err)
	}
}

// The verb renders the derivation: every proof, what its plan position expects,
// what the run said, and how the two sit together.
func TestBoardRendersTheDerivation(t *testing.T) {
	boardRepo(t, false)
	t.Setenv(adapter.RunGuardEnv, "")

	code, out, errOut := call(t, "board")
	if code != exitOK {
		t.Fatalf("board exited %d: %s%s", code, out, errOut)
	}

	for _, want := range []string{"p_one", "red", "passed", "ahead of plan", "0 slices landed"} {
		if !strings.Contains(out, want) {
			t.Errorf("the board does not carry %q:\n%s", want, out)
		}
	}
}

// The verb and the row read one board, so the two can never disagree about
// whether it holds (D54). A proof behind its plan fails the verb exactly as it
// reddens the row.
func TestBoardFailsOnAProofBehindItsPlan(t *testing.T) {
	boardRepo(t, true, "s_one")
	t.Setenv(adapter.RunGuardEnv, "")

	code, out, errOut := call(t, "board")
	if code != exitFailed {
		t.Fatalf("a board with a proof behind its plan exited %d: %s%s", code, out, errOut)
	}
	if !strings.Contains(out, "behind") {
		t.Errorf("the board does not say what is wrong:\n%s", out)
	}
}

// F74 and the verb's whole reason for reading Holds(): the verb and the row
// never disagree about one board. A misstated Slice trailer reddens the row, so
// it fails the verb, and the render says which trailer it was.
//
// The trailer here names a slice no plan declares — the reviewer's own probe,
// and the case the verb's tests had never driven.
func TestBoardFailsOnAMisstatedTrailer(t *testing.T) {
	dir := boardRepo(t, false)
	put(t, dir, "landed/typo.txt", "typo\n")
	runGit(t, dir, "add", "-A")
	runGit(t, dir, "commit", "-m", "land it\n\nSlice: s_nine")
	t.Setenv(adapter.RunGuardEnv, "")

	code, out, errOut := call(t, "board")
	if code != exitFailed {
		t.Fatalf("a board with a misstated trailer exited %d: %s%s", code, out, errOut)
	}
	for _, want := range []string{"s_nine", "names no slice"} {
		if !strings.Contains(out, want) {
			t.Errorf("the render does not carry %q:\n%s", want, out)
		}
	}
}

// The board is a derivation. Running the verb must leave the repo exactly as it
// found it — every file of it, the git directory and its refs included, which
// is the reading the row's own proof is held to (F79). Reading git status would
// pass over a verb that wrote a ref or a journal line.
func TestBoardWritesNothing(t *testing.T) {
	dir := boardRepo(t, false, "s_one")
	t.Setenv(adapter.RunGuardEnv, "")

	before := treeState(t, dir)

	code, out, errOut := call(t, "board")
	if code != exitOK {
		t.Fatalf("board exited %d: %s%s", code, out, errOut)
	}

	if moved := changedPaths(before, treeState(t, dir)); len(moved) > 0 {
		t.Fatalf("the board verb wrote to %d paths: %s", len(moved), strings.Join(moved, ", "))
	}
}

// treeState hashes every file under dir, the git directory included. The verb
// is forbidden to write anything at all, so nothing is left out of the reading.
func treeState(t *testing.T, dir string) map[string]string {
	t.Helper()

	state := map[string]string{}
	err := filepath.WalkDir(dir, func(path string, d fs.DirEntry, err error) error {
		if err != nil {
			return err
		}
		if d.IsDir() {
			return nil
		}

		rel, err := filepath.Rel(dir, path)
		if err != nil {
			return err
		}
		raw, err := os.ReadFile(path)
		if err != nil {
			// A socket or a pipe is not a file the verb could have written.
			return nil //nolint:nilerr // unreadable entries are not writes
		}
		sum := sha256.Sum256(raw)
		state[filepath.ToSlash(rel)] = hex.EncodeToString(sum[:])

		return nil
	})
	if err != nil {
		t.Fatalf("could not read the tree at %s: %v", dir, err)
	}

	return state
}

// changedPaths names every path that appeared, vanished or moved between two
// readings of a tree.
func changedPaths(before, after map[string]string) []string {
	var moved []string
	for path, sum := range after {
		was, had := before[path]
		switch {
		case !had:
			moved = append(moved, path+" (written)")
		case was != sum:
			moved = append(moved, path+" (changed)")
		}
	}
	for path := range before {
		if _, still := after[path]; !still {
			moved = append(moved, path+" (removed)")
		}
	}
	slices.Sort(moved)

	return moved
}

// A repo with no plan has no board. The verb says so rather than printing an
// empty table, and it does not fail: a repo that states no plan misstates none.
func TestBoardOnARepoWithNoPlan(t *testing.T) {
	newRepo(t)
	t.Setenv(adapter.RunGuardEnv, "")

	code, out, errOut := call(t, "board")
	if code != exitOK {
		t.Fatalf("board exited %d: %s%s", code, out, errOut)
	}
	if !strings.Contains(out, "docs/plan") {
		t.Errorf("the board does not say why there is nothing to show: %s%s", out, errOut)
	}
}

// The verb is on the usage, and a spare argument is a command-line mistake.
func TestBoardUsage(t *testing.T) {
	_, _, errOut := call(t)
	if !strings.Contains(errOut, "board") {
		t.Errorf("the usage does not name the board verb:\n%s", errOut)
	}

	newRepo(t)
	if code, _, _ := call(t, "board", "extra"); code != exitUsage {
		t.Errorf("a spare argument exited %d, want %d", code, exitUsage)
	}
}

// The manifest is what says where to look, so a repo with a plan and no
// manifest cannot be run and says so instead of guessing.
func TestBoardWithoutAManifest(t *testing.T) {
	dir := boardRepo(t, false)
	if err := os.Remove(filepath.Join(dir, manifest.File)); err != nil {
		t.Fatalf("could not remove the manifest: %v", err)
	}
	t.Setenv(adapter.RunGuardEnv, "")

	code, out, errOut := call(t, "board")
	if code != exitFailed {
		t.Fatalf("board with no manifest exited %d: %s%s", code, out, errOut)
	}
	if !strings.Contains(errOut, manifest.File) {
		t.Errorf("the failure does not name the manifest: %s", errOut)
	}
}
