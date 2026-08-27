package battery

import (
	"fmt"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"testing"

	"github.com/ryannel/groundwork/internal/findings"
	"github.com/ryannel/groundwork/internal/journal"
)

// The waiver counter's fixture. Every grant is a commit of its own touching one
// waiver file, which is the shape D24 asks of a grant and the shape D38 makes
// the authority read.

// grant writes a waiver file naming a row and commits it on its own, under a
// message carrying the bet the grant landed in.
func grant(t *testing.T, dir, name, row, bet string) {
	t.Helper()

	body := fmt.Sprintf("{\"v\":1,\"row\":%q,\"reason\":%q,\"granted\":\"2026-08-01\",\"expires\":\"2026-08-20\"}\n",
		row, "the row is wrong about "+name)
	writeSource(t, dir, WaiverDir+"/"+name, body)

	runGit(t, dir, "add", WaiverDir+"/"+name)
	runGit(t, dir, "commit", "-m", "waive "+row+"\n\nBet: "+bet+"\nTests: none")
}

// regrant rewrites a waiver file in a commit of its own, which D24's letter
// allows and which the counter reads as another grant.
func regrant(t *testing.T, dir, name, row, bet, reason string) {
	t.Helper()

	body := fmt.Sprintf("{\"v\":1,\"row\":%q,\"reason\":%q,\"granted\":\"2026-08-01\",\"expires\":\"2026-08-20\"}\n",
		row, reason)
	writeSource(t, dir, WaiverDir+"/"+name, body)

	runGit(t, dir, "add", WaiverDir+"/"+name)
	runGit(t, dir, "commit", "-m", "re-grant "+row+"\n\nBet: "+bet+"\nTests: none")
}

// writeFindings puts a findings ledger at the repo root, holding one entry per
// title given.
func writeFindings(t *testing.T, dir string, titles ...string) {
	t.Helper()

	page := "# Findings\n"
	for i, title := range titles {
		page += fmt.Sprintf("\n## F%d — 2026-08-27 — %s\n\nCaught by: battery — the waiver counter\nClass: friction-waived\n",
			i+1, title)
	}

	writeSource(t, dir, "docs/findings.md", page)
	runGit(t, dir, "add", "docs/findings.md")
	runGit(t, dir, "commit", "-m", "record the finding\n\nBet: demo_bet\nTests: none")
}

// shallowClone clones a repo one commit deep, which is the state this host's
// own clones are all in.
func shallowClone(t *testing.T, dir string) string {
	t.Helper()

	return shallowCloneAt(t, dir, 1)
}

// shallowCloneAt clones a repo a given number of commits deep. A clone deeper
// than one has commits with parents inside it, which is what tells the edge
// from an ordinary commit.
func shallowCloneAt(t *testing.T, dir string, depth int) string {
	t.Helper()

	clone := filepath.Join(t.TempDir(), "shallow")
	runGit(t, dir, "clone", "--quiet", "--depth", strconv.Itoa(depth), "file://"+dir, clone)

	if !strings.Contains(runGit(t, clone, "rev-parse", "--is-shallow-repository"), "true") {
		t.Fatal("the clone did not come back shallow, so this fixture proves nothing")
	}

	return clone
}

// declareBets writes a plan declaring the bets given, so the counter has
// something to hold a grant's Bet trailer against. A repo with no plan declares
// no bet, and every attribution there pools.
func declareBets(t *testing.T, dir string, bets ...string) {
	t.Helper()

	program := "---\nid: demo\ntitle: The demo program\ngoal: Show what a plan file looks like.\ndone: One committed file per unit.\nladder:\n"
	for _, bet := range bets {
		program += "  - id: " + bet + "\n    line: A bet with files of its own.\n    proof_sketch: The reader parses its files.\n"
	}
	program += "---\n\nProse.\n"

	files := map[string]string{
		"docs/design.md":            "# The design\n",
		"docs/plan/demo/program.md": program,
	}
	for _, bet := range bets {
		files["docs/plan/demo/"+bet+"/bet.md"] = fmt.Sprintf(
			"---\nid: %s\ntitle: The %s bet\nprogram: demo\ndesign:\n  - docs/design.md\nmilestones:\n  - id: %s_m1\n    title: The first milestone\nslices:\n  - id: %s_s1\n    milestone: %s_m1\n---\n\nProse.\n",
			bet, bet, bet, bet, bet)
		files["docs/plan/demo/"+bet+"/"+bet+"_s1.md"] = fmt.Sprintf(
			"---\nid: %s_s1\nbet: %s\nmilestone: %s_m1\nproofs:\n  - id: %s_p1\n    marker: TestProof_%s_p1_the_table_prints\n    from: docs/design.md#one\n    headline: true\n    retire_at_close: false\nfixtures:\n  - an empty table and a full one\nreal:\n  - the parser\nfaked: []\n---\n\nProse.\n",
			bet, bet, bet, bet, bet)
	}

	writePlanFiles(t, dir, files)
	runGit(t, dir, "add", "docs")
	runGit(t, dir, "commit", "-m", "the plan\n\nBet: "+bets[0]+"\nTests: none")
}

func TestWaiverCountRowIsRegistered(t *testing.T) {
	registered(t, "waiver-count", "waiver-count")
}

// TestProof_b3s7_counter_three_grants_of_one_row_hold_it_red is R14's counter:
// three grants of one row inside one bet, and that row stays red until a
// finding names it.
func TestProof_b3s7_counter_three_grants_of_one_row_hold_it_red(t *testing.T) {
	build := func(t *testing.T) string {
		t.Helper()

		dir := newRepo(t)
		declareBets(t, dir, "demo_bet")
		grant(t, dir, "honesty-20260801-aaaa.json", "honesty", "demo_bet")
		regrant(t, dir, "honesty-20260801-aaaa.json", "honesty", "demo_bet", "the row is still wrong")
		regrant(t, dir, "honesty-20260801-aaaa.json", "honesty", "demo_bet", "the row is wrong a third time")

		return dir
	}

	t.Run("no finding names the row", func(t *testing.T) {
		dir := build(t)

		res := runRow(t, dir, "waiver-count")
		if res.Outcome != Red {
			t.Fatalf("three grants of one row in one bet came out %s: %s", res.Outcome, res.Evidence)
		}
		mustFit(t, res.Evidence, "honesty", "3 grants", "demo_bet")
	})

	t.Run("a finding names the row", func(t *testing.T) {
		dir := build(t)
		writeFindings(t, dir, "The honesty row keeps going red on generated code")

		res := runRow(t, dir, "waiver-count")
		if res.Outcome != Green {
			t.Fatalf("a named row came out %s: %s", res.Outcome, res.Evidence)
		}
		mustFit(t, res.Evidence, "honesty", "and a finding names it")
	})
}

// The second threshold: five grants of one row across the repo, whatever bets
// they landed in.
func TestWaiverCountRowRedsFiveGrantsOfOneRowAcrossTheRepo(t *testing.T) {
	dir := newRepo(t)
	bets := []string{"bet_1", "bet_2", "bet_3", "bet_4", "bet_5"}
	declareBets(t, dir, bets...)
	for i, bet := range bets {
		grant(t, dir, fmt.Sprintf("honesty-2026080%d-aaaa.json", i+1), "honesty", bet)
	}

	res := runRow(t, dir, "waiver-count")
	if res.Outcome != Red {
		t.Fatalf("five grants across the repo came out %s: %s", res.Outcome, res.Evidence)
	}
	mustFit(t, res.Evidence, "honesty", "5 grants")
}

// Under both thresholds is green: two grants in a bet, four in the repo.
func TestWaiverCountRowIsGreenUnderBothThresholds(t *testing.T) {
	dir := newRepo(t)
	declareBets(t, dir, "bet_1", "bet_2", "bet_3")
	grant(t, dir, "honesty-20260801-aaaa.json", "honesty", "bet_1")
	grant(t, dir, "honesty-20260802-bbbb.json", "honesty", "bet_1")
	grant(t, dir, "honesty-20260803-cccc.json", "honesty", "bet_2")
	grant(t, dir, "honesty-20260804-dddd.json", "honesty", "bet_3")

	res := runRow(t, dir, "waiver-count")
	if res.Outcome != Green {
		t.Fatalf("four grants across three bets came out %s: %s", res.Outcome, res.Evidence)
	}
	mustFit(t, res.Evidence, "4 grants", "0 rows at a limit", "0 misstated")
}

// A repo that waives nothing has no row at a threshold. Its grant history is
// all here and it holds nothing, which is an answer rather than a hole.
func TestWaiverCountRowIsGreenOnARepoThatWaivesNothing(t *testing.T) {
	res := runRow(t, newRepo(t), "waiver-count")
	if res.Outcome != Green {
		t.Fatalf("a repo with no waivers came out %s: %s", res.Outcome, res.Evidence)
	}
	mustFit(t, res.Evidence, "0 waiver files")
}

// R14: a shallow clone cannot see the grant history, so the row reports
// unrunnable and never counts zero. That is D17's rule — a verifier may never
// pass on nothing — and the line says why, not just that.
//
// D56 ruling 3 sends the board row the other way on the same fact, and rightly:
// the board's miss leaves a slice unlanded, which is the flagged direction,
// while an unseen grant reads as zero and passes a threshold.
func TestTheShallowRuleSendsTheCounterToUnrunnable(t *testing.T) {
	dir := newRepo(t)
	declareBets(t, dir, "demo_bet")
	grant(t, dir, "honesty-20260801-aaaa.json", "honesty", "demo_bet")
	regrant(t, dir, "honesty-20260801-aaaa.json", "honesty", "demo_bet", "the row is still wrong")
	regrant(t, dir, "honesty-20260801-aaaa.json", "honesty", "demo_bet", "the row is wrong a third time")

	clone := shallowClone(t, dir)

	res := runRow(t, clone, "waiver-count")
	if res.Outcome != Unrunnable {
		t.Fatalf("a shallow clone came out %s: %s", res.Outcome, res.Evidence)
	}
	mustFit(t, res.Evidence, "shallow", "grant")
}

// D38 and D40: a merge is not a granting act. A merge that touched a waiver
// file is counted and named, never read as a grant — the same rule the waiver
// authority already applies, in the same words.
func TestWaiverCountRowDoesNotCountAMerge(t *testing.T) {
	res := runRow(t, mergedOverAWaiver(t), "waiver-count")

	// Three grants, two of them inside bet_2, and one merge inside bet_2 too.
	// Reading the merge as a grant would put bet_2 at the limit of three, so the
	// green here is the rule doing its work rather than a fixture that happened
	// to stay under.
	if res.Outcome != Green {
		t.Fatalf("a merge over a waiver file came out %s: %s", res.Outcome, res.Evidence)
	}
	mustFit(t, res.Evidence, "3 grants", "1 merges", "0 rows at a limit")
}

// mergedOverAWaiver builds a repo where one waiver file was granted on two
// branches at once and the merge resolved the collision.
//
// The merge has to touch the file to be listed against it at all — git's own
// history simplification passes over a merge that matches a parent — so both
// sides write the file and the merge writes it a third way. That is the evil
// merge D38 names: a person editing a waiver where two branches met.
func mergedOverAWaiver(t *testing.T) string {
	t.Helper()

	dir := newRepo(t)
	declareBets(t, dir, "bet_1", "bet_2")
	grant(t, dir, "honesty-20260801-aaaa.json", "honesty", "bet_1")

	runGit(t, dir, "checkout", "-q", "-b", "side")
	regrant(t, dir, "honesty-20260801-aaaa.json", "honesty", "bet_2", "re-granted on the branch")
	runGit(t, dir, "checkout", "-q", "-")
	regrant(t, dir, "honesty-20260801-aaaa.json", "honesty", "bet_2", "re-granted on the trunk")

	if _, err := tryGit(dir, "merge", "--no-ff", "-m", "the merge", "side"); err == nil {
		t.Fatal("the merge did not conflict, so it does not touch the waiver file")
	}
	writeSource(t, dir, WaiverDir+"/honesty-20260801-aaaa.json",
		"{\"v\":1,\"row\":\"honesty\",\"reason\":\"resolved in the merge\",\"granted\":\"2026-08-01\",\"expires\":\"2026-08-20\"}\n")
	runGit(t, dir, "add", WaiverDir+"/honesty-20260801-aaaa.json")
	runGit(t, dir, "commit", "-m", "the merge\n\nBet: bet_2\nTests: none")

	return dir
}

// D65 ruling 2: a pure rename decides nothing, so it is counted and named and
// never read as a grant. Two honest grants plus one tidy-up move stay under the
// limit, and the move is on the line.
func TestWaiverCountRowDoesNotReadARenameAsAGrant(t *testing.T) {
	dir := newRepo(t)
	declareBets(t, dir, "demo_bet")
	grant(t, dir, "honesty-20260801-aaaa.json", "honesty", "demo_bet")
	regrant(t, dir, "honesty-20260801-aaaa.json", "honesty", "demo_bet", "the row is still wrong")

	runGit(t, dir, "mv", WaiverDir+"/honesty-20260801-aaaa.json", WaiverDir+"/honesty-20260901-bbbb.json")
	runGit(t, dir, "commit", "-m", "tidy the waiver's name\n\nBet: demo_bet\nTests: none")

	res := runRow(t, dir, "waiver-count")
	if res.Outcome != Green {
		t.Fatalf("a tidy-up rename tripped the threshold: %s", res.Evidence)
	}
	mustFit(t, res.Evidence, "2 grants", "1 rename not read", "was moved in")
}

// D65 ruling 1: a path reused after a deletion is a new file. A new waiver
// arriving where a dead one sat does not inherit its grants.
func TestWaiverCountRowDoesNotInheritADeadWaiversGrants(t *testing.T) {
	dir := newRepo(t)
	declareBets(t, dir, "demo_bet")

	const at = "honesty-20260801-aaaa.json"
	grant(t, dir, at, "honesty", "demo_bet")
	for _, reason := range []string{"still wrong", "wrong again", "wrong a fourth time"} {
		regrant(t, dir, at, "honesty", "demo_bet", reason)
	}

	runGit(t, dir, "rm", "-q", WaiverDir+"/"+at)
	runGit(t, dir, "commit", "-m", "the waiver expired\n\nBet: demo_bet\nTests: none")

	// A new waiver, for a different row, at the dead one's path.
	writeSource(t, dir, WaiverDir+"/"+at,
		"{\"v\":1,\"row\":\"wiring\",\"reason\":\"the wiring row is wrong\",\"granted\":\"2026-08-01\",\"expires\":\"2026-08-20\"}\n")
	runGit(t, dir, "add", WaiverDir+"/"+at)
	runGit(t, dir, "commit", "-m", "waive wiring\n\nBet: demo_bet\nTests: none")

	res := runRow(t, dir, "waiver-count")
	if res.Outcome != Green {
		t.Fatalf("a new waiver inherited the dead one's grants: %s", res.Evidence)
	}
	mustFit(t, res.Evidence, "1 grant", "0 rows at a limit")
	if strings.Contains(res.Evidence, "wiring has") {
		t.Errorf("the wiring row was charged for a dead waiver's grants: %s", res.Evidence)
	}
}

// A file the run cannot read as a waiver names no row, so it can be nobody's
// grant. It is counted and named rather than passed over, which is D38's rule
// about the same directory.
func TestWaiverCountRowNamesAFileThatIsNotAWaiver(t *testing.T) {
	dir := newRepo(t)
	writeSource(t, dir, WaiverDir+"/notes.txt", "not a waiver\n")
	runGit(t, dir, "add", "-A")
	runGit(t, dir, "commit", "-m", "a stray file\n\nBet: demo_bet\nTests: none")

	res := runRow(t, dir, "waiver-count")
	if res.Outcome != Green {
		t.Fatalf("a stray file came out %s: %s", res.Outcome, res.Evidence)
	}
	mustFit(t, res.Evidence, "is not a waiver this tool can read")
}

// D64 ruling 5: a misstated attribution never weakens a threshold. Grants whose
// Bet trailer fails the board's four validity shapes pool into one bucket that
// shares the per-bet limit, so three of them are three inside one bucket.
//
// Three shapes, one rule: a commit naming no bet, a commit naming a bet nobody
// declared, and a commit carrying two Bet trailers.
func TestWaiverCountRowPoolsEveryMisstatedAttribution(t *testing.T) {
	cases := map[string]string{
		"no bet at all":       "waive honesty",
		"a bet nobody wrote":  "waive honesty\n\nBet: invented_bet\nTests: none",
		"two bets on one":     "waive honesty\n\nBet: demo_bet\nBet: other_bet\nTests: none",
		"a bet with no value": "waive honesty\n\nBet:\nTests: none",
	}

	for name, message := range cases {
		t.Run(name, func(t *testing.T) {
			dir := newRepo(t)
			declareBets(t, dir, "demo_bet", "other_bet")

			for i := range grantsPerBet {
				file := fmt.Sprintf("%s/honesty-2026080%d-aaaa.json", WaiverDir, i+1)
				writeSource(t, dir, file, fmt.Sprintf(
					"{\"v\":1,\"row\":\"honesty\",\"reason\":\"reason %d\",\"granted\":\"2026-08-01\",\"expires\":\"2026-08-20\"}\n", i))
				runGit(t, dir, "add", file)
				runGit(t, dir, "commit", "-m", message)
			}

			res := runRow(t, dir, "waiver-count")
			if res.Outcome != Red {
				t.Fatalf("three misstated grants came out %s: %s", res.Outcome, res.Evidence)
			}
			mustFit(t, res.Evidence, "3 misstated", "the unattributed bucket")
		})
	}
}

// D64 ruling 5's other half: a rename is not a fresh start. git mv on a waiver
// moves the file and leaves the waiver in force, and the count follows it.
func TestWaiverCountRowFollowsARenamedWaiver(t *testing.T) {
	dir := newRepo(t)
	declareBets(t, dir, "demo_bet")
	grant(t, dir, "honesty-20260801-aaaa.json", "honesty", "demo_bet")
	regrant(t, dir, "honesty-20260801-aaaa.json", "honesty", "demo_bet", "the row is still wrong")

	regrant(t, dir, "honesty-20260801-aaaa.json", "honesty", "demo_bet", "the row is wrong a third time")

	runGit(t, dir, "mv", WaiverDir+"/honesty-20260801-aaaa.json", WaiverDir+"/honesty-20260901-bbbb.json")
	runGit(t, dir, "commit", "-m", "move the waiver\n\nBet: demo_bet\nTests: none")

	res := runRow(t, dir, "waiver-count")
	if res.Outcome != Red {
		t.Fatalf("a renamed waiver reset its count: %s", res.Evidence)
	}
	mustFit(t, res.Evidence, "3 grants", "honesty")
}

// And a waiver that merely resembles another is not the same waiver. git
// reports that as a copy, and folding copies together would count one waiver's
// grants against a file nobody moved.
func TestWaiverCountRowDoesNotFoldTwoLookalikeWaivers(t *testing.T) {
	dir := newRepo(t)
	declareBets(t, dir, "demo_bet")
	grant(t, dir, "honesty-20260801-aaaa.json", "honesty", "demo_bet")
	grant(t, dir, "honesty-20260802-bbbb.json", "honesty", "demo_bet")

	res := runRow(t, dir, "waiver-count")
	if res.Outcome != Green {
		t.Fatalf("two lookalike waivers came out %s: %s", res.Outcome, res.Evidence)
	}
	mustFit(t, res.Evidence, "2 waiver files", "2 grants")
}

// D64 ruling 8: the row a reader has to act on leads the line. A cleared row is
// worth seeing and is nobody's next move, so it follows — and a line that led
// with it would bury the hot one inside "and 1 more".
func TestWaiverCountRowLeadsWithTheRowNoFindingAnswers(t *testing.T) {
	dir := newRepo(t)
	declareBets(t, dir, "demo_bet")

	for _, row := range []string{"board", "trace"} {
		for i := range grantsPerBet {
			grant(t, dir, fmt.Sprintf("%s-2026080%d-aaaa.json", row, i+1), row, "demo_bet")
		}
	}
	writeFindings(t, dir, "The board row counts a shallow clone's landings twice")

	res := runRow(t, dir, "waiver-count")
	if res.Outcome != Red {
		t.Fatalf("one cleared row and one hot one came out %s: %s", res.Outcome, res.Evidence)
	}

	hot := strings.Index(res.Evidence, "trace has")
	cleared := strings.Index(res.Evidence, "board has")
	if hot < 0 {
		t.Fatalf("the line does not name the row no finding answers: %s", res.Evidence)
	}
	if cleared >= 0 && cleared < hot {
		t.Fatalf("the cleared row leads the line: %s", res.Evidence)
	}
}

// A waiver made as a copy of another is a birth like any other. git reports it
// as a copy rather than an add, and a boundary that only knew adds would reach
// back past the deletion into a dead file's history.
func TestWaiverCountRowStartsAtAWaiverMadeAsACopy(t *testing.T) {
	dir := newRepo(t)
	declareBets(t, dir, "demo_bet")

	const at = "honesty-20260801-aaaa.json"
	const other = "honesty-20260802-bbbb.json"

	grant(t, dir, other, "honesty", "demo_bet")
	grant(t, dir, at, "honesty", "demo_bet")
	runGit(t, dir, "rm", "-q", WaiverDir+"/"+at)
	runGit(t, dir, "commit", "-m", "the waiver expired\n\nBet: demo_bet\nTests: none")

	// Made out of the other waiver, at the dead one's path, so git calls it a
	// copy. Its own history is that one commit.
	body, err := os.ReadFile(filepath.Join(dir, filepath.FromSlash(WaiverDir+"/"+other)))
	if err != nil {
		t.Fatalf("the other waiver did not read: %v", err)
	}
	writeSource(t, dir, WaiverDir+"/"+at, string(body))
	runGit(t, dir, "add", WaiverDir+"/"+at)
	runGit(t, dir, "commit", "-m", "waive honesty again\n\nBet: demo_bet\nTests: none")

	res := runRow(t, dir, "waiver-count")
	if res.Outcome != Green {
		t.Fatalf("a waiver made as a copy reached back past its own birth: %s", res.Evidence)
	}
	mustFit(t, res.Evidence, "2 grants", "0 rows at a limit")
}

// Only an exact move decides nothing. git scores a rename, and a move that also
// rewrote the file carries a score under a hundred — that is a re-grant like
// any other rewrite.
//
// The predicate is driven directly, because a waiver file is a hundred-odd
// bytes: an edit big enough to matter is a large fraction of it, so git calls
// the result a new file rather than a scored rename. That cost is F116's, and
// the test below it holds the shape a repo really meets.
func TestOnlyAnExactMoveDecidesNothing(t *testing.T) {
	moved := renamesAmong([]journal.FileChange{
		{Commit: "aaa", Status: "R100"},
		{Commit: "bbb", Status: "R087"},
		{Commit: "ccc", Status: "A"},
	})

	if !moved["aaa"] {
		t.Error("an exact rename was read as a grant")
	}
	if moved["bbb"] {
		t.Error("a move that rewrote the file was read as deciding nothing")
	}
	if moved["ccc"] {
		t.Error("an add was read as a rename")
	}
}

// And the cost F116 records, held to what it is: a move plus a rewrite of a
// waiver reads as a new file, so its count restarts. A waiver is short enough
// that git cannot tell that from somebody starting over.
func TestAMovePlusARewriteRestartsTheCount(t *testing.T) {
	dir := newRepo(t)
	declareBets(t, dir, "demo_bet")
	grant(t, dir, "honesty-20260801-aaaa.json", "honesty", "demo_bet")
	regrant(t, dir, "honesty-20260801-aaaa.json", "honesty", "demo_bet", "the row is still wrong")

	runGit(t, dir, "mv", WaiverDir+"/honesty-20260801-aaaa.json", WaiverDir+"/honesty-20260901-bbbb.json")
	writeSource(t, dir, WaiverDir+"/honesty-20260901-bbbb.json",
		"{\"v\":1,\"row\":\"honesty\",\"reason\":\"a wholly different argument for waiving this row\","+
			"\"granted\":\"2026-08-01\",\"expires\":\"2026-08-20\"}\n")
	runGit(t, dir, "add", "-A")
	runGit(t, dir, "commit", "-m", "move it and re-argue it\n\nBet: demo_bet\nTests: none")

	res := runRow(t, dir, "waiver-count")
	if res.Outcome != Green {
		t.Fatalf("a move plus a rewrite came out %s: %s", res.Outcome, res.Evidence)
	}
	mustFit(t, res.Evidence, "1 grant", "0 renames not read")
}

// D65 ruling 3: one repo prints one line. Map order is random, and reading it
// straight made twelve runs of one repo print two diagnoses (F114). On a tie the
// named bet wins, because a bet a reader can go and look at beats a bucket.
func TestWaiverCountRowPrintsOneLineForOneRepo(t *testing.T) {
	dir := newRepo(t)
	declareBets(t, dir, "demo_bet")

	for i := range grantsPerBet {
		grant(t, dir, fmt.Sprintf("honesty-2026080%d-aaaa.json", i+1), "honesty", "demo_bet")
	}
	for i := range grantsPerBet {
		file := fmt.Sprintf("%s/honesty-2026090%d-bbbb.json", WaiverDir, i+1)
		writeSource(t, dir, file, fmt.Sprintf(
			"{\"v\":1,\"row\":\"honesty\",\"reason\":\"unattributed %d\",\"granted\":\"2026-08-01\",\"expires\":\"2026-08-20\"}\n", i))
		runGit(t, dir, "add", file)
		runGit(t, dir, "commit", "-m", "waive honesty with no bet named")
	}

	first := runRow(t, dir, "waiver-count")
	if first.Outcome != Red {
		t.Fatalf("six grants of one row came out %s: %s", first.Outcome, first.Evidence)
	}
	if !strings.Contains(first.Evidence, "inside demo_bet") {
		t.Fatalf("the tie did not break toward the named bet: %s", first.Evidence)
	}

	// Twelve runs, one line. Reading the buckets in map order printed two
	// diagnoses of one repo, ten one way and two the other.
	for range 12 {
		if got := runRow(t, dir, "waiver-count"); got.Evidence != first.Evidence {
			t.Fatalf("two runs of one repo printed two lines:\n%s\n%s", first.Evidence, got.Evidence)
		}
	}
}

// And a tie between two named bets settles the same way. The tie-break says a
// named bet beats the bucket; only reading the buckets in one order says which
// named bet, and map order says a different one from run to run.
func TestWaiverCountRowSettlesATieBetweenTwoNamedBets(t *testing.T) {
	dir := newRepo(t)
	declareBets(t, dir, "bet_one", "bet_two")

	for i, bet := range []string{"bet_one", "bet_two"} {
		for n := range grantsPerBet {
			grant(t, dir, fmt.Sprintf("honesty-2026%02d0%d-aaaa.json", i+1, n+1), "honesty", bet)
		}
	}

	first := runRow(t, dir, "waiver-count")
	if first.Outcome != Red {
		t.Fatalf("three grants in each of two bets came out %s: %s", first.Outcome, first.Evidence)
	}

	for range 12 {
		if got := runRow(t, dir, "waiver-count"); got.Evidence != first.Evidence {
			t.Fatalf("two runs of one repo named two bets:\n%s\n%s", first.Evidence, got.Evidence)
		}
	}
	if !strings.Contains(first.Evidence, "inside bet_one") {
		t.Fatalf("the tie did not settle on the first bet by name: %s", first.Evidence)
	}
}

// The row's counts are its own reading, and every count is in the head where no
// cut reaches it (D33). The widest line is searched rather than fed the maximum
// in every field at once (F81).
func TestTheWaiverCountRowsCountsAlwaysFitTheLine(t *testing.T) {
	widest := 0
	for _, n := range []int{0, 1, 9, 10, 1 << 30, 1<<63 - 1} {
		rep := counterReport{Files: n, Grants: n, Merges: n, Renames: n, Unread: n, Over: n, Named: n, Misstated: n}
		if got := len(rep.head()); got > widest {
			widest = got
		}
	}

	// The constant certifies nothing on its own: a comment claiming 500 bytes
	// would pass a test that only held the head to it. So it is held to the
	// journal's own cap too (F115).
	if counterHeadBytes > journal.MaxTextBytes {
		t.Fatalf("the head's bound is %d bytes, over the journal's cap of %d",
			counterHeadBytes, journal.MaxTextBytes)
	}
	if widest > counterHeadBytes {
		t.Fatalf("the waiver counter's head reaches %d bytes, and the comment claims at most %d",
			widest, counterHeadBytes)
	}
}

// The dogfood, and it is not green. This clone is shallow, so R14 sends the row
// to unrunnable rather than to a count it cannot stand behind. The line has to
// say which of those two it is.
func TestWaiverCountRowIsUnrunnableAndSaysWhyOnThisRepo(t *testing.T) {
	res := runRow(t, ".", "waiver-count")

	shallow, err := journal.Shallow(".")
	if err != nil {
		t.Fatalf("could not ask git whether this clone is shallow: %v", err)
	}
	if !shallow {
		if res.Outcome != Green {
			t.Fatalf("this repo's own waiver counter came out %s: %s", res.Outcome, res.Evidence)
		}

		return
	}

	if res.Outcome != Unrunnable {
		t.Fatalf("this shallow clone's waiver counter came out %s: %s", res.Outcome, res.Evidence)
	}
	mustFit(t, res.Evidence, "shallow")
}

// A waiver directory that is not there and one that is empty mean the same
// honest thing, and neither is a hole in the count.
func TestWaiverCountRowReadsAnEmptyWaiverDirectory(t *testing.T) {
	dir := newRepo(t)
	if err := os.MkdirAll(filepath.Join(dir, filepath.FromSlash(WaiverDir)), 0o750); err != nil {
		t.Fatalf("could not make the waiver directory: %v", err)
	}

	res := runRow(t, dir, "waiver-count")
	if res.Outcome != Green {
		t.Fatalf("an empty waiver directory came out %s: %s", res.Outcome, res.Evidence)
	}
	mustFit(t, res.Evidence, "0 waiver files")
}

// D64 ruling 4: only the phrase "<id> row" clears a threshold. Nine of the
// sixteen row ids are ordinary English words, and this repo's own ledger holds
// most of them in titles about something else.
//
// The probe is the real ledger, copied whole, against a row the ledger names by
// bare word and never as a row. Under the old rule those grants read green,
// cleared by an entry about something else, and the threshold could never bite
// for that row again.
func TestARealLedgerDoesNotClearAThresholdByAccident(t *testing.T) {
	ledger, err := os.ReadFile(filepath.Join("..", "..", "docs", "findings.md"))
	if err != nil {
		t.Fatalf("this repo's own findings ledger did not read: %v", err)
	}

	row := bareInTitles(t, string(ledger))
	if row == "" {
		t.Skip("no shipped row id sits in this ledger's titles as a bare word only")
	}

	dir := newRepo(t)
	for i := range grantsPerBet {
		name := fmt.Sprintf("%s-2026080%d-aaaa.json", row, i+1)
		grant(t, dir, name, row, "demo_bet")
	}
	writeSource(t, dir, "docs/findings.md", string(ledger))
	runGit(t, dir, "add", "docs/findings.md")
	runGit(t, dir, "commit", "-m", "this repo's own ledger\n\nBet: demo_bet\nTests: none")

	res := runRow(t, dir, "waiver-count")
	if res.Outcome != Red {
		t.Fatalf("the real ledger cleared the %s row's threshold, which it never names: %s", row, res.Evidence)
	}
	mustFit(t, res.Evidence, row, "no finding names it")
}

// bareInTitles returns a shipped row id that the ledger's titles hold as a bare
// word and never as "<id> row". It returns an empty string when the ledger has
// grown a row entry for every such id, which is a good day and nothing to prove.
func bareInTitles(t *testing.T, ledger string) string {
	t.Helper()

	parsed := findings.Parse(ledger)
	if len(parsed.Entries) == 0 {
		t.Fatal("this repo's own findings ledger parsed to no entries")
	}

	for _, row := range Default().Rows() {
		bare, phrase := false, false
		for _, entry := range parsed.Entries {
			bare = bare || findings.Names(entry.Title, row.ID)
			phrase = phrase || findings.Names(entry.Title, row.ID+" row")
		}
		if bare && !phrase {
			return row.ID
		}
	}

	return ""
}

// The phrase is a phrase, and it stops at word edges like every other naming
// rule here.
func TestOnlyTheRowPhraseClearsAThreshold(t *testing.T) {
	cases := []struct {
		name    string
		title   string
		cleared bool
	}{
		{"the phrase", "The honesty row keeps going red on generated code", true},
		{"a bare word", "Honesty about what the spend query counts", false},
		{"the word inside another", "The dishonesty row is a different thing", false},
		{"the phrase mid-sentence", "Why the honesty row cannot see a table test", true},
	}

	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			dir := newRepo(t)
			declareBets(t, dir, "demo_bet")
			grant(t, dir, "honesty-20260801-aaaa.json", "honesty", "demo_bet")
			regrant(t, dir, "honesty-20260801-aaaa.json", "honesty", "demo_bet", "still wrong")
			regrant(t, dir, "honesty-20260801-aaaa.json", "honesty", "demo_bet", "wrong again")
			writeFindings(t, dir, c.title)

			want := Red
			if c.cleared {
				want = Green
			}

			if res := runRow(t, dir, "waiver-count"); res.Outcome != want {
				t.Fatalf("the title %q came out %s, want %s: %s", c.title, res.Outcome, want, res.Evidence)
			}
		})
	}
}

// A finding names a row when one of the ledger's entry titles names it as a
// whole word. Prose that merely holds the letters does not: "honesty" inside
// "dishonesty-check" is not a finding about the honesty row.
func TestAFindingNamesARowOnlyByAWholeWordInItsTitle(t *testing.T) {
	dir := newRepo(t)
	declareBets(t, dir, "demo_bet")
	grant(t, dir, "honesty-20260801-aaaa.json", "honesty", "demo_bet")
	regrant(t, dir, "honesty-20260801-aaaa.json", "honesty", "demo_bet", "the row is still wrong")
	regrant(t, dir, "honesty-20260801-aaaa.json", "honesty", "demo_bet", "the row is wrong a third time")
	writeFindings(t, dir, "The dishonesty-check keeps going red")

	res := runRow(t, dir, "waiver-count")
	if res.Outcome != Red {
		t.Fatalf("a finding naming no row came out %s: %s", res.Outcome, res.Evidence)
	}
	if strings.Contains(res.Evidence, "1 named") {
		t.Errorf("the row read a whole-word match where there is none: %s", res.Evidence)
	}
}
