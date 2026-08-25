# Fix rounds, builder reports

## Round 1: the review's fourteen findings


All fixes are in, proven, and the handoff is written. Here is the report.

## What changed, finding by finding

**H1 — the count never gives way.** `joined` is gone. `countedProblems` replaces it and writes the count first: `2 problems, the first: <problem>`, or `1 problem: <problem>`. The count sits at byte 0, so `cut`, which trims from the end, can never reach it. Separately `resolveBet` and `resolveSlice` now `clip()` the design and `from` paths. They were the only unclipped values on those lines. Both halves have bound tests in `internal/battery/planrow_test.go`.

**M1** — `resolveBet` now checks the bet sits under the program it names, mirroring the slice rule.

**M2** — new `oneTestPerProof`. Two proofs may not name one marker, and no proof id may open with another proof id and an underscore. The review's exact pair is the fixture.

**M3** — new `oneLadderPerBet` (twice on one ladder; on two ladders), and `uniqueIDs` now claims a ladder entry's id when no bet file declares it. An entry for a bet that has files is a reference, not a second declaration.

**M4** — `touches_data` removed from `sliceKeys`, the `Slice` struct, `binder.data`, the contract page, and all 8 dogfood slices. The closed key list means an old file carrying it is told so.

**M6** — the page now writes all six caps as numbers, the three tree levels, the docs/plan-holds-only-directories rule, the flat repo-wide id space, and the rules M1/M2/M3/L4 added.

**M7** — the "enormous file" case now wants "for a plan file". **M8** — `Load` counts the `program.md` files it met; zero is unrunnable and the wrapped error names what the directory held instead, one that will not read is red. **M9** — all 24 anchors repointed; note the em dash leaves a double hyphen, so R1 is `#r1--where-plans-live-and-what-a-plan-file-is`, and the four `#slice-1` anchors now point at `#2-the-slice-cut`. design.md untouched.

**L1** deleted. **L2** — six assertions now name the rule's own words, plus three new `checkKey` cases. **L3** — the contract test looks for each field backticked inside its own shape's section. **L4** — a second `#` is refused.

## How each was proven

Every new rule was blanked and its test watched die: 23 blank-the-rule runs, all passing. Two notes. Blanking the count-first rule kills both H1 tests, because the clip test also asserts the count — honest overlap, and each still dies alone on its own rule. The contract page was gutted two ways: the review's way, and the sneakier way of keeping every heading and stripping only the backticks. The second caught all 43 field slots.

The M9 anchors were verified by computing GitHub heading slugs from design.md: 24 checked, 0 dangling, every target slug unique.

`gofmt -l` clean, `go vet ./...` clean, `go test ./... -count=1` green on all nine packages.

## Verify tail

```
run run-20260825T204843Z-b260
battery 6.0+ra8c0ca9
...
plan          green    docs/plan holds 1 program, 1 bet and 8 slices, and every id and reference in them resolves
8 rows: green 8, red 0, waived 0, quarantined 0, unrunnable 0
```

The digest did not move: still `ra8c0ca9` at 6.0. The mutate row killed every mutant it judged, so no survivor and no pinning test owed. I ran verify twice — the first run was green, then I renamed two local variables for readability, so I rebuilt and ran it again. Both are identical apart from the run id.

## Red/green split

Red, tests only: `internal/plan/plan_test.go`, `internal/battery/planrow_test.go`, and the one-line edit to `internal/battery/battery_test.go`. No new test-only files this round. I checked this rather than asserting it: a throwaway worktree at a542b63 took those three files and ran them. `plan_test.go` does not compile (`undefined: Load`), every `planrow_test.go` case fails with "the default battery holds no plan row", and the battery_test edit fails on seven rows against eight wanted. The worktree was removed.

Green: everything else — the four `internal/plan` source files, `planrow.go`, `battery.go`, `rows.go`, `cmd/groundwork/battery_test.go`, `internal/journal/git_test.go`, the contract page, `docs/plan/rebuild/`, and the lock file.

## One thing for you

M9's anchors are fixed but not held by a test. Whether an anchor resolves is R12's question and the `trace` row lands in slice 6, so pinning it here would build slice 6's work early. I verified the anchors mechanically instead. Say if you want it pinned now.

Nothing is committed. Handoff at `/tmp/claude-0/-home-user-GroundWork/a5b7b708-4ccf-5ae9-9ab1-41cce247b571/scratchpad/handoff-b3s1-fix.md`.
---

## Round 2: F43 and F44


Round 2 is done. Report.

## First: the interruption

The death left the tree not compiling. `walkBet`'s caller already passed the counter, but `walkBet` itself had not taken the parameter. I finished that edit before anything else; `go build ./...` is clean.

## What changed

**F43.** `walkPlans`, `walkProgram` and `walkBet` now share one counter, `plans`, and it counts every plan file met — program file, bet file, slice file — whether or not it reads. `Load` answers unrunnable only when that count is zero. `ErrNoUnits` now reads "docs/plan is there and holds no plan file". This is D45.2's sentence read literally: one plan file of any kind means something was offered to parse, so everything wrong is red, the missing `program.md` included.

The landed M8 shapes did not regress. Three shapes stay unrunnable: README-only, a program directory with nothing beneath it, a bet directory with nothing beneath it. The last two are new cases and needed `os.MkdirAll`, since an empty directory cannot be written as a file map.

**F44a.** New `TestALongFromPathIsClippedNotLeftToFillTheLine`, the mirror of the design-path test, on a 245-byte `from:` path plus a second problem so the count is on the line.

**F44b.** I read the optional set off the bind calls rather than trusting the brief: a bet may leave out `premises`, `facing`, `deferred`; a slice plan may leave out `facing`, `records`, `data`. Nothing else anywhere is optional — `program.md` has none at all, and `b.id` and `b.flag` both call `b.scalar(key, true)`, so ids and flags are required. The page carries that in §1.1 with a note that required is not the same as holding something. The list lives once, in `optionalFields()` beside `fieldNames()`, and three tests read it.

## Proofs

Nine blank-the-rule runs, each killing its own test:

| Blanked | Died |
|---|---|
| `walkBet`'s `*plans++` (plan pkg) | the two-repo pair, plus two cases of the unrunnable table |
| the same, judged at the row | the row-level pair, plus one case |
| `clip` on the proof's `from` path | the new from-path test, alone |
| page drops `data` / drops the bet line / lists `design` as optional | the contract optional test, each time |
| parser makes `premises` required | the leave-them-out test |
| parser makes `faked` optional | the required-field table |
| a required field drops out of the coverage table | the required-field table |

Two things worth the driver's eye. The blanked F43 build reproduces the closure check's exact line: `docs/plan is there and holds no plan file. 1 problem: docs/plan/demo holds no program.md`, read as nothing-to-parse, over a repo whose bet and slice sit right there. And removing the `from` clip leaves the design-path test passing throughout — which is the review's point, that one test could never have covered both lines.

The evidence line prints the first problem and counts the rest, so the without-`program.md` line names the missing file rather than spelling out the misstatement. Both pair tests assert the line says `" problems, the first: "`, which only appears above one problem — that is how they prove the work below the missing file was still read.

## Verify tail

```
run run-20260825T221100Z-b203
battery 6.0+ra8c0ca9
...
plan          green    docs/plan holds 1 program, 1 bet and 8 slices, and every id and reference in them resolves
8 rows: green 8, red 0, waived 0, quarantined 0, unrunnable 0
```

Digest unmoved at `ra8c0ca9`, 6.0. Test count moved 627 → 633, the six tests added. Mutate killed every mutant it judged, so no survivor and no pinning test owed. `gofmt` clean, `go vet` clean, `go test ./... -count=1` green on all nine packages.

## Final split

Unchanged. No test-only files were added in either round. Red: `internal/plan/plan_test.go`, `internal/battery/planrow_test.go`, the one-line `battery_test.go` edit — verified failing at a542b63 in round 1. Green: everything else, including round 2's `plan.go`, `bind.go`, `planrow.go` comment, and the contract page.

Nothing committed. Ledgers untouched. Handoff at `scratchpad/handoff-b3s1-fix.md`.