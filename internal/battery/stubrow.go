package battery

import (
	"errors"
	"fmt"
	"slices"
	"unicode/utf8"

	"github.com/ryannel/groundwork/internal/adapter"
	"github.com/ryannel/groundwork/internal/board"
	"github.com/ryannel/groundwork/internal/journal"
	"github.com/ryannel/groundwork/internal/plan"
)

// The stub check judges the reds. R10: a proof its plan expects red has to fail
// at a real assertion, and passing, skipping, failing to build or dying before
// the assertion each fail the row with the reason named.
//
// It judges the board the board row derives, from the same three inputs and the
// same derivation. Expected state is not worked out again here: a second answer
// to "which proofs should be red" would be two rows able to disagree about one
// repo (D54 ruling 1).
//
// What makes it red, and what does not, is the whole judgement here.
//
// A proof that passed with a test that cannot fail is a stub, and it is red with
// the honesty scan's own words for what is wrong. The three styles the ladder
// names are these: an empty body, a commented-out assertion, and an always-true
// assertion. All three pass when the plan says they must fail.
//
// A proof that passed with a test that can fail is not. That is green ahead of
// plan — the plan lagging the work — and D56 ruling 1 already ruled it: never
// red, because a red there fires on every honest slice between its test going
// green and its commit landing, and on every repo whose history predates the
// trailer. So the row counts it in its own head, where no cut reaches it, and
// leaves the naming to the board row, whose subject it is.
//
// The line between those two is the honesty scan's judgment, called rather than
// copied. R10 forbids a second definition of vacuous, and this row holds none:
// it asks readTests what the scan makes of the proof's own test and prints the
// answer whole.
//
// A test the scan cannot follow reads as honest. That is the scan's own stance —
// precision over recall, written to miss rather than to guess — and it is where
// this row's reach ends. F83 and F86 name the size of it: a helper in another
// file, an assertion library, a fake recorder, a condition no comparison shape
// covers. Every one of those passes here, so the row says what the scan found
// and never that a repo holds no stub.
//
// A proof that was skipped is red. A skipped test proves nothing, whatever its
// plan expects of it, and nothing about a skip reads as work in progress.
//
// A proof whose test nobody has written is not red on its own. A plan names the
// proofs of slices nobody has built yet — that is what a plan is for — so the row
// counts them and leaves them alone. It is red, and named, when the slice that
// owed the proof has landed: a slice that landed without its test claimed work
// it never wrote, and nothing else in the battery sees that.
//
// A surface that did not build, or whose binary died before it finished, is red
// with the surface named. A proof that cannot compile proves nothing, and one
// whose runner died never reached anybody's assertion. Both arrive for a whole
// run rather than for one test — the stack loses the log when the build breaks
// or the binary dies — so the surface is what gets named.
//
// It is named beside the rest of the reading, never instead of it. The row still
// reads every surface it can and still names every stub it finds, because a
// broken surface is not a reason to stop looking at the ones that work (F89).
// A surface that broke for a reason the row cannot name rides as a clause and
// reddens nothing, which is the board row's rule: a red built out of missing
// data is not a red. Either way, no proof is blamed for having no result while
// a surface went unrun.
//
// Everything the row could not reach at all is unrunnable: a plan that will not
// read, a manifest it cannot load, a history git would not give it.
func stubRow() Row {
	return Row{
		ID:       "stub",
		Kind:     "stub",
		Severity: Blocking,
		Check:    checkStub,
	}
}

// stubDerivation is the stub check's own words for the board it derives.
var stubDerivation = derivation{
	name: "stub check",
	noPlan: fmt.Sprintf(
		"there is no %s directory, so this repo expects no proof red and can stub none", plan.Dir),
	noProof: fmt.Sprintf(
		"%s names no proof, so there is no red to judge and nothing to run", plan.Dir),
}

func checkStub(c Context) Result {
	d, bad, ok := stubDerivation.derive(c)
	if !ok {
		return bad
	}

	var rows []board.Row
	for _, row := range d.board.Rows {
		if row.Expected == board.ExpectRed {
			rows = append(rows, row)
		}
	}
	if len(rows) == 0 {
		// Every milestone the plan names has landed, so the plan expects no
		// proof red. There is no red to judge and none to get wrong. Whether
		// those proofs are green is the board row's question, and the line
		// claims nothing about it.
		//
		// It is answered before the surfaces, because expected state comes from
		// plan position and nothing a run did can move it. A repo with no red to
		// judge owes this row nothing, whatever its surfaces did — and what they
		// did is the run-evidence row's own red.
		return Result{
			Outcome: Green,
			Evidence: fmt.Sprintf("every one of the %s the plan names is expected green, "+
				"so the stub check has no red to judge",
				counted(len(d.board.Rows), "proof", "proofs")),
		}
	}

	read := readTests(d.scan)

	return stubVerdict(rows, cannotFail(read, d.set), read, brokenSurfaces(d))
}

// broken is what became of the surfaces the run could not reach.
type broken struct {
	// hits are the surfaces R10 names: one that did not build, one whose binary
	// died, one the runner's own clock stopped. Each is a fact about the code and
	// turns the row red.
	hits []hit

	// unreadable are the surfaces the row cannot name a reason for. They are
	// missing data, not a defect, so they ride as a clause and redden nothing.
	unreadable []string

	// said is the seam's own words about a surface the row did name. The hit
	// carries the row's verdict — did not build, died — because that is the
	// reason R10 asks for and it is what a reader acts on. The stack's own
	// message is colour beside it, so it rides as a clause, which is what a
	// narrow line gives up first.
	said []string

	// any says whether a surface went unrun at all, whichever kind. A proof with
	// no result may simply not have been reached when this is set, so no proof is
	// blamed for a missing test.
	any bool
}

// brokenSurfaces reads what the run could not reach.
//
// A build failure and a death are R10's own answers and not missing data: they
// are facts about the code, and the seam names each of them apart so a caller
// can tell them from a run that broke some other way.
//
// Neither kind stops the row reading the rest. F89: a broken surface used to be
// answered before any test source was read, so a stub planted on a healthy
// surface got no count and no name — the gate closed red and the defect the row
// exists to name was invisible behind the noise. The honesty scan already does
// this right, keeping its hits and riding an unreadable surface as a clause, and
// this follows it.
func brokenSurfaces(d derived) broken {
	var out broken

	for _, one := range d.blocked {
		out.any = true

		said, named := died(one.Err)
		if !named {
			out.unreadable = append(out.unreadable,
				fmt.Sprintf("the %s could not run the surface %q: %s",
					d.name, one.Surface, d.scan.reason(one.Err)))

			continue
		}

		out.hits = append(out.hits, hit{file: fmt.Sprintf("the surface %q", one.Surface), shape: said})
		out.said = append(out.said,
			fmt.Sprintf("the surface %q said: %s", one.Surface, complaint(d.scan, one.Err)))
	}

	return out
}

// maxComplaintBytes is how much of a stack's own message the clause carries.
//
// It is narrower than a row's ordinary budget for another tool's words, and on
// purpose: this clause has to fit beside a head, a named surface and a named
// stub, or the line drops it and the stack's words never reach anybody.
const maxComplaintBytes = 50

// complaint is what the stack itself said about a surface that would not run,
// short enough to ride a clause.
//
// The end is kept rather than the start, because a compiler and a runtime both
// open with the package path and finish with the thing somebody has to fix. It
// drops the seam's own marker along the way, which the row's hit has already
// said in its own words.
func complaint(s scanned, err error) string {
	return endOf(s.tidy(err.Error()), maxComplaintBytes)
}

// endOf keeps the last few bytes of a message, whole runes only.
func endOf(said string, most int) string {
	if len(said) <= most {
		return said
	}

	kept := said[len(said)-(most-3):]
	for len(kept) > 0 && !utf8.ValidString(kept) {
		kept = kept[1:]
	}

	return "..." + kept
}

// died says how a run ended before it could report an assertion, and whether it
// ended that way at all.
//
// The three are the seam's own markers, never a reading of its words. A row that
// matched the adapter's sentences would be a second statement of what a build
// failure is (D54 ruling 1).
//
// Each answer is a few words, because the line already says what the row makes
// of it and the seam's own reason follows. The words here only have to say which
// of the three happened.
//
// One of the three is hard to reach on purpose. The board gives a run ten
// minutes and go test's own default clock is also ten minutes, so on a default
// setup the board's clock fires first and the run comes back stopped rather than
// timed out. The clock arm is for a project that sets a shorter -timeout of its
// own, through its flags or GOFLAGS. It is proved by asking this function
// directly rather than by waiting ten minutes for a fixture.
func died(err error) (string, bool) {
	switch {
	case errors.Is(err, adapter.ErrBuildFailed):
		return "did not build", true
	case errors.Is(err, adapter.ErrTimedOut):
		return "ran out of the runner's own clock", true
	case errors.Is(err, adapter.ErrCrashed):
		return "died before its tests finished", true
	default:
		return "", false
	}
}

// cannotFail turns the honesty scan's reading into its judgment of each proof's
// own test, by proof id. A proof is absent when its test can fail, when the scan
// could not follow it, and when nobody has written it.
//
// The join is the marker as the plan wrote it, not the safe copy the board row
// carries: a marker wider than the board's print cap would otherwise miss its
// own test and read as honest.
func cannotFail(read sourceRead, set plan.Set) map[string]string {
	shapes := map[string]string{}
	for _, one := range read.found {
		// An honest reading never enters the map, and a file the scan could not
		// parse has no name to enter under. That is what keeps a stub in one
		// suite from being masked by an honest test of the same name in another:
		// one test name answers for one proof, and folding the two would let the
		// honest copy answer for the stub.
		if one.name == "" || one.shape == "" {
			continue
		}

		// So every shape in the map is a vacuous one, and any of them turns the
		// row red.
		//
		// The line below decides nothing but wording: where two suites both hold
		// a vacuous test of one name, it is the first read that gets named, and
		// the other would have turned the row red on the same proof anyway. No
		// verdict rests on it, which is why blanking it changes no answer.
		if _, said := shapes[one.name]; !said {
			shapes[one.name] = one.shape
		}
	}

	byProof := map[string]string{}
	for _, s := range set.Slices {
		for _, proof := range s.Proofs {
			if shape, said := shapes[proof.Marker]; said {
				byProof[proof.ID] = shape
			}
		}
	}

	return byProof
}

// how is what one proof its plan expects red turned out to be.
type how int

const (
	// rightReason: it failed at a real assertion. The good red.
	rightReason how = iota

	// notRightReason: it is red for no reason at all, or not red. This is the
	// one that turns the row red.
	notRightReason

	// aheadOfPlan: it passed, and its test can fail. The plan lagging the work.
	aheadOfPlan

	// noResult: the run reported nothing about it — nobody has written its test,
	// or a surface the run could not reach holds it.
	noResult
)

// judgeRed says what one proof its plan expects red turned out to be, and the
// row's own words for it. The words are empty when there is nothing to name.
//
// notFailing is the honesty scan's judgment of this proof's test, empty when the
// test can fail and empty when the scan could not follow it. The two are not
// told apart here, and the row's line says which question was asked rather than
// claiming the answer covers every stub there is.
//
// everySurfaceRan says whether the run reached every surface the manifest
// declares. A proof with no result is blamed only when it did: where a surface
// went unrun, a missing result may be the surface rather than a missing test,
// and a red built out of that is a red built out of missing data.
func judgeRed(row board.Row, notFailing string, everySurfaceRan bool) (how, string) {
	if !slices.Contains(board.Actuals(), row.Actual) {
		// A state the board grew that this row was never told about. Every arm
		// below answers one of the four the run can report, and letting an
		// unknown fifth fall into the last of them would read it as the good red
		// — the one direction that hides work. D25's stance, applied here: what
		// this row cannot read never passes in silence.
		return notRightReason, "came back in a state the stub check does not know"
	}

	switch row.Actual {
	case board.Passed:
		if notFailing != "" {
			return notRightReason, "passed, and its test " + notFailing
		}

		return aheadOfPlan, ""

	case board.Skipped:
		return notRightReason, "was skipped, and a test that did not run proves nothing"

	case board.NeverRan:
		if row.Landed && everySurfaceRan {
			return notRightReason, "has no test on any declared surface, and its slice has landed"
		}

		return noResult, ""

	default:
		// board.Failed, and nothing else: the guard above turned away every
		// state the run cannot report, and the three arms above answer the other
		// three. It is written as the default arm because Go wants one that
		// returns, not because anything unknown lands here.
		if notFailing != "" {
			return notRightReason, "failed, and its test " + notFailing
		}

		return rightReason, ""
	}
}

// stubVerdict judges every proof the plan expects red and returns the row's
// outcome and its one line.
func stubVerdict(rows []board.Row, notFailing map[string]string, read sourceRead, unrun broken) Result {
	totals := stubTotals{expected: len(rows), broken: len(unrun.hits)}

	// The surfaces come first among the hits. A surface that did not build or
	// died explains why every proof on it has no result, so a reader who gets one
	// line and no more should get that one.
	totals.hits = append(totals.hits, unrun.hits...)

	for _, row := range rows {
		kind, said := judgeRed(row, notFailing[row.Proof], !unrun.any)

		switch kind {
		case rightReason:
			totals.honest++
		case aheadOfPlan:
			totals.ahead++
		case noResult:
			totals.noResult++
		case notRightReason:
			totals.stubbed++
		}

		// The hit is the proof id and what became of it. There is no line and no
		// file: a proof is not a place in source, and the test it names is found
		// by its marker rather than by a path.
		//
		// So when a line is too narrow for one whole hit, the ladder keeps the
		// proof and gives up the reason. That is the other way round from D57
		// ruling 6, and for the reason that ruling gives: there the value could
		// be fetched from the commit the line already named, and here it is the
		// reason that can be fetched, by running the row again on the proof the
		// line named.
		if said != "" {
			totals.hits = append(totals.hits, hit{file: row.Proof, shape: said})
		}
	}

	// Ordered most droppable first: a red line gives up a clause of its tail
	// before it gives up the name of a hit, and it gives up the front one. The
	// stack's own words about a surface already named goes first, then what the
	// scan could not read, then what the run could not reach, then the count of
	// files nobody read — the same order the honesty scan puts its own clauses
	// in.
	if len(unrun.said) > 0 {
		totals.clauses = append(totals.clauses, listed(unrun.said, "; "))
	}
	if len(read.blocked) > 0 {
		totals.clauses = append(totals.clauses, listed(read.blocked, "; "))
	}
	if len(unrun.unreadable) > 0 {
		totals.clauses = append(totals.clauses, listed(unrun.unreadable, "; "))
	}
	totals.clauses = append(totals.clauses, read.notes.clauses()...)

	return totals.verdict()
}

// stubTotals is what one reading of the reds came to, in the numbers its line is
// built from.
//
// The four states partition the proofs the plan expects red: each one is red for
// the right reason, not red for the right reason, green ahead of its plan, or
// carrying no result at all. So the head says what became of every one of them
// and a reader never has to subtract.
type stubTotals struct {
	// expected is how many proofs the plan expects red — the row's whole
	// subject, and the number every other count is a part of.
	expected int

	honest   int
	stubbed  int
	ahead    int
	noResult int

	// broken is how many surfaces went unrun for a reason R10 names. It turns
	// the row red and it is not a count of proofs, so it stays out of the head
	// and rides as a named hit instead — where a reader can act on it, and where
	// hitEvidence counts whatever it could not fit.
	broken int

	hits    []hit
	clauses []string
}

// verdict turns the totals into the row's outcome and its one line.
//
// Every count is in the head, where no cut can reach it. D33 rules that words
// give way and counts never do, and F61 is what happens when a loud count rides
// in a clause instead. The fixed words come to 76 bytes, the widest spelling of
// the noun to 7 more, and five counts print at most 19 digits each, so the head
// is at most 178 bytes however large the counts get — which leaves the journal's
// cap room for what a reader can act on.
func (t stubTotals) verdict() Result {
	head := t.head()

	if len(t.hits) == 0 {
		// The clauses ride this branch too. A signal the row only shows when
		// something else is already wrong is aimed the wrong way (F76), and a
		// clean stub row is exactly when a reader most needs to know the scan
		// could not read some of the project.
		return Result{
			Outcome:  t.outcome(),
			Evidence: cutTo(head+t.say()+tailOf(t.clauses), journal.MaxTextBytes),
		}
	}

	return Result{Outcome: t.outcome(), Evidence: hitEvidence(head, t.hits, t.clauses)}
}

// outcome is the row's verdict: a proof that is not red for the right reason, or
// a surface whose run never reached an assertion. Nothing else.
func (t stubTotals) outcome() Outcome {
	if t.stubbed > 0 || t.broken > 0 {
		return Red
	}

	return Green
}

// head is every count, in the order a reader needs them.
//
// The widest is the plural spelling — "proofs" is a byte longer than "proof" —
// so the bound is measured there and a line that reads singular is always
// narrower.
func (t stubTotals) head() string {
	return fmt.Sprintf("%s expected red: %d red at an assertion, %d not, %d ahead of plan, %d with no result: ",
		counted(t.expected, "proof", "proofs"),
		t.honest, t.stubbed, t.ahead, t.noResult)
}

// say is what a line with nothing to name says instead.
//
// It says what was checked and who checked it, never what is so. F87: the
// sentence used to read "none of them is a stub", which is a claim about the
// world decided by a scan that reads Go source and is written to miss rather
// than to guess. Seven planted stubs walked past it in review. What the row can
// stand behind is the scan's own finding, and that is what it now says.
//
// There is no second sentence for a red line. A red always has something to
// name — a proof or a surface — so it takes the branch above this one.
func (t stubTotals) say() string {
	return "the honesty scan found no stub among them"
}
