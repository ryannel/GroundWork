package battery

import (
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"slices"
	"strings"
	"testing"

	"github.com/ryannel/groundwork/internal/journal"
)

// R17: the derivation contract is written in the same commit as the code that
// reads the shape. Section 5 is this slice's.
//
// The pins read the page's structure, not its words (D54 ruling 1), and they
// drive the verdict cells (D57 ruling 3): every row of every table on the page
// is built as a real run of a real row, and a cell somebody flips fails here. A
// pin that checked only the first cell would guard the table's skeleton and not
// the ruling it carries (F97).
const (
	recordSection  = "## 5. Records, grants counted, and the shape of the history"
	recordTable    = "| What the record row read | What it is | Is it red |"
	counterTable   = "| What the waiver counter read | What it is | Is it red |"
	shapeTable     = "| What the history row read | What it is | Is it red |"
	contractPageAt = "docs/derivation-contract.md"
)

// contractPage reads the derivation contract and fails when this slice's
// section is not on it.
func contractPage(t *testing.T) string {
	t.Helper()

	raw, err := os.ReadFile(filepath.Join("..", "..", filepath.FromSlash(contractPageAt)))
	if err != nil {
		t.Fatalf("the derivation contract did not read: %v", err)
	}

	page := string(raw)
	if !strings.Contains(page, recordSection) {
		t.Fatalf("the derivation contract holds no section titled %q", recordSection)
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

// tableRow is one row of a page table, as this test drives it: the middle
// cell's words, and the fixture that builds a real run of the row.
//
// The middle cell is driven too. A pin that read the first and last cells only
// guarded the table's skeleton and left its middle column a gut cell — somebody
// could rewrite what a state IS and nothing would fail (F97).
type tableRow struct {
	is    string
	build func(t *testing.T) Result
}

// drive holds one page table against the row it describes: every cell of every
// line, and the verdict from a real run.
func drive(t *testing.T, page, heading string, cases map[string]tableRow) {
	t.Helper()

	rows := rowsOf(t, page, heading)
	if len(rows) != len(cases) {
		t.Fatalf("the table opening %q holds %d rows and this test drives %d of them",
			heading, len(rows), len(cases))
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

			res := row.build(t)
			if got := res.Outcome == Red; got != red {
				t.Fatalf("the page says red is %v for %q, and the row came out %s: %s",
					red, cells[0], res.Outcome, res.Evidence)
			}
		})
	}
}

func TestTheContractPageAndTheRecordRowAgreeOnEveryVerdict(t *testing.T) {
	drive(t, contractPage(t), recordTable, map[string]tableRow{
		"A declared record in the tree, newer than the slice's commit": {"Current", func(t *testing.T) Result {
			dir := recordRepo(t, recordPath)
			commitAll(t, dir, "the plan")
			writeSource(t, dir, "alpha/alpha.go", "package alpha\n")
			land(t, dir, "demo_s1")
			writeSource(t, dir, recordPath, "# The record\n")
			commitAll(t, dir, "write the record up")

			return runRow(t, dir, "record")
		}},
		"A declared record written in the slice's own commit": {"Current", func(t *testing.T) Result {
			dir := recordRepo(t, recordPath)
			commitAll(t, dir, "the plan")
			writeSource(t, dir, "alpha/alpha.go", "package alpha\n")
			writeSource(t, dir, recordPath, "# The record\n")
			land(t, dir, "demo_s1")

			return runRow(t, dir, "record")
		}},
		"A declared record that is not a file in the tree": {"A record nobody wrote", func(t *testing.T) Result {
			dir := recordRepo(t, recordPath)
			commitAll(t, dir, "the plan")
			writeSource(t, dir, "alpha/alpha.go", "package alpha\n")
			land(t, dir, "demo_s1")

			return runRow(t, dir, "record")
		}},
		"A declared record edited since it landed": {"Its committed copy is current", func(t *testing.T) Result {
			dir := recordRepo(t, recordPath)
			commitAll(t, dir, "the plan")
			writeSource(t, dir, "alpha/alpha.go", "package alpha\n")
			writeSource(t, dir, recordPath, "# The record\n")
			land(t, dir, "demo_s1")
			writeSource(t, dir, recordPath, "# The record, edited and not committed\n")

			return runRow(t, dir, "record")
		}},
		"A declared record of a slice whose landing is past the shallow edge": {
			"Unseen, and not judged", func(t *testing.T) Result {
				dir := recordRepo(t, recordPath)
				writeSource(t, dir, recordPath, "# The record\n")
				commitAll(t, dir, "the plan and the record")
				writeSource(t, dir, "alpha/alpha.go", "package alpha\n")
				land(t, dir, "demo_s1")
				writeSource(t, dir, "alpha/beta.go", "package alpha\n\nvar Beta = 2\n")
				commitAll(t, dir, "later work with no slice trailer")

				return runRow(t, shallowClone(t, dir), "record")
			}},
		"A declared record dated to the edge of a shallow clone": {
			"Unjudged rather than believed", func(t *testing.T) Result {
				dir := recordRepo(t, recordPath)
				writeSource(t, dir, recordPath, "# The record\n")
				commitAll(t, dir, "the plan and the record")
				writeSource(t, dir, "alpha/alpha.go", "package alpha\n")
				land(t, dir, "demo_s1")

				return runRow(t, shallowClone(t, dir), "record")
			}},
		"A declared record no commit in a whole clone holds": {"A record nobody committed", func(t *testing.T) Result {
			dir := recordRepo(t, recordPath)
			commitAll(t, dir, "the plan")
			writeSource(t, dir, "alpha/alpha.go", "package alpha\n")
			land(t, dir, "demo_s1")
			writeSource(t, dir, recordPath, "# The record, never committed\n")

			return runRow(t, dir, "record")
		}},
		"A declared record whose last commit the slice's commit comes after": {
			"Older than the work it describes", func(t *testing.T) Result {
				dir := recordRepo(t, recordPath)
				writeSource(t, dir, recordPath, "# The record\n")
				commitAll(t, dir, "the plan and the record")
				writeSource(t, dir, "alpha/alpha.go", "package alpha\n")
				land(t, dir, "demo_s1")

				return runRow(t, dir, "record")
			}},
		"A declared record of a slice that has not landed": {"Not owed yet", func(t *testing.T) Result {
			dir := recordRepo(t, recordPath)
			commitAll(t, dir, "the plan, with no slice landed")

			return runRow(t, dir, "record")
		}},
		"A slice that declares no record": {"Nothing to owe", func(t *testing.T) Result {
			dir := recordRepo(t)
			commitAll(t, dir, "the plan")
			writeSource(t, dir, "alpha/alpha.go", "package alpha\n")
			land(t, dir, "demo_s1")

			return runRow(t, dir, "record")
		}},
	})
}

func TestTheContractPageAndTheWaiverCounterAgreeOnEveryVerdict(t *testing.T) {
	drive(t, contractPage(t), counterTable, map[string]tableRow{
		"Two grants of a row in one bet, four across the repo": {"Under both limits", func(t *testing.T) Result {
			dir := newRepo(t)
			declareBets(t, dir, "bet_1", "bet_2", "bet_3")
			grant(t, dir, "honesty-20260801-aaaa.json", "honesty", "bet_1")
			grant(t, dir, "honesty-20260802-bbbb.json", "honesty", "bet_1")
			grant(t, dir, "honesty-20260803-cccc.json", "honesty", "bet_2")
			grant(t, dir, "honesty-20260804-dddd.json", "honesty", "bet_3")

			return runRow(t, dir, "waiver-count")
		}},
		"Three grants of one row inside one bet": {
			"At the bet's limit, and no finding names it", func(t *testing.T) Result {
				return runRow(t, thriceWaived(t), "waiver-count")
			}},
		"Five grants of one row across the repo": {
			"At the repo's limit, and no finding names it", func(t *testing.T) Result {
				dir := newRepo(t)
				bets := []string{"bet_1", "bet_2", "bet_3", "bet_4", "bet_5"}
				declareBets(t, dir, bets...)
				for i, bet := range bets {
					grant(t, dir, fmt.Sprintf("honesty-2026080%d-aaaa.json", i+1), "honesty", bet)
				}

				return runRow(t, dir, "waiver-count")
			}},
		"Three grants of one row whose title carries the phrase": {
			"At a limit, and answered", func(t *testing.T) Result {
				dir := thriceWaived(t)
				writeFindings(t, dir, "The honesty row keeps going red on generated code")

				return runRow(t, dir, "waiver-count")
			}},
		"Three grants of one row a title names by bare word": {
			"At a limit, and unanswered", func(t *testing.T) Result {
				dir := thriceWaived(t)
				writeFindings(t, dir, "Honesty about what the spend query counts")

				return runRow(t, dir, "waiver-count")
			}},
		"Three grants under three bet names nobody declared": {
			"Three in the unattributed bucket", func(t *testing.T) Result {
				dir := newRepo(t)
				declareBets(t, dir, "bet_1")
				for i := range grantsPerBet {
					grant(t, dir, fmt.Sprintf("honesty-2026080%d-aaaa.json", i+1), "honesty",
						fmt.Sprintf("invented_%d", i))
				}

				return runRow(t, dir, "waiver-count")
			}},
		"Two grants of one row, then a tidy-up git mv": {
			"A move decides nothing", func(t *testing.T) Result {
				dir := newRepo(t)
				declareBets(t, dir, "bet_1")
				grant(t, dir, "honesty-20260801-aaaa.json", "honesty", "bet_1")
				regrant(t, dir, "honesty-20260801-aaaa.json", "honesty", "bet_1", "the row is still wrong")
				runGit(t, dir, "mv", WaiverDir+"/honesty-20260801-aaaa.json", WaiverDir+"/honesty-20260901-bbbb.json")
				runGit(t, dir, "commit", "-m", "tidy the waiver's name\n\nBet: bet_1\nTests: none")

				// Two grants and one move. Reading the move as a third grant
				// would put this row at the limit, so the verdict cell beside
				// this line is the whole difference the rule makes.
				return runRow(t, dir, "waiver-count")
			}},
		"A new waiver at a dead waiver's path": {
			"A new file, with no inherited grants", func(t *testing.T) Result {
				dir := newRepo(t)
				declareBets(t, dir, "bet_1")

				const at = "honesty-20260801-aaaa.json"
				grant(t, dir, at, "honesty", "bet_1")
				for _, reason := range []string{"still wrong", "wrong again", "wrong a fourth time"} {
					regrant(t, dir, at, "honesty", "bet_1", reason)
				}
				runGit(t, dir, "rm", "-q", WaiverDir+"/"+at)
				runGit(t, dir, "commit", "-m", "the waiver expired\n\nBet: bet_1\nTests: none")

				writeSource(t, dir, WaiverDir+"/"+at,
					"{\"v\":1,\"row\":\"wiring\",\"reason\":\"the wiring row is wrong\",\"granted\":\"2026-08-01\",\"expires\":\"2026-08-20\"}\n")
				runGit(t, dir, "add", WaiverDir+"/"+at)
				runGit(t, dir, "commit", "-m", "waive wiring\n\nBet: bet_1\nTests: none")

				return runRow(t, dir, "waiver-count")
			}},
		"A merge that changed a waiver file": {"Not a granting act", func(t *testing.T) Result {
			// Two grants and one merge. Reading the merge as a third grant would
			// put this row at the bet's limit, so the verdict cell beside this
			// line is the whole difference the rule makes.
			return runRow(t, mergedOverAWaiver(t), "waiver-count")
		}},
		"A file in the waiver directory that is not a waiver": {
			"Naming no row, so nobody's grant", func(t *testing.T) Result {
				dir := newRepo(t)
				declareBets(t, dir, "bet_1")
				writeSource(t, dir, WaiverDir+"/notes.txt", "not a waiver\n")
				runGit(t, dir, "add", "-A")
				runGit(t, dir, "commit", "-m", "a stray file\n\nBet: bet_1\nTests: none")

				return runRow(t, dir, "waiver-count")
			}},
		"A repo that waives nothing, whole history present": {"A real zero", func(t *testing.T) Result {
			return runRow(t, newRepo(t), "waiver-count")
		}},
	})
}

// thriceWaived is one waiver file granted and re-granted twice inside one bet,
// which is the bet threshold exactly.
func thriceWaived(t *testing.T) string {
	t.Helper()

	dir := newRepo(t)
	declareBets(t, dir, "bet_1")
	grant(t, dir, "honesty-20260801-aaaa.json", "honesty", "bet_1")
	regrant(t, dir, "honesty-20260801-aaaa.json", "honesty", "bet_1", "the row is still wrong")
	regrant(t, dir, "honesty-20260801-aaaa.json", "honesty", "bet_1", "the row is wrong a third time")

	return dir
}

func TestTheContractPageAndTheHistoryRowAgreeOnEveryVerdict(t *testing.T) {
	drive(t, contractPage(t), shapeTable, map[string]tableRow{
		"A bet closed on a merge commit": {"Every trailer still readable", func(t *testing.T) Result {
			dir := newRepo(t)
			closeABet(t, dir, false)

			return runRow(t, dir, "history")
		}},
		"A bet closed on a squash": {"Trailers the board can no longer read", func(t *testing.T) Result {
			dir := newRepo(t)
			closeABet(t, dir, true)

			return runRow(t, dir, "history")
		}},
		"A merge commit quoting its branch's messages": {"A merge doing its job", func(t *testing.T) Result {
			dir := newRepo(t)
			runGit(t, dir, "checkout", "-q", "-b", "side")
			writeSource(t, dir, "alpha/one.go", "package alpha\n")
			commitAll(t, dir, "slice one\n\nBet: demo_bet\nSlice: demo_s1\nTests: yes")
			runGit(t, dir, "checkout", "-q", "-")
			runGit(t, dir, "merge", "--no-ff", "-m",
				"the merge\n\nquoting the branch:\n\n    Slice: demo_s1\n    Slice: demo_s2", "side")

			return runRow(t, dir, "history")
		}},
		"A lone quoted Slice line in a paragraph of prose": {
			"Somebody writing about a slice", func(t *testing.T) Result {
				dir := newRepo(t)
				writeSource(t, dir, "docs/findings.md", "# Findings\n")
				commitAll(t, dir, "Record the review\n\nThe entry says the commit carrying\n"+
					"Slice: demo_s1\nwas the one that landed it.\n\nBet: demo_bet\nTests: none")

				return runRow(t, dir, "history")
			}},
		"A squash whose message kept no quoted trailers": {
			"Invisible, and named as the limit", func(t *testing.T) Result {
				dir := newRepo(t)
				runGit(t, dir, "checkout", "-q", "-b", "side")
				writeSource(t, dir, "alpha/one.go", "package alpha\n")
				commitAll(t, dir, "slice one\n\nBet: demo_bet\nSlice: demo_s1\nTests: yes")
				runGit(t, dir, "checkout", "-q", "-")
				runGit(t, dir, "merge", "--squash", "side")
				runGit(t, dir, "commit", "-m", "close the bet")

				return runRow(t, dir, "history")
			}},
		"A history naming no slice at all": {"Nothing to erase", func(t *testing.T) Result {
			return runRow(t, newRepo(t), "history")
		}},
	})
}

// The page writes the close scope, and a reader plans a bet close around it. A
// page listing a row the tool does not require, or missing one it does, would
// be a page somebody follows into a close that checks something else.
func TestThePageWritesTheCloseScopeTheToolChecks(t *testing.T) {
	page := contractPage(t)

	for _, row := range CloseScope() {
		if !strings.Contains(page, "`"+row+"`") {
			t.Errorf("the close scope names the row %s, and the contract page never writes it", row)
		}
	}

	// And the other direction: every name the page's close-scope sentence backticks
	// is a row the scope holds. Without this the page could list a fifth row and
	// nothing would notice.
	const opens = "The **close-scope list** is"
	at := strings.Index(page, opens)
	if at < 0 {
		t.Fatalf("the contract page holds no sentence opening %q", opens)
	}

	line, _, _ := strings.Cut(page[at:], "\n")

	named := backticked.FindAllStringSubmatch(line, -1)
	if len(named) != len(CloseScope()) {
		t.Fatalf("the page's close-scope sentence names %d rows and the scope holds %d: %s",
			len(named), len(CloseScope()), line)
	}
	for _, match := range named {
		if !slices.Contains(CloseScope(), match[1]) {
			t.Errorf("the page's close-scope sentence names %q, and the scope does not hold it", match[1])
		}
	}
}

// backticked matches one row id written in backticks on the page.
var backticked = regexp.MustCompile("`([a-z0-9-]+)`")

// The page states the two thresholds a reader plans around, so they are held to
// the numbers the code holds. A page that states a limit the code does not is a
// page somebody plans around and then meets something else (F98).
func TestThePageWritesTheThresholdsTheRowHolds(t *testing.T) {
	page := contractPage(t)

	for _, said := range []string{
		fmt.Sprintf("%d grants of one row inside one bet", grantsPerBet),
		fmt.Sprintf("%d grants of one row across the repo", grantsPerRepo),
		fmt.Sprintf("longer than %d bytes", journal.MaxMessageBytes),
		fmt.Sprintf("%d or more trailer-shaped lines", clusterSize),
	} {
		if !strings.Contains(page, said) {
			t.Errorf("the row holds %q, and the contract page never writes that", said)
		}
	}
}

// The page names the directory and the trailer the two rows read, in the code's
// own spelling. A second spelling on the page is a reader looking in the wrong
// place.
func TestThePageWritesTheNamesTheRowsRead(t *testing.T) {
	page := contractPage(t)

	for _, said := range []string{WaiverDir, "`Slice` lines", "`records`"} {
		if !strings.Contains(page, said) {
			t.Errorf("the contract page never writes %q, which the rows read", said)
		}
	}
}
