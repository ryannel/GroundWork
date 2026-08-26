# Blind review of slice 5

The first review. Verdict: lands after fixes — the judgment table and both seams held, and the reconciliation of R10 was judged sound; what failed was the row's own sentences claiming more than the row checked. Its findings are F86 through F90.


## Verdict: **lands after fixes**

The mechanism is right. I drove the whole judgment table through the built binary against real fixture repos, and every row of the contract table came out as written. The two seams (the shared derivation, the shared `readTests`) are genuine — blanking either kills both rows that depend on it. The version, digest, journal chain, row count, hostile-repo split and full verify all reconcile with the builder's claims.

What is wrong is narrower and mostly one shape: **the row's own sentences claim more than the row checked**, and four of its clauses are proved by nothing.

All work was done on copies under `/tmp/.../scratchpad`. `git status`, HEAD and `refs/groundwork/journal` in `/home/user/GroundWork` are byte-identical to the start.

---

## HIGH

### H1 — The green sentence is an unqualified claim the row cannot support

`internal/battery/stubrow.go:418` prints, on every green run: `none of them is a stub, a skip or a red that proves nothing`.

Under D58.1 that sentence is decided by the honesty scan, whose stated stance is precision over recall. I planted stubs that pass anyway. Each one is a proof its plan expects red, whose test passes, and which the row counts as **ahead of plan** while printing the sentence above:

| planted body | row said |
|---|---|
| `if 1 == 1 { return }` then `t.Errorf(...)` | `1 ahead of plan ... none of them is a stub` |
| `if false { t.Fatal(...) }` | same |
| `x := 1; y := 1; if x != y { t.Fatal(...) }` | same |
| `got := 2; if got != 2 { t.Fatal(...) }` | same |
| `for i := 0; i < 0; i++ { t.Fatal(...) }` | same |
| `checkIt(t)` where `func checkIt(t *testing.T) {}` sits in another `_test.go` of the same package | same |
| an assertion on a fake recorder (`r.Fatalf`) instead of `t` | same |

The last two are the serious ones. The scan follows helpers only inside one file, so **one line of indirection into a no-op helper defeats the whole check**, and the row still says "none of them is a stub".

This matters most on this repo. Its own line reads `24 proofs expected red: 0 red at an assertion, 0 not, 16 ahead of plan, 8 with no test`. **Zero** of the twenty-four was judged as a red at an assertion. The sentence rests entirely on the scan's precision-only reading of sixteen passing tests.

The contract page hedges correctly (`A test the scan cannot follow reads as one that can fail`). The evidence line does not hedge at all, and the evidence line is what a reader sees.

Fix: say what was checked. "the honesty scan found no stub among them" is honest; "none of them is a stub" is not.

Reproduce:
```
fx=/tmp/.../scratchpad; cd $fx/p_const && $fx/gw verify | grep '^stub'
```

### H2 — F83 understates the boundary it exists to name

F83 says: *"A constant condition is as vacuous as a self-comparison, and the scan's selfComparison could learn it."* That frames the hole as one missing comparison rule.

Teaching `selfComparison` about constants fixes exactly one of the seven shapes above. It fixes none of the `unknown`-escape cases — the cross-file helper, the assertion library, the fake recorder — and those are not accidents. They are the scan's own documented limits (`honestyrow.go:51-61`), and D58.1 has just promoted them from "the honesty row's known false negatives" to "the stub row's whole red/not-red boundary".

This is F62's lesson: the ledger entry was written from the builder's report, not from the diff. The class is right, the size is wrong.

Fix: rewrite F83 to name the escape, not just the missing shape.

---

## MED

### M1 — Five blanking survivors inside the slice's own new code

The builder reports "21 blanking rules all killed, one survivor outside the slice". I ran a 27-rule sweep. Twenty-one died. Six survived, and five of them are in this slice's new code. All five survive the **whole** `internal/battery` package suite, run clean (`ok ... 141.664s`).

| rule | what it blanks | survives |
|---|---|---|
| M8 | the `one.shape == ""` guard in `cannotFail` | yes |
| M9 | first-wins in `cannotFail` → last-wins | yes |
| M18 | the "broke some other way" clause on the broken-surface red line | yes |
| M20 | `tailOf(t.clauses)` on the green branch of `verdict()` | yes |
| M21 | the `read.blocked` clause in `stubVerdict` | yes |
| M26 | `running != ""` in `goadapter.go:506` (pre-existing, outside the slice) | yes |

Two of these are more than untested lines:

**M8 is load-bearing and reversed a real red.** The guard is what keeps an honest test from claiming a proof's name and masking a stub with the same name in another suite. I built that repo — `alpha` holds an honest failing `TestProof_p_dup_it_holds`, `beta` holds a stub with the same name — and:

```
stub (as built) red   ... 1 not ... p_dup failed, and its test asserts nothing
stub (M8)       green ... 0 not ... none of them is a stub, a skip or a red that proves nothing
```

A one-token change turns a caught stub into a green run, and nothing in the suite notices.

**M20 is F76's own class, re-committed.** The comment directly above the line says *"A signal the row only shows when something else is already wrong is aimed the wrong way (F76)"*. Deleting the thing that comment protects changes no test. A comment citing a finding is not a proof against it.

M21 matters for the same reason: on a repo with a stack the scan cannot read, that clause is the only signal the row could not judge some of its proofs. Blank it and the row is silently green.

M9 survives with only a wording difference, but its comment misdescribes the code. It says *"the first shape found is the answer, the way the run folds two outcomes at the worse of them."* The code does not fold at the worse — the `shape == ""` guard means honest readings never enter the map at all, so any vacuous shape wins. The behaviour is safer than the comment; the comment should say so.

M26 is genuinely pre-existing (`git log -S` puts it at `8ac78d4`, an earlier bet), so leaving it stands. But **it is in no ledger entry.** F85 got one for the Authority survivor; this one is only in the builder's report, and reports are not the record.

### M2 — The headline proof's three-styles assertion is a tautology for two of three styles

`stubrow_test.go:236`:
```go
for _, want := range []string{"p_empty", "p_commented", "p_always"} {
    if !strings.Contains(res.Evidence, want) && !strings.Contains(res.Evidence, "more") {
```

The real line that fixture produces is:

```
4 proofs expected red: 1 red at an assertion, 3 not, 0 ahead of plan, 0 with no test: p_empty passed, and its test asserts nothing and 2 more
```

`"more"` is always present, so the loop never checks that `p_commented` or `p_always` is named, and never checks their reasons. The sub-test is called *"the three stub styles each fail the row with the reason named"*, and for two of the three it asserts only the count `3 not`.

The three reasons genuinely differ (`asserts nothing` / `asserts nothing: the only assertion is commented out` / `only asserts under a condition that compares a value to itself`). I confirmed the row prints each correctly by running each style alone through the binary — so the code is right and the proof is soft. Split the case, or drop the `"more"` escape.

### M3 — A broken surface swallows every stub on every other surface

`checkStub` answers `brokenSurfaces` before it reads any test source, and that branch returns without judging a single proof. On a two-surface repo — `cli` holding a planted empty-body stub, `side` failing to build — the row says:

```
stub  red  1 surface could not be run, so the reds it holds prove nothing: the surface "side" did not build: ...
```

The stub on `cli` gets no count and no name. Neither do any of the other counts: D33's "counts lead and never give way" is silently suspended on this branch.

`brokenSurfaces`'s own doc says *"a row that gave the red up for it would lose the defect to the noise"* — and that is exactly what happens between a died surface and a real stub elsewhere. The honesty row already does this right: it keeps the hit and rides the unreadable surface as a clause. The gate still closes (the row is red), so this is not a false pass — but the defect the row exists to name is invisible, and §3.5 does not mention the behaviour. Every fixture in the test file is single-surface, so no test sees it.

Reproduce: `cd $fx/f_two && $fx/gw verify | grep -E '^(stub|honesty)'`

### M4 — D58.1 states two things that are not so

- *"The three ladder styles are exactly the three shapes the scan names."* The scan names five: `asserts nothing`, `asserts nothing: the only assertion is commented out`, `logs but never asserts`, `only asserts under a condition that compares a value to itself`, `is skipped unconditionally, so it never runs`. I drove `logs but never asserts` through the real row and it reddens — so it is not a shape nobody meets.
- *"both sealed fixture descriptions grade the same under this rule as under the strict one."* For `holdout3-go-gauge` this is checkable from the open description and holds: nine proofs, six expected red, three failing honestly, three plants that the scan sees. For `holdout3-go-sift` it is not checkable. The open record says *"One wrinkle, noted only in the key."* The builder could not read the key, so it could not know how the wrinkle grades. The honest wording is "as far as the open descriptions show".

The reconciliation itself I judge **sound**. The two R10 paragraphs describe the same set of proofs, so one had to give, and D56.1 had already ruled which. B19's value is preserved — I verified all three ladder styles still fail the row through the built binary. The problem is the supporting sentences, not the direction.

### M5 — The slice appends the contract page and declares no record

`b3s5.md` carries `records: []`. The slice adds §3.5 to `docs/derivation-contract.md` and a test that reads it. Slices 1, 3, 4 and 7 all declare that path. Slice 7's record row judges declared records only, so this slice's page obligation will never be checked. One line in the plan file fixes it.

---

## LOW

- **L1** §3.5 is placed after §3.4 *"What the tools do with this"*, which is the closing section of every chapter (1.6, 2.5, 3.4). It should sit before it, with the closer renumbered.
- **L2** §3.5's shape list has four items and then says *"Those are the three stub styles the ladder names"*, and omits `logs but never asserts`. The pin reads only the table, so the prose is unguarded.
- **L3** The contract pin drives the verdict cells in both directions — I flipped yes→no, no→yes, gutted a verdict to prose, deleted a row and reworded a condition cell, and all five died. But the middle column is unguarded: replacing `A stub: the test was never able to fail` with `""` survives, so the page could describe a stub as the good red and keep its verdict.
- **L4** `judgeRed`'s `default:` answers `rightReason` for any `board.Actual` the vocabulary gains — the green answer, silently. This same slice added `TestOnlyAVerifiedSignatureIsHumanAuthority`, whose comment says the vocabulary is *"walked whole rather than sampled, so a fifth state added without a ruling behind it shows up here as a failure"*. `board.Actual` is the vocabulary this row is built on and gets no such walk, even though `board.go:56` says the four states are kept apart *"because slice 5's stub check ... cannot judge what it cannot tell apart"*.
- **L5** `has no test, and its slice has landed` fires on a proof whose test exists but sits outside every declared surface. I built it: `alpha/alpha_test.go` holds `TestProof_p_here_it_holds`, the manifest declares only `sub`, and the row goes red saying the proof has no test. The tool cannot know better, but the sentence is false. "no test ran on any declared surface" is true.
- **L6** `stubTotals.say()`'s red arm is unreachable in the shipped row: `stubbed > 0` always produces a hit, so `len(hits) == 0 && outcome() == Red` cannot happen. `"one of them is not red for the right reason"` never prints, and the widest-line search asserts on it anyway.
- **L7** `brokenSurfaces` hard-codes `"the stub check"` instead of using `d.name`. The derivation struct exists to carry that name.
- **L8** D58.3's timeout arm does not draw on the default configuration. `board.Budget` is 10 minutes and go test's default clock is also 10 minutes, and board's clock starts first — so a hung suite comes back `go test was stopped` → unrunnable, not red. I reached the red only with `GOFLAGS=-timeout=15s`, where it works correctly (`the surface "cli" ran out of the runner's own clock`).
- **L9** Register. Two sentences carry two ideas and a jargon compound: *"A test the scan cannot follow reads as honest, which is the scan's own precision-over-recall stance and the reason it has never fired a false red on a table-driven test."* That last clause also asserts a track record nothing establishes. Otherwise the new prose sits at the house level, not below it.

---

## What held up

I could not break any of this:

- **The judgment table, end to end, through the built binary.** Empty body → red; commented-out → red; always-true → red; honest pass → not red, counted ahead; skip → red; build failure → red naming the surface; panic → red; `os.Exit` → red; SIGKILL → red; timeout (short clock) → red; missing test on an unlanded slice → counted and quiet; missing test on a **landed** slice with a real `Slice:` trailer → red naming it. Every reason came out in the scan's own words.
- **The vacuous seam is real.** Blanking `vacuousShape` kills the honesty row's seven cases **and** the stub row's headline proof and `TestTheStubCheckCallsTheHonestyScansOwnJudgment`. It is called, not copied.
- **The derivation seam is real, and there is no second expected-state.** `ExpectRed` is computed in exactly one place (`board.go:160`). Inverting it kills both `TestProof_b3s4_position...` and every stub-row test.
- **The marker join is right.** `Row.Marker` is the clipped `say()` copy; `cannotFail` joins on the plan's own marker. A 64-byte proof id makes a marker over the cap, so the distinction is load-bearing, and `M10_join_on_id` dies.
- **The sentinel discipline holds.** `died()` reads markers, not sentences; blanking any of the three arms dies, and so does making the default arm claim a name. Both adapter marker changes die.
- **The line bounds are exact.** I recomputed both: stub head fixed words 74 bytes + 7 for the plural noun + 5×19 digits = 176, as documented; broken line 55 + 19 + 1 + 8 = 83, as documented. F81's arithmetic lesson was applied.
- **Mechanics.** Red set re-derived at `6db5dc2`: the test files do not compile (`undefined: readTests`, `undefined: ErrCrashed`), and `TestVerifyGreenExitsZero`/`TestVerifyPrintsTheWholeSummary`/`TestVerifyRedPrintsTheWholeSummary` each fail on the row counts. F85's pin dies against a blanked `Authority()`. Version `10.0+r0a7f797` matches the lock file and the code. 13 chained journal lines under `b3s5`, seq 1-13, stub at seq 12.
- **One full verify on a copy:** `12 rows: green 12, red 0, waived 0, quarantined 0, unrunnable 0` at `10.0+r0a7f797`, with this repo's stub line matching the claim word for word.
- **`go test -p 1 ./... -count=1` green alone. `gofmt -l` empty, `go vet ./...` clean.**
- **F80 stays closed.** The mutate row reads `killed 9 (1 by crash), 1 did not compile` with no blocked clause. `internal/battery` measures **134.3s** here against the 180s per-mutant clock — 46 seconds of headroom, about 25%. Slices 6 and 7 add rows to that same package, so the margin is worth watching.