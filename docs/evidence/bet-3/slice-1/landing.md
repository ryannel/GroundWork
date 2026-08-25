# Landing note, slice 1

The driver landed this slice after the round-2 closure said lands.

## The fix at landing

The closure's one new low, F45, was fixed by the driver at landing, exactly as the closure specified. One test, TestAProgramFileAloneIsAPlanNotNothing, pins the program-file half of the counter. Blanking walkProgram's increment made it die alone, with the closure's exact line: a real program file read as "holds no plan file". Restored, the full suite is green. The register nit in planrow.go's comment was fixed in the same pass — one long sentence split at the closure's suggested full stop.

## The D39 checklist

- Evidence directory exists and holds both reviews, both closures, both fix rounds, and both handoffs.
- The ledgers carry the review: F35 through F45, and D45 through D47.
- The build handoff and fix handoff are archived beside this note. The builder died twice during this slice — once at the weekly usage limit during the build, once silently mid-edit in round 2. Both deaths were caught by the F25 rule: a handoff that stops moving while the tree does not.

## The landing split

Red, committed first, failing at a542b63 where internal/plan does not exist: internal/plan/plan_test.go, internal/battery/planrow_test.go, and the one-line row-list edit to internal/battery/battery_test.go. The builder verified the red in a throwaway worktree: the plan tests fail to build, the row tests fail on a battery with no plan row, the row list fails on seven rows against eight wanted.

Green, committed second: everything else, this directory included.

## The proof the slice stands on

Full verify on the finished tree: 8 rows, green 8, red 0, waived 0, quarantined 0, unrunnable 0, at 6.0+ra8c0ca9. The digest did not move — the plan row's identity was set once and the fixes never touched it. The mutate row killed every mutant it judged. The reviewer ran its own verify on a copy and got the same answer.
