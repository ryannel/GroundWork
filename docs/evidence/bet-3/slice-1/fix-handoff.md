# Handoff: bet-3 slice 1, fix round

Branch `claude/v2-clean-slate-tkuacl`, base commit 2df0f47. The slice sits
uncommitted in the working tree. The driver lands it.

This file is written as the work goes.

## Status

Done. Every finding fixed. Every new rule proven by blanking it. gofmt clean,
`go vet` clean, `go test ./...` green, full verify green at the same digest.
Nothing is committed — the slice is still uncommitted in the working tree.

## Findings and what happened to each

| Finding | Fix | Proven by |
|---|---|---|
| H1 | count first, paths clipped | blanking each; both tests die |
| M1 | bet must sit under its program | blanking; test dies alone |
| M2 | one marker, one proof | blanking each of two rules |
| M3 | ladder ids held | blanking each of three rules |
| M4 | touches_data removed | putting the key back; test dies |
| M6 | contract writes all six caps | dropping each cap line; test dies |
| M7 | file cap pinned | blanking the guard; case dies |
| M8 | nothing-to-parse vs misshapen | blanking; two cases die |
| M9 | 24 anchors repointed | slugs computed from design.md |
| L1 | atLeastOneLine deleted | it compiled and nothing called it |
| L2 | six assertions strengthened | blanking each rule; case dies |
| L3 | contract test is per-section | gutting the tables; test dies |
| L4 | a second # refused | blanking; case dies |

## What each fix is

**H1 — the count never gives way.** `joined` is gone. `countedProblems`
replaces it and writes the count first: `2 problems, the first: <problem>`, or
`1 problem: <problem>`. The count sits at byte 0, so `cut`, which trims from
the end, can never reach it. Separately, `resolveBet` and `resolveSlice` now
`clip()` the caller-supplied design and `from` paths. They were the only
unclipped values on those lines, and a 245-byte path spent the whole line.

**M1 — a bet sits under the program it names.** `resolveBet` now checks the
bet's directory. The message mirrors the slice's: "names the program X, and it
sits in the directory of Y".

**M2 — one test name, one proof.** New `oneTestPerProof` in resolve.go. Two
proofs may not name one marker. And no proof id may open with another proof id
and an underscore, because `TestProof_a_b_runs` opens with the marker prefix of
the proof `a` and with that of the proof `a_b`.

**M3 — ladder entry ids.** New `oneLadderPerBet`: a bet id twice on one ladder
is refused, and a bet id on two programs' ladders is refused. And `uniqueIDs`
now claims a ladder entry's id when no bet file declares it, so a milestone
cannot wear it. An entry naming a bet that has files is a reference, not a
second declaration, so it is not claimed.

**M4 — touches_data removed.** Out of `sliceKeys`, out of the `Slice` struct,
out of `binder.data`, off the contract page, and out of all 8 dogfood slice
files. The block's presence is the declaration. The closed key list means a
file that still carries the field is told so rather than quietly read.

**M6 — the contract writes every rule.** Section 1 now carries all six caps as
numbers, the three tree levels, the docs/plan-holds-only-directories rule, the
flat repo-wide id space, and the rules M1, M2, M3 and L4 added.

**M7 — the file cap is pinned.** The "an enormous file" hostile case now wants
"for a plan file", the file cap's own words. "bytes" alone was also satisfied
by the scalar cap, which the same content breaks.

**M8 — nothing to parse against a misshapen plan.** `Load` counts the
`program.md` files it met. Zero is unrunnable, and the error wraps `ErrNoUnits`
with the count and the first problem, so the row's line names what the
directory held instead. One `program.md` that is there and will not read is
red: there is a plan, and it is misshapen.

**M9 — the anchors.** All 24 `from:` anchors repointed to real GitHub heading
slugs of `docs/evidence/bet-3/design.md`. Note the em dash in each R-heading
drops out and leaves two hyphens, so R1 is
`#r1--where-plans-live-and-what-a-plan-file-is`. `#slice-1` matched no heading
— the slice entries in section 2 are bold paragraphs — so those four now point
at `#2-the-slice-cut`, the enclosing heading. design.md was not edited.

**L1.** `atLeastOneLine` deleted.

**L2.** `TestTheTreeShapeIsHeldTo` cases now assert the rule's own words as
well as the file name. Three new hostile cases assert `checkKey`'s own words:
the charset rule, the size rule, and the empty-name rule.

**L3.** The contract-agreement test now looks for each field backticked inside
its own shape's section, not anywhere on the page.

**L4.** `checkFrom` refuses a second `#`.

## Proof obligation 1 — blank the rule, watch its test die

Each row: the rule was removed or made unreachable, the package's tests were
run, the named test failed, and the file was restored.

| Rule blanked | Test that died |
|---|---|
| the count written first (plan.go) | TestTheCountIsSaidBeforeTheFirstProblem |
| the count written first (row line) | TestThePlanRowsRedLineNeverLosesTheCount |
| clip on the design path | TestALongPathInAPlanFileIsClippedNotLeftToFillTheLine |
| M1 the bet-under-program case | TestABetBelongsToTheProgramItSitsUnder |
| M2 the duplicate-marker rule | .../two_proofs_naming_one_marker |
| M2 the id-prefix rule | .../a_proof_id_opening_with_another_proof_id |
| M3 twice on one ladder | .../one_bet_listed_twice_on_one_ladder |
| M3 on two ladders | .../one_bet_on_the_ladders_of_two_programs |
| M3 an uncut entry claims its id | TestALadderEntryWithNoFilesStillHoldsItsID |
| M4 touches_data put back in sliceKeys | TestTheRemovedTouchesDataFieldIsRefused |
| M7 the whole-file cap | .../an_enormous_file |
| L4 the second-# check | .../a_from_field_with_two_anchors |
| L2 the .md rule in a bet directory | .../a_file_below_a_bet_that_is_not_markdown |
| L2 the file-under-a-program rule | .../a_stray_file_beside_a_program_file |
| L2 the directory-below-a-bet rule | .../a_directory_below_a_bet |
| L2 checkKey's charset rule | .../a_field_name_holding_a_capital |
| L2 checkKey's size rule | .../an_enormous_field_name |
| L2 checkKey's empty-name rule | .../a_line_that_opens_with_a_colon |
| M8 the files==0 condition | two cases of TestNothingToParse... |
| the green line's counts and claim | TestThePlanRowsGreenLineSaysWhatItRead and TestProof_b3s1_row_green_... |
| the unrunnable line's detail | TestThePlanRowSeparatesNothingToParse... and TestPlanRowIsUnrunnable... |
| each of the six cap lines on the page | TestTheContractWritesEveryCapTheParserHolds |
| the contract's field tables (gutted) | TestProof_b3s1_contract_names_every_field_the_parser_reads |

Two notes on that table.

Blanking the count-first rule kills both H1 tests, not one. The clip test also
asserts the count is there, so it depends on the same rule. That is honest
overlap, not a weak test: each still dies alone when *its own* rule is blanked.

The contract page was gutted two ways. First the review's own way — sections
1.3 to 1.6 replaced by one paragraph of common words — and the test died.
Then the sneakier way: every heading kept and only the backticks stripped, so
the field names survive as ordinary words in ordinary tables. It caught all 43
field slots.

## Proof obligation 5 — the M9 anchors

Verified by computing GitHub heading slugs from `docs/evidence/bet-3/design.md`
and checking each `from:` against them: 24 anchors checked, 0 dangling, and
every target slug appears exactly once in the file.

## A note for the driver

M9's anchors are fixed but not held by a test. Whether an anchor resolves is
R12's question and the `trace` row lands in slice 6. Adding an anchor resolver
here would build slice 6's work early, so I verified the anchors mechanically
and left the row to slice 6. Say if you want it pinned now.

## Proof obligations

1. Blank-the-rule runs: done, table above.
2. `gofmt -l internal/ cmd/`: clean.
3. `go test ./... -count=1`: green, all nine packages.
4. `go vet ./...`: clean.
5. Full verify: green. Tail below.
6. Red/green split: see below.

### The verify tail

Run twice. The first run was green, then two local variables were renamed for
readability, so it was run again from a fresh build. Both runs are identical
apart from the run id.

```
run run-20260825T204843Z-b260
battery 6.0+ra8c0ca9
ROW           OUTCOME  EVIDENCE
version       green    .groundwork-battery.json declares 6.0+ra8c0ca9, and the rows compute the same digest
manifest      green    .groundwork/manifest.json declares 7 capabilities on 1 surface, and a discovered suite proves every one
honesty       green    the honesty scan read 627 tests in 8 suites, and every one can fail
wiring        green    the wiring scan read 55 exported functions in 43 files, and a non-test file names every one
token         green    the token scan is not applicable to profile cli, by declaration
run-evidence  green    the run-evidence row reconciled 627 discovered tests in 8 suites on 1 surface, and the run log names every one
mutate        green    the deletion test killed every one of 9 mutants it judged: sampled 10 of 77 targets at 6.0+ra8c0ca9: killed 9 (1 by crash), 1 did not compile; 1 file was left out of this build
plan          green    docs/plan holds 1 program, 1 bet and 8 slices, and every id and reference in them resolves
8 rows: green 8, red 0, waived 0, quarantined 0, unrunnable 0
```

The digest did not move: still `ra8c0ca9` at 6.0. Nothing changed row identity,
which is right — no row was added, renamed, or re-severitied this round.

The mutate row's rotated sample killed every mutant it judged. No survivor, so
no new pinning test was owed.

## Red/green landing split

Red (tests only; must fail at pre-slice commit a542b63, where internal/plan
does not exist):

- `internal/plan/plan_test.go`
- `internal/battery/planrow_test.go`
- the one-line edit to `internal/battery/battery_test.go`

No new test-only files were added this round. Every new test went into one of
the two existing test files above.

The split was checked, not assumed. A throwaway worktree at a542b63 took the
three red files and nothing else, and ran them:

- `internal/plan/plan_test.go` does not compile there: `undefined: Load`,
  `undefined: maxFileBytes`, and so on. `internal/plan` does not exist at that
  commit.
- `internal/battery/planrow_test.go` compiles and every case fails with "the
  default battery holds no plan row", including the three new ones.
- The one-line edit to `internal/battery/battery_test.go` fails
  `TestDefaultHoldsExactlyTheShippedRows`: the shipped list has seven rows and
  the test wants eight.

The worktree was removed afterwards.

Green (everything else):

- `internal/plan/plan.go`, `parse.go`, `bind.go`, `resolve.go`
- `internal/battery/planrow.go`, `battery.go`, `rows.go`
- `cmd/groundwork/battery_test.go` (row-count edits, not new proofs)
- `internal/journal/git_test.go`
- `docs/derivation-contract.md`
- `docs/plan/rebuild/` (program.md, bet_3/bet.md, bet_3/b3s1..b3s8.md)
- `.groundwork-battery.json`

---

# Round 2: F43 and F44

The closure check closed all 14 round-1 findings and found three more. Base
moved to d775033 (the ledger commit); the working tree carried over intact.

## Status

Done. All three items fixed and proven. gofmt clean, `go vet` clean,
`go test ./...` green, full verify green at the same digest. Nothing committed;
the ledgers were not touched.

Note on the interruption: this session died at 21:30 UTC part-way through the
F43 edit, leaving `walkBet` without its counter parameter while its caller
already passed one. The tree did not compile. That was found and finished on
resume, and `go build ./...` is clean.

| Item | State | Proof |
|---|---|---|
| F43 count plan files, not program.md | done | see below |
| F44a bound test for clip on the from path | done | blanked; dies alone |
| F44b the contract names the optional fields | done | six drift shapes caught |

### F43

`walkPlans`, `walkProgram` and `walkBet` now share one counter, `plans`, and it
counts every plan file met — a program file, a bet file, a slice file —
whether or not it reads. `Load` answers unrunnable only when that count is
zero. `ErrNoUnits` now reads "docs/plan is there and holds no plan file".

Changed: `internal/plan/plan.go`, `internal/battery/planrow.go` (comment only).

Tests: `TestNothingToParseIsUnrunnableAndAPlanFileMakesItRed` replaces the M8
table and now runs seven shapes, three unrunnable and four red. Two of the
unrunnable shapes are new and needed `os.MkdirAll`, because a truly empty
directory cannot be written as a file map: a program directory with nothing
beneath it, and a bet directory with nothing beneath it. Both stay unrunnable.

The pair the closure check built is pinned twice, once per level:
`TestDeletingTheProgramFileDoesNotSilenceTheMisstatementBelowIt` in the plan
package, and `TestDeletingTheProgramFileDoesNotSilenceThePlanRow` in the
battery package. The battery one is the one that matters, because unrunnable
is where the run stops failing.

One thing worth knowing for review: the evidence line prints the first problem
and counts the rest, so the without-program.md line names the missing file and
does not spell the misstatement out. The tests assert the line says
" problems, the first: ", which only appears when more than one problem was
found — that is how they prove the work below the missing file was still read
rather than skipped.

### F44a

New test `TestALongFromPathIsClippedNotLeftToFillTheLine` in
`internal/battery/planrow_test.go`. It is the mirror of the design-path one,
built on a 245-byte `from:` path plus a second problem so the count is on the
line, and it asserts the line stays under the journal's 200 bytes.

Proven: removing `clip(where)` from resolveSlice's proof loop kills this test
and nothing else. The design-path test passes throughout, which is exactly the
review's point — the two lines are built in different places, so one test could
never have covered both.

### F43, proven

| Rule blanked | Tests that died |
|---|---|
| walkBet's `*plans++` (plan pkg) | TestDeletingTheProgramFileDoesNotSilenceTheMisstatementBelowIt, and two cases of TestNothingToParseIsUnrunnableAndAPlanFileMakesItRed |
| the same, judged at the row | TestDeletingTheProgramFileDoesNotSilenceThePlanRow, and one case of TestThePlanRowSeparatesNothingToParseFromAMisshapenPlan |

The blanked build reports the exact defect the closure check described: "docs/plan
is there and holds no plan file. 1 problem: docs/plan/demo holds no program.md",
read as nothing-to-parse, over a repo whose bet and slice are sitting right there.

One case earns its place separately: "one slice file, with no bet.md and no
program.md above it". A slice file alone in the tree is the only plan file
there, so it is what makes that repo red rather than unrunnable. It is the
purest test of the slice-file half of the count, and it dies when walkBet's
counter goes.

### F44b

The parser's optional set, read off the bind calls: a bet may leave out
`premises`, `facing` and `deferred`; a slice plan may leave out `facing`,
`records` and `data`. Nothing else in any shape is optional — `program.md` has
no optional field at all, and every field of a ladder entry, a milestone, a
slice entry, a facing item, a deferral, a proof and the data block is required.
Note `b.id` and `b.flag` both call `b.scalar(key, true)`, so ids and flags are
required; that is easy to misread from the call sites.

The page now carries that in section 1.1, right after the caps, as two lines
plus a note that required is not the same as holding something (`fixtures`,
`real` and `faked` must be written and may be `[]`).

The list itself lives once, in `optionalFields()` beside `fieldNames()` in
bind.go, and three tests read it:

- `TestEveryOptionalFieldMayBeLeftOut` loads a plan with all six left out.
- `TestAFieldOffTheOptionalListMayNotBeLeftOut` takes each required field of
  the bet and the slice plan out one at a time, and also fails if a required
  field has no case — so a field cannot drop out of the parser and the table
  together.
- `TestTheContractNamesEveryOptionalField` holds the page's two lines to the
  same list, in both directions: a missing optional field fails, and a
  required field listed as optional fails.

Six drift shapes were injected and each killed its test:

| Drift injected | Test that died |
|---|---|
| page drops `data` from the slice line | TestTheContractNamesEveryOptionalField |
| page drops the whole `bet.md` line | TestTheContractNamesEveryOptionalField |
| page lists `design` as optional | TestTheContractNamesEveryOptionalField |
| parser makes `premises` required | TestEveryOptionalFieldMayBeLeftOut |
| parser makes `faked` optional | TestAFieldOffTheOptionalListMayNotBeLeftOut |
| a required field drops out of the coverage table | TestAFieldOffTheOptionalListMayNotBeLeftOut |

## Round 2 proof obligations

1. Blank-the-rule runs: 9 this round (2 for F43, 1 for F44a, 6 for F44b), all
   killing their own test. Tables above.
2. `gofmt -l internal/ cmd/`: clean.
3. `go vet ./...`: clean.
4. `go test ./... -count=1`: green, all nine packages.
5. Full verify: green.

### The verify tail

```
run run-20260825T221100Z-b203
battery 6.0+ra8c0ca9
ROW           OUTCOME  EVIDENCE
version       green    .groundwork-battery.json declares 6.0+ra8c0ca9, and the rows compute the same digest
manifest      green    .groundwork/manifest.json declares 7 capabilities on 1 surface, and a discovered suite proves every one
honesty       green    the honesty scan read 633 tests in 8 suites, and every one can fail
wiring        green    the wiring scan read 55 exported functions in 43 files, and a non-test file names every one
token         green    the token scan is not applicable to profile cli, by declaration
run-evidence  green    the run-evidence row reconciled 633 discovered tests in 8 suites on 1 surface, and the run log names every one
mutate        green    the deletion test killed every one of 9 mutants it judged: sampled 10 of 77 targets at 6.0+ra8c0ca9: killed 9 (1 by crash), 1 did not compile; 1 file was left out of this build
plan          green    docs/plan holds 1 program, 1 bet and 8 slices, and every id and reference in them resolves
8 rows: green 8, red 0, waived 0, quarantined 0, unrunnable 0
```

Digest unmoved: still `ra8c0ca9` at 6.0. Nothing changed row identity this
round. The test count moved 627 to 633, which is the six tests added. The
mutate row's sample killed every mutant it judged, so no survivor and no
pinning test owed.

## Red/green landing split, final

Unchanged from round 1. No test-only files were added in either round; every
new test went into one of the two existing test files.

Red (tests only; verified to fail at the pre-slice commit a542b63, where
`internal/plan` does not exist):

- `internal/plan/plan_test.go`
- `internal/battery/planrow_test.go`
- the one-line edit to `internal/battery/battery_test.go`

Green (everything else):

- `internal/plan/plan.go`, `parse.go`, `bind.go`, `resolve.go`
- `internal/battery/planrow.go`, `battery.go`, `rows.go`
- `cmd/groundwork/battery_test.go` (row-count edits, not new proofs)
- `internal/journal/git_test.go`
- `docs/derivation-contract.md`
- `docs/plan/rebuild/` (program.md, bet_3/bet.md, bet_3/b3s1..b3s8.md)
- `.groundwork-battery.json`

Round 2 touched, on the green side: `internal/plan/plan.go` (the counter),
`internal/plan/bind.go` (`optionalFields`), `internal/battery/planrow.go`
(comment), `docs/derivation-contract.md` (the optional-fields block). On the red
side: both test files.
