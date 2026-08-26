package battery

import (
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"io/fs"
	"os"
	"path/filepath"
	"slices"
	"strconv"
	"strings"
	"testing"
	"unicode"

	"github.com/ryannel/groundwork/internal/adapter"
	"github.com/ryannel/groundwork/internal/board"
	"github.com/ryannel/groundwork/internal/journal"
	"github.com/ryannel/groundwork/internal/plan"
)

// The board row derives a board from three inputs and reconciles expected
// against actual. Every fixture below is a whole repo: the plan is files, the
// landed set is commits, and the run is a real run of the fixture's own tests.

// The plan every board fixture carries: one bet, two milestones, three slices,
// one proof each. It is the same plan at every landed position, so the only
// thing that moves between fixtures is git.
const (
	boardProgram = `---
id: demo
title: A demo program
goal: To prove a board derives
done: The board derives from the plan, git and the run
ladder:
  - id: demo_bet
    line: The one bet
    proof_sketch: The board derives
---

The program.
`

	boardBet = `---
id: demo_bet
title: The one bet
program: demo
design:
  - docs/design.md
milestones:
  - id: m_one
    title: The first milestone
  - id: m_two
    title: The second milestone
slices:
  - id: s_one
    milestone: m_one
  - id: s_two
    milestone: m_one
  - id: s_three
    milestone: m_two
---

The bet.
`
)

// boardSlicePlan is one slice's proof plan, written for a slice id, a milestone
// and a proof id.
func boardSlicePlan(slice, milestone, proof string) string {
	return fmt.Sprintf(`---
id: %s
bet: demo_bet
milestone: %s
proofs:
  - id: %s
    marker: TestProof_%s_it_holds
    from: docs/design.md#one
    headline: true
    retire_at_close: false
fixtures: []
real: []
faked: []
---

The slice.
`, slice, milestone, proof, proof)
}

// boardRepo makes a fixture repo carrying the plan above, a Go module whose
// tests carry the three proof markers, and one commit per landed slice.
//
// failing names the proofs whose test fails. landed names the slices whose
// commit carries a Slice trailer. Everything else is the same in every fixture.
func boardRepo(t *testing.T, failing []string, landed ...string) string {
	t.Helper()

	dir := newRepo(t)
	writeManifest(t, dir, goCLISurface)
	writeSource(t, dir, "go.mod", "module groundwork.test/fixture\n\ngo 1.24\n")
	writeSource(t, dir, "docs/design.md", "# The design\n\n## one\n\nThe shape.\n")
	writeSource(t, dir, "docs/plan/demo/program.md", boardProgram)
	writeSource(t, dir, "docs/plan/demo/demo_bet/bet.md", boardBet)
	writeSource(t, dir, "docs/plan/demo/demo_bet/s_one.md", boardSlicePlan("s_one", "m_one", "p_one"))
	writeSource(t, dir, "docs/plan/demo/demo_bet/s_two.md", boardSlicePlan("s_two", "m_one", "p_two"))
	writeSource(t, dir, "docs/plan/demo/demo_bet/s_three.md", boardSlicePlan("s_three", "m_two", "p_three"))

	writeSource(t, dir, "alpha/alpha.go", "package alpha\n\nfunc AddsUp(a, b int) int { return a + b }\n")

	var suite strings.Builder
	suite.WriteString("package alpha\n\nimport \"testing\"\n")
	for _, proof := range []string{"p_one", "p_two", "p_three"} {
		body := "\tif AddsUp(1, 1) != 2 {\n\t\tt.Fatal(\"arithmetic broke\")\n\t}\n"
		if slices.Contains(failing, proof) {
			body = "\tt.Fatal(\"this proof is not green yet\")\n"
		}
		fmt.Fprintf(&suite, "\nfunc TestProof_%s_it_holds(t *testing.T) {\n%s}\n", proof, body)
	}
	writeSource(t, dir, "alpha/alpha_test.go", suite.String())

	runGit(t, dir, "add", "-A")
	runGit(t, dir, "commit", "-m", "the plan and the proofs")

	for _, id := range landed {
		writeSource(t, dir, "landed/"+id+".txt", id+"\n")
		runGit(t, dir, "add", "-A")
		runGit(t, dir, "commit", "-m", "land "+id+"\n\nBet: demo\nSlice: "+id+"\nTests: the proof")
	}

	return dir
}

// runBoard runs the registered board row against dir with the recursion guard
// cleared. The row runs the fixture's own proofs, so these tests have to be the
// ones doing the running.
func runBoard(t *testing.T, dir string) Result {
	t.Helper()
	t.Setenv(adapter.RunGuardEnv, "")

	return runRow(t, dir, "board")
}

func TestTheBoardRowIsRegistered(t *testing.T) {
	registered(t, "board", "board")
}

// TestProof_b3s4_position_expected_state_comes_from_the_plan is R8 and R10's
// whole point: expected state is derived from where the plan sits in git, never
// from anything anyone wrote down.
//
// The same plan and the same tests sit at three landed positions. Nothing about
// the repo changes between them except which commits carry a Slice trailer, and
// the expected state moves anyway.
func TestProof_b3s4_position_expected_state_comes_from_the_plan(t *testing.T) {
	t.Run("one plan and one suite at three landed positions", func(t *testing.T) {
		cases := []struct {
			name   string
			landed []string
			ahead  int
		}{
			{"nothing landed", nil, 3},
			{"one whole milestone landed", []string{"s_one", "s_two"}, 1},
			{"every slice landed", []string{"s_one", "s_two", "s_three"}, 0},
		}

		var plans []string
		for _, c := range cases {
			dir := boardRepo(t, nil, c.landed...)
			plans = append(plans, partHash(t, dir, "docs/plan"), partHash(t, dir, "alpha"))

			res := runBoard(t, dir)
			if res.Outcome != Green {
				t.Fatalf("%s came out %s: %s", c.name, res.Outcome, res.Evidence)
			}
			mustFit(t, res.Evidence,
				"3 proofs", strconv.Itoa(len(c.landed))+" landed",
				strconv.Itoa(c.ahead)+" ahead of plan", "0 behind",
				"0 trailers misstated", "0 unread")
		}

		// The axis is the landed position and nothing else. If the plan or the
		// suite moved between fixtures, the cases above would be proving three
		// different things.
		for i := 2; i < len(plans); i++ {
			if plans[i] != plans[i%2] {
				t.Fatalf("fixture %d differs from the first outside git", i/2)
			}
		}
	})

	// R10: green ahead of plan is flagged, not silently accepted. The plan
	// lagging the work is the normal state between a test going green and its
	// commit landing, so it is named and counted and never red.
	t.Run("green ahead of its plan is named and never red", func(t *testing.T) {
		dir := boardRepo(t, nil)

		res := runBoard(t, dir)
		if res.Outcome != Green {
			t.Fatalf("a board ahead of its plan came out %s: %s", res.Outcome, res.Evidence)
		}
		mustFit(t, res.Evidence, "3 ahead of plan", "p_one")
	})

	// The other direction has no benign reading: a proof its plan expects green
	// that the run says is not green is work that regressed.
	t.Run("red behind its plan turns the row red", func(t *testing.T) {
		dir := boardRepo(t, []string{"p_one"}, "s_one", "s_two", "s_three")

		res := runBoard(t, dir)
		if res.Outcome != Red {
			t.Fatalf("a proof behind its plan came out %s: %s", res.Outcome, res.Evidence)
		}
		mustFit(t, res.Evidence, "1 behind", "p_one", "failed")

		// D33: the count leads, because the line is cut from the end.
		if !strings.HasPrefix(res.Evidence, "3 proofs") {
			t.Errorf("the line is %q, and it does not open with the counts", res.Evidence)
		}
	})
}

// TestProof_b3s4_silent_the_row_writes_no_file_at_all is the done-when's own
// sentence: the board is a derivation and never a file anyone edits. A
// derivation that writes is one small change away from a board a person can
// move by hand.
//
// Every path is proved, not just the green one (D53 ruling 2): the row that
// found nothing wrong, the row that went red, and the row that could not run
// all leave the repo byte for byte as they found it.
func TestProof_b3s4_silent_the_row_writes_no_file_at_all(t *testing.T) {
	cases := []struct {
		name string
		make func(t *testing.T) string
		want Outcome
	}{
		{"a green board", func(t *testing.T) string { return boardRepo(t, nil, "s_one") }, Green},
		{"a red board", func(t *testing.T) string {
			return boardRepo(t, []string{"p_one"}, "s_one", "s_two")
		}, Red},
		{"a board that could not run", func(t *testing.T) string {
			dir := boardRepo(t, nil)
			if err := os.Remove(filepath.Join(dir, "go.mod")); err != nil {
				t.Fatalf("could not break the fixture: %v", err)
			}

			return dir
		}, Unrunnable},
	}

	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			dir := c.make(t)

			before := treeState(t, dir)
			res := runBoard(t, dir)
			after := treeState(t, dir)

			if res.Outcome != c.want {
				t.Fatalf("the row came out %s, want %s: %s", res.Outcome, c.want, res.Evidence)
			}
			if moved := changedPaths(before, after); len(moved) > 0 {
				t.Fatalf("the row wrote to %d paths: %s", len(moved), strings.Join(moved, ", "))
			}
		})
	}
}

// treeState hashes every file under dir, the git directory included. The row is
// forbidden to write anything at all, so nothing is excluded from the reading.
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
			// A socket or a pipe is not a file the row could have written.
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

// partHash hashes one directory of a fixture, so a case can say that two
// fixtures differ only in git.
func partHash(t *testing.T, dir, under string) string {
	t.Helper()

	state := treeState(t, filepath.Join(dir, filepath.FromSlash(under)))

	paths := make([]string, 0, len(state))
	for path := range state {
		paths = append(paths, path)
	}
	slices.Sort(paths)

	h := sha256.New()
	for _, path := range paths {
		fmt.Fprintf(h, "%s\n%s\n", path, state[path])
	}

	return hex.EncodeToString(h.Sum(nil))
}

// A repo with no plan derives no board. There is nothing to reconcile, so there
// is nothing to misstate — the plan row's precedent, ruled in D45. The line says
// only that, and never claims a board held.
func TestBoardRowIsGreenOnARepoWithNoPlan(t *testing.T) {
	dir := newRepo(t)
	writeManifest(t, dir, goCLISurface)

	res := runBoard(t, dir)
	if res.Outcome != Green {
		t.Fatalf("a repo with no plan came out %s: %s", res.Outcome, res.Evidence)
	}
	mustFit(t, res.Evidence, "no docs/plan")
	if strings.Contains(res.Evidence, "ahead") {
		t.Errorf("the line is %q, and it claims a board was derived", res.Evidence)
	}
}

// A plan that is there and names no proof leaves nothing to reconcile, and a
// verifier may never pass on nothing (D17). It is unrunnable rather than red,
// because a plan that will not hold together is the plan row's own red and two
// rows red for one fault is two reds for one fix.
func TestBoardRowIsUnrunnableWhenThePlanNamesNoProof(t *testing.T) {
	dir := newRepo(t)
	writeManifest(t, dir, goCLISurface)
	writeSource(t, dir, "docs/plan/demo/program.md", boardProgram)

	res := runBoard(t, dir)
	if res.Outcome != Unrunnable {
		t.Fatalf("a plan with no proof came out %s: %s", res.Outcome, res.Evidence)
	}
	mustFit(t, res.Evidence, "no proof")
}

// A plan directory that is there and holds no plan file at all is unrunnable,
// not green — D17's rule, and the plan reader's own answer passed straight
// through. The branch was there and nothing drove it (F79).
func TestBoardRowIsUnrunnableWhenThePlanDirectoryHoldsNothing(t *testing.T) {
	dir := newRepo(t)
	writeManifest(t, dir, goCLISurface)
	if err := os.MkdirAll(filepath.Join(dir, "docs", "plan"), 0o750); err != nil {
		t.Fatalf("could not make the plan directory: %v", err)
	}

	res := runBoard(t, dir)
	if res.Outcome != Unrunnable {
		t.Fatalf("a plan directory holding nothing came out %s: %s", res.Outcome, res.Evidence)
	}

	// The plan reader's own sentence, passed straight through. A directory with
	// nothing in it and a plan that will not read are two different claims, and
	// a line that opened the same way for both would tell the reader neither.
	if !strings.HasPrefix(res.Evidence, plan.Dir+" is there") {
		t.Errorf("the row said %q, and it does not pass the plan reader's own answer through", res.Evidence)
	}
	mustFit(t, res.Evidence, "holds no plan file")
}

// A plan that will not read leaves the board with nothing to derive from. The
// plan row is the one that judges a plan, and it goes red on the same file.
func TestBoardRowIsUnrunnableWhenThePlanWillNotRead(t *testing.T) {
	dir := boardRepo(t, nil)
	writeSource(t, dir, "docs/plan/demo/demo_bet/s_one.md", "---\nid: nothing_like_it\n---\n")

	res := runBoard(t, dir)
	if res.Outcome != Unrunnable {
		t.Fatalf("a plan that will not read came out %s: %s", res.Outcome, res.Evidence)
	}
	if runRow(t, dir, "plan").Outcome != Red {
		t.Error("the plan row did not go red on the plan the board row declined to read")
	}
}

// The recursion guard. A project whose own suite calls the battery would
// otherwise run the suite inside the suite.
func TestBoardRowDoesNotStartASuiteInsideOne(t *testing.T) {
	dir := boardRepo(t, nil)
	t.Setenv(adapter.RunGuardEnv, "1")

	res := runRow(t, dir, "board")
	if res.Outcome != Unrunnable {
		t.Fatalf("the row inside a run came out %s: %s", res.Outcome, res.Evidence)
	}
	mustFit(t, res.Evidence, "inside")
}

// The row could not reach the thing it checks. Unrunnable is visible, counted,
// and somebody's problem.
func TestBoardRowIsUnrunnableOutsideARepo(t *testing.T) {
	res := runRow(t, t.TempDir(), "board")
	if res.Outcome != Unrunnable {
		t.Fatalf("the row outside a repo came out %s: %s", res.Outcome, res.Evidence)
	}
}

// A Slice trailer the board cannot read as landed-ness is a misstatement in one
// of the board's three inputs, and it is red with the trailer named. The plan
// row calls a plan that misstates itself red for the same reason: nothing else
// in the battery reads these trailers, so a board that only whispered would be
// the only reader of a lying input.
func TestBoardRowIsRedOnATrailerItCannotRead(t *testing.T) {
	dir := boardRepo(t, nil)
	writeSource(t, dir, "landed/typo.txt", "typo\n")
	runGit(t, dir, "add", "-A")
	runGit(t, dir, "commit", "-m", "land it\n\nSlice: s_nine")

	res := runBoard(t, dir)
	if res.Outcome != Red {
		t.Fatalf("a trailer naming no slice came out %s: %s", res.Outcome, res.Evidence)
	}
	mustFit(t, res.Evidence, "s_nine", "1 trailer misstated", "0 unread")
}

// D57 ruling 4, through the real row: the oldest claim is the landing and the
// newer one is the stray named. A reader chasing the named commit must land on
// the stray, not on the commit that actually did the work (F78).
func TestBoardRowNamesTheLaterOfTwoCommitsClaimingOneSlice(t *testing.T) {
	dir := boardRepo(t, nil, "s_one")
	earlier := runGit(t, dir, "rev-parse", "HEAD")

	writeSource(t, dir, "landed/again.txt", "again\n")
	runGit(t, dir, "add", "-A")
	runGit(t, dir, "commit", "-m", "land it again\n\nSlice: s_one")
	later := runGit(t, dir, "rev-parse", "HEAD")

	res := runBoard(t, dir)
	if res.Outcome != Green {
		t.Fatalf("one slice claimed twice came out %s: %s", res.Outcome, res.Evidence)
	}
	mustFit(t, res.Evidence, "1 landed", "0 trailers misstated", "1 unread",
		cutTo(later, shortCommitBytes), "earlier commit already landed")
	if strings.Contains(res.Evidence, cutTo(earlier, shortCommitBytes)) {
		t.Errorf("the row named the earlier commit as the stray: %s", res.Evidence)
	}
}

// D38 and D40: merges never govern. One slice is one commit, and a merge is not
// that commit, so a Slice trailer on a merge is counted and named and never
// read — and never red, because it misstates nothing about the id space.
func TestBoardRowNamesATrailerOnAMergeAndIsNotRedForIt(t *testing.T) {
	dir := boardRepo(t, nil)
	runGit(t, dir, "checkout", "-q", "-b", "side")
	writeSource(t, dir, "landed/side.txt", "side\n")
	runGit(t, dir, "add", "-A")
	runGit(t, dir, "commit", "-m", "side work")
	runGit(t, dir, "checkout", "-q", "main")
	runGit(t, dir, "merge", "--no-ff", "-m", "merge side\n\nSlice: s_one", "side")

	res := runBoard(t, dir)
	if res.Outcome != Green {
		t.Fatalf("a trailer on a merge came out %s: %s", res.Outcome, res.Evidence)
	}
	mustFit(t, res.Evidence, "0 trailers misstated", "1 unread", "merge")
	if strings.Contains(res.Evidence, "1 landed") {
		t.Errorf("the merge commit landed a slice: %s", res.Evidence)
	}
}

// F49 and D49 ruling 2. A commit trailer is free text written by whoever can
// write a commit, and in this environment that is any agent. A newline or a tab
// in one would otherwise draw a row of its own in the verify table.
func TestNothingTheBoardRowSaysCarriesAControlCharacter(t *testing.T) {
	// A misstated trailer, whose reason is the longest this row prints. The
	// value gives way to the reason on a line this wide (D57 ruling 6), so what
	// is proved here is that nothing which does reach the line can draw a row.
	t.Run("a trailer that misstates", func(t *testing.T) {
		dir := boardRepo(t, nil)
		writeSource(t, dir, "message.txt", "hostile\n\nSlice: s_one\tboard\n")
		runGit(t, dir, "add", "-A")
		runGit(t, dir, "commit", "-F", filepath.Join(dir, "message.txt"))

		res := runBoard(t, dir)
		if res.Outcome != Red {
			t.Fatalf("a trailer outside the id charset came out %s: %s", res.Outcome, res.Evidence)
		}
		mustBePrintable(t, res.Evidence)
		mustFit(t, res.Evidence, "is not an id")
	})

	// A trailer the board declines to read has a short reason, so the value
	// itself reaches the line — and it reaches it with its tab already turned
	// into a space.
	t.Run("a trailer on a merge commit", func(t *testing.T) {
		dir := boardRepo(t, nil)
		runGit(t, dir, "checkout", "-q", "-b", "side")
		writeSource(t, dir, "landed/side.txt", "side\n")
		runGit(t, dir, "add", "-A")
		runGit(t, dir, "commit", "-m", "side work")
		runGit(t, dir, "checkout", "-q", "main")
		writeSource(t, dir, "message.txt", "merge side\n\nSlice: s_one\tboard\n")
		runGit(t, dir, "add", "-A")
		runGit(t, dir, "commit", "-m", "keep the message file")
		runGit(t, dir, "merge", "--no-ff", "-F", filepath.Join(dir, "message.txt"), "side")

		res := runBoard(t, dir)
		if res.Outcome != Green {
			t.Fatalf("a trailer on a merge came out %s: %s", res.Outcome, res.Evidence)
		}
		mustBePrintable(t, res.Evidence)
		mustFit(t, res.Evidence, "s_one board", "merge")
	})
}

// mustBePrintable holds a line of evidence to D49 ruling 2: nothing on it may
// draw a row of its own in the table it is printed in.
func mustBePrintable(t *testing.T, evidence string) {
	t.Helper()

	for _, r := range evidence {
		if !unicode.IsPrint(r) {
			t.Errorf("the row said %q, and it holds the unprintable character %q", evidence, r)
		}
	}
	if strings.Contains(evidence, "\n") || strings.Contains(evidence, "\t") {
		t.Errorf("the row said %q, and a table would draw a second row from it", evidence)
	}
}

// A shallow clone cannot see all of its own history, so the landed count it
// read may be short. The row says so rather than passing the count off as
// whole, and it says it in the head, beside the count it qualifies.
//
// It is not unrunnable. History a clone cannot see can only leave a slice
// unlanded, which moves a proof toward expected red — the flagged direction,
// never a silent pass over a regression. The waiver counter's shallow rule goes
// the other way because its miss goes the other way: there, history nobody can
// see counts as zero grants and passes a threshold.
func TestBoardRowSaysWhenTheHistoryIsShallow(t *testing.T) {
	dir := boardRepo(t, nil, "s_one", "s_two")

	whole := runBoard(t, dir)
	if strings.Contains(whole.Evidence, "shallow") {
		t.Errorf("a whole history read as shallow: %s", whole.Evidence)
	}
	mustFit(t, whole.Evidence, "2 landed")

	clone := filepath.Join(t.TempDir(), "shallow")
	runGit(t, t.TempDir(), "clone", "-q", "--depth", "1", "file://"+dir, clone)

	res := runBoard(t, clone)
	if res.Outcome != Green {
		t.Fatalf("a shallow clone came out %s: %s", res.Outcome, res.Evidence)
	}
	// The clone can see one of the two landing commits, so the landed count is
	// short — and the line says which of the two it is reading.
	mustFit(t, res.Evidence, "1 landed (shallow)")
}

// F76 and D57 ruling 2. A signal the row only shows when something else is
// already wrong is aimed the wrong way: a folded double answer misleads most on
// a board that otherwise looks clean. So the clauses ride the branch with
// nothing to name too.
//
// The board here is as clean as one gets — every slice landed, every proof on
// plan, nothing at all to name — and it still has to say that one test name
// came back from two suites.
func TestACleanBoardStillSaysOneTestCameFromTwoSuites(t *testing.T) {
	dir := boardRepo(t, nil, "s_one", "s_two", "s_three")

	clean := runBoard(t, dir)
	if clean.Outcome != Green {
		t.Fatalf("a landed board came out %s: %s", clean.Outcome, clean.Evidence)
	}
	mustFit(t, clean.Evidence, "every proof sits where its plan puts it")
	if strings.Contains(clean.Evidence, "more than one suite") {
		t.Fatalf("a board with one suite claimed two: %s", clean.Evidence)
	}

	// A second suite holding a test of the same name.
	writeSource(t, dir, "beta/beta.go", "package beta\n\nfunc AddsUp(a, b int) int { return a + b }\n")
	writeSource(t, dir, "beta/beta_test.go",
		"package beta\n\nimport \"testing\"\n\n"+
			"func TestProof_p_one_it_holds(t *testing.T) {\n\tif AddsUp(1, 1) != 2 {\n\t\tt.Fatal(\"no\")\n\t}\n}\n")
	runGit(t, dir, "add", "-A")
	runGit(t, dir, "commit", "-m", "a second suite of the same name")

	res := runBoard(t, dir)
	if res.Outcome != Green {
		t.Fatalf("two suites reporting one name came out %s: %s", res.Outcome, res.Evidence)
	}
	mustFit(t, res.Evidence, "1 test was reported by more than one suite")
}

// A row's evidence is read on a machine that is not the one that wrote it, so a
// temporary directory in a line of evidence says nothing to the reader.
func TestBoardRowEvidenceNeverCarriesAMachinePath(t *testing.T) {
	dir := boardRepo(t, nil)

	res := runBoard(t, dir)
	if strings.Contains(res.Evidence, dir) || strings.Contains(res.Evidence, os.TempDir()) {
		t.Errorf("the row said %q, and it carries a path from the machine it ran on", res.Evidence)
	}
}

// D57 ruling 6: in a hit's give-way ladder the reason outranks the value. A
// trailer at the width the contract page allows cannot fit whole beside the
// head, and what a reader needs off the line is what the row concluded — the
// value itself can be fetched from the commit the line already names.
//
// F79 is where the ladder had this the other way round: the widest wrong
// trailer kept its 64 bytes of value and dropped its why.
func TestAWrongTrailerAtItsFullWidthKeepsItsWhy(t *testing.T) {
	dir := boardRepo(t, nil)

	// A value at the page's own cap, and outside the id charset by its last
	// character, so the reason is the longest this row prints.
	value := strings.Repeat("v", board.MaxValueBytes-1) + "A"
	writeSource(t, dir, "landed/wide.txt", "wide\n")
	runGit(t, dir, "add", "-A")
	runGit(t, dir, "commit", "-m", "land it\n\nSlice: "+value)
	commit := runGit(t, dir, "rev-parse", "HEAD")

	res := runBoard(t, dir)
	if res.Outcome != Red {
		t.Fatalf("a trailer outside the id charset came out %s: %s", res.Outcome, res.Evidence)
	}

	// The case only proves what it claims if the whole hit cannot fit.
	whole := hit{
		file:    fmt.Sprintf("%q", value),
		subject: "on " + cutTo(commit, shortCommitBytes),
		shape:   "is not an id: it holds 'A', which is not a lowercase letter, a digit or an underscore",
	}
	if len(whole.String()) < journal.MaxTextBytes/2 {
		t.Fatalf("the hit renders to %d bytes, which is not the wide case", len(whole.String()))
	}

	mustFit(t, res.Evidence, "is not an id", cutTo(commit, shortCommitBytes))
}

// F54's class, third entry. The arithmetic that proves a line fits has to
// measure the true widest line, and the true widest is found by searching
// rather than by feeding the maximum into every field at once.
//
// Every count is in the head, where no cut can reach it: D33 rules that words
// give way and counts never do, and F61 is what happens when a loud count rides
// in a clause instead.
//
// The search samples the boundary rather than the whole cross product. The head
// is monotone in every count — a wider number is a wider line, and the plural
// spelling is wider than the singular — so the widest sits at an extreme, and a
// full cross product of six axes buys nothing but time. F80 is what that time
// cost: eleven values on six axes is 1.7 million tuples, and the eight seconds
// this test used to take became seventy-five, which pushed this package's own
// suite past the deletion test's per-mutant clock.
//
// So each axis is walked through its interesting values with the others pinned
// at both extremes, and the two all-one-value tuples are added. The middles are
// there to pin the wording — the singular and plural spellings both — and the
// extremes are there to find the widest.
func TestTheBoardRowLineIsWidestSomewhereInTheCountSpace(t *testing.T) {
	tails := [][]string{nil, {"x"}, {strings.Repeat("c", 120)}}
	shapes := [][]hit{
		nil,
		{{file: "p_one", shape: "is green on plan and failed in the run"}},
		{{file: strings.Repeat("p", 300), shape: strings.Repeat("s", 300)}},
	}

	widest, at := 0, ""

	for _, counts := range countTuples() {
		for _, shallow := range []bool{false, true} {
			for _, hits := range shapes {
				for _, clauses := range tails {
					totals := boardTotals{
						proofs: counts[0], landed: counts[1], ahead: counts[2],
						behind: counts[3], misstated: counts[4], unread: counts[5],
						shallow: shallow, hits: hits, clauses: clauses,
					}

					got := totals.verdict().Evidence
					if len(got) > journal.MaxTextBytes {
						t.Fatalf("the line is %d bytes, over the journal's cap of %d: %s",
							len(got), journal.MaxTextBytes, got)
					}
					if len(got) > widest {
						widest, at = len(got), fmt.Sprintf("%+v", totals)
					}

					// D33: the counts never give way. D52.3 and F75: the two
					// trailer states are counted apart on every line, so a red
					// cause can never read as a benign one. And each count is
					// spelled the way a person writes it, singular for one.
					for _, want := range []string{
						counted(totals.proofs, "proof", "proofs"),
						strconv.Itoa(totals.landed) + " landed",
						strconv.Itoa(totals.ahead) + " ahead of plan",
						strconv.Itoa(totals.behind) + " behind",
						counted(totals.misstated, "trailer misstated", "trailers misstated"),
						strconv.Itoa(totals.unread) + " unread",
					} {
						if !strings.Contains(got, want) {
							t.Fatalf("the line %q does not say %q", got, want)
						}
					}
				}
			}
		}
	}

	t.Logf("the widest line the search found is %d bytes, at %s", widest, at)

	if widest < journal.MaxTextBytes/2 {
		t.Errorf("the widest line found is %d bytes, and the search never came near the cap", widest)
	}
}

// countTuples is the boundary of the count space: every axis walked through the
// values that change how it is spelled or how wide it prints, with every other
// axis pinned at each extreme, plus the two tuples where every axis agrees.
//
// The line's width is monotone in each count, so this holds the widest the full
// cross product would have found while building a few hundred tuples instead of
// a million.
func countTuples() [][6]int {
	const most = 1<<62 - 1

	interesting := []int{0, 1, 2, 9, 10, 99, 100, 999, 1000, 1 << 20, most}

	var tuples [][6]int
	for _, pinned := range []int{0, most} {
		var all [6]int
		for i := range all {
			all[i] = pinned
		}
		tuples = append(tuples, all)

		for axis := range all {
			for _, value := range interesting {
				one := all
				one[axis] = value
				tuples = append(tuples, one)
			}
		}
	}

	return tuples
}

func TestThisRepoDeclaresTheBumpTheBoardRowCost(t *testing.T) {
	lock, err := ReadLock(".")
	if err != nil {
		t.Fatalf("this repo's lock file did not read: %v", err)
	}

	if lock.Digest != Default().Digest() {
		t.Errorf("%s declares the digest %s, and the shipped rows compute %s",
			LockFile, lock.Digest, Default().Digest())
	}

	half, _, _ := strings.Cut(lock.Version, ".")
	major, err := strconv.Atoi(half)
	if err != nil {
		t.Fatalf("%s declares the version %q, whose major half is not a number", LockFile, lock.Version)
	}
	if major < 9 {
		t.Errorf("%s declares %s, and the board row puts this battery at 9.0 or past it",
			LockFile, lock.Version)
	}
}
