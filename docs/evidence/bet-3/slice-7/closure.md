# Closure re-check

After the fix round. Everything closed — F100 confirmed gone across three clean runs — with four new mediums in the counter's identity rules, recorded as F113 through F116.


Closure re-check complete. The real repo is untouched: `git status` matches the start (42 entries), HEAD still `790186a`, journal ref still `fcd482a`, no stashes, 9 tags. Everything ran on copies.

---

# Closure re-check — bet 3, slice 7

**VERDICT: lands after four small fixes.** Every finding from my round is closed or closed-as-ruled, and the fixes are pinned — 21 of 22 planted mutations died against clean baselines. F100's ghost is gone: three verify runs, three green boards, three identical honest tails. Four MED defects are new in the fix diff, and three closed findings leave residuals worth recording.

---

## Per finding

### H1 / F105 — CLOSED

`verify --close` on my unrunnable-scope fixture: **exit 1**.

```
close scope, beside the full suite: seal-verify, board, trace, record
board / trace / record   unrunnable
16 rows: green 11, red 0, waived 0, quarantined 0, unrunnable 5
stderr: a bet close runs seal-verify, board, trace, record, and this run did not:
        board came back unrunnable; trace came back unrunnable; record came back unrunnable
```

Refusing after the table is the right call — the reader sees every row before the verdict. `UnmetAtClose` driven across all five outcomes plus the missing-row case: green and waived pass; red, unrunnable and quarantined each fail by name; a run holding none of the rows names all four. Mutations `n03` (unwire the call), `n04` (only red counts), `n05` (ignore did-not-run) all died. `TestVerifyCloseFailsWhenAScopeRowDidNotRun` asserts a plain verify exits 0 on the same fixture first — that is the four-way discipline, and it is what makes the refusal real rather than incidental.

**The journal call is right.** The scope rides the run's own battery line, `omitempty`, cloned, each entry checked non-empty, D28's vocabulary untouched. A close is a property of a run, not a second event — the same reasoning D60.3 used for R13's mark. Verified on a real refused close: `"scope":["seal-verify","board","trace","record"]`, and absent on an ordinary run.

### H2 / F106 — CLOSED as ruled

My depth-1 probe no longer reads green-with-a-hidden-miss in the old way:

```
full clone   : red   1 record read: 1 missing, ... 0 waiting
depth-1 clone: green 0 records read (shallow): 0 missing, ... 1 unseen
```

The state is named. The page says which is which (5.1). The head sits at six counts inside its bound, and the bound test searches both spellings.

**On the "one count, two words" call: sound, and better than a second count would be.** From inside a shallow clone git genuinely cannot tell "never landed" from "landed past the edge" — I built a repo holding one of each and both read `unseen`, correctly, because the word claims the weaker thing. A second count would be invented. The code says so and cites D64.2, and the page carries it.

**Residual, worth recording:** the row still comes back green over records it cannot judge. Same repo, same tree: whole clone `red, 1 stale`; depth-1 clone `green, 0 stale, 2 unseen`. On this repo that is 3 of 7 record-declaring slices unjudged at every run, and it will stay that way while every clone here is shallow. D64.2 ruled counting, not reddening, so this is the ruled cost — but the ledger should say the cost out loud rather than leave it in the word.

### H3 / F106 — CLOSED

`TestRecordRowJudgesARecordOneCommitInsideTheEdge` is the missing fixture. My depth-3 probe: shipped code reds (`1 stale, 0 unjudged`); depth-1 leaves it unjudged. Mutations `n01` (widen the guard to every shallow commit) and `n02` (remove it) both died — last round `n01`'s equivalent survived the whole suite.

### M1 / F107 — CLOSED

`board.Landings` is exported, `Derive` calls it, the record row calls it. Re-ran my two-claims probe: the record written between an older and a newer claim is now judged against the **older** one and comes back green — last round it was red, naming the stray. A doubled `Slice:` trailer no longer lands a slice at all (`1 waiting`), so the four validity shapes now reach the record row. `JudgeValue` puts the shapes in one place. `n06` (record row reads claims itself) and `n07` (walk newest-first) both died.

### M2 / F108 — CLOSED

Ran the real `findings.Names` over the real parsed titles: bare-word matches 9 rows, the phrase `<id> row` matches 5 — and all five are titles genuinely about the row. `version`, `honesty`, `chain`, `stub`, `trace` no longer clear.

My original probe used `record`, which since gained a legitimate "The record row's …" entry (F106, my own finding) — so I re-ran it on `trace`, which the ledger names only as "Three smalls from the trace build": **red**, "no finding names it". `TestARealLedgerDoesNotClearAThresholdByAccident` self-selects a bare-only row from the shipped ledger and skips honestly when none is left. `n08` died.

### M3 / F109 — CLOSED, with a residual

Rename following works and the copy/rename distinction is **sound and load-bearing**. Probes:

- rename after 3 grants → `4 grants`, red (was green).
- rename then modify → `4 grants`, red.
- a real copy beside the original → the copy does **not** inherit; git emits `C100` here, so had copies been folded the lookalike would have inherited three grants. `n17` (stop following renames) and `n18` (fold copies too) both died, so both directions are pinned.

Not `--follow` for the count itself is the right call: `--follow` takes one path and mangles merges, and the two-step (follow for names, ordinary log for commits) keeps `1 merge not read` visible.

**Residual:** `git rm` plus a differently-worded file at a new name, in one commit, still restarts the count at 1 — git calls it `A`, not `R`, below the similarity threshold. It costs the evader a real rewrite now instead of a bare `git mv`, so it is much narrower, but the page names only deletion as the limit. Both limits belong in the same sentence.

### M4 / F109 — CLOSED

- four grants under invented bet names → `red … 4 grants inside the unattributed bucket … 4 misstated`
- three grants each carrying two `Bet:` trailers → `red … 3 grants inside the unattributed bucket … 3 misstated`
- three grants across three **declared** bets → green, no false red.

`n10` (skip the shape check) died. The misstated count is in the head where no cut reaches it.

Worth naming as a cost, not a defect: in a repo whose plan declares no bets, every `Bet` trailer is unknown, so all grants pool into one bucket sharing the per-bet limit of 3. The page says "against the bets the plan declares", so it is documented — but adopters without a GroundWork plan will meet a much stricter row than the page's headline numbers suggest.

### M5 / F110 — CLOSED

One run, one version. HEAD 0.1, working tree bumped to 7.7:

```
battery 0.1+ra48a79a
version  red     the working tree's ... declares 7.7 ... and HEAD declares 0.1 ...
mutate   green   ... sampled 1 of 1 target at 0.1+ra48a79a
```

`n11` died.

### M6 / M7 / M8 / F111 — CLOSED, with a residual

- prose paste (a lone quoted `Slice:` line): **green**. Was a permanent red.
- GitHub-style squash: red, `quotes 2 Slice lines that git reads as 1`.
- classic `merge --squash`: red, `git reads as 0`.
- merge quoting a whole trailer block: still not read.
- reds-first ordering: my cleared-`board`/hot-`trace` probe now leads with `trace`. `n15` died.
- the discarded-message flavour is a driven table cell: "A squash whose message kept no quoted trailers | Invisible, and named as the limit | no". Naming the limit is the honest move.

`n12` (cluster of one) and `n13` (no cluster at all) both died.

**Residual — the false red is narrowed, not removed.** Two adjacent trailer-shaped lines in prose still trip it. Both reproduced:

```
"The commit we are correcting carried / Bet: demo_bet / Slice: demo_s1"   -> red
"Notes: / Slice: demo_s1 was the one that broke."                          -> red
```

The second is worse than the first: `trailerShaped` accepts any `word:` line, so a bare prose label above a sentence starting `Slice:` forms a cluster, and the evidence then prints the whole sentence as a trailer value — `demo_s1 was the one that broke.` History is immutable and the row is blocking, so such a red never clears. A cheap tightening: require two or more lines whose keys are trailer keys this repo actually writes. Probe 2 goes green under that rule, probe 1 and both real squashes stay red.

### M9 / F104 — CLOSED, and this is the big one

**Three verify runs on the landed copy, three green boards, three identical tails:**

```
board   green  24 proofs, 4 landed (shallow): 12 ahead of plan, 0 behind, 0 trailers misstated, 0 unread
record  green  4 records read (shallow): 0 missing, 0 never committed, 0 stale, 0 unjudged, 3 unseen
history green  273 commits read (shallow), 25 merges not read: 0 squashed, 0 cut
16 rows: green 15, red 0, waived 0, quarantined 0, unrunnable 1
```

Last round I got the board red on four of four. The record and history lines match the builder's claims exactly. 17 chained journal lines. `go test -p 1 ./...` green in **2m58s**, `internal/battery` **89.7s** (was 138s). `gofmt -l` clean, `go vet` clean. I measured the residue directly: running `internal/journal` and `cmd/groundwork` with `GIT_CONFIG_GLOBAL=/dev/null` now makes no difference, so nothing is still reaching the shim.

### M10 / F110 — CLOSED

D64.6 corrects D60.5's promise in the ledger and assigns committed design reads to a later bet. `internal/trace` and `internal/plan` still read the working tree, which is now the recorded position rather than a silent narrowing.

### M11 / F112 — CLOSED

Measured against D63's baseline of ~15:

| | before | now |
|---|---|---|
| the four new row files' comments | 19.2 mean, 18 sentences of 35+ | **14.9 mean, 1 of 35+** |
| contract page section 5 | 19.5 mean, 7 of 35+ | **16.5 mean, 1 of 35+** |

The shallow posture is written once on `checkWaiverCount` and referenced. One note, not a reopen: across *all* Go prose the slice adds — test files, `git.go`, `board.go` — the mean is 17.5 with 28 sentences of 35+. D63.3 puts the measurement on the landing checklist; it should name which files it covers, or the drift will move to where nobody measures.

### The lows / F112 — all CLOSED

BlobAt's comment now describes what the code does. Doubled record paths are refused at load, plan row red, record row unrunnable — one cause, one red (`n19` died). `uncommitted` → `never committed`, with the page and a driven table cell both saying an edited-after-landing record is neither counted nor red. `atTheEdge` is shared and pinned twice — a table across all four parents/shallow combinations, and both rows against one graft commit. The proud sentence is gone. `Messages` capped at 64 KiB with the cut counted and page-pinned (`n20` died); this repo's longest message is 15 KB, so `0 cut` is the honest steady state. `Lstat` pinned (`n14` died). A close leaves a journal trace.

---

## NEW in the fix diff

**N1 (MED) — a reused waiver file name inherits another row's grants, and reds the wrong row.**
Reality: `wiring` waived exactly once, in `bet_two`, at a path a deleted `honesty` waiver used to occupy. The row says:

```
red ... 5 grants ... wiring has 4 grants inside bet_one, at the limit of 3, and no finding names it
```

Four grants that belong to a deleted waiver, attributed to a row and a bet that never had them. The read is keyed on paths, so `PathsOf` widening the path set makes this more reachable, not less: with a rename in play I measured 6 grants where 3 exist, with each file counting the other's commits. It contradicts the page's own sentence — "each waiver file's own git history". The fix is to stop the path read at the commit that created the file's current incarnation.

**N2 (MED) — a pure `git mv` counts as a grant.**
Two honest grants plus one tidy-up rename in the same bet:

```
before the rename: green  2 grants
after the rename:  red    3 grants inside bet_one, at the limit of 3
```

Nobody decided anything about the waiver; a filename changed. The row's own rule for merges is the right one here — counted, named, never read as a grant. The page's cell says "Two grants of one row, moved by git mv | The same waiver, counted once | no", but its fixture plants **one** grant plus a rename, so the cell's words do not describe what it drives and `drive` cannot catch it.

**N3 (MED) — the counter's evidence line is nondeterministic.**
Dropping the `bet != ""` guard lets the unattributed bucket win `worst` on a tie. Same repo, same binary, twelve runs: ten say `inside bet_one`, two say `inside the unattributed bucket`. `judge`'s own comment claims "a fixed order so one repo always prints one line". The journal is the durable record, and two runs of one repo now write two different diagnoses. One line fixes it: break ties toward the named bet.

**N4 (MED) — the record row has the buried-lead defect D64.8 just fixed in the counter.**
Shallow clone, two unjudged records and one stale one:

```
red ... 1 stale, 2 unjudged ... docs/aaa.md ... was last changed at the edge of this shallow clone ... and 2 more
```

The row is red because of `zzz.md`; the line names `aaa.md`, which is never red. `unjudged` notes share one slice with the three red kinds, in plan order. Reachable on any shallow clone with more than one record — which is every clone here. Same one-line fix the counter got.

**N5 (LOW) — the `--close` usage text still documents the check F105 replaced.**
`groundwork verify --list` prints: "a refusal when the battery does not hold a row a close has to check". That is registration, not outcome. The one place a person reads about `--close` before running it describes the hollow version.

**N6 (LOW-MED) — the gpgsign shape pin is evadable two ways.** Both reproduced against the pin:
- a maker that inits with `-b trunk` (or plain `git init`, or `--initial-branch=main`) is invisible — the walk greps for the literal `"init", "-b", "main"`;
- a second, unsigned maker added to a file that already contains the gpgsign string passes, because the check is per file, not per maker.

It covers today's makers. Counting `"init"` occurrences against `"commit.gpgsign"` occurrences per file, or funnelling makers through one helper, closes both.

**N7 (LOW) — the page says a cut message is counted "rather than judging the half it saw"; the code judges it.** Proven: a 75 KB message reports `1 squashed, 1 cut`. Judging the half is the better behaviour — it caught the squash — so the sentence is what should change.

**N8 (LOW) — the head-byte constants are self-certifying.** Each test checks the computed head against its own constant; nothing checks the constant against `journal.MaxTextBytes`. `counterHeadBytes` is 199 against a cap of 200, and its comment says so plainly. One assertion per row closes it.

**N9 (LOW) — the close's journal line does not say whether the close was met.** My refused close recorded `scope:[...]`, `counts:{green:11, red:0, unrunnable:5}` — read alone, `red 0` looks like a close that passed. The reader has to cross-reference sixteen row lines. A close is the highest-stakes run there is; D52.3's rule applies.

**N10 (LOW) — `TrailersFor` turns an all-empty path list into "read everything".** The empty-path drop protects `Trailers`' no-path call, but it makes a caller's empty value mean the whole history — the direction that inflates a threshold. Not reachable today; the counter always passes a real path.

**N11 (LOW) — a close has no override.** Waivers apply only to a red row (`if first.Outcome == Red`), so an unrunnable scope row cannot be waived and cannot be excused. The outcome most likely to block a close is the one with no escape.

---

## Mutation sweep — 22 rules, clean baselines for four packages

**21 KILLED:** edge guard widened; edge guard off; close refusal unwired; unmet counts only red; unmet ignores did-not-run; record row reads claims itself; Landings walks newest-first; naming by bare word; PathsOf off; attribution unchecked; mutate seed from the working tree; cluster size one; cluster read off; Lstat→Stat; cleared hits first; waitingWord always "waiting"; renames not followed; copies folded; doubled records allowed; Messages uncapped; close scope shrunk.

**1 SURVIVED:** blanking the gpgsign pin's own assertion — a test cannot pin itself. Not a gap in the code; N6 is the real question about that pin.

## What held up

The three rows' behaviour is intact under regression: missing, stale, never-committed, landed-with-its-code, the two thresholds, the five-across case, merges not counted, an unread file named, no-slice-trailer histories, the shallow gate. The contract page's three tables gained a cell for every fix and stay cell-driven both directions. `verify --list` shows sixteen rows with their kinds. The digest is unchanged at `ra48a79a`, the version row is red on the uncommitted tree and green on the landed one, and the version floors still run unbroken 2 through 12.