package battery

import (
	"fmt"

	"github.com/ryannel/groundwork/internal/journal"
)

// The chain row walks every session in the journal and says whether its lines
// still hang together. Each line carries the hash of the line before it in its
// own session, so a line deleted or rewritten leaves a hole a reader can see.
//
// The chain is per session because sessions are independent, and the union merge
// works on that. A repo-global chain would conflict on every merge.
//
// Three verdicts, and the two that are not red are worth stating plainly.
//
// A repo with no journal ref is green. Nothing was ever recorded there, so no
// chain can be broken. A red here would demand a journal before anything can
// verify. The line says only that: it never claims a chain held, because none
// was read.
//
// A journal ref that is there and holds no event is unrunnable, not green. That
// is D17's rule — a verifier may never pass on nothing. A ref pointing at
// ordinary history is the shape that lands here.
//
// A break is red, and the line names the session and the seq. Lines written
// before the chain existed carry no prev, so they cannot be checked: the row
// counts them and says they are unchained. It never calls them forged. This
// repo's own ref holds three bets of them, and a row that read them as breaks
// would open with a false red over the record of all three.
//
// Two ways past this row stay open, and D49 ruling 3 accepts both until the seal
// lands. A session's newest line can be rewritten and refiled at its new hash —
// nothing points at a tip yet. That is inherent to a hash chain, and only R4's
// signature answers it. And a whole session can be invented in the v1 shape,
// with no hashing at all, which this walk cannot tell from a genuine prefix. So
// both lines carry the count of sessions that hold nothing but unchained lines:
// a reader watches that number rather than trusting it.
func chainRow() Row {
	return Row{
		ID:       "chain",
		Kind:     "chain",
		Severity: Blocking,
		Check:    checkChain,
	}
}

func checkChain(c Context) Result {
	res, err := journal.CheckChain(c.RepoDir)
	if err != nil {
		// The row could not reach the thing it checks. Unrunnable is visible,
		// counted, and somebody's problem — and it is the honest answer when git
		// itself could not read the ref.
		//
		// cut, not printable: D49 ruling 2 is about the values a line takes off
		// a journal line, and these are git's own words about a ref it could not
		// walk. The red branch below is the only one a forger writes into, and
		// clipSession is where it goes through printable.
		//
		// That safety rests on the journal walkers quoting every path and
		// header they interpolate with %q, which escapes control characters.
		// Change one of those to %s and this line becomes a forger's (D50.1).
		return Result{Outcome: Unrunnable, Evidence: cut(err.Error())}
	}

	if !res.HasRef {
		return Result{
			Outcome: Green,
			Evidence: fmt.Sprintf(
				"there is no %s in this repo, so no line was ever recorded and none can be missing",
				journal.Ref),
		}
	}

	if res.Lines == 0 {
		return Result{
			Outcome: Unrunnable,
			Evidence: fmt.Sprintf("%s is there and holds no event, so there is no chain to read",
				journal.Ref),
		}
	}

	if len(res.Breaks) > 0 {
		return Result{
			Outcome: Red,
			Evidence: addIfItFits(
				countedBreaks(len(res.Breaks), res.Breaks[0]),
				"; "+unchainedClause(res)),
		}
	}

	head := fmt.Sprintf("%s across %s in %s: every chain holds",
		counted(res.Lines, "line", "lines"),
		counted(res.Sessions, "session", "sessions"),
		journal.Ref)

	if res.Unchained == 0 {
		return Result{Outcome: Green, Evidence: head}
	}

	return Result{Outcome: Green, Evidence: addIfItFits(head, ", and "+unchainedClause(res))}
}

// countedBreaks turns the breaks into one line: how many there are, then the
// first of them. All of them would not fit on a line of evidence, and the count
// is what tells the reader whether fixing the first one finishes the job.
//
// The count is written first because the line is read from the front. D33 rules
// that words give way and counts never do, so the count sits where nothing that
// comes after it can push it off, and what gives way is the tail of somebody's
// session id.
//
// It takes the count rather than reading it off a slice, so the arithmetic that
// proves this line fits can hand it the widest count an int can print.
func countedBreaks(n int, first journal.ChainBreak) string {
	where := brokenAt(first)

	if n == 1 {
		return "1 break: " + where
	}

	return fmt.Sprintf("%d breaks, the first: %s", n, where)
}

// brokenAt says where one break is: the session, and the seq when the break has
// one.
//
// A break with no seq sits on a line nobody can read a seq off, and printing
// zero would name a seq no line ever has — D49 ruling 4. A line naming no
// session of its own is placed the only way it can be, by where it sits.
func brokenAt(b journal.ChainBreak) string {
	session := clipSession(b.Session)
	if session == "" {
		session = "an unnamed session"
	} else {
		session = "session " + session
	}

	if b.Seq < 1 {
		return session + ": " + b.Why
	}

	return fmt.Sprintf("%s at seq %d: %s", session, b.Seq, b.Why)
}

// unchainedClause is what the row says about the lines written before the chain
// existed: how many there are, and how many sessions hold nothing else.
//
// Both lines carry it, per D49 ruling 3. The session count is the one a forger
// inflates by inventing a session in the v1 shape, and it is on the record so
// that somebody can watch it.
func unchainedClause(res journal.ChainResult) string {
	return fmt.Sprintf("%s came before the chain and went unchained, in %s with nothing chained",
		counted(res.Unchained, "line", "lines"),
		counted(res.UnchainedSessions, "session", "sessions"))
}

// addIfItFits puts a clause on the end of a line, and drops it when the line has
// no room left.
//
// The head is the part a test proves fits by arithmetic, and it carries the
// count a reader must never lose. The clause is the part that gives way. That
// is D33's order: words give way, counts never do. The clause's count is worth
// having; the head's is not negotiable.
func addIfItFits(head, clause string) string {
	line := head + clause
	if len(line) > journal.MaxTextBytes {
		return head
	}

	return line
}

// clipSession renders a session id safe to put on a line of evidence.
//
// A session id comes off a journal line, and a forger writing through git
// plumbing controls that field completely. The write path's charset check never
// touches it: that check guards what this tool writes, not what it reads.
//
// So it goes through printable before it goes through the clip — D38 ruling 4,
// applied where D49 ruling 2 found it missing. A newline in a session name
// would otherwise draw a row of its own in the verify table. A run that prints
// a forged row is worse than one that prints nothing.
//
// Then the length: left whole, an id can spend the line on itself, and the
// reader loses both the count and the reason the chain broke.
func clipSession(session string) string {
	const most = 40

	return cutTo(printable(session), most)
}
