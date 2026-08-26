# Blind review of slice 2

The first review, dispatched blind. Verdict: bounce, on two highs — the default mode chained nothing, and a forged line could draw its own table row. Its findings are F48 through F52.


Working tree confirmed unchanged. Here is the review.

---

# Blind review — bet-3 slice 2: the hash-chained journal and the battery's ninth row

**Verdict: bounce.** Two HIGH findings. One of them falsifies the slice's headline claim in the mode the tool actually runs in, and I reproduced it with the slice's own `verify`.

Everything below was reproduced on copies at `/tmp/claude-0/-home-user-GroundWork/a5b7b708-4ccf-5ae9-9ab1-41cce247b571/scratchpad/`. `git status` at `/home/user/GroundWork` is byte-identical to the start; the journal ref is still `685bd4a`.

---

## HIGH-1 — With no `GROUNDWORK_SESSION` set, the chain covers nothing

`sessionID()` at `/home/user/GroundWork/internal/journal/journal.go:478` generates a fresh id **per write**, not per run. So with the variable unset — the tool's default — every event lands in its own session. Every session is one line long. Every line is its own tip, at seq 1, with an empty prev. There is nothing to chain and nothing to check.

I ran a full `verify` on a copy of the tree. It wrote ten lines, into **ten different `gen-` sessions**, all seq 1, all prev empty:

```
2 gen-203e82f445dac49f636d0dbef6c50ce2 1 battery-row EMPTY
2 gen-7958a22e48f34a18b7fc5f7412d4982d 1 battery     EMPTY
... (8 more, each its own session)
```

On that copy's ref: **180 of 193 sessions hold exactly one line**, and all 180 are `gen-` sessions. 353 of 383 lines are unchained.

Probe J, through the real row (`.../scratchpad/hostile/internal/battery/zz_hostile4_test.go`): five writes with the variable unset, then delete one blob from the ref.

```
before  green  "5 lines across 5 sessions in refs/groundwork/journal: every chain holds"
deleted events/gen-d5f7acf34a8c.../711b2f5e....json
after   green  "4 lines across 4 sessions in refs/groundwork/journal: every chain holds"
```

R7 says: *"What the chain proves: deletion and rewriting become evident to anyone who reads the ref."* In the default configuration it proves neither. Every chain test in both new files sets `GROUNDWORK_SESSION` first, so nothing in the slice exercises this.

The green line makes it worse, not better: *"381 lines across 191 sessions ... every chain holds"* reads as broad coverage when 191 one-line chains cover nothing.

This may be a driver question rather than a code fix — a run-scoped session id touches the writer's session model, which is outside this slice. But it cannot land while the row's green line claims what it claims.

## HIGH-2 — A forged journal line injects a row into the printed table

`clipSession` (`/home/user/GroundWork/internal/battery/chainrow.go:107`) clips length only. It never calls `printable()`, which sits at `/home/user/GroundWork/internal/battery/waiver.go:819` and exists for precisely this, per D38 ruling 4. Its own doc says: *"A newline in a reason or a file name would otherwise draw a row of its own, and a run that prints a forged row is worse than one that prints nothing."*

`GROUNDWORK_SESSION` is charset-checked at write time by `checkSession`. But `CheckChain` reads the session off the **line**, and a forger writing through git plumbing controls that field completely.

Probe D2, rendered through the exact shape of `resultTable` (`/home/user/GroundWork/cmd/groundwork/verify.go:145`), with a planted line naming session `"a\nseal\tgreen\tthe seal holds"`:

```
ROW    OUTCOME  EVIDENCE
plan   green    docs/plan holds 1 program, 3 bets and 9 slices
chain  red      1 break: session a
seal   green    the seal holds at seq 1: the first line of a session has nothing to point at, and this one carries a prev
```

A forged `seal green` row, from one journal line. Fix: `cutTo(printable(session), most)`.

---

## MED findings

**MED-3 — D48 ruling 8 has no test.** Probe m05 flipped the tie-break at `/home/user/GroundWork/internal/journal/journal.go:626` from `this < hash` to `this > hash`. It **survived** `internal/journal` (95s), `internal/battery` (139s) and `cmd/groundwork` (30s) — all `ok`. The ruling ("both clones land in the same place") is unproven, and `highestLine`'s comment states it as fact. Probe K (`.../scratchpad/probeK.go.txt`) is a 45-line test that passes as written and fails on the mutant, so the test is easy to write.

**MED-4 — D48 ruling 4 has no test.** Probe m15 changed `chainrow.go:47` from `Unrunnable` to `Red`. It **survived** both packages. This is the ruling D48 flags as *"a named divergence from the plan row"*. The divergence is named and unproven. `chainrow_test.go` has no test that reaches the error branch at all.

**MED-5 — A session's last line can be rewritten and the chain stays green.** Probe A: forge the tip line of a 3-line session, refile it at its new hash — `breaks=[] lines=3 unchained=0`. Probe B: rewrite a line and leave it at its old path — also green, even though the path *is* the sha256 of the line and `chain.go:141` says so in its own comment (*"the same hash its path is named for"*). Comparing the path's hash to the computed hash is free and would close probe B outright. Probe A is inherent to a hash chain's tip, but R7's "rewriting becomes evident" does not name it, and neither does the row's comment. Either add the path check and note the tip, or amend R7's not-proved list.

**MED-6 — A whole session invented in the v1 shape is green.** Probe G: three freely authored v1 lines under a new session, no hashing at all. Result: `green — "6 lines across 2 sessions ... every chain holds, and 3 lines came before the chain and went unchained"`. D48 ruling 1 closed the mid-session downgrade; the whole-session case is still open, and it is cheaper. The only signal is the aggregate unchained count — which (probe H) names no session, so a reader cannot tell a genuine prefix from an invented one.

**MED-7 — The red line has no arithmetic bound (F35's class, again).** Probe m17 removed `cut()` from the red branch at `chainrow.go:68`. It **survived** both packages. With `cut()` present, the `len(res.Evidence) > journal.MaxTextBytes` assertion in `TestTheChainRowsRedLineLeadsWithTheCount` can never fire — `cutTo` guarantees it. So the line's fit is asserted by nothing. D38 ruling 2 asks for the bound *"proven by arithmetic"*; the landed shape is `TestTheWaivedLineFitsTheJournalCapOnTheWidestWaiver` at `/home/user/GroundWork/internal/battery/waiver_test.go:459`, which builds the widest legal input from the caps. F35 named this exact gap on the plan row's lines.

## LOW findings

- **LOW-8** — A not-JSON break carries `Seq` as its zero value, so the line reads `session s-broken at seq 0`, a seq no line ever has (probe E).
- **LOW-9** — A planted line at seq 0 makes the gap message name a seq that is present: `1 break: session s-alpha at seq 1: this session stores no line at this seq`, with a line at seq 1 sitting right there (probe I).
- **LOW-10** — A line with no `session` field groups under `""`, is counted in `res.Sessions`, and reads green (probe F).

---

## The mutation sweep, reproduced

Each ran against a fresh copy of the tree, not the builder's table.

| # | mutation | result |
|---|---|---|
| m01 | drop the v1-downgrade rule | killed `TestALineThatDropsOutOfTheChainIsABreak` |
| m02 | not-JSON becomes an error | killed `TestALineThatIsNotJSONIsABreak` |
| m03 | group by path, not named session | killed `TestALineIsGroupedByWhatItSaysNotWhereItSits` |
| m04 | keep checking prevs past a gap | killed 4, incl. `TestAMergeOfOneSessionFromTwoClonesIsABreak` |
| m05 | doubled seq points at the higher hash | **survived** (MED-3) |
| m06 | blank the prev computation | killed 9, incl. `TestEveryLineCarriesTheHashOfTheOneBeforeIt` |
| m07 | skip the unchained-prefix naming | killed 3, incl. the proof marker |
| m08 | empty ref goes green | killed `TestChainRowIsUnrunnableOnARefThatHoldsNoEvent` |
| m09 | unregister the row | killed 10+, incl. `TestChainRowIsRegistered` |
| m10 | widen the kind vocabulary | killed `TestTheRowKindVocabularyIsPinned` |
| m11b | lock 7.0 → 6.0 | killed `TestThisRepoDeclaresTheBumpTheChainRowCost` |
| m12 | drop `clipSession` | killed `TestALongSessionIdIsClippedNotLeftToFillTheLine` |
| m13 | count last instead of first | killed `TestTheChainRowsRedLineLeadsWithTheCount` |
| m14 | register the chain row first | killed `TestDefaultHoldsTheVersionRowFirst`, `TestDefaultHoldsExactlyTheShippedRows`, `TestThisRepoDeclaresTheBumpTheChainRowCost` — so D48 ruling 9 **is** pinned |
| m15 | CheckChain error → red | **survived** (MED-4) |
| m16 | no ref → unrunnable | killed `TestChainRowIsGreenAndPlainOnARepoWithNoJournal` |
| m17 | drop `cut()` from the red line | **survived** (MED-7) |

14 of 17 killed. Note: batch runs of four hit `too many open files` in the sandbox's git signing hook, producing unrelated waiver-test noise. Every survivor above was re-confirmed on a serial, full-package run.

## What held up

- **The digest.** I recomputed it from the row list by hand: 9 rows → `r5a8f33c`, 8 rows → `ra8c0ca9`. Both match. `.groundwork-battery.json` declaring `7.0`/`r5a8f33c` is correct.
- **The floor test.** `major < 7` continues the landed 2, 3, 4, 5, 6 pattern exactly, and m11b proves it bites.
- **The red set is real and pure.** I derived it myself (two new test files plus pin-only edits), applied it to a clean tree at `9d8963d`, and confirmed **no source file and no lock file** differed. Every chain test dies there; `internal/journal` fails to build on `undefined: CheckChain` — the ordinary shape for a new API written test-first.
- **A full verify on a copy is green.** `9 rows: green 9, red 0, waived 0, quarantined 0, unrunnable 0` at `7.0+r5a8f33c`.
- **The battery's own writes are v2 and chained.** Session `b3s2` in the real ref carries seq 1–20, all v2, seq 1 with an empty prev, every prev matching.
- **v1 and v2 coexist by construction.** Only three places in the tree parse a `v` field; none of the journal readers validate it, and the waiver file's `v` is a separate constant (`waiverSchema`). `TestEveryReaderTakesBothVersionsOfTheEnvelope` covers Spend, VerifyTokens and the dial.
- **The merge shapes hold.** Both two-clone tests drive the real `Merge`, so D15's union check runs inside them.
- **Markers reconcile.** `TestProof_b3s2_chain_a_break_is_named_and_never_blamed` exists exactly once, no orphan `TestProof_` names, `docs/plan` untouched.
- **`go test ./...` is green** on an unmodified copy, all nine packages.
- **Register is in band.** New comments: `chain.go` mean 15.3 words / median 13; `chainrow.go` mean 17.0 / median 14.5. Landed baseline: `journal.go` 13.6/12, `waiver.go` 16.9/15, `planrow.go` 19.3/18. No drift.
- **`scanBatch` cannot silently misalign paths.** A missing object yields a two-field header and an error, not a shifted read.
- **The performance note is honestly deferred, not a defect.** The chain row on this repo takes 48ms for 373 lines across two git subprocesses. The write-side cost is the real one — `sessionTip` reads every earlier line of the same session on each write, so a long session is quadratic — and `journal.go` already writes that down ("A long session will want an index").

## Suggested order for the fix round

1. HIGH-2 first — one call to `printable`, plus a test in the shape of `TestNothingARunSaysAboutAWaiverCarriesAControlCharacter`.
2. HIGH-1 to the driver. It is a question about what a session is, not a bug in this code.
3. MED-3 and MED-4 are two small tests; probe K is written and ready for the first.
4. MED-7 is the widest-line arithmetic test, copying the waiver precedent.
5. MED-5 and MED-6 need a ruling on scope before code: either close them or write them into R7's not-proved list.