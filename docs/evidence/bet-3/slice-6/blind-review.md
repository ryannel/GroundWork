# Blind review of slice 6

The first review. Verdict: lands after fixes — the two directions and the premises signal held; the high was one uncapped read that could kill the whole battery. Its findings are F94 through F97.


Review complete. The real repo is untouched — `git status`, HEAD, the journal ref and the stash list all match the start. Everything below ran on copies.

---

# Blind review — bet 3, slice 6 (trace row)

**VERDICT: lands after fixes.** One HIGH must be fixed before it lands. Four MED are record defects or missing edges. The core logic is sound and well tested — 29 of 31 mutations I planted died, and the two survivors are the two the builder declared as can-never-fail, both correctly declared.

---

## HIGH

### H1 — The design-file read is uncapped, and it kills the whole battery

`internal/trace/trace.go:396`, `anchorsOf`:

```go
raw, err := os.ReadFile(filepath.Join(root, filepath.FromSlash(where)))
```

No size cap. Every other reader in this repo caps: `internal/plan/parse.go:28` `maxFileBytes = 64 * 1024`, `internal/manifest/manifest.go:53` `maxBytes = 256 * 1024`. This one does not.

Reproduced, no symlink needed. A fixture repo whose `docs/design.md` is 400 MB, committed, with a `from:` pointing into it:

```
$ ( ulimit -v 2000000; groundwork verify )
exit=2
stdout bytes: 0
runtime: out of memory: cannot allocate 402653184-byte block (410517504 in use)
fatal error: out of memory
```

Nothing prints. No summary. No journal line for the run. The whole battery is lost, not one row. With no memory limit it hangs instead — I killed it at 60s.

The function's own comment also makes a claim that is false:

> "That is checkPath in internal/plan, and this read happens only after Load returned — so nothing here can be pointed outside the repo by a plan file."

A committed symlink defeats it. Reproduced:

```
$ ln -s /tmp/outside/secret.md docs/link.md
$ # slice's from: docs/link.md#a-secret-ruling
plan   green
trace  green  1 proof: 0 dangling; ... docs/link.md carries no seal in this repo
```

The anchor resolved against a file outside the repo. The plan row is green on it. `ln -s /dev/zero docs/link.md` is the OOM above with no large file at all.

The file contents never reach the evidence line, so nothing leaks. What is wrong is that the row's verdict can be driven by a file nobody reviewed, and that `verify` can be made to die.

Fix: cap the read, and correct the comment. Both are small.

---

## MED

### M2 — The contract page describes a mechanism the row does not have

`docs/derivation-contract.md`, §4.4:

> "The head carries `(unsealed)` whenever a design file the row read carries no seal, or a premise names an artifact no seal names, **and the clauses say which and how many**."

There are no clauses. `tracerow.go:212` passes `nil` where the other rows pass clauses, and the comment two lines above says so in as many words: "No clauses." D60 ruling 7, ratified in the same commit, says the same: "Unsealed things are named as hits, not folded into a clause."

The page also says "how many". No count of unsealed things is printed anywhere — the head carries the bare word `(unsealed)` and nothing else.

This page is the record `b3s6.md` declares. It states the opposite of the code and of its own slice's ruling.

### M3 — R13's "later" and R12's "one slice's proof" were re-worded with no ruling

R13, as ratified: "Amending or withdrawing an artifact marks every **later** bet whose premises name it."

`premises()` takes `(set, held)`. There is no time input, no ladder position, no program. It marks every bet in the repo. Reproduced with three bets across two programs, all citing one artifact:

```
AFTER: 3 proofs: 0 dangling; ... 3 marked: a_bet1 stands on b3_design,
       which the record says was amended and 2 more
```

`a_bet1` is first on its ladder. `b_bet1` is in a different program. Both marked.

This may well be the right reading — a bet's premises point at an already-sealed artifact, so every citing bet is later by construction. But nobody wrote that down. D60 has seven rulings and none is this one. F91-F93 do not mention it. The contract page silently restates R13 without "later". Given F91 (a mark never clears), the consequence is real: a bet that closed five bets ago is now marked forever by an amendment it could not have anticipated.

Same class, same page: R12 says a facing id is "claimed by exactly one slice's **proof**". The code reads `slice.Facing`, and §4.2 restates it as the slice's `facing` list. Also probably right — there is no per-proof facing field — and also unrecorded.

Either add a D61 that records both readings, or make the code match the words.

### M4 — A slice that lists one id twice is red, and the line says nothing useful

Reproduced. One slice, `facing: [f_one, f_one]`:

```
plan   green
trace  red   1 proof: 0 dangling; 1 facing id: 0 unclaimed, 1 claimed twice;
             0 marked (unsealed): f_one is claimed by demo_s1 and by demo_s1
```

The plan reader lets a repeat through (`internal/plan/resolve.go` only checks the id is declared by the bet). `forward()` then reads `by = [demo_s1, demo_s1]` and prints `by[0]` and `by[1]`.

Three things wrong. R12 says "claimed by exactly one slice" — one slice is one slice. The line names one slice twice, which tells a reader nothing about what to fix. And the twelve-row verdict table has no row for this reachable state, while `TestTheContractPageAndTheRowAgreeOnEveryVerdict` enforces the table both ways and so reads as complete.

### M5 — `b3s6.md` contradicts D60 ruling 5

The slice's own plan, committed:

```yaml
real:
  - the sealed plan and the sealed design docs, read as committed
```

D60.5, ratified in the same commit `e03a5b0`: "Design files are read from the working tree until R15's slice moves committed reads onto their own ground." F92, same commit: this repo's design carries no seal. So the plan claims sealed docs read as committed; the ruling says unsealed docs read from the working tree. The builder edited this file (`records:`) and left the line standing.

---

## LOW

- **L1 — Two spellings of the red rule.** `trace.Report.Sound()` is called from tests only (`grep -rn "\.Sound()"` — the other hits are `seal.Report`). The row computes its verdict from `traceTotals.outcome()` and never calls `Sound`. The contract table is titled "What the row read … Is it red", but `TestTheContractPageAndTheRowAgreeOnEveryVerdict` drives all twelve cells through `Sound()`. Three of the twelve states never reach the row in any test: "the design file could not be read", "claimed and deferred", "a premise withdrawn". Both functions are separately pinned today, so nothing is wrong now. It is one rule written twice, and the page's proof goes through the copy the row does not use.
- **L2 — The table's middle column is a gut cell.** I changed `Traced` to `Bananas` and the suite stayed green. The verdict column and the row count are both driven (I flipped two cells and deleted a row — all killed).
- **L3 — The slug rule diverges from a real renderer on one shape.** `## The [spec](docs/spec.md) page` → GitHub `the-spec-page`, this code `the-specdocsspecmd-page` (reproduced: the GitHub anchor is red, the computed one green). §4.1 opens "An anchor is the heading slug a markdown renderer makes, which is what somebody clicking a heading link in a browser gets." No current design heading holds a link, so this is latent. Inline code, bold, em dashes, unicode, case and duplicates all match GitHub — I checked each.
- **L4 — §4.3's premise-id claim rests on two rules that agree by luck.** The page says a premise id is a seal subject "spelled the way section 2 spells one". `internal/plan/parse.go:30` `maxIDBytes = 64` and lowercase-digit-underscore; `internal/seal/seal.go:71` `MaxSubjectBytes = 64` and `^[a-z0-9_]+$`. Identical, and nothing pins them together.
- **L5 — The forward proof's two-slices subtest does not check the plan row.** The other two red subtests do. I confirmed by hand that the plan row is green on a two-slices fixture, so the claim holds — it is just not proved.
- **L6 — Register drift.** Two examples against "one idea per sentence": `tracerow.go:37-41` ("A mark is not. Nothing in this bet gives a marked bet a way to answer — the answer is a person re-reading the bet against the artifact that moved — and a red nobody can clear is the friction-waived class this design's own risks name.") and `tracerow.go:195-197` (the byte arithmetic, five clauses in one sentence). This matches the neighbouring rows, so it is repo-wide drift rather than something this slice invented. Worth naming before it compounds.

---

## What held up

**The two directions, end to end through the built binary.** Anchor resolves → quiet. Anchor names nothing → red, naming the proof, the anchor and the file, with the resolving proof not blamed. Em-dash double hyphen, unicode letters, case folding, duplicate headings (`duplicate`, `duplicate-1`, and `duplicate-2` red), closed ATX headings, seven hashes, no space after hashes, fenced `#`, setext — all correct, and setext is named in F93 and on the page. Forward: claimed once quiet, claimed twice red with both slices named, unclaimed red, deferred quiet, claimed-and-deferred red per D60.4 with the plan row green on it. A deferral naming an undeclared id is the plan row's red, and trace goes unrunnable.

**The premises signal.** Grant, amend and withdraw all driven through the real seal verbs on scratch repos. Before the amend: green, `0 marked`, no `(unsealed)`. After: `1 marked: demo_bet stands on b3_design, which the record says was amended`. Withdrawal says `withdrawn`. D60.3 holds — the mark lands in the row's own `battery-row` journal event, verified in the ref:

```json
"row":"trace","outcome":"green","evidence":"1 proof: 0 dangling; 1 facing id:
0 unclaimed, 0 claimed twice; 1 marked: demo_bet stands on b3_design, which
the record says was amended"
```

A premise no seal names is `(unsealed)`, not a mark, not red (D60.7). A seal covering `README.md` under subject `b3_design` leaves the premise sealed and the design file honestly called unsealed — the two halves are read apart, which is right.

**The sealed posture.** D53.1 is satisfied: `TestProof_b3s6_premises` and `TestTheTraceRowsGreenLineSaysWhatItRead` both build repos sealed through the real `GrantSeal`, so the non-default sealed path is walked. `(unsealed)` clears when the file is sealed. This repo's own line is honest — it says exactly what is true of it.

**No double-reporting.** Unloadable plan, `from:` with no anchor, `../..`, an absolute path, and a directory: plan red, trace unrunnable, every time. The plan reader refuses path escapes before trace ever runs.

**Forged inputs.** Control characters in an anchor reach the row and are defanged by `printable` — `\x01`, `\x02` and an ANSI escape all came out as spaces (M29, dropping `printable`, was killed). Control characters and RTL overrides in a facing id are the plan reader's red. Evidence never carries a machine path.

**Mutation sweep, 31 planted, four-way, full-suite reruns for the survivors.** Killed: every part of the slug rule (punctuation strip, case fold, space-to-dash, dash/underscore keep, dash-run collapse), the `-1` suffix, fence skipping, the six-hash limit, the space-after-hashes rule, closed-heading trimming, all three forward branches, both halves of the bet-directory scoping, amended-vs-withdrawn, revoked detection, one-mark-per-bet, unsealed-premise detection, the covers map, the `visited` de-dup, `printable`, the D17 zero-check, the no-plan-dir green, all three red causes in `outcome()`, marks-as-red, unsealed-as-red, `sealNote`, and `SubjectOf`'s name check. **Survived, both correctly declared:** the non-seal-tag skip in `readSeals` (acts filed under a name `tagsOf` never holds are never looked up — verified) and the tag de-dup in `claim` (`stateOf` answers the same for a repeated tag — verified).

**Mechanics.** `gofmt -l` clean, `go vet ./...` clean. `go test -p 1 ./...` green alone, 4m29s; `internal/battery` 132.5s against the claimed 136.9s. Red set re-derived at `63c4189`: with the seven test files in place and nothing else, three packages do not compile; with minimal stubs added so they build, all three `TestProof_b3s6_*` are red at an assertion, along with `TestTheTraceRowsCountsAlwaysFitTheLine`, `TestSubjectOfReadsASealTagAndRefusesEverythingElse`, and every `TestThisRepoDeclaresTheBump*` test via digest drift. Version floor chain is continuous: 2,3,4,5,6,7,8,9,10,11. Hostile split arithmetic checks: 12→13 rows, green 5→6, red 2 and unrunnable 5 unchanged. `SubjectOf` reuses `checkTagName`, which round-trips through `TagName`, so there is one rule about a seal tag's name. One full verify on a copy gives `battery 11.0+rffb3f30`, `13 rows: green 13`, and the exact claimed trace line. The journal holds 14 chained lines under `b3s6` — 13 `battery-row` plus 1 `battery`, seq 1 to 14 — and that recorded run's trace line matches the claim byte for byte.

**The head's byte arithmetic.** I checked it by hand: fixed words 52, plural nouns 18, unsealed note 11, six counts at 19 digits each 114 — 195, against `MaxTextBytes = 200`. Correct, and driven by a search over the count space rather than a guess.