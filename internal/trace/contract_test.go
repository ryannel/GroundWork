package trace

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/ryannel/groundwork/internal/plan"
)

// R17: the derivation contract is written in the same commit as the code that
// reads the shape. Section 4 is this slice's.
//
// The pin reads the page's structure, not its words (D54 ruling 1), and it
// drives the verdict cells (D57 ruling 3): every row of the page's table is
// built as a real report, and a cell somebody flips fails here. A pin that
// checked only the first cell would guard the table's skeleton and not the
// ruling it carries.
const (
	traceSection = "## 4. Two-direction traceability and premises"
	traceTable   = "| What the row read | What it is | Is it red |"
)

// contractPage reads the derivation contract and fails when this slice's
// section is not on it.
func contractPage(t *testing.T) string {
	t.Helper()

	raw, err := os.ReadFile(filepath.Join("..", "..", "docs", "derivation-contract.md"))
	if err != nil {
		t.Fatalf("the derivation contract did not read: %v", err)
	}

	page := string(raw)
	if !strings.Contains(page, traceSection) {
		t.Fatalf("the derivation contract holds no section titled %q", traceSection)
	}

	return page
}

// rowsOf returns the body rows of the table a heading line opens, cut into
// cells.
func rowsOf(t *testing.T, page, heading string) [][]string {
	t.Helper()

	at := strings.Index(page, heading)
	if at < 0 {
		t.Fatalf("the derivation contract holds no table opening %q", heading)
	}

	want := len(cellsOf(heading))

	var found [][]string
	for i, line := range strings.Split(page[at:], "\n") {
		if i < 2 {
			// The heading itself, and the separator under it.
			continue
		}
		if !strings.HasPrefix(line, "|") {
			break
		}

		cells := cellsOf(line)
		if len(cells) != want {
			t.Fatalf("the row %q holds %d cells and its heading holds %d", line, len(cells), want)
		}
		found = append(found, cells)
	}

	if len(found) == 0 {
		t.Fatalf("the table opening %q holds no row at all", heading)
	}

	return found
}

// cellsOf cuts one markdown table line into its cells.
func cellsOf(line string) []string {
	var cells []string
	for _, cell := range strings.Split(strings.Trim(line, "|"), "|") {
		cells = append(cells, strings.TrimSpace(cell))
	}

	return cells
}

// readVerdict reads a verdict cell. Only the two words the column is written in
// are accepted, so a cell somebody rewrote into prose is refused here rather
// than read as one of them — a prose cell would otherwise pass by luck on every
// row whose verdict is no.
func readVerdict(cell string) (red, ok bool) {
	switch cell {
	case "yes":
		return true, true
	case "no":
		return false, true
	default:
		return false, false
	}
}

// tableRow is one row of the page's table, as this test drives it: the middle
// cell's words, what the report has to hold, and the fixture that builds it.
//
// The middle cell is driven too. A pin that read the first and last cells only
// guarded the table's skeleton and left its middle column a gut cell — somebody
// could rewrite what a state IS and nothing would fail (F97).
type tableRow struct {
	is    string
	holds func(t *testing.T, rep Report)
	build func(t *testing.T) Report
}

// holds turns one assertion about a report into the shape a table row carries.
func holds(check func(t *testing.T, rep Report)) func(t *testing.T, rep Report) {
	return check
}

// What each row of the page's table has to be true of the report. The verdict
// cell says whether the state is red; these say the state happened at all. A
// mark and an unsealed thing are never red, so without them a row could pass by
// producing nothing.
func noDangling(t *testing.T, rep Report) {
	t.Helper()

	if len(rep.Dangling) != 0 {
		t.Fatalf("the report holds %d dangling anchors, want none: %+v", len(rep.Dangling), rep.Dangling)
	}
	if rep.Proofs != 1 {
		t.Fatalf("the report counted %d proofs, want 1", rep.Proofs)
	}
}

func oneDangling(t *testing.T, rep Report) {
	t.Helper()

	if len(rep.Dangling) != 1 {
		t.Fatalf("the report holds %d dangling anchors, want 1: %+v", len(rep.Dangling), rep.Dangling)
	}
}

func oneUnclaimed(t *testing.T, rep Report) {
	t.Helper()

	if len(rep.Unclaimed) != 1 {
		t.Fatalf("the report holds %d unclaimed facing ids, want 1: %+v", len(rep.Unclaimed), rep.Unclaimed)
	}
}

func oneTwice(t *testing.T, rep Report) {
	t.Helper()

	if len(rep.Twice) != 1 {
		t.Fatalf("the report holds %d ids claimed twice, want 1: %+v", len(rep.Twice), rep.Twice)
	}
}

func oneMark(t *testing.T, rep Report) {
	t.Helper()

	if len(rep.Marked) != 1 {
		t.Fatalf("the report marks %d bets, want 1: %+v", len(rep.Marked), rep.Marked)
	}
}

func oneUnsealedDesign(t *testing.T, rep Report) {
	t.Helper()

	if len(rep.UnsealedDesign) != 1 {
		t.Fatalf("the report holds %d unsealed design files, want 1: %+v",
			len(rep.UnsealedDesign), rep.UnsealedDesign)
	}
}

func oneUnsealedPremise(t *testing.T, rep Report) {
	t.Helper()

	if len(rep.UnsealedPremise) != 1 {
		t.Fatalf("the report holds %d unsealed premises, want 1: %+v",
			len(rep.UnsealedPremise), rep.UnsealedPremise)
	}
}

// nothingNamed is the row that produced no finding of its own kind: the claim
// resolved, and the report holds no unclaimed id and no doubled one.
func nothingNamed(t *testing.T, rep Report) {
	t.Helper()

	if len(rep.Unclaimed)+len(rep.Twice) != 0 {
		t.Fatalf("the report holds %d unclaimed and %d doubled facing ids, want none",
			len(rep.Unclaimed), len(rep.Twice))
	}
	if rep.Facing != 1 {
		t.Fatalf("the report counted %d facing ids, want 1", rep.Facing)
	}
}

// The page and the code agree on every verdict: each row of the page's table is
// built as a real report, and the page's own cell is held against what the code
// does with it.
//
// The name is not a proof marker. b3s6 declares three proofs, and a fourth test
// wearing the marker prefix would be a proof the plan never declared — which is
// the drift this row exists to catch.
func TestTheContractPageAndTheRowAgreeOnEveryVerdict(t *testing.T) {
	cases := map[string]tableRow{
		"The anchor names a heading in the file": {"Traced", holds(noDangling), func(t *testing.T) Report {
			return report(t, fixture{slices: []plan.Slice{
				oneSlice("demo_s1", "r1--the-first-ruling-b7"),
			}})
		}},
		"The anchor names no heading in the file": {"A proof pointing at nothing", holds(oneDangling), func(t *testing.T) Report {
			return report(t, fixture{slices: []plan.Slice{
				oneSlice("demo_s1", "r9--nobody-wrote-this"),
			}})
		}},
		"The design file could not be read": {"An anchor nobody could resolve", holds(oneDangling), func(t *testing.T) Report {
			dir := newRepo(t)

			return checked(t, dir, fixture{slices: []plan.Slice{
				oneSlice("demo_s1", "r1--the-first-ruling-b7"),
			}}.set())
		}},
		"No seal covers the design file": {"Unsealed, and loud", holds(oneUnsealedDesign), func(t *testing.T) Report {
			return report(t, fixture{slices: []plan.Slice{
				oneSlice("demo_s1", "r1--the-first-ruling-b7"),
			}})
		}},
		"A facing id one slice claims": {"Claimed once", holds(nothingNamed), func(t *testing.T) Report {
			return report(t, fixture{
				facing: []plan.Facing{{ID: "f_one", Line: "One."}},
				slices: []plan.Slice{oneSlice("demo_s1", "r1--the-first-ruling-b7", "f_one")},
			})
		}},
		"A facing id no slice claims and no deferral records": {"Unclaimed and unrecorded", holds(oneUnclaimed), func(t *testing.T) Report {
			return report(t, fixture{
				facing: []plan.Facing{{ID: "f_one", Line: "One."}},
				slices: []plan.Slice{oneSlice("demo_s1", "r1--the-first-ruling-b7")},
			})
		}},
		"A facing id two slices claim": {"Claimed twice", holds(oneTwice), func(t *testing.T) Report {
			return report(t, fixture{
				facing: []plan.Facing{{ID: "f_one", Line: "One."}},
				slices: []plan.Slice{
					oneSlice("demo_s1", "r1--the-first-ruling-b7", "f_one"),
					oneSlice("demo_s2", "r2--the-second-ruling", "f_one"),
				},
			})
		}},
		"A facing id one slice claims and the bet defers": {"Two answers to one question", holds(oneTwice), func(t *testing.T) Report {
			return report(t, fixture{
				facing:   []plan.Facing{{ID: "f_one", Line: "One."}},
				deferred: []plan.Deferral{{ID: "f_one", Reason: "the next bet"}},
				slices:   []plan.Slice{oneSlice("demo_s1", "r1--the-first-ruling-b7", "f_one")},
			})
		}},
		"A facing id the bet defers with a reason": {"Recorded", holds(nothingNamed), func(t *testing.T) Report {
			return report(t, fixture{
				facing:   []plan.Facing{{ID: "f_one", Line: "One."}},
				deferred: []plan.Deferral{{ID: "f_one", Reason: "the next bet"}},
				slices:   []plan.Slice{oneSlice("demo_s1", "r1--the-first-ruling-b7")},
			})
		}},
		"A premise whose artifact the record says was amended": {"A bet standing on moved ground", holds(oneMark), func(t *testing.T) Report {
			dir := sealedRepo(t, "docs/design.md", "b3_design")
			amend(t, dir, "b3_design")

			return checked(t, dir, fixture{
				premises: []string{"b3_design"},
				slices:   []plan.Slice{oneSlice("demo_s1", "r1--the-first-ruling-b7")},
			}.set())
		}},
		"A premise whose artifact the record says was withdrawn": {"A bet standing on moved ground", holds(oneMark), func(t *testing.T) Report {
			dir := sealedRepo(t, "docs/design.md", "b3_design")
			withdraw(t, dir, "b3_design")

			return checked(t, dir, fixture{
				premises: []string{"b3_design"},
				slices:   []plan.Slice{oneSlice("demo_s1", "r1--the-first-ruling-b7")},
			}.set())
		}},
		// D61 ruling 1: the mark falls on every bet whose premises name the
		// artifact, across programs. Nothing about the mark reads a program.
		"A premise in one program naming an artifact sealed under another": {
			"A bet standing on moved ground", holds(oneMark), func(t *testing.T) Report {
				dir := sealedRepo(t, "docs/design.md", "b3_design")
				amend(t, dir, "b3_design")

				set := fixture{
					premises: []string{"b3_design"},
					slices:   []plan.Slice{oneSlice("demo_s1", "r1--the-first-ruling-b7")},
				}.set()
				set.Bets[0].Path = "docs/plan/other/other_bet/bet.md"
				set.Bets[0].ID = "other_bet"
				set.Slices[0].Path = "docs/plan/other/other_bet/demo_s1.md"

				return checked(t, dir, set)
			}},
		// And the same ruling's other half: later is satisfied by construction, so
		// even the first bet on a ladder is marked when the artifact it stands on
		// moves. A premise is a sealed artifact, and a bet citing one came after it.
		"A premise of the first bet on a ladder whose artifact moved": {
			"A bet standing on moved ground", holds(oneMark), func(t *testing.T) Report {
				dir := sealedRepo(t, "docs/design.md", "b3_design")
				amend(t, dir, "b3_design")

				set := fixture{
					premises: []string{"b3_design"},
					slices:   []plan.Slice{oneSlice("demo_s1", "r1--the-first-ruling-b7")},
				}.set()
				set.Programs = []plan.Program{{
					Path:   "docs/plan/demo/program.md",
					ID:     "demo",
					Ladder: []plan.LadderEntry{{ID: "demo_bet"}, {ID: "later_bet"}},
				}}

				return checked(t, dir, set)
			}},
		"A premise no seal names": {"Unsealed, and loud", holds(oneUnsealedPremise), func(t *testing.T) Report {
			return report(t, fixture{
				premises: []string{"b3_design"},
				slices:   []plan.Slice{oneSlice("demo_s1", "r1--the-first-ruling-b7")},
			})
		}},
	}

	rows := rowsOf(t, contractPage(t), traceTable)
	if len(rows) != len(cases) {
		t.Fatalf("the page's table holds %d rows and this test drives %d of them", len(rows), len(cases))
	}

	for _, cells := range rows {
		row, held := cases[cells[0]]
		if !held {
			t.Fatalf("the page's table has a row for %q and nothing here drives it", cells[0])
		}

		red, ok := readVerdict(cells[2])
		if !ok {
			t.Fatalf("the row %q has the verdict cell %q, and the column holds yes or no", cells[0], cells[2])
		}

		t.Run(cells[0], func(t *testing.T) {
			if cells[1] != row.is {
				t.Fatalf("the page calls %q %q, and the code makes it %q", cells[0], cells[1], row.is)
			}

			rep := row.build(t)

			if got := !rep.Sound(); got != red {
				t.Fatalf("the page says red is %v for %q, and the row makes it %v", red, cells[0], got)
			}

			row.holds(t, rep)
		})
	}
}

// report builds a repo holding the fixture design file and checks the set
// against it.
func report(t *testing.T, f fixture) Report {
	t.Helper()

	dir := newRepo(t)
	write(t, dir, "docs/design.md", design)
	commit(t, dir, "docs/design.md")

	return checked(t, dir, f.set())
}

// checked runs the check and fails the test when it could not run at all.
func checked(t *testing.T, dir string, set plan.Set) Report {
	t.Helper()

	rep, err := Check(dir, set)
	if err != nil {
		t.Fatalf("the check failed: %v", err)
	}

	return rep
}

// The cap is a number in two places, so a test holds them together — the shape
// the plan parser's caps have had since slice 1 (F98, re-entering F95's class).
// A page that states a cap the code does not hold is a page a reader plans
// around and then meets something else.
func TestThePageWritesTheCapTheRowHolds(t *testing.T) {
	page := contractPage(t)

	said := fmt.Sprintf("%d bytes", MaxDesignBytes)
	if !strings.Contains(page, said) {
		t.Errorf("the row caps a design file at %q, and the contract page never writes that", said)
	}

	// The same holding, for the refusal that has no number: the page quotes the
	// row's own words for a read that leaves the repo.
	if !strings.Contains(page, outsideTheRepo) {
		t.Errorf("the row refuses a read that %q, and the contract page never says so", outsideTheRepo)
	}
}

// The page says what the slug rule is, and a design author reads it there. The
// pin holds the page to the rule the code applies rather than to a sentence
// somebody wrote once.
func TestThePageSpellsTheSlugTheCodeComputes(t *testing.T) {
	page := contractPage(t)

	for _, heading := range []string{"## R1 — The first ruling (B7)", "### 1.1 `program.md`"} {
		for anchor := range anchorsIn(heading + "\n") {
			if !strings.Contains(page, anchor) {
				t.Errorf("the heading %q makes the anchor %q, and the page does not show it", heading, anchor)
			}
		}
	}
}
