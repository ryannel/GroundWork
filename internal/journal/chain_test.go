package journal

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"math"
	"slices"
	"strings"
	"testing"
)

// The chain tests drive the real writer and the real ref. The honest shapes are
// written by WriteDispatch. The hostile ones are made with git plumbing against
// the ref itself, because that is how a forger works: never through the writer.

// writeRun writes n dispatch lines under one session and returns their paths,
// oldest first.
func writeRun(t *testing.T, dir, session string, n int) []string {
	t.Helper()

	t.Setenv(sessionEnv, session)

	var paths []string
	for i := range n {
		d := sampleDispatch()
		d.Outcome = fmt.Sprintf("line %d", i+1)

		path, err := WriteDispatch(dir, d)
		if err != nil {
			t.Fatalf("the write of line %d returned an error: %v", i+1, err)
		}
		paths = append(paths, path)
	}

	return paths
}

// reshape rebuilds the journal ref by hand: it drops the paths in drop and adds
// the lines in add. It is F10's shape — plumbing straight at the ref — and it is
// the only way to make a journal the writer would never produce.
func reshape(t *testing.T, dir string, drop []string, add map[string]string) {
	t.Helper()

	tip, err := resolve(dir, Ref)
	if err != nil {
		t.Fatalf("could not read the journal ref: %v", err)
	}
	if tip == "" {
		t.Fatal("there is no journal ref to reshape")
	}

	tree, err := inTempIndex(dir, func(env []string) error {
		if _, err := gitOut(dir, env, nil, "read-tree", tip); err != nil {
			return err
		}
		for _, path := range drop {
			if _, err := gitOut(dir, env, nil, "update-index", "--force-remove", path); err != nil {
				return err
			}
		}
		for path, content := range add {
			blob, err := gitOut(dir, nil, []byte(content), "hash-object", "-w", "-t", "blob", "--stdin")
			if err != nil {
				return err
			}
			cacheinfo := "100644," + strings.TrimSpace(blob) + "," + path
			if _, err := gitOut(dir, env, nil, "update-index", "--add", "--cacheinfo", cacheinfo); err != nil {
				return err
			}
		}

		return nil
	})
	if err != nil {
		t.Fatalf("could not build the reshaped tree: %v", err)
	}

	commit, err := gitOut(dir, identity(), nil, "commit-tree", tree, "-p", tip, "-m", "reshaped by hand")
	if err != nil {
		t.Fatalf("could not commit the reshaped tree: %v", err)
	}
	if err := moveRef(dir, strings.TrimSpace(commit), tip); err != nil {
		t.Fatalf("could not move the journal ref: %v", err)
	}
}

// forge rewrites one line of the journal and stores it back at the path its new
// content hashes to, exactly as the writer would have. So the tree stays
// self-consistent, and the only thing left wrong is the line that pointed at
// what used to be there.
func forge(t *testing.T, dir, session, path, field, value string) {
	t.Helper()

	var line map[string]any
	if err := json.Unmarshal(readEvent(t, dir, path), &line); err != nil {
		t.Fatalf("the line at %s is not valid JSON: %v", path, err)
	}
	line[field] = value

	raw, err := json.Marshal(line)
	if err != nil {
		t.Fatalf("could not build the forged line: %v", err)
	}
	raw = append(raw, '\n')

	sum := sha256.Sum256(raw)
	forged := "events/" + session + "/" + hex.EncodeToString(sum[:]) + ".json"

	reshape(t, dir, []string{path}, map[string]string{forged: string(raw)})
}

// chainOf runs the check and fails the test if it could not run at all.
func chainOf(t *testing.T, dir string) ChainResult {
	t.Helper()

	res, err := CheckChain(dir)
	if err != nil {
		t.Fatalf("CheckChain returned an error: %v", err)
	}

	return res
}

// wantHolds fails the test unless the chain holds, saying what broke if it did
// not.
func wantHolds(t *testing.T, res ChainResult) {
	t.Helper()

	if len(res.Breaks) != 0 {
		t.Fatalf("the chain does not hold: %v", res.Breaks)
	}
}

// A v1 dispatch line, as the writer wrote them before this slice. A test plants
// one to put the old shape in front of the new reader.
func v1Line(session string, seq int) string {
	return fmt.Sprintf(
		`{"v":1,"ts":"2026-08-22T14:0%d:00Z","kind":"dispatch","session":%q,"seq":%d,"commit":"","branch":"main","role":"worker","tier":"execution","tokens":{"in":1,"out":1,"total":2},"tokens_source":"host-report","duration_ms":1,"outcome":"old"}`,
		seq, session, seq)
}

// Every new line carries the hash of the line before it in its own session, and
// the first line of a session carries nothing.
func TestEveryLineCarriesTheHashOfTheOneBeforeIt(t *testing.T) {
	dir := newRepo(t)
	paths := writeRun(t, dir, "s-alpha", 3)

	first := decodeEvent(t, dir, paths[0])
	wantNumber(t, first, "v", 2)
	wantString(t, first, "prev", "")

	for i := 1; i < len(paths); i++ {
		sum := sha256.Sum256(readEvent(t, dir, paths[i-1]))

		event := decodeEvent(t, dir, paths[i])
		wantNumber(t, event, "v", 2)
		wantString(t, event, "prev", hex.EncodeToString(sum[:]))
	}
}

// The chain is per session. Two sessions writing into one journal each carry
// their own chain, and neither one's first line points at the other's.
func TestTheChainIsPerSessionNotRepoGlobal(t *testing.T) {
	dir := newRepo(t)
	writeRun(t, dir, "s-alpha", 2)
	beta := writeRun(t, dir, "s-beta", 2)

	wantString(t, decodeEvent(t, dir, beta[0]), "prev", "")

	res := chainOf(t, dir)
	wantHolds(t, res)
	if res.Sessions != 2 {
		t.Errorf("the check read %d sessions, want 2", res.Sessions)
	}
	if res.Lines != 4 {
		t.Errorf("the check read %d lines, want 4", res.Lines)
	}
	if res.Unchained != 0 {
		t.Errorf("the check called %d lines unchained, and every one of them is chained", res.Unchained)
	}
}

// An honest session holds. This is the shape every run writes.
func TestCheckChainHoldsOnAnHonestSession(t *testing.T) {
	dir := newRepo(t)
	writeRun(t, dir, "s-alpha", 4)

	res := chainOf(t, dir)
	wantHolds(t, res)
	if !res.HasRef {
		t.Error("the check says there is no journal ref, and four lines were just written to it")
	}
}

// A repo that never wrote a line has no ref. That is not a break and not an
// error: the check says the ref is not there, the way Spend does.
func TestCheckChainSaysWhenThereIsNoRefAtAll(t *testing.T) {
	res := chainOf(t, newRepo(t))

	if res.HasRef {
		t.Error("the check says the journal ref is there, and nothing ever wrote to it")
	}
	if res.Lines != 0 || res.Sessions != 0 {
		t.Errorf("the check read %d lines across %d sessions from a ref that is not there",
			res.Lines, res.Sessions)
	}
	wantHolds(t, res)
}

// The three shapes the slice names, at the level the check works: a forged line
// and a deleted line are each found by session and seq, and a v1 line — written
// before the chain existed — is counted as unchained and never called a break.
// The row above turns these into the words a reader sees, and the slice's proof
// marker sits there.
func TestCheckChainFindsABreakAndLeavesTheV1PrefixAlone(t *testing.T) {
	t.Run("a forged line", func(t *testing.T) {
		dir := newRepo(t)
		paths := writeRun(t, dir, "s-alpha", 3)

		forge(t, dir, "s-alpha", paths[1], "outcome", "something else")

		res := chainOf(t, dir)
		if len(res.Breaks) != 1 {
			t.Fatalf("a forged line gave %d breaks, want 1: %v", len(res.Breaks), res.Breaks)
		}
		if res.Breaks[0].Session != "s-alpha" || res.Breaks[0].Seq != 3 {
			t.Errorf("the break is at session %q seq %d, want s-alpha seq 3",
				res.Breaks[0].Session, res.Breaks[0].Seq)
		}
		if !strings.Contains(res.Breaks[0].Why, "prev") {
			t.Errorf("the break says %q, and it does not say the prev is wrong", res.Breaks[0].Why)
		}
	})

	t.Run("a deleted line", func(t *testing.T) {
		dir := newRepo(t)
		paths := writeRun(t, dir, "s-alpha", 3)

		reshape(t, dir, []string{paths[1]}, nil)

		res := chainOf(t, dir)
		if len(res.Breaks) != 1 {
			t.Fatalf("a deleted line gave %d breaks, want 1: %v", len(res.Breaks), res.Breaks)
		}
		if res.Breaks[0].Session != "s-alpha" || res.Breaks[0].Seq != 2 {
			t.Errorf("the break is at session %q seq %d, want s-alpha seq 2",
				res.Breaks[0].Session, res.Breaks[0].Seq)
		}
		if res.Lines != 2 {
			t.Errorf("the check read %d lines, want the 2 that are left", res.Lines)
		}
	})

	// The plainest deletion of all: the first line goes, and the walk opens at
	// seq 2 with nothing before it. A fix round once turned this into a panic
	// (F53), and the battery-level proof sits a package away — this one lives
	// beside the guard it pins.
	t.Run("a deleted first line", func(t *testing.T) {
		dir := newRepo(t)
		paths := writeRun(t, dir, "s-alpha", 3)

		reshape(t, dir, []string{paths[0]}, nil)

		res := chainOf(t, dir)
		if len(res.Breaks) != 1 {
			t.Fatalf("a deleted first line gave %d breaks, want 1: %v", len(res.Breaks), res.Breaks)
		}
		if res.Breaks[0].Session != "s-alpha" || res.Breaks[0].Seq != 1 {
			t.Errorf("the break is at session %q seq %d, want s-alpha seq 1",
				res.Breaks[0].Session, res.Breaks[0].Seq)
		}
	})

	t.Run("a session written before the chain", func(t *testing.T) {
		dir := newRepo(t)
		plant(t, dir, "s-old", v1Line("s-old", 1))
		plant(t, dir, "s-old", v1Line("s-old", 2))

		res := chainOf(t, dir)
		wantHolds(t, res)
		if res.Unchained != 2 {
			t.Errorf("the check called %d lines unchained, want 2", res.Unchained)
		}
	})
}

// The mixed journal risk 1 names: v1 lines before the chain, v2 lines after it,
// in one session. The first chained line points at the last unchained one, so
// the record joins up rather than starting again.
func TestASessionCarriesItsV1PrefixIntoTheChain(t *testing.T) {
	dir := newRepo(t)
	plant(t, dir, "s-mix", v1Line("s-mix", 1))
	plant(t, dir, "s-mix", v1Line("s-mix", 2))

	paths := writeRun(t, dir, "s-mix", 2)

	joined := decodeEvent(t, dir, paths[0])
	wantNumber(t, joined, "seq", 3)

	sum := sha256.Sum256([]byte(v1Line("s-mix", 2) + "\n"))
	wantString(t, joined, "prev", hex.EncodeToString(sum[:]))

	res := chainOf(t, dir)
	wantHolds(t, res)
	if res.Unchained != 2 {
		t.Errorf("the check called %d lines unchained, want the 2 v1 lines", res.Unchained)
	}
	if res.Lines != 4 {
		t.Errorf("the check read %d lines, want 4", res.Lines)
	}
}

// A v1 line at a seq above a chained one is the forger's cheapest move: drop out
// of the chain and nothing has to hash. The prefix is unchained; a line after the
// chain began is a break.
func TestALineThatDropsOutOfTheChainIsABreak(t *testing.T) {
	dir := newRepo(t)
	writeRun(t, dir, "s-alpha", 2)
	plant(t, dir, "s-alpha", v1Line("s-alpha", 3))

	res := chainOf(t, dir)
	if len(res.Breaks) != 1 {
		t.Fatalf("a v1 line after the chain gave %d breaks, want 1: %v", len(res.Breaks), res.Breaks)
	}
	if res.Breaks[0].Session != "s-alpha" || res.Breaks[0].Seq != 3 {
		t.Errorf("the break is at session %q seq %d, want s-alpha seq 3",
			res.Breaks[0].Session, res.Breaks[0].Seq)
	}
}

// A line is grouped by the session it names, not by the directory it sits in.
// Moving a blob between session directories changes nothing about what the line
// says, and the chain reads what a line says.
//
// Grouping by the path instead would call this journal broken twice over — a gap
// where the line was, and a session starting at seq 2 where it went — while
// every line is still exactly what the record says it is.
func TestALineIsGroupedByWhatItSaysNotWhereItSits(t *testing.T) {
	dir := newRepo(t)
	paths := writeRun(t, dir, "s-alpha", 3)

	name := strings.TrimPrefix(paths[1], "events/s-alpha/")
	moved := "events/s-elsewhere/" + name
	reshape(t, dir, []string{paths[1]}, map[string]string{moved: string(readEvent(t, dir, paths[1]))})

	res := chainOf(t, dir)
	wantHolds(t, res)
	if res.Sessions != 1 {
		t.Errorf("the check read %d sessions, and all three lines name one", res.Sessions)
	}
}

// A chained line at seq 1 has nothing to point at. One that points at something
// anyway is naming a line the session does not hold.
func TestAFirstLineThatCarriesAPrevIsABreak(t *testing.T) {
	dir := newRepo(t)
	writeRun(t, dir, "s-alpha", 1)

	plant(t, dir, "s-beta",
		`{"v":2,"ts":"2026-08-22T14:00:00Z","kind":"drive","session":"s-beta","seq":1,"prev":"aa","commit":"","branch":"main","notes":"n"}`)

	res := chainOf(t, dir)
	if len(res.Breaks) != 1 {
		t.Fatalf("a first line with a prev gave %d breaks, want 1: %v", len(res.Breaks), res.Breaks)
	}
	if res.Breaks[0].Session != "s-beta" || res.Breaks[0].Seq != 1 {
		t.Errorf("the break is at session %q seq %d, want s-beta seq 1",
			res.Breaks[0].Session, res.Breaks[0].Seq)
	}
}

// One broken session among many names the one that broke, and says nothing
// about the others.
func TestOnlyTheSessionThatBrokeIsNamed(t *testing.T) {
	dir := newRepo(t)
	writeRun(t, dir, "s-alpha", 3)
	broken := writeRun(t, dir, "s-beta", 3)
	writeRun(t, dir, "s-gamma", 3)

	reshape(t, dir, []string{broken[1]}, nil)

	res := chainOf(t, dir)
	if len(res.Breaks) != 1 {
		t.Fatalf("one broken session gave %d breaks, want 1: %v", len(res.Breaks), res.Breaks)
	}
	if res.Breaks[0].Session != "s-beta" {
		t.Errorf("the break names session %q, and s-beta is the one that broke", res.Breaks[0].Session)
	}
	if res.Sessions != 3 {
		t.Errorf("the check read %d sessions, want 3", res.Sessions)
	}
}

// Breaks come back in one order however git hands the blobs over, so the line
// built from them says the same thing on every run.
func TestBreaksComeBackSortedBySessionAndSeq(t *testing.T) {
	dir := newRepo(t)
	first := writeRun(t, dir, "s-alpha", 3)
	second := writeRun(t, dir, "s-beta", 3)

	reshape(t, dir, []string{first[1], second[1]}, nil)

	res := chainOf(t, dir)
	if len(res.Breaks) != 2 {
		t.Fatalf("two broken sessions gave %d breaks, want 2: %v", len(res.Breaks), res.Breaks)
	}

	sessions := []string{res.Breaks[0].Session, res.Breaks[1].Session}
	if !slices.Equal(sessions, []string{"s-alpha", "s-beta"}) {
		t.Errorf("the breaks name %v, want them sorted", sessions)
	}
}

// Risk 2, the shape F10 broke on. Two clones each write their own chained
// session. The merge is a union of two independent chains, so both hold after
// it — which is the whole reason the chain is per session and not repo-global.
func TestAMergeOfTwoClonesKeepsBothChains(t *testing.T) {
	origin := newRepo(t)
	here := clone(t, origin, "here")
	there := clone(t, origin, "there")

	writeRun(t, here, "s-here", 3)
	writeRun(t, there, "s-there", 3)

	wantHolds(t, chainOf(t, here))
	wantHolds(t, chainOf(t, there))

	fetchJournal(t, here, there, "refs/groundwork/incoming")

	if _, err := Merge(here, "refs/groundwork/incoming"); err != nil {
		t.Fatalf("Merge returned an error: %v", err)
	}

	res := chainOf(t, here)
	wantHolds(t, res)
	if res.Sessions != 2 || res.Lines != 6 {
		t.Errorf("after the merge the check read %d lines across %d sessions, want 6 across 2",
			res.Lines, res.Sessions)
	}
}

// The other half of risk 2. Two clones sharing one session id each number their
// own lines, so the merged journal holds two lines at the same seq. The chain
// says so rather than picking one.
func TestAMergeOfOneSessionFromTwoClonesIsABreak(t *testing.T) {
	origin := newRepo(t)
	here := clone(t, origin, "here")
	there := clone(t, origin, "there")

	writeRun(t, here, "s-shared", 2)
	writeRun(t, there, "s-shared", 2)

	fetchJournal(t, here, there, "refs/groundwork/incoming")

	if _, err := Merge(here, "refs/groundwork/incoming"); err != nil {
		t.Fatalf("Merge returned an error: %v", err)
	}

	res := chainOf(t, here)
	if len(res.Breaks) != 1 {
		t.Fatalf("two clones sharing a session gave %d breaks, want 1: %v", len(res.Breaks), res.Breaks)
	}
	if res.Breaks[0].Session != "s-shared" {
		t.Errorf("the break names session %q, want s-shared", res.Breaks[0].Session)
	}
	if !strings.Contains(res.Breaks[0].Why, "twice") {
		t.Errorf("the break says %q, and it does not say the seq is held twice", res.Breaks[0].Why)
	}
}

// D48 ruling 8, which the review found stated as fact and proven by nothing.
// When two clones shared a session id, the merged journal holds two lines at the
// highest seq. The next line has to point at one of them, and it points at the
// lower hash — so whichever clone writes next, the new line lands in the same
// place. The chain row names the doubled seq either way.
//
// This is the reviewer's probe K. Flipping the comparison in highestLine
// survived the whole suite before it.
func TestADoubledSeqPointsTheNextLineAtTheLowerHash(t *testing.T) {
	origin := newRepo(t)
	here := clone(t, origin, "here")
	there := clone(t, origin, "there")

	writeRun(t, here, "s-shared", 2)
	writeRun(t, there, "s-shared", 2)

	fetchJournal(t, here, there, "refs/groundwork/incoming")
	if _, err := Merge(here, "refs/groundwork/incoming"); err != nil {
		t.Fatalf("Merge returned an error: %v", err)
	}

	// The two lines now sitting at the highest seq.
	var tips []string
	for _, path := range journalPaths(t, here) {
		if int(decodeEvent(t, here, path)["seq"].(float64)) != 2 {
			continue
		}

		sum := sha256.Sum256(readEvent(t, here, path))
		tips = append(tips, hex.EncodeToString(sum[:]))
	}
	if len(tips) != 2 {
		t.Fatalf("the merged journal holds %d lines at seq 2, and this case needs 2", len(tips))
	}

	lower := min(tips[0], tips[1])

	t.Setenv(sessionEnv, "s-shared")
	path, err := WriteDispatch(here, sampleDispatch())
	if err != nil {
		t.Fatalf("WriteDispatch returned an error: %v", err)
	}

	if got := decodeEvent(t, here, path)["prev"]; got != lower {
		t.Errorf("the next line points at %v, and the lower of the two hashes is %s", got, lower)
	}
}

// A journal ref that holds no event is not a journal. The check says the ref is
// there and that it read nothing, and the row above it turns that into
// unrunnable rather than a pass.
func TestCheckChainReadsNoLinesFromARefHoldingNoEvents(t *testing.T) {
	dir := newRepo(t)
	writeRun(t, dir, "s-alpha", 1)

	paths := journalPaths(t, dir)
	reshape(t, dir, paths, nil)

	res := chainOf(t, dir)
	if !res.HasRef {
		t.Error("the check says there is no ref, and the ref is there")
	}
	if res.Lines != 0 {
		t.Errorf("the check read %d lines from a ref holding none", res.Lines)
	}
}

// A line nobody can parse has been rewritten, whatever else it is. It is a break
// on the session the path files it under, and it never stops the check.
//
// D49 ruling 4: the reason names the byte reading stopped at. A line nobody can
// parse has no seq to name, and the zero value would print a seq no line has.
func TestALineThatIsNotJSONIsABreak(t *testing.T) {
	dir := newRepo(t)
	writeRun(t, dir, "s-alpha", 1)

	reshape(t, dir, nil, map[string]string{"events/s-broken/deadbeef.json": "not json at all\n"})

	res := chainOf(t, dir)
	if len(res.Breaks) != 1 {
		t.Fatalf("a line that is not JSON gave %d breaks, want 1: %v", len(res.Breaks), res.Breaks)
	}
	if res.Breaks[0].Session != "s-broken" {
		t.Errorf("the break names session %q, want the one the path files it under", res.Breaks[0].Session)
	}
	if res.Breaks[0].Seq != 0 {
		t.Errorf("the break is at seq %d, and no seq can be read off a line like this",
			res.Breaks[0].Seq)
	}
	if !strings.Contains(res.Breaks[0].Why, "byte") {
		t.Errorf("the break says %q, and it does not say where reading stopped", res.Breaks[0].Why)
	}
}

// D49 ruling 3, and the reviewer's probe B. A line's path is the sha256 of the
// line, so the path is a claim about the content. A line rewritten and left
// where it was breaks that claim, and checking it costs nothing.
func TestALineRewrittenInPlaceIsABreak(t *testing.T) {
	dir := newRepo(t)
	paths := writeRun(t, dir, "s-alpha", 3)

	rewritten := strings.Replace(string(readEvent(t, dir, paths[1])),
		`"outcome":"line 2"`, `"outcome":"line X"`, 1)
	if rewritten == string(readEvent(t, dir, paths[1])) {
		t.Fatal("the fixture did not rewrite the line it meant to")
	}

	reshape(t, dir, nil, map[string]string{paths[1]: rewritten})

	res := chainOf(t, dir)

	found := false
	for _, b := range res.Breaks {
		if b.Session == "s-alpha" && b.Seq == 2 && strings.Contains(b.Why, "hash") {
			found = true
		}
	}
	if !found {
		t.Fatalf("a line rewritten where it sits gave %v, and none of it says the path no longer fits",
			res.Breaks)
	}
}

// D49 ruling 4. A line with no session of its own belongs to no chain. Grouped
// under the empty string it would make a session out of nothing and read green,
// which is the reviewer's probe F.
func TestALineWithNoSessionIsABreak(t *testing.T) {
	dir := newRepo(t)
	writeRun(t, dir, "s-alpha", 1)

	plant(t, dir, "s-alpha",
		`{"v":2,"ts":"2026-08-22T14:00:00Z","kind":"drive","session":"","seq":4,"prev":"","commit":"","branch":"main","notes":"n"}`)

	res := chainOf(t, dir)
	if len(res.Breaks) != 1 {
		t.Fatalf("a line naming no session gave %d breaks, want 1: %v", len(res.Breaks), res.Breaks)
	}
	if !strings.Contains(res.Breaks[0].Why, "names no session") {
		t.Errorf("the break says %q, and it does not say the line names no session", res.Breaks[0].Why)
	}
	if res.Sessions != 1 {
		t.Errorf("the check read %d sessions, and only s-alpha names itself", res.Sessions)
	}
}

// D49 ruling 4, and the reviewer's probe I. A seq below 1 is its own break.
// Left in the run of seqs it shifts every later line one place along, and the
// gap message then names a seq that is sitting right there.
func TestASeqBelowOneIsItsOwnBreakAndNeverBlamesThePresentSeq(t *testing.T) {
	dir := newRepo(t)
	writeRun(t, dir, "s-alpha", 1)

	plant(t, dir, "s-alpha",
		`{"v":2,"ts":"2026-08-22T14:00:00Z","kind":"drive","session":"s-alpha","seq":0,"prev":"","commit":"","branch":"main","notes":"n"}`)

	res := chainOf(t, dir)
	if len(res.Breaks) != 1 {
		t.Fatalf("a line at seq 0 gave %d breaks, want 1: %v", len(res.Breaks), res.Breaks)
	}
	if !strings.Contains(res.Breaks[0].Why, "seq 0") {
		t.Errorf("the break says %q, and it does not name the seq the line carries", res.Breaks[0].Why)
	}
	if strings.Contains(res.Breaks[0].Why, "stores no line") {
		t.Errorf("the break says %q, and a line at seq 1 is sitting right there", res.Breaks[0].Why)
	}
	if res.Breaks[0].Seq != 0 {
		t.Errorf("the break is at seq %d, and the seq it is about is in its own words",
			res.Breaks[0].Seq)
	}
}

// A session that holds nothing but v1 lines is counted, so a reader can watch
// the one number a forger inflates by inventing a session in the v1 shape.
// D49 ruling 3 accepts that forgery until the seal lands, on this condition.
func TestAWhollyUnchainedSessionIsCounted(t *testing.T) {
	dir := newRepo(t)

	plant(t, dir, "s-old", v1Line("s-old", 1))
	plant(t, dir, "s-old", v1Line("s-old", 2))

	plant(t, dir, "s-mix", v1Line("s-mix", 1))
	writeRun(t, dir, "s-mix", 1)

	writeRun(t, dir, "s-new", 2)

	res := chainOf(t, dir)
	wantHolds(t, res)
	if res.Unchained != 3 {
		t.Errorf("the check called %d lines unchained, want 3", res.Unchained)
	}
	if res.UnchainedSessions != 1 {
		t.Errorf("the check called %d sessions wholly unchained, and only s-old is",
			res.UnchainedSessions)
	}
}

// Every reason a break carries fits the cap the row builds its line around. The
// cap is enforced where breaks are made, so a reason that outgrew it is cut
// there rather than pushing a line of evidence past the journal's own cap.
func TestNoBreakReasonIsWiderThanTheCap(t *testing.T) {
	long := breakAt("s-alpha", 1, strings.Repeat("w", MaxWhyBytes*3))
	if len(long.Why) != MaxWhyBytes {
		t.Errorf("a reason of %d bytes came back at %d, want the cap of %d",
			MaxWhyBytes*3, len(long.Why), MaxWhyBytes)
	}

	// The two reasons built from a number are the ones that can grow without
	// anybody editing the words.
	for _, why := range []string{
		whySeqBelowOne(math.MinInt64),
		whyNotJSON(&json.SyntaxError{Offset: math.MaxInt64}),
		whyNotJSON(&json.UnmarshalTypeError{Offset: math.MaxInt64}),
		whyNotJSON(errors.New("something else")),
	} {
		if len(why) > MaxWhyBytes {
			t.Errorf("the reason %q is %d bytes, over the cap of %d", why, len(why), MaxWhyBytes)
		}
	}
}

// Risk 1: the envelope moved, so every reader has to take both versions. A
// reader that took only the new one would read three bets of this repo's own
// record as nothing at all. One journal holding both, read by the spend query,
// the token cross-check and the dial.
func TestEveryReaderTakesBothVersionsOfTheEnvelope(t *testing.T) {
	dir := newRepo(t)
	plant(t, dir, "s-mix", v1Line("s-mix", 1))
	writeRun(t, dir, "s-mix", 1)

	rows, hasRef, err := Spend(dir, "session")
	if err != nil {
		t.Fatalf("Spend returned an error: %v", err)
	}
	if !hasRef || len(rows) != 1 {
		t.Fatalf("Spend read %d rows from a journal holding both versions", len(rows))
	}
	if rows[0].Dispatches != 2 {
		t.Errorf("Spend counted %d dispatches, want both versions", rows[0].Dispatches)
	}
	// 2 from the v1 line, 165 from the v2 one.
	if rows[0].TokensTotal != 167 {
		t.Errorf("Spend totalled %d tokens, want 167", rows[0].TokensTotal)
	}

	writeSidecar(t, dir, "s-mix", sidecarBody("s-mix", [2]int{1, 2}, [2]int{2, 165}))

	res, err := VerifyTokens(dir, "s-mix", 0)
	if err != nil {
		t.Fatalf("VerifyTokens returned an error: %v", err)
	}
	for _, row := range res.Rows {
		if row.Status != VerifyOK {
			t.Errorf("the cross-check calls seq %d %q, and both lines agree with the host",
				row.Seq, row.Status)
		}
	}

	// The dial reads its from off the journal, so a v1 dial line still sets the
	// rung a v2 dial line starts from.
	plant(t, dir, "s-dial",
		`{"v":1,"ts":"2026-08-22T14:00:00Z","kind":"dial","session":"s-dial","seq":1,"commit":"","branch":"main","from":"slice","to":"bet","scope":"bet-3","reason":"old"}`)

	t.Setenv(sessionEnv, "s-new")
	path, err := WriteDial(dir, Dial{To: "program", Scope: "bet-3", Reason: "new"})
	if err != nil {
		t.Fatalf("WriteDial returned an error: %v", err)
	}
	wantString(t, decodeEvent(t, dir, path), "from", "bet")
}

// A ref that resolves to something that is not a journal commit is not a ref
// the check can read. It says so with git's own words rather than reporting on
// a journal it never saw. The row above turns that into unrunnable.
//
// A blob is the plainest way to make that shape: rev-parse resolves it, and
// ls-tree will not walk it.
func TestCheckChainFailsOnARefThatIsNotACommit(t *testing.T) {
	dir := newRepo(t)

	blob := strings.TrimSpace(runGitIn(t, dir, []byte("not a tree\n"),
		"hash-object", "-w", "-t", "blob", "--stdin"))
	runGit(t, dir, "update-ref", Ref, blob)

	_, err := CheckChain(dir)
	if err == nil {
		t.Fatal("the check read a journal from a ref pointing at a blob")
	}
	if !strings.Contains(err.Error(), "ls-tree") {
		t.Errorf("the error is %q, and it does not say which git call could not read the ref", err)
	}
}

// runGitIn runs one git command with standard input and returns its stdout.
func runGitIn(t *testing.T, dir string, stdin []byte, args ...string) string {
	t.Helper()

	out, err := gitOut(dir, nil, stdin, args...)
	if err != nil {
		t.Fatalf("git %s failed: %v", strings.Join(args, " "), err)
	}

	return out
}

// Outside a repository the check says so in this package's own words.
func TestCheckChainOutsideARepoSaysSo(t *testing.T) {
	if _, err := CheckChain(t.TempDir()); !errors.Is(err, ErrNotARepo) {
		t.Fatalf("CheckChain returned %v, want ErrNotARepo", err)
	}
}
