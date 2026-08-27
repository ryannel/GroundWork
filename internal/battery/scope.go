package battery

import "slices"

// The close scope, from D7 and R14.
//
// D7's bet-close validation was a ceremony list: a page of steps somebody was
// meant to work through. R14 replaces it with a scope. Later bets add their
// rows to the same scope.
//
// Two halves, and they are different things.
//
// The full suite is every row this battery holds. Per-slice scoping of the
// suites a row runs is a thing the spec asks for and nothing has built. So
// every row already runs at every verify, and a close is no exception.
//
// The four named rows carry the bet-level questions, and they are what this
// list holds. A close fails unless every one of them came back green or waived
// (D64 ruling 1).
//
// That is why the scope is a list rather than a sentence. A close that skipped
// what a close checks would be the ceremony step going missing again.
//
// What is not here is the project's own test suite. A green battery does not
// prove the tests pass: the run-evidence row reconciles which tests ran, not
// how they ended.
//
// D55 makes that a line on the driver's landing checklist until F70's row
// lands. Naming it here would be this scope claiming a check nobody built.
var closeScope = []string{"seal-verify", "board", "trace", "record"}

// CloseScope returns the rows a bet close runs beyond the full suite.
//
// It is returned fresh, so a caller that sorts or appends to it does not change
// what the next caller runs. Default follows the same rule for the same
// reason.
func CloseScope() []string {
	return slices.Clone(closeScope)
}

// UnmetAtClose returns the close-scope rows a run did not come back green or
// waived on, each with what it came back as.
//
// D64 ruling 1. Asking only whether a row is registered was a check that could
// never fire on the shipped battery. Three of the four rows a close exists for
// came back unrunnable, and the tool printed the scope and exited zero.
//
// A close is a claim that what a close checks ran and held. So a row that did
// not run fails it as surely as one that went red.
//
// Waived counts, because a waiver is a person's committed claim and D24 rules
// what that is worth. Nothing else does.
func UnmetAtClose(res RunResult) []string {
	came := map[string]Outcome{}
	for _, row := range res.Rows {
		came[row.ID] = row.Outcome
	}

	var unmet []string
	for _, id := range closeScope {
		outcome, ran := came[id]
		switch {
		case !ran:
			unmet = append(unmet, id+" did not run")
		case outcome != Green && outcome != Waived:
			unmet = append(unmet, id+" came back "+string(outcome))
		}
	}

	return unmet
}
