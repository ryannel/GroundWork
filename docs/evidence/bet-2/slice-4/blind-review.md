# Blind review — Bet 2, slice 4: the run-evidence row

Reviewer: a fresh session, no contact with the builder. Method: three mutations of its own, three end-to-end fixture repos, and a mechanism-level probe of what go test -json emits when killed mid-suite. Verdict: **lands after fixes**. Date: 2026-08-22.

## Findings

HIGH — two proven false reds, against the bet's own done condition:

1. A Go run that died half way came back as a successful partial log, and the row turned the unfinished tests into never-run reds — proven with a fixture whose second test panics, and at the mechanism level for timeout expiry: a killed go test leaves terminal events for finished packages and nothing for the rest, so the battery's own clock manufactured false reds. The exec shape got this right; the Go shape did not, and conformance never compared them. Fixed: a run with a non-terminal test or a dead context is unrunnable, never a partial tally.
2. A nested module — tools/, examples/, any directory with its own go.mod — was walked by Discover and never reached by go test ./..., so its tests red as never-run on an ordinary repo layout. Fixed: the walk skips nested modules and _-prefixed directories, keeping both sides on the same package set.

MED:

3. The exec side of the ErrNoTests seam was unpinned — degrading B18's flagship red to unrunnable for every non-Go stack survived the suite. Pinned both shapes.
4. The D17 discovered-nothing branch was dead code, and the test named for it covered a different path — flipping the branch to green passed everything. Made reachable or removed, with the mutation killed.
5. The 15-minute row timeout was unpinned, untested at expiry, and shared across surfaces without saying so. Injectable, pinned, stated.

LOW:

6. Judgment call 8 (tests written after implementation for unreachable branches) was assessed honest — expected answers come from the ruled contracts, not the code — but one of its four subtests is publicly reachable and already covered; the justification trimmed.
7. Nothing guarded against battery self-recursion — a future test running the row on this repo forks go test inside go test. The GROUNDWORK_BATTERY env guard ships, which also protects real projects whose suites call verify.
8. One id spelled two ways reports as two defects naming neither cause; exact matching is right, the message could name the mismatch. Accepted as-is.
9. A path dropped from the empty-run message; restored.
10. The row costs ~25 seconds on this repo — recorded so the price is chosen, not discovered.

## What held up

The reconciliation core is right: both directions, dedupe on both sides, subtest collapse imported from the seam rather than copied, skip-and-fail-count-as-ran stated and pinned. The adaptations to existing tests were forced and legitimate; the lock bump computes. The trust boundary is stated and defended. Style holds the house register at a 28% comment ratio.
