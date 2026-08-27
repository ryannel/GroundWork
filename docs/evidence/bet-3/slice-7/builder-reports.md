# Builder reports

## The build


Build complete. Everything is in the working tree; nothing committed.

## What was built

**Three battery rows** (`internal/battery/recordrow.go`, `waivercountrow.go`, `historyrow.go`), registered after `trace`, kinds `record`, `waiver-count`, `history` added to the closed vocabulary. **The close scope** (`scope.go` + `verify --close`). **R15's lock read** (`ReadLockAtHead`, the version row and `verify version` moved onto the HEAD blob). **Section 5** of `docs/derivation-contract.md`, with three verdict tables driven cell by cell. Four new git readers in `internal/journal/git.go` (`TrailersFor`, `Messages`, `IsAncestor`, `BlobAt`) and `findings.Names` exported. Lock bumped to **12.0+ra48a79a**.

## Rulings taken

1. **Slice's last code commit** = the newest commit carrying its `Slice` trailer; merges not read.
2. **"Predates" is ancestry, not clock time.** A record landed in the slice's own commit is not stale.
3. **Landed slices only.** An unlanded slice is counted as waiting.
4. **A squash is read from the gap** between the `Slice` lines a message writes and the ones git's parser reads. Measured: a squash leaves one single-parent commit quoting everything, and git reads no trailer from it.
5. **Two shallow postures.** The counter is unrunnable, unconditionally (R14): its verdict is a threshold over every grant, so a partial history makes the count *wrong*, toward the pass. Record and history name the short history and keep judging — they leave things *unjudged*, never misjudged. Extends D56.3's reasoning by one step.
6. **"A finding names it"** = an entry title in `docs/findings.md` holding the row id as a whole word, via `findings.Names` — one rule, not two.
7. **The close scope is a checked list**, and `--close` refuses a battery missing `seal-verify`, `board`, `trace` or `record`. `go test` stays D55's manual line until F70; code and page say so.
8. **The lock is read twice**; the difference is the drift. `ReadLock` = working tree, `ReadLockAtHead` = HEAD.
9. The counter counts the waiver files present now — a deleted waiver takes its grants with it. Named as a limit.

## Red/green split, blanking, proofs

Tests were written first. **Blanking: 41 rules, 41 killed, 0 survivors, every baseline green.** The harness's own first version filled only two cells of F55's table and reported false kills; rewritten to check the clean-tree baseline per rule, it exposed **three real gaps** — a merge claiming a slice, the newest-vs-oldest claim, and the shallow-clone edge — each now closed by a test. Two mutations killed the build rather than an assertion and were re-run in compiling forms.

**One real defect the sweep found in my own row:** git dates every file in a shallow clone whether or not it can — at the edge the whole tree hangs off one grafted commit — so a record dated to the graft would read as current when it is stale. Fixed with the waiver authority's own test (parentless commit inside a shallow clone → unjudged), and the row comment and page corrected; the claim they make now is the one the code keeps.

`gofmt`/`vet` clean. `go test -p 1 ./...` green alone, `internal/battery` **141.9 s** of the 180 s clock.

## The honest verify tail

```
battery 12.0+ra48a79a
16 rows: green 15, red 0, waived 0, quarantined 0, unrunnable 1
```

The unrunnable row is the waiver counter, on this clone's shallowness — R14's own rule, and the first non-all-green tail this repo has printed. Verify exits 0; only red fails a run. Record: `4 records read (shallow): 0 missing, 0 uncommitted, 0 stale, 0 unjudged, 3 waiting`. History: `270 commits read (shallow), 25 merges not read: 0 squashed`. 17 chained journal lines under `b3s7r2`, seq 1–17.

**In-tree, the version row is red during the build** — the working tree carries 12.0 and HEAD carries 11.0, which is exactly what R15 says an uncommitted bump should read as. Your landing commit resolves it.

## Two things needing your ruling

- **A board red on the first verify attempt that does not reproduce.** Run 1 on the fresh copy gave `green 14, red 1` with the board `10 behind`, naming `b3s4_position ... failed in the run`. Run 2 on the same copy with the same binary: board green, `0 behind`. The board is also green run directly; every proof passes under `go test -run TestProof_` with and without the run guard; and a full verify on pristine `0a29858` is `13 rows: green 13`. So it is a false red in the board's proof run, not a state my rows introduced — a finding candidate against the board row, and the flake machinery missed it because both attempts inside that one run agreed.
- **`TestSealRowIsGreenOnThisRepo` was failing before I touched anything**, because you granted `seal/design/bet_3` after `0a29858` and the test asserted the repo holds no seal tag. I did not weaken it: it now asks git for the fact and holds the row to whichever green is honest. A finding candidate against the seal grant; you decide whether the fix rides with this slice.

Ten decision candidates and the finding candidates are written out in the handoff at `/tmp/claude-0/-home-user-GroundWork/a5b7b708-4ccf-5ae9-9ab1-41cce247b571/scratchpad/handoff-b3s7.md`, with an index of the evidence files beside it. I did not touch `docs/findings.md` or `docs/decisions.md`.
---

## The fix round


Fix round done. Nothing committed; the tree is ready for the reviewer.

## The nine, and what each became

**1. F104/D64.9 — signing off.** `commit.gpgsign=false` in every fixture repo maker across seven packages. `internal/battery` **141.9 s → 81.2 s**, whole suite **4m33 → 2m38**, verify **13m44 → 7m51**. The board's false red has not returned in any run since. Blanking this fails no assertion — it makes the suite slow and flaky, which *was* F100 — so it is pinned by shape: `TestEveryFixtureRepoMakerTurnsSigningOff` walks the repo's own test sources and names any file that inits a repo without it.

**2. F105/D64.1.** `MissingAtClose` is gone. `battery.UnmetAtClose(RunResult)` names every scope row that did not come back green or waived; the verb refuses on it after the table, driven through `call(t, "verify", "--close")` with a plan directory holding no plan file — an ordinary verify exits 0 there, the close fails naming board, trace and record. Unwiring the call dies. A close also records its scope on the run's own journal line (`journal.Battery` gained an optional `scope`), because a close is a property of a run, not a second event beside it.

**3. F106/D64.2.** One count, two words: `waiting` on a whole clone, `unseen` on a shallow one — nothing in git tells "never landed" from "landed past the edge", so the word says the weaker thing. Seven counts do not fit 200 bytes; six do. Page corrected. The depth-three fixture pins the guard narrow, and the widening mutation dies.

**4. F107/D64.3.** `board.Landings` and `board.JudgeValue` exported; `Derive` calls the first, so there is one reading, and the four validity shapes have one home. The newest-claim test inverted to `TestRecordRowDatesARecordAgainstTheOldestClaim`.

**5. F108/D64.4.** Only `<id> row` clears. The real-ledger probe picks its own row — it walks the shipped rows against `docs/findings.md` and takes the first that appears bare in a title and never as a row (today `version`), so it cannot rot as the ledger grows.

**6. F109/D64.5.** Bet trailers go through `board.JudgeValue` against declared bets; anything that fails pools into one unattributed bucket sharing the per-bet limit. Renames are followed by **naming every path**, not by `--follow` on the read — measured twice: `--follow` drops merges, and it folded in a *copy*, linking two waivers that merely looked alike. `journal.PathsOf` takes R records only; the git-mv probe stays red and the lookalike probe stays green.

**7. F110/D64.6.** `mutateVersion` reads HEAD. The seed and the run's label are pinned equal.

**8. F111/D64.7+8.** Cluster read: two or more adjacent trailer-shaped lines. Lone quoted prose is green, a quoted block red, and the discarded-message flavour is named on the page as the limit. Counter hits order reds, then cleared, then unreadable.

**9. F112 + lows.** Shallow posture written once (on `checkWaiverCount`) and referenced. `BlobAt`'s comment now describes the code. Doubled record paths refused at load. `journal.Messages` capped at 64 KiB with `Cut`, counted by the row and pinned on the page. `Lstat` pinned by a symlink. `atTheEdge` shared, with a table pin and a two-row pin on one clone. Proud sentence gone. Prose **19.2 → 15.3** mean; section 5 **19.4 → 16.5**.

**My call on the count:** renamed `uncommitted` → **`never committed`** rather than redefined. "Uncommitted" reads as "has uncommitted edits", a question this row does not ask; a word that needs defining away is a word to change. Both the row and the page say an edited-after-landing record is neither counted there nor red.

**My call on the journal trace:** the scope rides the run's own battery line. A close is a property of a run, so it did not warrant a new journal kind — D28's vocabulary stays closed. Pinned both ways: a close records it, an ordinary run does not.

## Proofs

Blanking: **31 rules, 31 killed, 0 survivors**, every baseline green, no build breaks. The first pass had one survivor and one build break — the survivor was my own plan test, which had written a second `records:` key and so passed on the parser's doubled-*key* rule instead of mine. Both fixed and re-run.

`gofmt`/`vet` clean. `go test -p 1 ./...` green alone, 2m38s. One verify alone, **green on the first attempt**:

```
battery 12.0+ra48a79a
16 rows: green 15, red 0, waived 0, quarantined 0, unrunnable 1
```

Board green, `0 behind`. Record reads `4 records read (shallow): 0 missing, 0 never committed, 0 stale, 0 unjudged, 3 unseen` — unseen, not waiting, which is F106's point. History reads `273 commits read (shallow), 25 merges not read: 0 squashed, 0 cut`. 17 chained journal lines, seq 1–17, no `scope` on the line because that run was not a close.

The version row stays red on the uncommitted tree: 12.0 in the working tree, 11.0 at HEAD. R15's honest state, resolved by your landing commit. The digest is unchanged at `ra48a79a` — no row identity moved, so R16 asks for no second bump.

Round-2 handoff: `scratchpad/handoff-b3s7-round2.md`; sweep in `sweep3.json`/`sweep2.log`; verify in `verify-fix.txt`. No ledger edits.
---

## The micro-round (resumed across an exit-137)


Resumed and finished. Nothing committed; no ledger edits.

## Tree state confirmed

All micro-round edits were already in the tree at `d68025a` — 43 paths changed, 14 new. Spot-checked: `bornAt`/`renamesAmong`/`pureRename` (F113), the sorted bucket read with the tie-break and the record row's `found()` (F114), `board.TrailerKeys()` behind `trailerShaped` (F115.4), and all six smalls including `close_met` and the all-empty-path refusal.

## Per item

| Item | Status |
|---|---|
| F113/D65.1 incarnation boundary | done — `journal.FileHistory` returns names + statuses; the walk stops at the birth; a copy counts as a birth too. Probes: a new wiring waiver at a dead honesty waiver's path keeps 1 grant, not 4; a waiver made as a copy starts at its own commit |
| F113/D65.2 pure rename | done — `R100` counted, named, never a grant. Page cell's fixture is now two grants + move, so the cell drives its own words |
| F114/D65.3 ties + reds first | done — buckets read sorted, ties break toward the named bet; two twelve-run probes (bet-vs-bucket, and bet-vs-bet). Record row leads with its reds |
| F115/D65.4 cluster keys | done — `board.TrailerKeys()` beside `TrailerKey`, structure-pinned to CLAUDE.md's trailer block and the contract page. `Notes:`/`Slice:` green; `Bet:`+`Slice:` stays red |
| F115 smalls (a)–(f) | all done — usage text, counting signing pin (`signingOff`), page's counted-vs-judged sentence, head bounds tied to `journal.MaxTextBytes`, `close_met` on the close's line, all-empty path list refused |

**On the second cluster probe I confirm the reviewer** rather than argue. `Bet:` and `Slice:` adjacent is what a squash quotes, the board can read neither, so the commit's slices are unlanded as far as anything here can tell. The red is about what is readable; letting a real trailer block off because the prose above looked honest would be reading intent, which no other row does.

## Blanking

**18 rules, 18 killed, 0 survivors**, every baseline green, no build breaks — over three passes (5 survivors + 1 build break, then 2, then clean). The survivors were worth the passes: the copy-as-birth and exact-rename branches are unreachable through repo fixtures (a waiver is ~100 bytes, so a move-plus-edit reads as a new file — F116's cost, now its own test), so both predicates are driven directly; the sorted read needed a three-bucket tie to become load-bearing; and the signing pin's rule sat inline in the walk where no test could reach it, so it is a function both callers use.

## The gate, run strictly serially

`gofmt -l` clean, `go vet ./...` clean. Then, alone to completion:

**`go test -p 1 -count=1 ./...` green — 3m38s**, `internal/battery` **121.3 s**. Up from 81 s: the micro-round added the twelve-run ordering probes and eight other tests, and the machine is slower than it was. Inside the 180 s clock.

Then, alone — green on the first attempt:

```
battery 12.0+ra48a79a
16 rows: green 15, red 0, waived 0, quarantined 0, unrunnable 1
```

Exit 0, 8m49. `record`: `4 records read (shallow): 0 missing, 0 never committed, 0 stale, 0 unjudged, 3 unseen`. `history`: `274 commits read (shallow), 25 merges not read: 0 squashed, 0 cut`. `waiver-count` unrunnable on the shallow clone, as R14 rules. 17 chained journal lines under `b3s7micro`, seq 1–17, no `scope`/`close_met` because that run was not a close.

Version row stays red on the uncommitted tree — HEAD `11.0+rffb3f30`, working tree `12.0+ra48a79a`. Digest unchanged at `ra48a79a`; no row identity moved, so no second bump.

Handoff: `scratchpad/handoff-b3s7-round3.md`. Evidence: `suite-final.log`, `verify-micro.txt`, `sweep6.json`/`sweep6.log`.
---

## The last round


Done. Nothing committed; no ledger edits.

**(i) Cut-message sentence** — now says the row judges what it read and counts the message as cut, so a squash quoted inside the first 65536 bytes is still `1 squashed, 1 cut`. Pinned by the re-check's own probe (a quoted trailer block plus 65 KB of padding), holding the page's phrase against the row's line.

**(ii) Cluster rule** — the page names the key set `Bet`, `Slice`, `Tests` and where each is fixed, then works both shapes through so a reader can derive why `Notes:`/`Slice:` is green and `Bet:`/`Slice:` is red. The writer's warning is there: a whole trailer block reproduced verbatim at line start reads as a squash, history does not change, so that red never clears — quote with indentation or inside a fence. The pin reads the keys from `board.TrailerKeys()` (the same source `TestTheTrailerKeys...` holds to the pages), drives both shapes through the row, and reads the page's own verdict word out of each teaching sentence rather than hardcoding one.

**(iii) Counter's counts sentence** — matches the head word for word: renames in, `limit` spelling, and one line saying the not-waivers count now lives on this row's hits and in the run's loud block. The pin reads that one sentence, not the page — every word in it appears elsewhere in section 5, which is exactly how a dropped count survived the first sweep pass.

**(iv) Help text** — `verifyUsage` is built from `battery.CloseScope()`. `main.go` gained the `battery` import; nothing else in it moved. Pinned: the help text, the scope and the refusal must be one phrase in one order.

**Blanking: 10 rules, 10 killed, 0 survivors**, baselines green, no build breaks. Two passes — the first left two survivors, and both were the pins' fault, not the rules': one drove the row without reading the page's claim, the other read the whole page instead of its sentence. Both now read what they describe.

**Gate:** `gofmt -l` clean, `go vet ./...` clean. `go test -p 1 ./internal/battery ./internal/board ./cmd/groundwork` green alone, **1m51s** (`internal/battery` 87.0 s). Narrow set is in scope: the only non-test source change is `verifyUsage` and its import.

**Unchanged as expected:** digest still `ra48a79a` — no row identity moved, and the bump pin comparing the lock against `Default().Digest()` is green. HEAD `11.0+rffb3f30`, working tree `12.0+ra48a79a`; `groundwork verify version` reports exactly that disagreement, which is R15's honest state for an unlanded bump and resolves at your landing commit.

Handoff: `scratchpad/handoff-b3s7-round4.md`. Evidence: `narrow.log`, `sweep8.json`/`sweep8.log`.
---

## The page restoration (F118)


Page restored.

**How.** Not retyped — recovered. `scratchpad/final3-copy` is the committed copy this session made for the micro-round's verify, so its page is the round-3 page exactly. A diff of its first 534 lines against the damaged file showed the only differences were the two header lines round 1 changed, which confirms sections 1–4 are identical and the copy is trustworthy. I copied it in, then re-applied round 4's three sentence fixes with the same replacements I ran the first time. 685 lines → 691, the six the cluster rule's new paragraphs add.

**Pin tests — all green, 24 across four packages:**

| Package | Pins |
|---|---|
| `internal/battery` | `TestTheContractPageAndTheRecordRowAgreeOnEveryVerdict`, `...WaiverCounter...`, `...HistoryRow...`, `TestThePageWritesTheCloseScopeTheToolChecks`, `...TheThresholdsTheRowHolds`, `...TheNamesTheRowsRead`, `TestThePageSaysWhatACutMessageDoesToTheVerdict`, `TestThePageNamesTheTrailerKeysTheClusterReadUses`, `TestThePageListsTheCountsTheCounterPrints`, `TestTheContractNamesEveryWayAProofExpectedRedIsJudged` — 10 PASS |
| `internal/board` | `TestTheTrailerKeysAreTheOnesThePagesDeclare`, `TestTheContractNamesEveryShapeATrailerCanTake`, `...BothDirectionsOfDisagreement`, `...SpellsTheMarkerTheTrailerAndTheCaps`, `...TheCapThePatternFallsBackAt` — 5 PASS |
| `internal/plan` | `TestTheContractWritesEveryCapTheParserHolds`, `TestTheContractNamesEveryOptionalField` — 2 PASS |
| `internal/trace` | `TestTheContractPageAndTheRowAgreeOnEveryVerdict`, `TestThePageWritesTheCapTheRowHolds`, `TestThePageSpellsTheSlugTheCodeComputes` — 3 PASS |

The three verdict-table pins are the strongest evidence the restore is complete: each fails on a row count that does not match the cases it drives, so all thirty section-5 table rows are back and every cell still agrees with what its row does.

**Gate.** `gofmt -l` clean. `go test -p 1 ./internal/battery ./internal/board ./cmd/groundwork` green alone, **1m48s** (`internal/battery` 85.4 s).

**Tree.** `docs/derivation-contract.md` is the only path that moved; 43 paths changed as at round 4, digest `ra48a79a`, HEAD `11.0+rffb3f30` against the working tree's `12.0+ra48a79a`. Nothing committed. Restore recorded in `scratchpad/handoff-b3s7-round4.md`.