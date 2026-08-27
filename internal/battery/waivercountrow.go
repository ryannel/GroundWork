package battery

import (
	"errors"
	"fmt"
	"io/fs"
	"maps"
	"slices"
	"strings"

	"github.com/ryannel/groundwork/internal/board"
	"github.com/ryannel/groundwork/internal/findings"
	"github.com/ryannel/groundwork/internal/journal"
	"github.com/ryannel/groundwork/internal/plan"
)

// The waiver counter reads how often each row has been waived.
//
// R14, from D37 ruling 2 and D24: three grants of one row inside one bet, or
// five across the repo, and that row stays red until a finding names it.
//
// Grants are counted from each waiver file's own git history, per D38 — not
// from the journal alone. The journal records what a run did with a waiver; git
// records who granted it and when, and git is the record a person cannot edit
// by running the tool again.
//
// One grant is one commit that changed one waiver file. A rewrite in a commit
// of its own is a re-grant, which D24's letter allows, and it counts as another
// grant. Three re-grants of one file is a row three people in a row decided to
// keep waived.
//
// A merge is not a granting act (D38, D40). Neither is a move: a pure rename
// changes nothing about the waiver, so it is counted and named and never read
// as a grant (D65 ruling 2). Operations that decide nothing never count as
// decisions.
//
// A waiver file's history starts at the commit that made it. A path reused
// after a deletion is a new file, and a dead file's grants die with it (D65
// ruling 1). Otherwise a new waiver could arrive at an old path already over a
// threshold, red on a row that never had those grants.
//
// One limit is worth naming rather than leaving implied. The count is over the
// waiver files the directory holds now, because R14 says each waiver file's own
// git history. A waiver deleted after it expired takes its grants with it.
//
// Closing that means reading the directory's whole history, and resolving every
// path a waiver ever sat at. That is a bigger reading than this row. Nothing in
// D24 or D37 asks for it yet.
//
// The bet a grant landed in is the `Bet` trailer on its commit. A grant with no
// such trailer counts toward the repo's five and toward no bet's three: naming
// a bet nobody wrote would be the tool inventing the fact the threshold turns
// on.
//
// A finding names a row when an entry title in docs/findings.md carries the
// phrase "<id> row" (D64 ruling 4).
//
// Nine of sixteen row ids are ordinary English words. The ledger's titles hold
// most of them already, for unrelated reasons. A bare-word match cleared the
// record row's threshold with an entry about a spend query, so the threshold
// could never bite.
//
// The phrase is matched at word edges, by the findings package's own reader.
// That is the rule that decides whether a decision names a defect class.
//
// A shallow clone cannot see that history, so the row reports unrunnable and
// never counts zero. This is where the battery's shallow-clone posture is
// written down, because this row is the strictest about it.
//
// Three rows meet the same missing history and answer differently. All three
// are right.
//
// This one refuses. Its verdict is a threshold over a count of every grant, so
// a partial history makes the count wrong. Wrong toward the pass, at that.
//
// The board names the short history and keeps judging (D56 ruling 3). An unseen
// landing pushes a proof toward expected red, which is the flagged direction.
//
// The record and history rows follow the board. What they cannot see they leave
// unjudged and count, never misjudge.
func waiverCountRow() Row {
	return Row{
		ID:       "waiver-count",
		Kind:     "waiver-count",
		Severity: Blocking,
		Check:    checkWaiverCount,
	}
}

// grantsPerBet and grantsPerRepo are R14's two thresholds. At or over either
// one, the row it counts stays red until a finding names it.
const (
	grantsPerBet  = 3
	grantsPerRepo = 5
)

func checkWaiverCount(c Context) Result {
	root, err := journal.RepoRoot(c.RepoDir)
	if err != nil {
		return Result{Outcome: Unrunnable, Evidence: cut(err.Error())}
	}

	shallow, err := journal.Shallow(root)
	if err != nil {
		return Result{Outcome: Unrunnable, Evidence: cut("the waiver counter could not read this repo: " + err.Error())}
	}
	if shallow {
		// Unconditional, before a single file is read. A count taken here would
		// be a count of the grants that happen to be in reach, and R14 says the
		// row never reports that as a zero.
		return Result{
			Outcome: Unrunnable,
			Evidence: fmt.Sprintf(
				"this clone is shallow, so the grant history behind %s is not all here: grants nobody can see would count as zero and pass a threshold. Fetch the full history to run this row",
				WaiverDir),
		}
	}

	rep, err := countGrants(root)
	if err != nil {
		return Result{Outcome: Unrunnable, Evidence: cut("the waiver counter could not read this repo: " + err.Error())}
	}

	return rep.verdict()
}

// unattributed is the bucket a grant lands in when its commit does not name a
// bet the plan declares.
//
// It is one bucket, and it shares the per-bet limit (D64 ruling 5). A misstated
// attribution must never weaken a threshold, and three grants under three
// invented bet names is the shape that used to.
const unattributed = ""

// rowGrants is what one row's waivers came to.
//
// The row's own id is not here: the caller holds it, and a second copy of it
// would be a second answer about which row these grants belong to.
type rowGrants struct {
	total int

	// worst is the bucket holding the most grants of this row, and inBet how
	// many it holds. A row over the bet threshold is named with its bucket,
	// because that is where the reader goes to look.
	worst string
	inBet int
}

// over reports whether this row has reached either threshold, and which.
func (g rowGrants) over() (why string, yes bool) {
	switch {
	case g.inBet >= grantsPerBet:
		return fmt.Sprintf("has %s inside %s, at the limit of %d",
			counted(g.inBet, "grant", "grants"), bucketName(g.worst), grantsPerBet), true
	case g.total >= grantsPerRepo:
		return fmt.Sprintf("has %s across this repo, at the limit of %d",
			counted(g.total, "grant", "grants"), grantsPerRepo), true
	default:
		return "", false
	}
}

// bucketName is how a bucket reads on the row's line.
func bucketName(bet string) string {
	if bet == unattributed {
		return "the unattributed bucket"
	}

	return bet
}

// counterReport is what one reading of the waiver directory came to.
type counterReport struct {
	// Files is every entry in the waiver directory, and Unread the ones that
	// are not waivers this tool can read. An unread file names no row, so it is
	// nobody's grant — counted and named rather than passed over (D38).
	Files  int
	Unread int

	// Grants is every grant counted. Merges and Renames are the commits that
	// touched a waiver file and decided nothing: a merge is not a granting act,
	// and neither is a move.
	Grants  int
	Merges  int
	Renames int

	// Over is the rows at or past a threshold, and Named how many of those a
	// finding names. Only the difference is red. Named is not in the head: the
	// journal's cap holds six counts, and each row at a threshold says on its
	// own hit whether a finding answers it.
	Over  int
	Named int

	// Misstated is the grants whose commit named no bet this plan declares.
	// They pool into one bucket that shares the per-bet limit, so a misstated
	// attribution can only ever tighten a threshold (D64 ruling 5).
	Misstated int

	// hits are the rows at a threshold no finding answers. They lead the line,
	// because they are the ones a reader has to act on (D64 ruling 8).
	hits []hit

	// cleared is the rows a finding answers, unread the files that are not
	// waivers, and moved the commits that only renamed one. None is anybody's
	// next move, so they follow the reds and give way to them when the line
	// runs out.
	cleared []hit
	unread  []hit
	moved   []hit
}

// Sound reports whether every row at a threshold is answered by a finding.
func (r counterReport) Sound() bool {
	return r.Over == r.Named
}

// countGrants reads the waiver directory and every waiver file's own history.
func countGrants(root string) (counterReport, error) {
	entries, err := readWaivers(root)
	if err != nil {
		return counterReport{}, err
	}

	bets, err := declaredBets(root)
	if err != nil {
		return counterReport{}, err
	}

	rep := counterReport{Files: len(entries)}

	// row id to bet to grants. The map is built before anything is judged, so a
	// row waived by two files is counted once across both of them.
	byRow := map[string]map[string]int{}

	for _, e := range entries {
		if !e.readable() {
			rep.Unread++
			rep.unread = append(rep.unread,
				hit{file: printable(e.file), shape: "is not a waiver this tool can read, so it names no row"})

			continue
		}

		// Every name this waiver has had, and what each commit did to it. The
		// trailer read is the ordinary one, which keeps merges visible — git's
		// own --follow drops them.
		paths, changes, err := journal.FileHistory(root, e.file)
		if err != nil {
			return counterReport{}, err
		}

		commits, err := journal.TrailersFor(root, "Bet", paths...)
		if err != nil {
			return counterReport{}, err
		}

		born := bornAt(changes)
		renames := renamesAmong(changes)

		for _, commit := range commits {
			switch {
			case commit.Parents > 1:
				rep.Merges++

			case renames[commit.ID]:
				rep.Renames++
				rep.moved = append(rep.moved, hit{
					file:  printable(e.file),
					shape: "was moved in " + brief(commit.ID) + ", which decides nothing",
				})

			default:
				rep.Grants++

				bet := rep.attribute(commit, bets)
				if byRow[e.body.Row] == nil {
					byRow[e.body.Row] = map[string]int{}
				}
				byRow[e.body.Row][bet]++
			}

			// The history stops at the commit that made this file. A path reused
			// after a deletion is a new file, and a dead file's grants die with
			// it (D65 ruling 1).
			if commit.ID == born {
				break
			}
		}
	}

	named, err := namedByAFinding(root)
	if err != nil {
		return counterReport{}, err
	}

	rep.judge(byRow, named)

	return rep, nil
}

// bornAt returns the commit that created a file's current incarnation: the
// newest commit that added it, rather than the one that first gave the path a
// file.
//
// git reports a rename as a rename, so an add here is a real add. A copy is an
// add too: it made a file that was not there, out of one that was. Walking
// newest first, the first of either is the birth of the file that is there now,
// and everything under it belongs to a file somebody deleted.
//
// An empty answer means no add is in reach, which a shallow clone can produce.
// The counter never runs on one, and a caller that met it would count the whole
// visible history — the answer that names too much rather than too little.
func bornAt(changes []journal.FileChange) string {
	for _, change := range changes {
		if strings.HasPrefix(change.Status, "A") || strings.HasPrefix(change.Status, "C") {
			return change.Commit
		}
	}

	return ""
}

// renamesAmong returns the commits whose only change to the file was moving it.
//
// A pure rename is git's R100: the content is identical either side of it. It
// decides nothing about whether a row should be waived, so it is counted and
// named and never read as a grant — the merge rule's shape, applied to the
// other operation that decides nothing (D65 ruling 2). A move that also edited
// the file carries a lower score and is a re-grant like any other rewrite.
func renamesAmong(changes []journal.FileChange) map[string]bool {
	moved := map[string]bool{}
	for _, change := range changes {
		if change.Status == pureRename {
			moved[change.Commit] = true
		}
	}

	return moved
}

// pureRename is git's own status for a move that changed nothing.
const pureRename = "R100"

// attribute says which bucket one grant belongs to.
//
// The Bet trailer is held to the board's four validity shapes, against the bets
// the plan declares. They are the four the board applies to a Slice trailer,
// through the same reader, so two rows cannot judge one commit differently.
//
// A value that fails any of them is not an attribution. It pools.
func (r *counterReport) attribute(commit journal.TrailerCommit, bets map[string]bool) string {
	value := ""
	if len(commit.Values) > 0 {
		value = commit.Values[0]
	}

	if shape, _ := board.JudgeValue(value, len(commit.Values) == 1, bets); shape != board.ShapeSound {
		r.Misstated++

		return unattributed
	}

	return printable(value)
}

// declaredBets returns the bet ids this repo's plan declares.
//
// A repo with no plan declares none, so every attribution pools. That is the
// safe direction and the honest one: a bet nobody wrote down is not a bet a
// threshold can be spread across.
func declaredBets(root string) (map[string]bool, error) {
	bets := map[string]bool{}

	set, err := plan.Load(root)
	switch {
	case errors.Is(err, plan.ErrNoPlanDir), errors.Is(err, plan.ErrNoUnits):
		return bets, nil
	case err != nil:
		// A plan that will not read is the plan row's red. Here it means the
		// same as no plan: nothing declares a bet.
		return bets, nil
	}

	for _, bet := range set.Bets {
		bets[bet.ID] = true
	}

	return bets, nil
}

// judge turns the counts into the report's verdict, in a fixed order so one
// repo always prints one line.
func (r *counterReport) judge(byRow map[string]map[string]int, named func(row string) bool) {
	for _, row := range slices.Sorted(maps.Keys(byRow)) {
		var g rowGrants
		// Sorted, so one repo prints one line. Map order is random, and reading
		// it straight made twelve runs of one repo print two diagnoses (F114).
		for _, bet := range slices.Sorted(maps.Keys(byRow[row])) {
			n := byRow[row][bet]
			g.total += n

			// The unattributed bucket is a bucket like any other here: it shares
			// the per-bet limit, so a misstated attribution never buys room. A
			// tie breaks toward the named bet, because a bet a reader can go and
			// look at beats a bucket (D65 ruling 3).
			if n > g.inBet || (n == g.inBet && g.worst == unattributed && bet != unattributed) {
				g.worst, g.inBet = bet, n
			}
		}

		why, yes := g.over()
		if !yes {
			continue
		}

		r.Over++
		if named(row) {
			r.Named++
			r.cleared = append(r.cleared, hit{file: printable(row), shape: why + ", and a finding names it"})

			continue
		}

		r.hits = append(r.hits, hit{file: printable(row), shape: why + ", and no finding names it"})
	}
}

// found is everything the row has to name, reds first.
//
// hitEvidence shows as many whole hits as fit and counts the rest. So this
// order decides what a narrow line keeps.
//
// A row at a threshold no finding answers is somebody's next move. A cleared
// row and an unreadable file are not. A line that led with either would bury
// the one that matters inside "and N more" (D64 ruling 8).
func (r counterReport) found() []hit {
	found := slices.Clone(r.hits)
	found = append(found, r.cleared...)
	found = append(found, r.unread...)

	return append(found, r.moved...)
}

// namedByAFinding returns a test for whether the findings ledger names a row.
//
// A ledger that is not there answers no for every row. That is the safe
// direction: a repo with no ledger has no finding naming anything, so an
// over-waived row stays red rather than being cleared by a file nobody wrote.
func namedByAFinding(root string) (func(row string) bool, error) {
	path, err := findings.LedgerPath(root)
	if err != nil {
		return nil, err
	}

	ledger, err := findings.ParseFile(path)
	if err != nil {
		if errors.Is(err, fs.ErrNotExist) {
			return func(string) bool { return false }, nil
		}

		return nil, err
	}

	return func(row string) bool {
		for _, entry := range ledger.Entries {
			if findings.Names(entry.Title, row+" row") {
				return true
			}
		}

		return false
	}, nil
}

// counterHeadBytes is the widest the head can print. A test searches the count
// space for it rather than feeding the maximum into every field at once (F54,
// F61, F81).
//
// The fixed words come to 85 bytes at their widest, which is the plural
// spelling of each noun. Six counts print at most 19 digits each. So the head
// is at most 199 bytes, one inside the journal's cap. Six is where counts stop
// fitting.
const counterHeadBytes = 196

// verdict turns the report into the row's outcome and its one line.
//
// Every count is in the head, where no cut can reach it (D33, F61).
func (r counterReport) verdict() Result {
	outcome := Green
	if !r.Sound() {
		outcome = Red
	}

	head := r.head()

	found := r.found()
	if len(found) == 0 {
		return Result{Outcome: outcome, Evidence: cutTo(head+r.say(), journal.MaxTextBytes)}
	}

	return Result{Outcome: outcome, Evidence: hitEvidence(head, found, nil)}
}

// head is every count, in the order a reader needs them: what was read, then
// what it came to, then what is at a line.
//
// Six counts is what the journal's cap holds, so two are elsewhere. The count
// of distinct rows waived is dropped, because the rows a reader acts on are the
// ones at a limit and those are named one by one. The count of files that are
// not waivers is dropped too: each of them is named here as a hit, and the
// run's own loud block names every one again with the reason (D38 ruling 5).
func (r counterReport) head() string {
	return fmt.Sprintf("%s: %s, %d merges, %s not read: %s at a limit, %d misstated: ",
		counted(r.Files, "waiver file", "waiver files"),
		counted(r.Grants, "grant", "grants"),
		r.Merges,
		counted(r.Renames, "rename", "renames"),
		counted(r.Over, "row", "rows"),
		r.Misstated)
}

// say is what a line with nothing to name says instead.
//
// It says what was read, never what is so of the repo (F87). What this row
// reads is the waiver files the directory holds now. So an empty directory gets
// the same narrow sentence as a full one.
func (r counterReport) say() string {
	return "no row read has reached either limit"
}
