package battery

import (
	"bytes"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"math"
	"os"
	"os/exec"
	"path/filepath"
	"strconv"
	"strings"
	"testing"
	"unicode"

	"github.com/ryannel/groundwork/internal/journal"
)

// The chain row's fixtures are written by the real writer, into the real ref.
// The hostile ones are then reshaped with git plumbing, straight at the ref,
// because that is the only way to make a journal the writer would never
// produce — and it is the shape F10 broke on.

// writeLines writes n dispatch lines under one session and returns the paths
// they were stored at, oldest first.
func writeLines(t *testing.T, dir, session string, n int) []string {
	t.Helper()

	t.Setenv("GROUNDWORK_SESSION", session)

	var paths []string
	for range n {
		path, err := journal.WriteDispatch(dir, journal.Dispatch{
			Role: "worker", Tier: "execution",
			TokensIn: 1, TokensOut: 1, TokensSource: "host-report",
			DurationMS: 1, Outcome: "ok",
		})
		if err != nil {
			t.Fatalf("a journal write returned an error: %v", err)
		}
		paths = append(paths, path)
	}

	return paths
}

// plumb runs one git command with an index and a standard input of its own.
// runGit carries neither, and a hostile tree must never be built in the repo's
// real index.
func plumb(t *testing.T, dir, index string, stdin []byte, args ...string) string {
	t.Helper()

	cmd := exec.Command("git", append([]string{"-C", dir}, args...)...)
	if index != "" {
		cmd.Env = append(os.Environ(), "GIT_INDEX_FILE="+index)
	}
	if stdin != nil {
		cmd.Stdin = bytes.NewReader(stdin)
	}

	var out, errOut bytes.Buffer
	cmd.Stdout = &out
	cmd.Stderr = &errOut
	if err := cmd.Run(); err != nil {
		t.Fatalf("git %s failed: %v: %s", strings.Join(args, " "), err, errOut.String())
	}

	return strings.TrimSpace(out.String())
}

// journalTip returns the commit the journal ref points at, or an empty string
// when the repo has no journal ref yet.
func journalTip(t *testing.T, dir string) string {
	t.Helper()

	cmd := exec.Command("git", "-C", dir, "rev-parse", "--verify", "--quiet", journal.Ref)

	var out bytes.Buffer
	cmd.Stdout = &out
	if err := cmd.Run(); err != nil {
		return ""
	}

	return strings.TrimSpace(out.String())
}

// reshapeJournal rebuilds the journal ref by hand: it drops the paths in drop
// and adds the lines in add, each at the path its own content hashes to.
func reshapeJournal(t *testing.T, dir string, drop []string, add map[string]string) {
	t.Helper()

	tip := journalTip(t, dir)
	index := filepath.Join(t.TempDir(), "index")

	if tip != "" {
		plumb(t, dir, index, nil, "read-tree", tip)
	}
	for _, path := range drop {
		plumb(t, dir, index, nil, "update-index", "--force-remove", path)
	}
	for path, line := range add {
		blob := plumb(t, dir, "", []byte(line), "hash-object", "-w", "-t", "blob", "--stdin")
		plumb(t, dir, index, nil, "update-index", "--add", "--cacheinfo", "100644,"+blob+","+path)
	}
	tree := plumb(t, dir, index, nil, "write-tree")

	args := []string{"commit-tree", tree}
	if tip != "" {
		args = append(args, "-p", tip)
	}
	commit := plumb(t, dir, "", nil, append(args, "-m", "reshaped by hand")...)

	if tip == "" {
		runGit(t, dir, "update-ref", journal.Ref, commit)

		return
	}
	runGit(t, dir, "update-ref", journal.Ref, commit, tip)
}

// plant stores one line by hand, at the path its content hashes to.
func plant(t *testing.T, dir, session, line string) {
	t.Helper()

	raw := line + "\n"
	sum := sha256.Sum256([]byte(raw))
	path := "events/" + session + "/" + hex.EncodeToString(sum[:]) + ".json"

	reshapeJournal(t, dir, nil, map[string]string{path: raw})
}

// v1Dispatch is a dispatch line in the shape the writer used before the chain:
// version 1, and no prev at all.
func v1Dispatch(session string, seq int) string {
	return fmt.Sprintf(
		`{"v":1,"ts":"2026-08-22T14:00:%02dZ","kind":"dispatch","session":%q,"seq":%d,"commit":"","branch":"main","role":"worker","tier":"execution","tokens":{"in":1,"out":1,"total":2},"tokens_source":"host-report","duration_ms":1,"outcome":"old"}`,
		seq, session, seq)
}

// v2Line is a chained line as the writer makes them, but with fields a test
// chooses. The writer will not name a session a forger would, so this is the
// only way to put one in front of the row.
func v2Line(session string, seq int, prev string) string {
	body, err := json.Marshal(map[string]any{
		"v": 2, "ts": "2026-08-22T14:00:00Z", "kind": "drive",
		"session": session, "seq": seq, "prev": prev,
		"commit": "", "branch": "main", "notes": "n",
	})
	if err != nil {
		panic(err)
	}

	return string(body)
}

// forgeLine rewrites one line of the journal and puts it back at the path its
// new content hashes to, exactly as the writer would have. The tree stays
// self-consistent, so the only thing left wrong is the line that pointed at
// what used to be there.
func forgeLine(t *testing.T, dir, session, path string) {
	t.Helper()

	raw := plumb(t, dir, "", nil, "cat-file", "blob", journal.Ref+":"+path)
	forged := strings.Replace(raw, `"outcome":"ok"`, `"outcome":"no"`, 1)
	if forged == raw {
		t.Fatalf("the line at %s does not hold the field this fixture rewrites: %s", path, raw)
	}
	forged += "\n"

	sum := sha256.Sum256([]byte(forged))
	at := "events/" + session + "/" + hex.EncodeToString(sum[:]) + ".json"

	reshapeJournal(t, dir, []string{path}, map[string]string{at: forged})
}

// The row has to be registered, or it is a check that never runs.
func TestChainRowIsRegistered(t *testing.T) {
	registered(t, "chain", "chain")
}

// TestProof_b3s2_chain_a_break_is_named_and_never_blamed is this slice's
// headline proof, at the level a person reads. A forged line and a deleted line
// each turn the row red, and the line names the session and the seq. A journal
// of lines written before the chain existed is green, and the row says they are
// unchained rather than calling them forged.
func TestProof_b3s2_chain_a_break_is_named_and_never_blamed(t *testing.T) {
	t.Run("a forged line is named", func(t *testing.T) {
		dir := newRepo(t)
		paths := writeLines(t, dir, "s-alpha", 3)

		forgeLine(t, dir, "s-alpha", paths[1])

		res := runRow(t, dir, "chain")
		if res.Outcome != Red {
			t.Fatalf("a forged line came out %s: %s", res.Outcome, res.Evidence)
		}
		for _, want := range []string{"s-alpha", "seq 3", "prev"} {
			if !strings.Contains(res.Evidence, want) {
				t.Errorf("the row said %q, and it does not say %q", res.Evidence, want)
			}
		}
	})

	t.Run("a deleted line is named", func(t *testing.T) {
		dir := newRepo(t)
		paths := writeLines(t, dir, "s-alpha", 3)

		reshapeJournal(t, dir, []string{paths[1]}, nil)

		res := runRow(t, dir, "chain")
		if res.Outcome != Red {
			t.Fatalf("a deleted line came out %s: %s", res.Outcome, res.Evidence)
		}
		for _, want := range []string{"s-alpha", "seq 2"} {
			if !strings.Contains(res.Evidence, want) {
				t.Errorf("the row said %q, and it does not say %q", res.Evidence, want)
			}
		}
	})

	// The plainest deletion of all, and the one a fix round briefly turned
	// into a panic: the session's first line goes, so the walk opens at seq 2
	// with nothing before it.
	t.Run("a deleted first line is a gap, never a crash", func(t *testing.T) {
		dir := newRepo(t)
		paths := writeLines(t, dir, "s-alpha", 3)

		reshapeJournal(t, dir, []string{paths[0]}, nil)

		res := runRow(t, dir, "chain")
		if res.Outcome != Red {
			t.Fatalf("a deleted first line came out %s: %s", res.Outcome, res.Evidence)
		}
		for _, want := range []string{"s-alpha", "seq 1", "stores no line"} {
			if !strings.Contains(res.Evidence, want) {
				t.Errorf("the row said %q, and it does not say %q", res.Evidence, want)
			}
		}
	})

	t.Run("the lines written before the chain are never blamed", func(t *testing.T) {
		dir := newRepo(t)
		plant(t, dir, "s-old", v1Dispatch("s-old", 1))
		plant(t, dir, "s-old", v1Dispatch("s-old", 2))

		res := runRow(t, dir, "chain")
		if res.Outcome != Green {
			t.Fatalf("a journal written before the chain came out %s: %s", res.Outcome, res.Evidence)
		}
		if !strings.Contains(res.Evidence, "2") || !strings.Contains(res.Evidence, "unchained") {
			t.Errorf("the row said %q, and it does not name the unchained lines", res.Evidence)
		}
		for _, blame := range []string{"forged", "break"} {
			if strings.Contains(res.Evidence, blame) {
				t.Errorf("the row said %q about lines written before the chain existed", res.Evidence)
			}
		}
	})
}

// F48, through the row, in the mode the tool actually runs in. Nothing here
// sets GROUNDWORK_SESSION, so the writer generates one id for the process —
// D49 ruling 1 — and the run's lines chain. Delete one and the row goes red on
// the gap.
//
// This is the reviewer's probe J. Before D49.1 it stayed green through the
// deletion, because every line sat alone in a session of its own.
func TestADeletionIsFoundWithNoSessionInTheEnvironment(t *testing.T) {
	dir := newRepo(t)
	t.Setenv("GROUNDWORK_SESSION", "")

	var paths []string
	for range 5 {
		path, err := journal.WriteDispatch(dir, journal.Dispatch{
			Role: "worker", Tier: "execution", TokensSource: "host-report", Outcome: "ok",
		})
		if err != nil {
			t.Fatalf("a journal write returned an error: %v", err)
		}
		paths = append(paths, path)
	}

	before := runRow(t, dir, "chain")
	if before.Outcome != Green {
		t.Fatalf("five honest writes came out %s: %s", before.Outcome, before.Evidence)
	}
	if !strings.Contains(before.Evidence, "5 lines") || !strings.Contains(before.Evidence, "1 session") {
		t.Fatalf("the row said %q, and five writes of one run are one session of five lines",
			before.Evidence)
	}

	reshapeJournal(t, dir, []string{paths[2]}, nil)

	after := runRow(t, dir, "chain")
	if after.Outcome != Red {
		t.Fatalf("a line deleted from the run came out %s: %s", after.Outcome, after.Evidence)
	}
	if !strings.Contains(after.Evidence, "seq 3") {
		t.Errorf("the row said %q, and it does not name the seq that went missing", after.Evidence)
	}
}

// An honest run holds, and a v1 prefix under a chained tail holds too. This is
// what every session of this repo looks like from here on.
func TestChainRowIsGreenOnAnHonestJournal(t *testing.T) {
	dir := newRepo(t)
	plant(t, dir, "s-mix", v1Dispatch("s-mix", 1))
	writeLines(t, dir, "s-mix", 2)
	writeLines(t, dir, "s-beta", 2)

	res := runRow(t, dir, "chain")
	if res.Outcome != Green {
		t.Fatalf("an honest journal came out %s: %s", res.Outcome, res.Evidence)
	}
}

// The green line's bound test (D38.2). It says which ref it read, how much was
// in it, what it checked, and how many lines came before the chain. Dropping any
// one of those kills this test: a green nobody can audit is not evidence.
func TestTheChainRowsGreenLineSaysWhatItRead(t *testing.T) {
	dir := newRepo(t)
	plant(t, dir, "s-mix", v1Dispatch("s-mix", 1))
	writeLines(t, dir, "s-mix", 2)
	writeLines(t, dir, "s-beta", 2)

	res := runRow(t, dir, "chain")
	if res.Outcome != Green {
		t.Fatalf("an honest journal came out %s: %s", res.Outcome, res.Evidence)
	}
	for _, want := range []string{
		"5 lines", "2 sessions", journal.Ref, "every chain holds", "1 line", "unchained",
	} {
		if !strings.Contains(res.Evidence, want) {
			t.Errorf("the row said %q, and it does not say %q", res.Evidence, want)
		}
	}
}

// D49 ruling 3: both lines carry the count of sessions that hold nothing but
// unchained lines. That is the number a forger inflates by inventing a whole
// session in the v1 shape, which this row cannot otherwise tell from a genuine
// prefix, so it goes where somebody can watch it.
func TestBothLinesCountTheWhollyUnchainedSessions(t *testing.T) {
	dir := newRepo(t)
	plant(t, dir, "s-old", v1Dispatch("s-old", 1))
	plant(t, dir, "s-old", v1Dispatch("s-old", 2))
	broken := writeLines(t, dir, "s-alpha", 3)

	green := runRow(t, dir, "chain")
	if green.Outcome != Green {
		t.Fatalf("an honest journal with a v1 session came out %s: %s", green.Outcome, green.Evidence)
	}
	if !strings.Contains(green.Evidence, "1 session with nothing chained") {
		t.Errorf("the green line said %q, and it does not count the wholly unchained session",
			green.Evidence)
	}

	reshapeJournal(t, dir, []string{broken[1]}, nil)

	red := runRow(t, dir, "chain")
	if red.Outcome != Red {
		t.Fatalf("a deleted line came out %s: %s", red.Outcome, red.Evidence)
	}
	if !strings.HasPrefix(red.Evidence, "1 break: ") {
		t.Fatalf("the red line said %q, and the break count is not first", red.Evidence)
	}
	if !strings.Contains(red.Evidence, "1 session with nothing chained") {
		t.Errorf("the red line said %q, and it does not count the wholly unchained session",
			red.Evidence)
	}
}

// D49 ruling 4, through the row. A line nobody can parse has no seq, and the
// row must not print one. "at seq 0" is a seq no line ever has.
func TestTheRowNamesNoSeqForALineItCannotRead(t *testing.T) {
	dir := newRepo(t)
	writeLines(t, dir, "s-alpha", 1)
	reshapeJournal(t, dir, nil, map[string]string{"events/s-broken/deadbeef.json": "not json\n"})

	res := runRow(t, dir, "chain")
	if res.Outcome != Red {
		t.Fatalf("a line that is not JSON came out %s: %s", res.Outcome, res.Evidence)
	}
	if strings.Contains(res.Evidence, "seq 0") {
		t.Errorf("the row said %q, and no line ever carries seq 0", res.Evidence)
	}
	if !strings.Contains(res.Evidence, "s-broken") || !strings.Contains(res.Evidence, "byte") {
		t.Errorf("the row said %q, and it does not place the line it could not read", res.Evidence)
	}
}

// A break on a line that names no session is still placed: by where it sits when
// the path says, and in plain words when even that says nothing.
func TestTheRowPlacesABreakOnALineWithNoSession(t *testing.T) {
	dir := newRepo(t)
	writeLines(t, dir, "s-alpha", 1)
	reshapeJournal(t, dir, nil, map[string]string{"events/adrift.json": "not json\n"})

	res := runRow(t, dir, "chain")
	if res.Outcome != Red {
		t.Fatalf("a line adrift came out %s: %s", res.Outcome, res.Evidence)
	}
	if !strings.Contains(res.Evidence, "an unnamed session") {
		t.Errorf("the row said %q, and it does not say the line names no session", res.Evidence)
	}
	if strings.Contains(res.Evidence, "session : ") {
		t.Errorf("the row said %q, and it names a session with nothing in it", res.Evidence)
	}
}

// A journal with nothing before the chain must not be told it has an unchained
// prefix. The green says only what it read.
func TestTheGreenLineNamesNoPrefixWhenThereIsNone(t *testing.T) {
	dir := newRepo(t)
	writeLines(t, dir, "s-alpha", 2)

	res := runRow(t, dir, "chain")
	if res.Outcome != Green {
		t.Fatalf("a fully chained journal came out %s: %s", res.Outcome, res.Evidence)
	}
	if strings.Contains(res.Evidence, "unchained") {
		t.Errorf("the row said %q, and every line it read is chained", res.Evidence)
	}
}

// The red line's bound test (D38.2), and D33: words give way, counts never do.
// The count of breaks is written before the first break, so a line too long to
// hold loses the tail and never the count.
func TestTheChainRowsRedLineLeadsWithTheCount(t *testing.T) {
	dir := newRepo(t)

	first := writeLines(t, dir, "s-alpha", 3)
	second := writeLines(t, dir, "s-beta", 3)
	reshapeJournal(t, dir, []string{first[1], second[1]}, nil)

	res := runRow(t, dir, "chain")
	if res.Outcome != Red {
		t.Fatalf("two broken sessions came out %s: %s", res.Outcome, res.Evidence)
	}
	if !strings.HasPrefix(res.Evidence, "2 breaks") {
		t.Errorf("the row said %q, and the count is not where nothing can push it off", res.Evidence)
	}
}

// F50 and MED-7, the arithmetic D38 ruling 2 asks for. Not a measurement of one
// example: the widest line the row can build, out of the caps that bound every
// part of it.
//
// The count of breaks and the seq are both ints, so each prints at most twenty
// bytes. The session goes through a clip. The reason goes through the journal's
// own cap on a break's words. This is the sum of all four, and it has to fit the
// line the journal will hold.
//
// The old assertion here measured a line the row had already cut, so it could
// never fire — the reviewer's m17 removed the cut and nothing noticed. This one
// fires the moment any of those four grows.
func TestTheChainRowsRedLineFitsTheJournalCapOnTheWidestBreak(t *testing.T) {
	widest := countedBreaks(math.MaxInt64, journal.ChainBreak{
		Session: strings.Repeat("s", 4*journal.MaxTextBytes),
		Seq:     math.MaxInt64,
		Why:     strings.Repeat("w", journal.MaxWhyBytes),
	})

	if len(widest) > journal.MaxTextBytes {
		t.Fatalf("the widest break makes a line of %d bytes, over the cap of %d: %q",
			len(widest), journal.MaxTextBytes, widest)
	}
}

// The same sum for the green line's head. Two counts and the ref's own name,
// and nothing else can grow.
func TestTheChainRowsGreenLineFitsTheJournalCapOnTheWidestCounts(t *testing.T) {
	widest := fmt.Sprintf("%s across %s in %s: every chain holds",
		counted(math.MaxInt64, "line", "lines"),
		counted(math.MaxInt64, "session", "sessions"),
		journal.Ref)

	if len(widest) > journal.MaxTextBytes {
		t.Fatalf("the widest green line is %d bytes, over the cap of %d: %q",
			len(widest), journal.MaxTextBytes, widest)
	}
}

// The unchained clause is the part that gives way. When the line has no room
// left, the count of breaks stays and the clause goes — never the other way
// round.
func TestTheUnchainedClauseGivesWayAndTheCountNeverDoes(t *testing.T) {
	head := strings.Repeat("h", journal.MaxTextBytes-10)

	if got := addIfItFits(head, "; and some more words than there is room for"); got != head {
		t.Errorf("a clause with no room for it stayed on the line: %q", got)
	}
	if got := addIfItFits("1 break: x", "; y"); got != "1 break: x; y" {
		t.Errorf("a clause that fits was dropped anyway: %q", got)
	}
}

// One break reads as one break. A line that said "1 breaks" would be the first
// thing a reader stopped trusting.
func TestTheChainRowsRedLineCountsOneBreakAsOne(t *testing.T) {
	dir := newRepo(t)

	paths := writeLines(t, dir, "s-alpha", 3)
	reshapeJournal(t, dir, []string{paths[1]}, nil)

	res := runRow(t, dir, "chain")
	if !strings.HasPrefix(res.Evidence, "1 break: ") {
		t.Errorf("the row said %q, want it to open with one break", res.Evidence)
	}
}

// A session id is somebody else's text, off a journal line. Left whole it spends
// the line on itself, and the reader loses the reason the chain broke.
func TestALongSessionIdIsClippedNotLeftToFillTheLine(t *testing.T) {
	dir := newRepo(t)

	long := strings.Repeat("a", 120)
	paths := writeLines(t, dir, long, 3)
	other := writeLines(t, dir, "s-beta", 3)
	reshapeJournal(t, dir, []string{paths[1], other[1]}, nil)

	res := runRow(t, dir, "chain")
	if res.Outcome != Red {
		t.Fatalf("two broken sessions came out %s: %s", res.Outcome, res.Evidence)
	}
	if !strings.Contains(res.Evidence, "2 breaks") {
		t.Errorf("the row said %q, and it does not count the breaks it found", res.Evidence)
	}
	if strings.Contains(res.Evidence, long) {
		t.Errorf("the row said %q, and it carries a session id whole", res.Evidence)
	}
	if len(res.Evidence) >= journal.MaxTextBytes {
		t.Errorf("the row said %d bytes over one long session id, and the line holds %d: %s",
			len(res.Evidence), journal.MaxTextBytes, res.Evidence)
	}
}

// A repo that never wrote a journal line has no chain to break. The row is
// green, and it says only that: a green claiming it read a journal would be a
// green over nothing.
func TestChainRowIsGreenAndPlainOnARepoWithNoJournal(t *testing.T) {
	res := runRow(t, newRepo(t), "chain")
	if res.Outcome != Green {
		t.Fatalf("a repo with no journal came out %s: %s", res.Outcome, res.Evidence)
	}
	if !strings.Contains(res.Evidence, journal.Ref) {
		t.Errorf("the row said %q, and it does not name the ref it looked for", res.Evidence)
	}
	for _, overclaim := range []string{"every chain holds", "unchained"} {
		if strings.Contains(res.Evidence, overclaim) {
			t.Errorf("the row read no journal and still said %q", res.Evidence)
		}
	}
}

// A journal ref that holds no event is not a journal. D17: a verifier may never
// pass on nothing, so this is unrunnable, and the line names the ref.
func TestChainRowIsUnrunnableOnARefThatHoldsNoEvent(t *testing.T) {
	dir := newRepo(t)
	paths := writeLines(t, dir, "s-alpha", 1)
	reshapeJournal(t, dir, paths, nil)

	res := runRow(t, dir, "chain")
	if res.Outcome != Unrunnable {
		t.Fatalf("a ref holding no event came out %s: %s", res.Outcome, res.Evidence)
	}
	if !strings.Contains(res.Evidence, journal.Ref) {
		t.Errorf("the row said %q, and it does not name the ref", res.Evidence)
	}
}

// D48 ruling 4, which the review found unproven: every error out of CheckChain
// leaves the row unrunnable, never red. The row could not reach the thing it
// checks, and calling that red would blame the project for git's trouble.
//
// This is the divergence from the plan row, which reds when it cannot find the
// repo root. It is named in the row's own comment, and now a test reaches the
// branch: a ref pointing at a blob resolves, and ls-tree will not walk it.
func TestChainRowIsUnrunnableWhenTheRefCannotBeRead(t *testing.T) {
	dir := newRepo(t)
	writeLines(t, dir, "s-alpha", 1)

	blob := plumb(t, dir, "", []byte("not a tree\n"), "hash-object", "-w", "-t", "blob", "--stdin")
	runGit(t, dir, "update-ref", journal.Ref, blob)

	res := runRow(t, dir, "chain")
	if res.Outcome != Unrunnable {
		t.Fatalf("a ref the tool cannot read came out %s: %s", res.Outcome, res.Evidence)
	}
	if !strings.Contains(res.Evidence, "ls-tree") {
		t.Errorf("the row said %q, and it does not say what could not be read", res.Evidence)
	}
	if len(res.Evidence) > journal.MaxTextBytes {
		t.Errorf("the row said %d bytes, and the journal's line holds %d",
			len(res.Evidence), journal.MaxTextBytes)
	}
}

// TestChainRowIsGreenOnThisRepo runs the row against the repo it ships in. This
// repo's own ref carries three bets of lines written before the chain, and the
// row has to read them as unchained rather than forged.
func TestChainRowIsGreenOnThisRepo(t *testing.T) {
	res := runRow(t, ".", "chain")
	if res.Outcome != Green {
		t.Fatalf("this repo's own chain row came out %s: %s", res.Outcome, res.Evidence)
	}
	if !strings.Contains(res.Evidence, "unchained") {
		t.Errorf("the row said %q, and this repo's ref holds lines written before the chain", res.Evidence)
	}
}

// D23: a row added moves the major half of the version. This slice adds the
// chain row, so 6.0 — the version the plan row's slice closed at — is no longer
// a version anybody can be held to. The digest moves with the row list, and the
// version row would find that drift on this repo first.
func TestThisRepoDeclaresTheBumpTheChainRowCost(t *testing.T) {
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
	if major < 7 {
		t.Errorf("%s declares %s, and the chain row puts this battery at 7.0 or past it",
			LockFile, lock.Version)
	}
}

// F49, and D49 ruling 2. The session on a read line is the forger's to write:
// checkSession guards what this tool writes, never what it reads. A name
// carrying a newline and tabs draws a row of its own in the verify table, and
// the reviewer rendered a whole fake "seal green" row from one planted line.
//
// This is the shape of TestNothingARunSaysAboutAWaiverCarriesAControlCharacter:
// nothing the row says about a journal line may carry a control character.
func TestNothingTheChainRowSaysCarriesAControlCharacter(t *testing.T) {
	dir := newRepo(t)

	forged := "a\nseal\tgreen\tthe seal holds"
	plant(t, dir, "s-forged", v2Line(forged, 1, "aa"))

	res := runRow(t, dir, "chain")
	if res.Outcome != Red {
		t.Fatalf("a first line carrying a prev came out %s: %s", res.Outcome, res.Evidence)
	}

	for _, r := range res.Evidence {
		if !unicode.IsPrint(r) {
			t.Errorf("the row said %q, and it holds the unprintable character %q", res.Evidence, r)
		}
	}
	if strings.Contains(res.Evidence, "\n") || strings.Contains(res.Evidence, "\t") {
		t.Errorf("the row said %q, and a table would draw a second row from it", res.Evidence)
	}
	// The name is still named, just made safe. A row that dropped it would tell
	// the reader nothing about which session broke.
	if !strings.Contains(res.Evidence, "seal") {
		t.Errorf("the row said %q, and it does not name the session at all", res.Evidence)
	}
}

// A row's evidence is read on a machine that is not the one that wrote it, so a
// temporary directory in a line of evidence says nothing to the reader.
func TestChainRowEvidenceNeverCarriesAMachinePath(t *testing.T) {
	dir := newRepo(t)
	paths := writeLines(t, dir, "s-alpha", 3)
	reshapeJournal(t, dir, []string{paths[1]}, nil)

	res := runRow(t, dir, "chain")
	if strings.Contains(res.Evidence, dir) || strings.Contains(res.Evidence, os.TempDir()) {
		t.Errorf("the row said %q, and it carries a path from the machine it ran on", res.Evidence)
	}
}
