package battery

import (
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"testing"

	"github.com/ryannel/groundwork/internal/journal"
	"github.com/ryannel/groundwork/internal/plan"
)

// The record row's fixture. It is the plan row's fixture with a records list on
// the slice, because the row judges the records a plan declares and nothing
// else.

const recordPath = "docs/the-record.md"

// sliceWithRecords is the fixture slice plan, declaring the record paths given.
// A slice declaring none writes the empty list, which is what a slice that owes
// nothing looks like.
func sliceWithRecords(records ...string) string {
	body := "records: []\n"
	if len(records) > 0 {
		body = "records:\n"
		for _, path := range records {
			body += "  - " + path + "\n"
		}
	}

	return strings.Replace(planSlice, "faked: []\n", "faked: []\n"+body, 1)
}

// recordRepo builds a repo holding the fixture plan, with the slice declaring
// the record paths given. Nothing is committed yet: each case decides what
// lands in which commit, and that is the whole subject of this row.
func recordRepo(t *testing.T, records ...string) string {
	t.Helper()

	dir := newRepo(t)
	writePlan(t, dir, "docs/plan/demo/demo_bet/demo_s1.md", sliceWithRecords(records...))

	return dir
}

// commitAll commits everything in the working tree under one message.
func commitAll(t *testing.T, dir, message string) {
	t.Helper()

	runGit(t, dir, "add", "-A")
	runGit(t, dir, "commit", "-m", message)
}

// land commits everything under a message carrying the Slice trailer, which is
// what makes a slice landed. board.TrailerKey spells the trailer; the fixture
// spells it the way a person writes it in a commit message.
func land(t *testing.T, dir, slice string) {
	t.Helper()

	commitAll(t, dir, "the work\n\nBet: demo_bet\nSlice: "+slice+"\nTests: yes")
}

func TestRecordRowIsRegistered(t *testing.T) {
	registered(t, "record", "record")
}

// TestProof_b3s7_record_a_missing_or_stale_record_is_red is R14's record rule:
// the row fails when a declared record is missing, and when its last commit
// predates the slice's last code commit.
//
// Three fixtures, one axis: a record that is there, one that is missing, and
// one older than the work it describes.
func TestProof_b3s7_record_a_missing_or_stale_record_is_red(t *testing.T) {
	t.Run("a record that is there", func(t *testing.T) {
		dir := recordRepo(t, recordPath)
		writeSource(t, dir, recordPath, "# The record\n")
		commitAll(t, dir, "the plan and the record")
		writeSource(t, dir, "alpha/alpha.go", "package alpha\n")
		writeSource(t, dir, recordPath, "# The record\n\nWritten up.\n")
		land(t, dir, "demo_s1")

		res := runRow(t, dir, "record")
		if res.Outcome != Green {
			t.Fatalf("a record newer than the work came out %s: %s", res.Outcome, res.Evidence)
		}
		mustFit(t, res.Evidence, "0 missing", "0 stale")
	})

	t.Run("a record that is missing", func(t *testing.T) {
		dir := recordRepo(t, recordPath)
		commitAll(t, dir, "the plan")
		writeSource(t, dir, "alpha/alpha.go", "package alpha\n")
		land(t, dir, "demo_s1")

		res := runRow(t, dir, "record")
		if res.Outcome != Red {
			t.Fatalf("a missing record came out %s: %s", res.Outcome, res.Evidence)
		}
		mustFit(t, res.Evidence, "1 missing", recordPath, "demo_s1")
	})

	t.Run("a record older than the work it describes", func(t *testing.T) {
		dir := recordRepo(t, recordPath)
		writeSource(t, dir, recordPath, "# The record\n")
		commitAll(t, dir, "the plan and the record")
		writeSource(t, dir, "alpha/alpha.go", "package alpha\n")
		land(t, dir, "demo_s1")

		res := runRow(t, dir, "record")
		if res.Outcome != Red {
			t.Fatalf("a stale record came out %s: %s", res.Outcome, res.Evidence)
		}
		mustFit(t, res.Evidence, "1 stale", recordPath, "demo_s1")
	})
}

// A record written in the slice's own commit is the ordinary case, and it is
// not stale: the same commit does not predate itself. Every slice of this bet
// has landed that way, so a rule that called it stale would red this repo on
// every run.
func TestRecordRowCallsARecordLandedWithItsCodeFresh(t *testing.T) {
	dir := recordRepo(t, recordPath)
	commitAll(t, dir, "the plan")
	writeSource(t, dir, "alpha/alpha.go", "package alpha\n")
	writeSource(t, dir, recordPath, "# The record\n")
	land(t, dir, "demo_s1")

	res := runRow(t, dir, "record")
	if res.Outcome != Green {
		t.Fatalf("a record landed with its code came out %s: %s", res.Outcome, res.Evidence)
	}
}

// A slice that has not landed owes nothing yet. Its record is work in progress,
// not a missing record, and the row counts it as waiting rather than judging it.
func TestRecordRowDoesNotJudgeASliceThatHasNotLanded(t *testing.T) {
	dir := recordRepo(t, recordPath)
	commitAll(t, dir, "the plan, with no slice landed")

	res := runRow(t, dir, "record")
	if res.Outcome != Green {
		t.Fatalf("an unlanded slice came out %s: %s", res.Outcome, res.Evidence)
	}
	mustFit(t, res.Evidence, "1 waiting")
}

// R14: the row judges declared records only. A row that invented obligations
// would become the friction-waived class the ledger already knows, so a slice
// declaring no record is green however much it wrote or did not write.
func TestRecordRowJudgesDeclaredRecordsOnly(t *testing.T) {
	dir := recordRepo(t)
	commitAll(t, dir, "the plan")
	writeSource(t, dir, "alpha/alpha.go", "package alpha\n")
	land(t, dir, "demo_s1")

	res := runRow(t, dir, "record")
	if res.Outcome != Green {
		t.Fatalf("a slice declaring no record came out %s: %s", res.Outcome, res.Evidence)
	}
	mustFit(t, res.Evidence, "0 records")
}

// A record nobody committed is not a record. It is red, and it says which of
// the two faults it is: the file is there, and nothing attributes it to
// anybody. D52 ruling 3 is why that is its own count rather than folded into
// missing.
func TestRecordRowRedsARecordNobodyCommitted(t *testing.T) {
	dir := recordRepo(t, recordPath)
	commitAll(t, dir, "the plan")
	writeSource(t, dir, "alpha/alpha.go", "package alpha\n")
	land(t, dir, "demo_s1")
	writeSource(t, dir, recordPath, "# The record, never committed\n")

	res := runRow(t, dir, "record")
	if res.Outcome != Red {
		t.Fatalf("an uncommitted record came out %s: %s", res.Outcome, res.Evidence)
	}
	mustFit(t, res.Evidence, "1 never committed", recordPath)
}

// A record a shallow clone cannot date is unjudged, and it is the fixture that
// makes this worth a test: the record was written one commit before the slice
// landed, so it is not stale — and a depth-one clone cannot know that.
//
// git dates every file in a shallow clone whether or not it can. At the edge the
// whole tree hangs off one grafted commit, so the record reads as last changed
// in the same commit that landed the slice. Believing that would call a record
// older than the work fresh, which is a verdict made out of missing data.
//
// The row keeps judging rather than going unrunnable, because with the edge
// named it judges every record it can really date: a shallow clone leaves
// records unjudged here, never misjudged. The waiver counter goes the other way
// on the same fact, and D56 ruling 3 is where that line was first drawn.
func TestRecordRowLeavesARecordItCannotDateUnjudged(t *testing.T) {
	dir := recordRepo(t, recordPath)
	writeSource(t, dir, recordPath, "# The record\n")
	commitAll(t, dir, "the plan and the record")
	writeSource(t, dir, "alpha/alpha.go", "package alpha\n")
	land(t, dir, "demo_s1")

	// One commit deep, so the commit that wrote the record is out of reach and
	// the commit that landed the slice is the tip.
	clone := shallowClone(t, dir)

	res := runRow(t, clone, "record")
	if res.Outcome != Green {
		t.Fatalf("a record this clone cannot date came out %s: %s", res.Outcome, res.Evidence)
	}
	mustFit(t, res.Evidence, "shallow", "1 unjudged", "0 never committed", "0 stale")
}

// The same fixture in a whole clone is judged, and it is not stale: the record
// was written before the slice landed, and it is the slice's commit that comes
// after. Without this the test above would pass on a row that called everything
// unjudged.
func TestRecordRowDatesTheSameRecordInAWholeClone(t *testing.T) {
	dir := recordRepo(t, recordPath)
	writeSource(t, dir, recordPath, "# The record\n")
	commitAll(t, dir, "the plan and the record")
	writeSource(t, dir, "alpha/alpha.go", "package alpha\n")
	land(t, dir, "demo_s1")

	res := runRow(t, dir, "record")
	if res.Outcome != Red {
		t.Fatalf("a stale record in a whole clone came out %s: %s", res.Outcome, res.Evidence)
	}
	mustFit(t, res.Evidence, "1 stale", "0 unjudged")
}

// D38, D40 and D56 ruling 4: a merge never governs. A merge commit carrying a
// Slice trailer is not the commit that landed the slice, so the record is dated
// against the slice's own commit and not against the merge.
//
// The fixture makes the two answers differ. The slice's code lands on a branch;
// the record is written on the trunk after the branch parted; the merge claims
// the slice again. Read against the branch commit the record is not older than
// the work, because neither commit reaches the other. Read against the merge it
// would be, because the merge comes after everything.
func TestRecordRowDoesNotDateARecordAgainstAMerge(t *testing.T) {
	dir := recordRepo(t, recordPath)
	commitAll(t, dir, "the plan")

	runGit(t, dir, "checkout", "-q", "-b", "side")
	writeSource(t, dir, "alpha/alpha.go", "package alpha\n")
	land(t, dir, "demo_s1")

	runGit(t, dir, "checkout", "-q", "-")
	writeSource(t, dir, recordPath, "# The record\n")
	commitAll(t, dir, "write the record up")
	runGit(t, dir, "merge", "--no-ff", "-m", "close the bet\n\nBet: demo_bet\nSlice: demo_s1\nTests: yes", "side")

	res := runRow(t, dir, "record")
	if res.Outcome != Green {
		t.Fatalf("a record dated against the merge came out %s: %s", res.Outcome, res.Evidence)
	}
	mustFit(t, res.Evidence, "0 stale")
}

// D57 ruling 4, as D64 ruling 3 corrects this row: the oldest commit carrying a
// slice's Slice trailer is its landing, and every newer claim is a stray. This
// row read the newest one and named the real landing as the stray.
//
// The fixture makes the two answers differ. The record sits between the two
// claims: read against the landing it is newer than the work, and read against
// the stray it would be older.
func TestRecordRowDatesARecordAgainstTheOldestClaim(t *testing.T) {
	dir := recordRepo(t, recordPath)
	commitAll(t, dir, "the plan")

	writeSource(t, dir, "alpha/alpha.go", "package alpha\n")
	land(t, dir, "demo_s1")

	writeSource(t, dir, recordPath, "# The record\n")
	commitAll(t, dir, "write the record up")

	writeSource(t, dir, "alpha/beta.go", "package alpha\n\nvar Beta = 2\n")
	land(t, dir, "demo_s1")

	res := runRow(t, dir, "record")
	if res.Outcome != Green {
		t.Fatalf("a record newer than the landing came out %s: %s", res.Outcome, res.Evidence)
	}
	mustFit(t, res.Evidence, "0 stale")
}

// The claims come through the board's own machinery, so the four validity
// shapes apply here too. A trailer naming a slice the plan does not declare
// lands nothing, and the record it would have made owed reads as unjudged
// rather than as a slice with a record to owe.
func TestRecordRowReadsClaimsThroughTheBoardsValidityChecks(t *testing.T) {
	dir := recordRepo(t, recordPath)
	commitAll(t, dir, "the plan")
	writeSource(t, dir, "alpha/alpha.go", "package alpha\n")
	commitAll(t, dir, "the work\n\nBet: demo_bet\nSlice: demo_s1 and demo_s2\nTests: yes")

	res := runRow(t, dir, "record")
	if res.Outcome != Green {
		t.Fatalf("a trailer naming no declared slice came out %s: %s", res.Outcome, res.Evidence)
	}
	mustFit(t, res.Evidence, "0 records read", "1 waiting")
}

// The edge test is for a shallow clone and nothing else. A repo's own first
// commit has no parents either, and it is a commit somebody really made: a
// record last changed there is datable, and here it is older than the work.
//
// Without this the row could leave every such record unjudged and no test would
// notice — which is what the blanking sweep found.
func TestRecordRowDatesARecordFromTheRepositorysFirstCommit(t *testing.T) {
	dir := t.TempDir()
	for _, args := range [][]string{
		{"init", "-b", "main"},
		{"config", "user.name", "Test Person"},
		{"config", "user.email", "test@example.com"},
		// D64 ruling 9: a fixture has nothing to sign, and the host's signing
		// shim dies under load, which reads as a proof that failed (F104).
		{"config", "commit.gpgsign", "false"},
	} {
		runGit(t, dir, args...)
	}

	writePlan(t, dir, "docs/plan/demo/demo_bet/demo_s1.md", sliceWithRecords(recordPath))
	writeSource(t, dir, recordPath, "# The record\n")
	commitAll(t, dir, "the plan and the record")
	writeSource(t, dir, "alpha/alpha.go", "package alpha\n")
	land(t, dir, "demo_s1")

	if parents := runGit(t, dir, "log", "--format=%P", "-1", "HEAD~1"); parents != "" {
		t.Fatalf("the record's commit has the parents %q, and this fixture wants the first commit", parents)
	}

	res := runRow(t, dir, "record")
	if res.Outcome != Red {
		t.Fatalf("a record from the first commit came out %s: %s", res.Outcome, res.Evidence)
	}
	mustFit(t, res.Evidence, "1 stale", "0 unjudged")
}

// The edge guard has to stay narrow, and only a clone with commits on both
// sides of the edge shows that. Here the record's own commit sits one deeper
// than the graft, so it is datable — and it is older than the work.
//
// A guard widened to every commit reads this record as unjudged and the row
// green. That widening is what the review found nothing killing (F106).
func TestRecordRowJudgesARecordOneCommitInsideTheEdge(t *testing.T) {
	dir := recordRepo(t, recordPath)
	commitAll(t, dir, "the plan")
	writeSource(t, dir, "alpha/filler.go", "package alpha\n")
	commitAll(t, dir, "filler, so the record's commit is not the graft")
	writeSource(t, dir, recordPath, "# The record\n")
	commitAll(t, dir, "write the record up")
	writeSource(t, dir, "alpha/alpha.go", "package alpha\n\nvar Alpha = 1\n")
	land(t, dir, "demo_s1")

	// Three deep: the filler commit is the graft, and the record's commit and
	// the landing sit inside the clone with parents of their own.
	clone := shallowCloneAt(t, dir, 3)

	res := runRow(t, clone, "record")
	if res.Outcome != Red {
		t.Fatalf("a record one commit inside the edge came out %s: %s", res.Outcome, res.Evidence)
	}
	mustFit(t, res.Evidence, "shallow", "1 stale", "0 unjudged")
}

// D64 ruling 2: a slice this clone found no claim for is unseen on a shallow
// clone and waiting on a whole one. The row cannot tell a landing past the edge
// from a slice that never landed, so the word says the weaker thing.
func TestRecordRowCallsAnUnclaimedSliceUnseenOnAShallowClone(t *testing.T) {
	dir := recordRepo(t, recordPath)
	writeSource(t, dir, recordPath, "# The record\n")
	commitAll(t, dir, "the plan and the record")
	writeSource(t, dir, "alpha/alpha.go", "package alpha\n")
	land(t, dir, "demo_s1")
	writeSource(t, dir, "alpha/beta.go", "package alpha\n\nvar Beta = 2\n")
	commitAll(t, dir, "later work with no slice trailer")

	// One deep, so the landing commit is out of reach and the slice has no
	// claim this clone can see.
	clone := shallowCloneAt(t, dir, 1)

	res := runRow(t, clone, "record")
	if res.Outcome != Green {
		t.Fatalf("an unseen landing came out %s: %s", res.Outcome, res.Evidence)
	}
	mustFit(t, res.Evidence, "shallow", "0 records read", "1 unseen")
	if strings.Contains(res.Evidence, "waiting") {
		t.Errorf("a shallow clone called an unseen landing waiting: %s", res.Evidence)
	}
}

// A symlink where a record should be is a path pointing wherever it likes, and
// following it would judge a file the plan never named. Lstat is what keeps the
// row from following it; Stat would read the file at the other end as a record.
func TestRecordRowRefusesASymlinkWhereARecordShouldBe(t *testing.T) {
	dir := recordRepo(t, recordPath)
	writeSource(t, dir, "docs/elsewhere.md", "# Not the record\n")
	full := filepath.Join(dir, filepath.FromSlash(recordPath))
	if err := os.MkdirAll(filepath.Dir(full), 0o750); err != nil {
		t.Fatalf("could not make the record's directory: %v", err)
	}
	if err := os.Symlink("elsewhere.md", full); err != nil {
		t.Skipf("this machine cannot make a symlink: %v", err)
	}
	commitAll(t, dir, "the plan and a symlink")
	writeSource(t, dir, "alpha/alpha.go", "package alpha\n")
	land(t, dir, "demo_s1")

	res := runRow(t, dir, "record")
	if res.Outcome != Red {
		t.Fatalf("a symlink where a record should be came out %s: %s", res.Outcome, res.Evidence)
	}
	mustFit(t, res.Evidence, "1 missing", recordPath)
}

// A repo with no plan directory declares no record, so it can owe none. That is
// the plan row's own shape, ruled in D45.
func TestRecordRowIsGreenOnARepoWithNoPlan(t *testing.T) {
	res := runRow(t, newRepo(t), "record")
	if res.Outcome != Green {
		t.Fatalf("a repo with no plan came out %s: %s", res.Outcome, res.Evidence)
	}
	mustFit(t, res.Evidence, plan.Dir)
}

// A plan that will not read is the plan row's red. Two rows red for one fault
// is two reds for one fix, so this one reports unrunnable.
func TestRecordRowIsUnrunnableOnAPlanThatWillNotRead(t *testing.T) {
	dir := newRepo(t)
	writePlan(t, dir, "docs/plan/demo/demo_bet/demo_s1.md", "not frontmatter at all\n")

	res := runRow(t, dir, "record")
	if res.Outcome != Unrunnable {
		t.Fatalf("a plan that will not read came out %s: %s", res.Outcome, res.Evidence)
	}
}

// D65 ruling 3: reds lead every line, every row. A record this clone could not
// date is worth seeing and is nobody's next move, so a stale one leads.
func TestRecordRowLeadsWithTheRecordThatMadeItRed(t *testing.T) {
	dir := newRepo(t)
	writePlan(t, dir, "docs/plan/demo/demo_bet/demo_s1.md",
		sliceWithRecords("docs/one.md", "docs/two.md", "docs/three.md"))
	commitAll(t, dir, "the plan")
	for _, at := range []string{"docs/two.md", "docs/three.md"} {
		writeSource(t, dir, at, "# A record\n")
	}
	commitAll(t, dir, "two records, which will sit at the edge")
	writeSource(t, dir, "docs/one.md", "# A record\n")
	commitAll(t, dir, "one record, which will sit inside")
	writeSource(t, dir, "alpha/alpha.go", "package alpha\n")
	land(t, dir, "demo_s1")

	// Three deep: the two-record commit is the graft, so those two are
	// unjudged, and the third dates to a commit with a parent inside the clone
	// and is stale against the landing.
	clone := shallowCloneAt(t, dir, 3)
	res := runRow(t, clone, "record")
	if res.Outcome != Red {
		t.Fatalf("three records older than the work came out %s: %s", res.Outcome, res.Evidence)
	}

	stale := strings.Index(res.Evidence, "before the slice's own")
	edge := strings.Index(res.Evidence, "edge of this shallow clone")
	if stale < 0 {
		t.Fatalf("the line does not name the record that made it red: %s", res.Evidence)
	}
	if edge >= 0 && edge < stale {
		t.Fatalf("an unjudged record leads the line: %s", res.Evidence)
	}
}

// The row's counts are its own reading, and the line says so rather than
// claiming something about the repo (F87). Every count is in the head, where no
// cut reaches it (D33), and the arithmetic is searched rather than fed the
// maximum in every field at once (F81).
func TestTheRecordRowsCountsAlwaysFitTheLine(t *testing.T) {
	widest := 0
	for _, n := range []int{0, 1, 9, 10, 1 << 30, 1<<63 - 1} {
		for _, shallow := range []bool{false, true} {
			rep := recordReport{
				Records: n, Waiting: n,
				Missing: n, Stale: n, NeverCommitted: n, Unjudged: n,
				Shallow: shallow,
			}
			if got := len(rep.head()); got > widest {
				widest = got
			}
		}
	}

	// The constant certifies nothing on its own: a comment claiming 500 bytes
	// would pass a test that only held the head to it. So it is held to the
	// journal's own cap too (F115).
	if recordHeadBytes > journal.MaxTextBytes {
		t.Fatalf("the head's bound is %d bytes, over the journal's cap of %d",
			recordHeadBytes, journal.MaxTextBytes)
	}
	if widest > recordHeadBytes {
		t.Fatalf("the record row's head reaches %d bytes, and the comment claims at most %d",
			widest, recordHeadBytes)
	}
}

// The dogfood. This repo declares its own records, and every slice of this bet
// writes the same page, so a rule nobody can follow shows up here first.
func TestRecordRowIsGreenAndHonestOnThisRepo(t *testing.T) {
	res := runRow(t, ".", "record")
	if res.Outcome != Green {
		t.Fatalf("this repo's own record row came out %s: %s", res.Outcome, res.Evidence)
	}
	mustFit(t, res.Evidence, "0 missing", "0 stale")
}

// D23: a row added moves the major half of the version. This slice adds three
// rows, and R16 rules that as one bump, so 11.0 is no longer a version anybody
// can be held to.
func TestThisRepoDeclaresTheBumpTheRecordRowCost(t *testing.T) {
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
	if major < 12 {
		t.Errorf("%s declares %s, and this slice's three rows put this battery at 12.0 or past it",
			LockFile, lock.Version)
	}
}

// A record path is read from the repo root, however deep the caller sits. A row
// that resolved it against the working directory would judge a different file
// on every run started from a subdirectory.
func TestRecordRowReadsFromTheRepoRoot(t *testing.T) {
	dir := recordRepo(t, recordPath)
	commitAll(t, dir, "the plan")
	writeSource(t, dir, "alpha/alpha.go", "package alpha\n")
	writeSource(t, dir, recordPath, "# The record\n")
	land(t, dir, "demo_s1")

	res := runRow(t, filepath.Join(dir, "alpha"), "record")
	if res.Outcome != Green {
		t.Fatalf("the row run from a subdirectory came out %s: %s", res.Outcome, res.Evidence)
	}
}
