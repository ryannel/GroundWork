# Handoff — bet 3 slice 4: test markers and the board derivation

Builder session. Branch `claude/v2-clean-slate-tkuacl`, base `ff80ad0`, working tree only, no commits.
Updated as the work goes.

## What the slice ships

- `internal/board` — the derivation. Three inputs joined: the plan, git's `Slice:` trailers,
  the adapter's per-test run results. Nothing in it writes.
- `internal/battery/boardrow.go` — the eleventh row, kind `board`, at 9.0+r4326bda.
- `cmd/groundwork/board.go` — the `groundwork board` verb.
- `docs/derivation-contract.md` section 3 — test naming and the `Slice` trailer.
- Three seams moved or added so one truth has one source (D54.1):
  `adapter.For` (moved out of `battery.adapterFor`), `adapter.Worse`, `journal.Trailers`,
  `journal.Printable`, `plan.CheckID`, `plan.MarkerPrefix`, `(*adapter.Go).RunMatching`.

## Red / green split (the driver lands two commits)

**RED — fails at ff80ad0.** Test files and pins only:

- `internal/board/board_test.go` (new)
- `internal/board/history_test.go` (new)
- `internal/board/run_test.go` (new)
- `internal/board/render_test.go` (new)
- `internal/board/contract_test.go` (new)
- `internal/battery/boardrow_test.go` (new)
- `internal/journal/trailers_test.go` (new)
- `cmd/groundwork/board_test.go` (new)
- `cmd/groundwork/battery_test.go` — three row-count pins, 10 → 11
- `internal/battery/battery_test.go` — the shipped-row list pin gains `board/board/blocking`
- `internal/battery/planrow_test.go` — the row-kind vocabulary pin gains `board`

Verified red at ff80ad0 by construction: `go vet ./...` at the base with these files in place
reported `undefined: History` (internal/board) and `undefined: boardTotals` (internal/battery);
three packages fail to build. Same shape as slice 3's red commit (a07cd9b).

**GREEN — everything else.** New: `internal/board/{board,history,run,render}.go`,
`internal/battery/boardrow.go`, `internal/adapter/for.go`, `cmd/groundwork/board.go`.
Edited: `internal/battery/{battery,rows,manifestrow,runevidencerow,mutaterow}.go`,
`internal/adapter/{adapter,goadapter}.go`, `internal/journal/{git,journal}.go`,
`internal/plan/{bind,plan}.go`, `cmd/groundwork/main.go`,
`docs/derivation-contract.md`, `.groundwork-battery.json` (8.0+rb43026c → 9.0+r4326bda).

The lock file rides green, following slice 3's precedent (ff80ad0 carried it).

**Survivor pins from the 9.0 sample rotation:** see the section at the bottom.

## The rulings taken

Written out as candidate ledger entries at the bottom. The load-bearing one is the
no-trailers edge.

## Notes as they came

- This repo is a **shallow clone** (`git rev-parse --is-shallow-repository` → true, 253 commits).
  So an "a shallow clone is unrunnable" rule — the shape R14 gives the waiver counter — would
  have made the row unrunnable on this repo's own verify. It is named instead. Reasoning is in
  candidate decision 3.
- No commit in this repo's history carries a `Slice:` trailer, so the board reads 0 landed
  slices while 15 of the 24 planned proofs pass. That is the "green ahead of plan, everywhere"
  edge the brief names. Candidate decision 1 rules it.
- `git log --format=...%(trailers:key=Slice,valueonly,unfold)%x00` was checked against real git
  2.43 before any code was written: folded values join onto one line, an empty value is emitted
  as an empty line, and each record is NUL-terminated with git's own newline after it.
- The board runs the proofs **filtered** — `go test -run '^(?:marker|marker|…)$'` — rather than
  running the whole suite a second time inside verify. Candidate decision 2.

---

## Candidate ledger entries

I did not touch `docs/decisions.md` or `docs/findings.md`. These are for the driver.

### Candidate decision 1 — What "flagged" means, and why this repo's board is honest green

R10 says green ahead of plan is "flagged, not silently accepted". It does not say red. This
slice reads it as: **named and counted everywhere the board is shown, and never red.**

The two directions of disagreement are not one thing:

- **Expected red, actually green** is the plan lagging the work. It is the state of every slice
  between the moment its test goes green and the moment its commit lands — which is every slice
  this repo has ever built, because tests come first and the commit comes last. It is also the
  state of every repo whose history predates the trailer. A red there would fire on the record of
  three honest slices and on every honest slice in progress, which is the friction-waived class
  the bet 3 design's risk 5 already names.
- **Expected green, actually not green** is work regressing. There is no benign reading, and it
  is red.

So "flagged" is made real by three things, none of which is a red row:

1. The count `N ahead of plan` sits in the **head** of the row's evidence line, where no cut can
   reach it (D33, and F61's lesson that a loud count in a droppable clause goes silent at scale).
2. Each ahead proof is a named hit on the row's line, after the reds and after the unread
   trailers, so the rarer things are never crowded out.
3. `groundwork board` gives every proof its own line with `ahead of plan` in the flag column, and
   prints `N proofs: a on plan, b ahead of plan, c behind` under the table.

**On this repo right now:** nothing in history carries a `Slice:` trailer, so the board reads 0
landed slices; every milestone holds unlanded slices; every one of the 24 planned proofs is
expected red; the 15 that exist pass. The row is green and says
`24 proofs, 0 landed of a shallow history: 15 ahead of plan, 0 behind, 0 trailers not read`.
Nothing is hidden and nothing is falsely red. The driver adding `Slice:` trailers from this
slice's own commit onward walks the board forward one slice at a time.

### Candidate decision 2 — The board runs the proofs its plan names, not the whole suite

The run-evidence row already runs `go test ./...` inside every verify. A board row that ran it
again would roughly double the battery's wall clock, which the design's risk 3 already warns
about, and it would fold every unrelated failure into the board's input.

So the board builds a `-run` pattern from the plan's own markers — `^(?:marker|marker|…)$` — and
runs exactly those. That is what R9's marker is for: `-run` filters names. The pattern is
`regexp.QuoteMeta`'d, and a plan too large for a command line falls back to `^TestProof_`.

The filtering is an optional interface on the seam (`RunMatching`), not a change to `Adapter`.
Go implements it, exactly as it already implements `RunPackage` for the deletion test. A stack
that does not is run whole and filtered afterwards — slower, and just as true.

### Candidate decision 3 — A shallow clone is named on the board row, never unrunnable

R14 gives the waiver counter the opposite rule: a shallow clone reports unrunnable and never
counts zero. The two are not inconsistent, and the difference is which way the missing data
pushes.

- The waiver counter's miss is **unsafe**: history it cannot see counts as zero grants, and zero
  grants passes a threshold that should have held the row red.
- The board's miss is **safe**: history it cannot see leaves a slice unlanded, which moves a
  proof from expected green to expected red — the flagged direction, never a silent pass over a
  regression.

And this host's own clones are shallow (this repo included, 253 commits), so an unrunnable rule
would mean the row never actually runs anywhere. It is named instead: the row's head reads
`0 landed of a shallow history`, in the head where no cut reaches it, and the render says the
same.

### Candidate decision 4 — Merges never govern landed-ness; four trailer shapes are red

One slice is one commit. That sentence decides the whole table in derivation-contract §3.2.

- A `Slice:` trailer on a **merge commit** is counted, named, and not read. It misstates nothing
  about the id space — it is a claim in a place the board does not read. This is D38 and D40's
  precedent, where merges never govern a waiver, applied to the same question.
- A slice **claimed by two commits** is landed, and the second commit is named. The claim is not
  in doubt; only how many commits made it.
- Four shapes are **red**, named: two or more `Slice:` trailers on one commit; a trailer with
  nothing after its colon; a value outside the id charset; a value naming no slice the plan
  declares. Each is a misstatement in the one input landed-ness is read from, and the plan row
  calls a plan that misstates itself red for exactly the same reason. Nothing else in the battery
  reads these trailers, so a board that only whispered would be the only reader of a lying input.
  The false-red risk is nil for a repo that writes its trailers correctly.

### Candidate decision 5 — "Stamped with the run it came from" is a stamp, not a second run id

R8 asks the render be "stamped with the run it came from". `groundwork board` is not a battery
run and has no run id of its own; minting one would put a second run-id vocabulary beside the
battery's, and the board package cannot import the battery without a cycle.

So the stamp names what a reader actually needs to ask whether the board is still true: when the
run started (RFC3339, UTC), what it cost, how many results it read, the commit the landed set was
read at, and whether the history behind it was short. Inside `verify` the board row's own line is
already journalled under the battery run id, so the stamp is there too.

### Candidate decision 6 — One truth, one source: the seams this slice moved

D54 ruling 1 says where a truth must live in two places, one place is the source. Six moves,
all of them because the board would otherwise have carried a second copy:

- `battery.adapterFor` → **`adapter.For`**. It is not a check; every caller with a manifest that
  wants to run a surface asks it. Three battery call sites updated, no behaviour change.
- `adapter.collapse`'s outcome ranking → **`adapter.Worse`**. A parent whose subtest failed has
  failed, and a proof two suites disagree about has failed: one sentence, one function.
- **`journal.Trailers`** — git's own trailer parser, in the package that already owns the
  read-only git questions. Never a hand regex over commit bodies.
- `journal.printableText` → **`journal.Printable`**, so the board's clip of a commit trailer is
  the journal's own statement of what is safe to print.
- `plan.checkID` → **`plan.CheckID`**. An id means one thing whether it was written in a plan
  file or in a commit message.
- `plan.markerPrefix` → **`plan.MarkerPrefix`**, so the `-run` fallback pattern is not a second
  rule about what a marker is.

### Candidate finding A — three copies of `printable` remain

`journal`, `seal` and `battery` each carry their own `printable`. This slice exported the
journal's one and used it from `board`, but did not touch the other two — out of a board slice's
scope. It is D54's parallel-definition class with three entries. Worth a finding so a later slice
collapses them rather than a fourth appearing.

### Candidate finding B — the board row answers F70 only for proof tests

F70 is "the battery went green over a failing test suite": no row asks whether the suite passes.
The board row now asks that question **of the proof tests only** — a proof its plan expects green
that fails is red. It says nothing about the rest of the suite, and it says nothing about a proof
whose milestone has not landed. So F70 is narrowed, not closed, and D55's manual pairing of
`go test ./...` beside `verify` still stands. The bet 3 close-out should say so when it decides
F70's owner.

---

## The blanking table (F55's four answers, kept apart)

40 mutations, one rule each, applied to the working tree and reverted after. Four verdicts are
counted apart, because a blanked rule can kill a test, survive, fail to build, or never be
applied — and a harness that folds the last two into either of the first two reports false
confidence in both directions.

The harness is at `scratchpad/blank.py`; the two runs are at `scratchpad/blanking.txt` and
`scratchpad/blanking2.txt`.

**Final: 40 killed, 0 survived, 0 did-not-build, 0 not-applied.**

The first pass was 29 killed, 5 survived, 5 did-not-build, 1 not-applied. Every one of those 11
was worth chasing, and two were real:

- **`the row writes nothing` survived.** The mutation wrote a file into the repo in the middle of
  the row, and nothing died. The cause was the harness, not the code: my `-run` filter for
  `internal/battery` was `Board|board`, and `TestProof_b3s4_silent_the_row_writes_no_file_at_all`
  carries neither word. The same fault hid the two other headline-proof cases (29 and 19). Filter
  widened to `Board|board|b3s4`; all three then died. Worth recording: a proof named for what it
  proves rather than for the row it proves it about is invisible to a filter built from row
  names.
- **`the head says when the history was shallow` survived, for real.** Nothing asserted the row
  ever prints the shallow note — the widest-line search varied the flag but never read the word.
  Fixed with `TestBoardRowSaysWhenTheHistoryIsShallow`, which clones a two-landing fixture at
  depth 1 and pins both sides: the whole repo says `2 landed` and never says shallow, the clone
  says `1 landed of a shallow history`. The under-count is visible in the test, which is the
  point.
- **`an enormous pattern falls back to the marker prefix` survived, for real, and the test could
  never have failed.** The fixture built 4000 proofs from 26 repeating ids, so `slices.Compact`
  folded them to 26 markers and the pattern never reached the cap. That is F55's other side — a
  case that looks clean and proves nothing. Ids made unique; the mutation now dies.
- Five did-not-build mutations were non-answers (a dropped call left an import or a variable
  unused). Each was rewritten to compile and then killed. One not-applied was my own patch text
  written against code I had not yet changed.

---

## The final run, on the tree the driver lands

`gofmt -l .` clean, `go vet ./...` clean.

**verify** (`scratchpad/verify-b3s4.txt`, session `b3s4`, run `run-20260826T094257Z-3e4e`):

```
battery 9.0+r4326bda
board   green   24 proofs, 0 landed of a shallow history: 15 ahead of plan, 0 behind,
                0 trailers not read: b3s1_shapes is expected red and passed in the run and 14 more
11 rows: green 11, red 0, waived 0, quarantined 0, unrunnable 0
```

The mutate row is green: `sampled 10 of 114 targets at 9.0+r4326bda: killed 9, 1 did not
compile`. The 9.0 rotation drew one real survivor first time round — `internal/journal/git.go`
`Shallow`, whose blanking left the journal's 188 tests green. Pinned in its owning package with
`TestShallowTellsAWholeCloneFromAShallowOne`, the F29/F34/F47 way: one test, proven by blanking
the function and watching it die alone. The scan was not touched. The one uncompiled mutant is a
non-answer the row already reports rather than folds (D26, F55).

**go test ./...** on the same tree, beside verify, per D55: all eleven packages green
(`scratchpad/suite-final.txt`). `internal/battery` 141s, `internal/journal` 53s,
`cmd/groundwork` 37s, `internal/adapter` 34s.

**The journal chains under session b3s4.** 24 lines across the two verify runs — eleven
`battery-row` lines and one `battery` line each. Line 1 opens the session with no `prev`; every
line after it carries one, and the chain row read the ref back and said `every chain holds`.

**`groundwork board` on this repo** renders all 24 proofs over 3 milestones in the plan's own
order, stamped `0 slices landed, read from Slice trailers on 253 commits at ff80ad0…, a shallow
history` and `15 tests in 7.2s at 2026-08-26T09:13:43Z`. Fifteen rows read `red / passed /
ahead of plan`; nine read `red / never ran / on plan`. That is K14's whole-ladder red, materialised.

## Survivor-pin list (rides green)

- `internal/journal/git_test.go` — `TestShallowTellsAWholeCloneFromAShallowOne`, the 9.0
  rotation's one survivor, pinned in the package that owns the function.

## Left open

- **Candidate finding A** — three copies of `printable` remain (journal, seal, battery). Out of
  this slice's scope; D54's class, three entries.
- **Candidate finding B** — the board row narrows F70 but does not close it. The bet 3 close-out
  should say so when it assigns F70.
- The driver adds `Slice: b3s4` to this slice's own landing commits, per R8's derivation-contract
  addition. Until a whole milestone lands, every proof stays expected red and the board reads
  `ahead of plan` — visible, counted, and honest.
- `verify` now takes about 20 minutes on this host, most of it the deletion test running
  `internal/battery`'s own 141-second suite once per mutant. The board row itself costs about 8
  seconds. The design's risk 3 predicted the growth; nothing here is a new cause, but the number
  is worth a driver's eye before slice 7 adds three more rows.

---

# Round 2 — the fix round (F74-F79, D57)

Base still `ff80ad0` for the slice code; the ledgers landed at `198791c` and `c37836b`.
Read D57 first, then F74-F79. No ledger edits from me.

Items, ticked as they go:

- [x] F74 — `TestBoardFailsOnAMisstatedTrailer` drives the verb on `Slice: s_nine` and pins exitFailed
- [x] F75/D57.1 — two counts in the head: `N trailers misstated, N unread`; the searched widest-line
      test varies both and pins both; the shallow note shortened to ` (shallow)` to keep the head
      inside the cap (83 fixed bytes + six 19-digit counts = 197)
- [x] F76/D57.2 — `tailOf(t.clauses)` rides the no-hits branch; the render gained a Run.Twice line;
      `TestACleanBoardStillSaysOneTestCameFromTwoSuites` is the reviewer's probe
- [x] F77/D57.3 — the contract pin cuts every row into cells and drives the verdict cells
- [x] F78/D57.4 — the oldest claim lands (`slices.Backward`), the newer one is the stray named;
      pinned in the board test, the contract test and a real-git battery test; page reworded
- [x] F79 (a)-(h) — (a) the page names the `^TestProof_` fallback and the 8192-byte cap, pinned;
      (b) `adapter.For`'s doc names the manifest row as the owner of D25's red and claims none
      itself; (c) the render's widest-line test searches lengths, counts and kinds together
      (widest found 253 of 400); (d) a boundary plan built up to the last marker that fits, which
      must not fall back; (e) the verb's writes-nothing test hashes the whole tree, `.git` and its
      refs included; (f) `firstOf` gains a first rung for a hit that is not a place in a file, and
      a real-git test drives a 64-byte wrong trailer that must keep its why; (g) the seam's fourth
      outcome and the empty-plan-directory branch both pinned; (h) §3 unwrapped to match §1-2
- [x] blanking: 61 cases, four-way table, b3s4-inclusive filter, unfiltered escalation
- [x] gofmt / vet clean; `go test -p 1 ./...` green, run alone
- [x] one full verify to scratchpad/verify-b3s4-fix.txt: 11 rows green at 9.0+r4326bda


## Round 2's blanking table

`scratchpad/blank.py`, results in `scratchpad/blanking-fix.txt` and `blanking-fix2.txt`.

**61 mutations: 61 killed, 0 survived, 0 did-not-build, 0 not-applied.**

Twenty-one cases are new this round — every rule the fix round added, and the ones the first
sweep never had a case for at all. That last set is where F74 lived: my forty-for-forty table was
not wrong about its forty, it was wrong to call itself complete. `Holds()` had no case, so
neither half was ever blanked.

Three things changed in the harness, and each closes one way the first sweep could lie:

1. **The filter includes the proof markers.** `Board|board|b3s4|Trailer|Hit`. A proof is named
   for what it proves, not for the row it proves it about (D56's harness lesson).
2. **A survivor is never believed on a filtered run.** Any case that survives every filter is
   re-run against the whole suite, unfiltered, before it is reported. Both real survivors this
   round — 52 and 54 — came back SURVIVED after that full run, so they were real.
3. **Four cases run the whole suite up front**, whatever the filter says: both halves of
   `Holds()`, the oldest-claim direction, the no-hits clauses and the give-way ladder. These are
   the rules whose only readers sit outside the filtered packages.

The two real survivors, and what they were:

- **52, `a plan directory holding nothing leaves the row unrunnable`.** Blanking the `ErrNoUnits`
  branch fell through to the next one, which is also unrunnable and whose message *contains* the
  plan reader's sentence — so my assertion matched either way. F55's can-never-fail side. The test
  now pins the branch by what only it does: it passes the plan reader's own answer straight
  through, and the fall-through prefixes its own. Two different claims, two different lines.
- **54, `a surface whose stack no adapter maps is refused`.** The refusal branch came with
  `adapterFor` when I moved it to `adapter.For`, and nothing in the repo had ever driven it —
  green on the whole unfiltered suite. `internal/adapter/for_test.go` now drives all three ways
  the seam answers, the refusal included.

One non-answer and one bad patch were harness faults: a stale symbol name after the
`maxSaidBytes` → `MaxValueBytes` rename, and a mutation that left `actual` without a return. Both
rewritten and killed.

One rule is honestly unpinnable and is not counted as a kill: `runOne`'s fall back to the whole
`Run` when a stack cannot filter. A full run and a filtered run produce the same board — the
extra results match no marker — so no test can tell them apart. It is a cost, not a rule.


## Round 2's final run

Run one at a time, never a suite and a verify together — the round-1 kill at 10:59 was a 137, and
everything since has been serialised with `-p 1`.

`gofmt -l .` clean, `go vet ./...` clean.

**verify** (`scratchpad/verify-b3s4-fix.txt`, run `run-20260826T122050Z-b56d`):

```
battery 9.0+r4326bda
board   green   24 proofs, 0 landed (shallow): 15 ahead of plan, 0 behind,
                0 trailers misstated, 0 unread: b3s1_shapes is expected red and passed in the run and 14 more
11 rows: green 11, red 0, waived 0, quarantined 0, unrunnable 0
```

The digest is unchanged at `r4326bda`, as it must be: F75 changed the row's evidence, not the row
list, and the digest is computed from ids, kinds and severities alone.

**go test -p 1 ./...** green on the same tree, run alone afterwards (`scratchpad/suite-fix.txt`).

## Red/green split, updated

**Red** gains, all of them new test files or pin edits:

- `internal/adapter/for_test.go` (new) — the seam's three answers, refusal included
- `internal/battery/boardrow_test.go` — `TestBoardRowNamesTheLaterOfTwoCommitsClaimingOneSlice`,
  `TestBoardRowIsUnrunnableWhenThePlanDirectoryHoldsNothing`,
  `TestACleanBoardStillSaysOneTestCameFromTwoSuites`,
  `TestAWrongTrailerAtItsFullWidthKeepsItsWhy`, the two-count head assertions, the split
  control-character test
- `cmd/groundwork/board_test.go` — `TestBoardFailsOnAMisstatedTrailer` (F74), and the
  writes-nothing test now hashes the whole tree
- `internal/board/board_test.go` — `TestAnOutcomeTheSeamDoesNotNameIsNotAPass`, the stray-commit
  pin
- `internal/board/run_test.go` — `TestAPlanJustInsideTheCapDoesNotFallBack`
- `internal/board/render_test.go` — `TestTheWidestRenderedLineIsSomewhereInTheInputSpace` (the
  searched one, replacing the fed-maxima one), `TestTheRenderSaysWhenOneTestCameFromTwoSuites`
- `internal/board/contract_test.go` — rewritten to cut every row into cells and drive the
  verdicts

**Green** gains: `internal/battery/scan.go` (the ladder's new first rung),
`internal/battery/boardrow.go` (two counts, clauses on every branch),
`internal/board/board.go` (oldest-claim walk, `MaxValueBytes`),
`internal/board/render.go` (the Twice line), `internal/adapter/for.go` (the doc),
`docs/derivation-contract.md` (§3 unwrapped, the fallback named, the stray wording).

`.groundwork-battery.json` is untouched this round: still `9.0+r4326bda`.

## One thing for the driver

The mutate row's line this run reads: `killed 8, 1 uncompiled, 1 blocked; internal/battery holds
1 target and its own tests do not finish in time`. The battery package's own suite is now 200
seconds, and the deletion test's per-mutant clock runs out before it can judge a target there.
The row is honest about it — it says blocked rather than counting it — and it stays green because
it killed every mutant it did judge. But the effect is that `internal/battery`, which is where
most of this bet's new code lives, is drifting out of the deletion test's reach. Not this slice's
to fix; worth a finding before slice 7 adds three more rows to that package.

---

# Round 3 — the micro-round (NEW-1 to NEW-4)

- [x] **NEW-1** — the render's multi-suite line rides `listed`'s `const most = 3`, and nothing
      drove that cap. The search's twice axis now reaches `{0, 1, 3, 4, 10, 200}` with names built
      once outside the loops, so blanking the cap renders 200 names past the bound and dies. The
      `maxLineBytes` comment carries the real arithmetic: the multi-suite line is the widest at
      288 bytes (a count and noun at 30, 33 fixed words, three 64-byte names with separators and
      " and N more" at 29), then a table row at 242, a note at 238, the git stamp at 181. The
      stale "242 bytes is the widest" claim is gone. Widest the search now finds: **257 bytes**.
- [x] **NEW-2** — `isRed` split into `readVerdict` (pure) and `isRed` (the Fatalf). A guard whose
      only exit is Fatalf cannot be driven through its caller, and this one had to be: without it
      a prose cell reads as "no" and passes by luck on every not-red row.
      `TestAVerdictCellIsYesOrNoAndNothingElse` drives ten rejects; blanking the guard dies.
- [x] **NEW-3** — the head regained `counted` for the misstated count: "1 trailer misstated", not
      "1 trailers". `unread` stays a bare count because it borrows the noun beside it. The searched
      test pins the spelling through the same helper rather than a second copy of the rule, and
      one stale assertion elsewhere moved with it. Cap arithmetic re-checked: the plural is the
      longer spelling, so the 83-byte fixed part and the 197-byte bound both stand, and the
      comment now says the bound is measured at the plural.
- [x] **NEW-4** — the row's searched test samples the boundary instead of the full cross product.
      The head is monotone in every count, so `countTuples` walks each axis through its
      interesting values with the others pinned at both extremes, plus the two all-one-value
      tuples: 134 tuples where 11^6 was 1.7 million. **75s → 0.01s.**

## Round 3's proofs

Three mutations, all killed (`scratchpad/blanking-micro.txt`), bringing the sweep to **64 of 64**:

- the multi-suite line's list cap → `TestTheWidestRenderedLineIsSomewhereInTheInputSpace`
- the verdict guard → `TestAVerdictCellIsYesOrNoAndNothingElse`
- the singular spelling → `TestTheBoardRowLineIsWidestSomewhereInTheCountSpace`

`gofmt -l .` clean, `go vet ./...` clean.

**go test -p 1 ./...**, run alone: green (`scratchpad/suite-micro.txt`). `internal/battery` is
**137s, down from 200s** — the 63 seconds are the search test alone.

**verify**, run alone (`scratchpad/verify-b3s4-micro.txt`, run `run-20260826T140708Z-8059`):

```
battery 9.0+r4326bda
mutate  green   the deletion test killed every one of 9 mutants it judged: sampled 10 of 114
                targets at 9.0+r4326bda: killed 9, 1 did not compile
board   green   24 proofs, 0 landed (shallow): 15 ahead of plan, 0 behind,
                0 trailers misstated, 0 unread: b3s1_shapes is expected red and passed in the run and 14 more
11 rows: green 11, red 0, waived 0, quarantined 0, unrunnable 0
```

**F80's cause is closed.** The mutate row's line no longer carries a blocked clause and no longer
names `internal/battery` as a package whose tests do not finish in time. Last round it read
`killed 8, 1 uncompiled, 1 blocked; internal/battery holds 1 target and its own tests do not
finish in time`; it now reads `killed 9, 1 did not compile`. The deletion test is back in reach of
the package where most of this bet's code lives, and the search test's cost was the whole cause.

The digest is still `r4326bda`: none of this touched a row's id, kind or severity.
