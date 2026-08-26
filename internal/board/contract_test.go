package board

import (
	"fmt"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"testing"

	"github.com/ryannel/groundwork/internal/adapter"
	"github.com/ryannel/groundwork/internal/plan"
)

// R17: the derivation contract is written in the same commit as the code that
// reads the shape. Section 3 is this slice's, and the pins below read the
// page's structure rather than its words — D54 ruling 1, where one place is the
// source and the other carries a pin that a gutted table fails.
//
// D57 ruling 3 makes them read further than the shape. A pin that matched only
// each row's first cell guarded the table's skeleton and not its content: the
// reviewer flipped four verdicts on the page — merge trailers landing, doubled
// trailers landing, red and green swapped — and the suite stayed green (F77).
// So the verdict cells are what these tests drive.

const (
	contractSection = "## 3. Test naming and the `Slice` trailer"
	trailerTable    = "| What git found | What the board does | Is it red |"
	disagreeTable   = "| Expected | Actual | What it is | Is it red |"
)

// contractPage reads the derivation contract.
func contractPage(t *testing.T) string {
	t.Helper()

	raw, err := os.ReadFile(filepath.Join("..", "..", "docs", "derivation-contract.md"))
	if err != nil {
		t.Fatalf("the derivation contract did not read: %v", err)
	}

	page := string(raw)
	if !strings.Contains(page, contractSection) {
		t.Fatalf("the derivation contract holds no section titled %q", contractSection)
	}

	return page
}

// rowsOf returns the body rows of the table a heading line opens, each one cut
// into its cells. Every cell is read, because the cells are where the ruling
// lives.
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

// rowSaying finds the one table row whose first cell is this text.
func rowSaying(t *testing.T, rows [][]string, says string) []string {
	t.Helper()

	for _, cells := range rows {
		if cells[0] == says {
			return cells
		}
	}

	t.Fatalf("the page's table has no row for %q", says)

	return nil
}

// readVerdict reads a verdict cell. Only the two words the column is written in
// are accepted, so a cell somebody rewrote into prose is refused here rather
// than read as one of them.
//
// It is split from isRed so the refusal can be driven. A guard whose only exit
// is t.Fatalf cannot be tested through its caller, and this one had to be:
// without it a prose cell reads as "no", which passes by luck on every row whose
// verdict is no.
func readVerdict(cell string) (red, ok bool) {
	switch cell {
	case "yes":
		return true, true
	case "no":
		return false, true
	}

	return false, false
}

// isRed reads a verdict cell, or stops the test on a cell that is not one.
func isRed(t *testing.T, cell string) bool {
	t.Helper()

	red, ok := readVerdict(cell)
	if !ok {
		t.Fatalf("the page's verdict cell says %q, and a verdict is yes or no", cell)
	}

	return red
}

// The verdict column is the whole content of the page's ruling tables, so what
// counts as a verdict is narrow on purpose. A cell somebody rewrote into prose
// must be refused, not guessed at.
func TestAVerdictCellIsYesOrNoAndNothingElse(t *testing.T) {
	for cell, want := range map[string]bool{"yes": true, "no": false} {
		red, ok := readVerdict(cell)
		if !ok {
			t.Errorf("the verdict cell %q was refused", cell)
		}
		if red != want {
			t.Errorf("the verdict cell %q reads red=%v, want %v", cell, red, want)
		}
	}

	for _, cell := range []string{"", "Yes", "No", "no ", " yes", "not red", "n/a", "never", "0", "true"} {
		if _, ok := readVerdict(cell); ok {
			t.Errorf("the verdict cell %q was read as a verdict", cell)
		}
	}
}

// Every shape a Slice trailer can take is on the page, and the page says the
// same thing about each one that the code does — both what the board does with
// it and whether it is red.
//
// The cases below drive the real derivation against the page's own cells, so a
// flipped verdict fails here. The count is pinned too, so a shape the code
// learns without the page learning it fails here as well.
func TestTheContractNamesEveryShapeATrailerCanTake(t *testing.T) {
	cases := []struct {
		says  string
		claim Claim
		land  string
	}{
		{"One `Slice:` trailer naming a slice the plan declares",
			Claim{Commit: "a", Value: "s_one", Alone: true}, "s_one"},
		{"A trailer on a commit with more than one parent",
			Claim{Commit: "b", Value: "s_two", Alone: true, Merge: true}, ""},
		{"Two or more `Slice:` trailers on one commit",
			Claim{Commit: "c", Value: "s_two", Alone: false}, ""},
		{"A trailer with nothing after its colon",
			Claim{Commit: "d", Value: "", Alone: true}, ""},
		{"A trailer whose value is not an id",
			Claim{Commit: "e", Value: "S-ONE", Alone: true}, ""},
		{"A trailer naming no slice the plan declares",
			Claim{Commit: "f", Value: "s_nine", Alone: true}, ""},
	}

	rows := rowsOf(t, contractPage(t), trailerTable)

	// The already-landed row is driven by its own case below, because it needs
	// two claims to reach.
	if len(rows) != len(cases)+1 {
		t.Errorf("the page's trailer table holds %d rows and this test drives %d shapes",
			len(rows), len(cases)+1)
	}

	for _, c := range cases {
		t.Run(c.says, func(t *testing.T) {
			cells := rowSaying(t, rows, c.says)
			lands := strings.Contains(cells[1], "has landed")
			red := isRed(t, cells[2])

			b := Derive(demoSet(), History{Commits: 1, Claims: []Claim{c.claim}}, allPassing())

			if got := len(b.Landed) > 0; got != lands {
				t.Errorf("the board landed %v, and the page says the slice has landed is %v", b.Landed, lands)
			}
			if strings.Join(b.Landed, ",") != c.land {
				t.Errorf("the board landed %v, want %q", b.Landed, c.land)
			}
			if got := !b.Holds(); got != red {
				t.Errorf("the board reads red=%v, and the page says %v", got, red)
			}
			if got := len(b.Wrong) > 0; got != red {
				t.Errorf("the board called it a misstatement=%v, and the page says red=%v", got, red)
			}
			// A claim the board read landed a slice and names nothing; every
			// other claim is named exactly once, as one kind or the other.
			named := len(b.Wrong) + len(b.Unread)
			if want := 1 - len(b.Landed); named != want {
				t.Errorf("the board named %d wrong and %d unread trailers, want %d named",
					len(b.Wrong), len(b.Unread), want)
			}
		})
	}

	t.Run("A trailer naming a slice an earlier commit already landed", func(t *testing.T) {
		cells := rowSaying(t, rows, "A trailer naming a slice an earlier commit already landed")
		if !strings.Contains(cells[1], "has landed") {
			t.Errorf("the page says %q, and a slice claimed twice has landed", cells[1])
		}
		if isRed(t, cells[2]) {
			t.Error("the page calls a slice claimed twice red, and the code does not")
		}
		// D57 ruling 4: the page's "later commit" is the newer one, and the
		// stray is what gets named.
		if !strings.Contains(cells[1], "later commit is named") {
			t.Errorf("the page says %q, and it does not say which of the two is named", cells[1])
		}

		// Newest first, the way git hands them back.
		b := Derive(demoSet(), History{Commits: 2, Claims: []Claim{
			{Commit: "the_newer_commit", Value: "s_one", Alone: true},
			{Commit: "the_older_commit", Value: "s_one", Alone: true},
		}}, allPassing())

		if strings.Join(b.Landed, ",") != "s_one" || len(b.Wrong) != 0 || len(b.Unread) != 1 {
			t.Fatalf("a slice claimed twice read landed=%v wrong=%d unread=%d",
				b.Landed, len(b.Wrong), len(b.Unread))
		}
		if b.Unread[0].Commit != "the_newer_commit" {
			t.Errorf("the board named %q, and the page says the later commit is named", b.Unread[0].Commit)
		}
		if !b.Holds() {
			t.Error("a slice claimed twice turned the board red")
		}
	})
}

// The page's other table says which way a disagreement is red, and both
// directions are driven through the real derivation against its own cells.
func TestTheContractNamesBothDirectionsOfDisagreement(t *testing.T) {
	rows := rowsOf(t, contractPage(t), disagreeTable)

	if len(rows) != 2 {
		t.Fatalf("the page's disagreement table holds %d rows, want the two directions", len(rows))
	}

	for _, cells := range rows {
		t.Run(cells[0]+" and "+cells[1], func(t *testing.T) {
			red := isRed(t, cells[3])

			var b Board

			switch cells[0] {
			case string(ExpectRed):
				if cells[1] != string(Passed) {
					t.Fatalf("the page pairs expected red with %q, which is not the disagreement", cells[1])
				}
				// Nothing landed, so every milestone is unreached and every
				// proof is expected red. Every proof passes.
				b = Derive(demoSet(), landedAt(), allPassing())

				if len(b.Ahead()) == 0 {
					t.Fatal("green ahead of plan was not flagged")
				}

			case string(ExpectGreen):
				if !strings.Contains(cells[1], string(Passed)) {
					t.Fatalf("the page pairs expected green with %q, which names no outcome", cells[1])
				}
				run := allPassing()
				run.Outcomes["TestProof_p_one_it_holds"] = adapter.Fail
				b = Derive(demoSet(), landedAt("s_one", "s_two"), run)

				if len(b.Behind()) != 1 {
					t.Fatalf("the board counts %d proofs behind plan, want 1", len(b.Behind()))
				}

			default:
				t.Fatalf("the page's expected cell says %q, and a proof is expected red or green", cells[0])
			}

			if got := !b.Holds(); got != red {
				t.Errorf("the board reads red=%v, and the page says %v", got, red)
			}
		})
	}
}

// The two shapes the section is about are spelled on the page as this package
// spells them, and so are the numbers it holds somebody's file to. A page
// naming a different trailer, a different prefix or a different cap sends
// whoever reads it to write something the tools never look at.
func TestTheContractSpellsTheMarkerTheTrailerAndTheCaps(t *testing.T) {
	page := contractPage(t)

	for _, said := range []string{
		TrailerKey + ":",
		plan.MarkerPrefix + "<proof id>_",
		"^" + plan.MarkerPrefix,
		strconv.Itoa(MaxValueBytes) + " bytes",
		strconv.Itoa(maxPatternBytes) + " bytes",
	} {
		if !strings.Contains(page, said) {
			t.Errorf("the derivation contract never spells %q", said)
		}
	}
}

// The page says the pattern falls back when a plan outgrows the cap, so the
// number it writes has to be the number the code falls back at.
func TestTheContractWritesTheCapThePatternFallsBackAt(t *testing.T) {
	page := contractPage(t)

	at := strings.Index(page, fmt.Sprintf("%d bytes", maxPatternBytes))
	if at < 0 {
		t.Fatalf("the page never writes the pattern cap of %d bytes", maxPatternBytes)
	}
	if !strings.Contains(page[at:at+400], plan.MarkerPrefix) {
		t.Error("the page writes the pattern cap and never says what it falls back to")
	}
}
