# Builder reports

## The build


Built, in the working tree, no commits. Handoff is at `/tmp/claude-0/-home-user-GroundWork/a5b7b708-4ccf-5ae9-9ab1-41cce247b571/scratchpad/handoff-b3s4.md`.

## What was built

`internal/board` derives the board from three inputs and nothing else: the plan, git's `Slice:` trailers, and the adapter's per-test run results. `internal/battery/boardrow.go` is the eleventh row (kind `board`, 9.0+r4326bda). `cmd/groundwork/board.go` is the verb. `docs/derivation-contract.md` gained section 3 — the marker, the trailer, expected state, and what the tools do with each.

Six seams moved or exported so one truth has one source: `adapter.For` (out of `battery.adapterFor`), `adapter.Worse`, `journal.Trailers`, `journal.Printable`, `plan.CheckID`, `plan.MarkerPrefix`, plus `(*adapter.Go).RunMatching`.

## The ruling on the no-trailers edge

"Flagged" means named and counted everywhere the board is shown, and never red. Expected-red-actually-green is the plan lagging the work — the state of every slice between its test going green and its commit landing, and of every repo whose history predates the trailer. A red there fires on every honest slice in progress. Expected-green-actually-not-green is work regressing, and that is red. So on this repo the row is honest green: `24 proofs, 0 landed of a shallow history: 15 ahead of plan, 0 behind, 0 trailers not read`, with the ahead count in the head where no cut reaches it and each ahead proof named among the hits. Two related rulings: a shallow clone is named rather than unrunnable (its miss pushes toward expected red — the safe direction — and every clone on this host is shallow), and a `Slice:` trailer on a merge commit is not read and not red, while four misstating shapes are red and named.

## Red/green split

Red (fails at ff80ad0, verified — three packages fail to build): eight new `_test.go` files plus three pin edits — `cmd/groundwork/battery_test.go` row counts 10→11, `internal/battery/battery_test.go` shipped-row list, `internal/battery/planrow_test.go` row-kind vocabulary. Green: everything else, including the lock file (slice 3's precedent) and the contract page. Survivor pin riding green: `TestShallowTellsAWholeCloneFromAShallowOne` in `internal/journal/git_test.go` — the 9.0 rotation drew `journal.Shallow` and it survived blanking, fixed the F29/F34/F47 way.

## Blanking table

40 mutations, four verdicts kept apart: **40 killed, 0 survived, 0 did-not-build, 0 not-applied.** The first pass was 29/5/5/1, and two survivors were real: nothing asserted the row ever prints the shallow note, and the enormous-plan test could never have failed because its 4000 ids folded to 26. A third was my harness — the `-run` filter `Board|board` never matched `TestProof_b3s4_silent_the_row_writes_no_file_at_all`, which hid all three headline-proof cases. Worth the driver's eye: a proof named for what it proves is invisible to a filter built from row names.

## Verify tail

```
board  green  24 proofs, 0 landed of a shallow history: 15 ahead of plan, 0 behind, 0 trailers not read: ...
11 rows: green 11, red 0, waived 0, quarantined 0, unrunnable 0
```
at 9.0+r4326bda, with `go test ./...` green on the same tree beside it (D55), and 24 chained journal lines under session b3s4.

## Candidate ledger entries (I edited neither ledger)

Six decisions and two findings, written out in the handoff: what "flagged" means; the filtered proof run; shallow named not unrunnable; the merge rule and the four red shapes; the stamp instead of a second run id; the six seam moves. Findings: three copies of `printable` still stand, and the board row narrows F70 without closing it.

## Left open

`verify` now runs about 20 minutes here, almost all of it the deletion test running `internal/battery`'s own 141-second suite once per mutant. The board row costs about 8 seconds of that. Not a new cause, but worth a look before slice 7 adds three more rows.
---

## The fix round (resumed after an exit-137 death)


Fix round done. Working tree only, no commits. Handoff round-2 section is at `scratchpad/handoff-b3s4.md`.

## Resume check

Every round-1 edit had survived the 137 — the kill hit the test run, not the writes. Confirmed by diff, then worked the checklist.

## The six items

**F74** — `TestBoardFailsOnAMisstatedTrailer` drives the verb on the reviewer's own probe (`Slice: s_nine`, undeclared) and pins `exitFailed`. Both halves of `Holds()` now die under blanking, verified against the whole unfiltered suite.

**F75/D57.1** — two counts in the head: `N trailers misstated, N unread`. The shallow note shortened to ` (shallow)` to keep the arithmetic inside the cap — 83 fixed bytes plus six 19-digit counts is 197. The searched widest-line test varies both new counts and pins both.

**F76/D57.2** — `tailOf(t.clauses)` rides the no-hits branch, and the render gained a `Run.Twice` line. `TestACleanBoardStillSaysOneTestCameFromTwoSuites` is the reviewer's probe: a board with every slice landed and every proof on plan still says one name came back from two suites.

**F77/D57.3** — the contract pin cuts every row into cells and drives the verdict cells through the real derivation. All four of the reviewer's flips now die.

**F78/D57.4** — the walk runs `slices.Backward`, so the oldest claim lands and the newer one is the stray named. Pinned three ways: the board test, the contract test, and a real-git battery test that asserts the later commit id is on the line and the earlier one is not. Page reworded to "the later commit is named".

**F79** — all eight. The page names the `^TestProof_` fallback and its 8192-byte cap (pinned); `adapter.For`'s doc names the manifest row as the owner of D25's red rather than claiming one; the render's widest-line test searches lengths, counts and kinds together (widest found 253 of 400); a boundary plan built up to the last marker that fits must not fall back; the verb's writes-nothing test hashes the whole tree, `.git` and refs included; `firstOf` gained a first rung for a hit that is not a place in a file, with a real-git 64-byte wrong trailer that must keep its why; both unpinned branches driven; §3 unwrapped.

## Blanking

**61 mutations, 61 killed, 0 survived, 0 did-not-build, 0 not-applied.** Twenty-one cases are new. Three harness changes close the ways the first sweep lied: the filter includes `b3s4`; any case surviving every filter is re-run against the whole unfiltered suite before being reported; and four cases run the whole suite up front. Two real survivors fell out and both are fixed — the empty-plan-directory assertion matched both branches (F55's can-never-fail side), and `adapter.For`'s refusal had never been driven by anything, green on the full suite.

## Final gate

`gofmt`/`vet` clean. Verify, run alone: **11 rows: green 11, red 0, waived 0, quarantined 0, unrunnable 0** at **9.0+r4326bda** — digest unchanged, as F75 touched evidence and not the row list. `go test -p 1 ./...` green on the same tree, run alone afterwards.

## One thing for you

The mutate row now reads `killed 8, 1 uncompiled, 1 blocked; internal/battery holds 1 target and its own tests do not finish in time`. That package's suite is 200 seconds and the per-mutant clock runs out before judging a target there. The row is honest — blocked, not counted — and green on what it judged. But `internal/battery` is drifting out of the deletion test's reach, and that is where most of this bet's code lives. Not mine to fix; worth a finding before slice 7 adds three more rows to it.
---

## The micro-round


Micro-round done. Working tree only, no commits.

## The four

**NEW-1** — the render's multi-suite line rode `listed`'s `const most = 3` and nothing drove it. The search's twice axis now reaches `{0, 1, 3, 4, 10, 200}`, with the names built once outside the loops; blanking the cap renders 200 names past the bound and dies. The `maxLineBytes` comment carries real arithmetic now: the multi-suite line is the widest at 288 bytes (30 for a count and its noun, 33 fixed words, 225 for three 64-byte names with separators and `" and N more"`), then a table row at 242, a note at 238, the git stamp at 181 — so 400 leaves 112 spare. The stale "242 is the widest" claim is gone. **Widest the search now finds: 257.**

**NEW-2** — `isRed` split into a pure `readVerdict` and the `Fatalf` wrapper, because a guard whose only exit is `Fatalf` cannot be driven through its caller. `TestAVerdictCellIsYesOrNoAndNothingElse` drives ten rejects including the by-luck ones; blanking the guard dies.

**NEW-3** — `counted` back on the misstated count: "1 trailer misstated". `unread` stays bare since it borrows the noun beside it. The searched test pins the spelling through the same helper rather than a second copy, and one stale assertion elsewhere moved with it. Cap re-checked: the plural is the longer spelling, so 83 fixed bytes and the 197-byte bound both stand — the comment now says the bound is measured at the plural.

**NEW-4** — the row's search samples the boundary. The head is monotone in every count, so `countTuples` walks each axis through its interesting values with the others pinned at both extremes, plus the two all-one-value tuples: **134 tuples where 11⁶ was 1.7 million. 75s → 0.01s.**

## Gate

Three mutations, all killed — the sweep is **64 of 64**. gofmt and vet clean. `go test -p 1 ./...` green, run alone; `internal/battery` **137s, down from 200s**, all of it that one test. Verify, run alone: **11 rows: green 11, red 0, waived 0, quarantined 0, unrunnable 0** at **9.0+r4326bda** — digest untouched, since nothing here moved a row's id, kind or severity.

## F80

Closed at its cause. The mutate row read `killed 8, 1 uncompiled, 1 blocked; internal/battery holds 1 target and its own tests do not finish in time`. It now reads `killed 9, 1 did not compile` — no blocked clause, no named package. The deletion test is back in reach of `internal/battery`, and the search test's cost was the whole of it.