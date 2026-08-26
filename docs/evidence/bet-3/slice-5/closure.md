# Closure re-check

After the fix round, resumed across a container restart. Every finding closed, both survivor counts reached independently. Its four hand-backs — the guard's stated cost, the sentence that did not parse, D59, and the finding outcomes — were done at landing. Verdict: lands.


## Closure re-check: **LANDS**

Re-created the scratchpad state after the restart (`$SP/fix` was byte-identical to the working tree outside `.git`; rebuilt the binary, re-ran every probe from scratch). Real repo untouched: 20 status entries, HEAD `65f6af4`, journal `d7a2cca` — same at start and end.

Every finding closed. Four new things, none blocking.

---

## Per finding

### H1 — the evidence line overclaims — **CLOSED**

The quiet line now reads `the honesty scan found no stub among them`. I re-ran all seven of my original plants through the rebuilt binary:

```
p_const    green  ... 1 ahead of plan ... the honesty scan found no stub among them
p_false    green  ... same
p_vars     green  ... same
p_fixed    green  ... same
p_loop     green  ... same
p_helper   green  ... same   (cross-file no-op helper)
p_fake     green  ... same   (fake recorder)
```

The row still misses them — that is F83's boundary and it is meant to stand — but the sentence no longer claims they are not there. It says who looked and what they found.

`N25_say_claims_clean` (put the old wording back) is killed by three tests, including `TestStubRowReadsAScanEscapingStubAsAheadOfPlan`, which plants seven escaping shapes and asserts the old sentence is absent. The doc comment's track-record claim is gone and now names the escape set instead.

### H2 — F83 understates its own boundary — **CLOSED**

F86 corrects it: the size is the escape set, named as the cross-file helper, the assertion library, the fake recorder, and a condition no comparison shape covers, with "one line of indirection into a no-op helper defeats the whole check". It also corrects D58.1's two false statements (five shapes not three; the fixture claim holds only as far as the open descriptions show). Accurate to what I found and to what the code does.

### M1 — five blanking survivors — **CLOSED**

I ran an independent 33-rule sweep against the fixed tree, each rule `go vet`-checked for compilation and then run against the whole `internal/battery` package suite (plus `internal/adapter` or `internal/board` where the rule lives there).

**31 killed, 2 survived** — the builder's number, reached independently.

The five that survived before now die, each to a named test:

| rule | killed by |
|---|---|
| the `one.shape == ""` guard | `TestAStubInOneSuiteIsNotMaskedByAnHonestTestOfTheSameName` |
| the `unrun.said` clause | the headline proof |
| the `read.blocked` clause | `TestACleanStubRowStillSaysWhatItCouldNotRead` |
| the `unrun.unreadable` clause | `TestStubRowSaysWhenItCouldNotRunASurface` |
| clauses on the quiet branch | both of those |

The two survivors are the two the builder declares:

- `N4_last_wins` — first-wins in `cannotFail`. I checked the can-never-fail claim rather than taking it: the `shape == ""` guard means only vacuous readings enter the map, so both candidates redden the row and only the printed wording differs. The comment now says exactly that. Honest.
- `N32_goroutine_guard` — pre-existing adapter code from `8ac78d4`, on the record in F88 rather than only in a report.

Two more worth naming: `N9` (the unknown-state guard) and `N29` (shortening `board.Actuals()`) both die, so L4's walk is real in both directions. `N26`/`N27` die, so `endOf` keeping the *end* of a compiler message is proved, not asserted.

I also probed the new constant nobody asked about: widening `maxComplaintBytes` from 50 to 200 **kills** the build-failure case. The bound is driven by a fixture, so this is not another F81.

### M2 — the headline proof's tautology — **CLOSED**

One fixture per style, each asserting `p_planted`, `passed`, and that style's own reason by name, and each failing if `more` appears. My probes confirm each single-style line carries the whole hit, so the `more` guard genuinely bites. The all-three case asserts only `3 not` and its comment says why.

### M3 — a broken surface swallows the other surfaces' stubs — **CLOSED**

My two-surface fixture now reads:

```
stub  red  2 proofs expected red: 1 red at an assertion, 1 not, 0 ahead of plan, 0 with no result:
           the surface "side" did not build; p_empty passed, and its test asserts nothing
```

Both named, counts back in the head, surface first. `N19` (dropping the surface hits) and `N17` (zeroing the broken count) both die.

### M4 — D58's false support — **CLOSED** via F86 (see also NEW-3).

### M5 — the undeclared page — **CLOSED**. `b3s5.md` now declares `docs/derivation-contract.md`.

### L1-L9 — all **CLOSED**

- **L1** §3.4 is the new content, §3.5 is the chapter closer, and the closer gained a stub-row paragraph.
- **L2** the prose names all five shapes and says the ladder's three are "among those five".
- **L3** the middle column is driven. Seven probes, all killed — including the one that matters: relabelling `A stub: the test was never able to fail` as `Red for the right reason` while leaving the verdict `yes`.
- **L4** `board.Actuals()` exported, pinned in its own package, walked by `judgeRed` and by `TestJudgeRedAnswersEveryStateTheRunCanReport`.
- **L5** `no test of it ran on any declared surface` (see NEW-2 for a wording nit).
- **L6** the unreachable red arm is gone; `say()` has one sentence and the search skips a state the row cannot be in, with the reason written down.
- **L7** `d.name` carries the row's name.
- **L8** `died()`'s doc names the clock collision and says the arm is for a project with a shorter `-timeout`.
- **L9** the track-record claim is gone; the stance sentence is split.

---

## NEW

### NEW-1 — an unreachable surface suppresses the D58.2 red, and the gate stays open (MED-LOW, judgement call)

The driver asked me to judge the `everySurfaceRan` guard. **The direction is right** — without it a broken surface reddens every landed proof out of missing data, which is the board row's own rule. **The behaviour is named** in the code, in the table (`No test of it ran, and a surface did not run`), and in the prose. **The row is not silent**: the head carries `N with no result` and a clause names the surface.

What is not named is the consequence. `unrun.any` is set for *both* kinds of unreachable surface, including the kind that reddens nothing. So:

```
$fx/f_supp: a landed slice whose proof was never written,
            plus a second Go surface with no go.mod

stub  green  3 proofs expected red: 2 red at an assertion, 0 not, 0 ahead of plan,
             1 with no result: the honesty scan found no stub among them;
             the stub check could not run the surface "side": the adapter could...
```

A slice that landed without its proof passes the stub row, because of an unrelated surface. The board row goes unrunnable on the same repo, and `verify` exits 1 only on red — so nothing red stops that repo.

The sharp version: when the break is one R10 names, the row is **already red**, so the guard costs nothing there. The guard's entire gate-opening effect comes from the branch the row deliberately treats as missing data. That is defensible, and it is the honest choice — but it deserves one sentence on the page, or `any` could be set only for the unreadable kind, which would be the same behaviour with the cost stated. Driver's call; I would not hold the landing for it.

### NEW-2 — the corrected no-test sentence does not read as a sentence (LOW)

`hit.String()` is `id + " " + shape`, and every other shape is a verb phrase that attaches to the id: `p_empty passed, and its test asserts nothing`. The new one has its own subject, so the line reads:

```
p_claimed no test of it ran on any declared surface, and its slice has landed
```

`p_claimed has no test on any declared surface, and its slice has landed` keeps the honesty L5 asked for and keeps the pattern.

### NEW-3 — D58 still carries the two sentences F86 says are false (LOW)

`decisions.md` is append-only, so D58 cannot be corrected in place, and there is no D59. A reader who goes to the ruling — which is what the slice-8 graders will be judged against — still reads "exactly the three shapes the scan names" and "both sealed fixture descriptions grade the same". F86 has the correction, so the ledger as a whole is right; the ruling read alone is not. One appended decision line would close it.

### NEW-4 — F87 through F90 still read "What happened: open" (landing item)

Each says "open. The fix round …". The working agreement says a slice cannot close while a finding on it is open, so these four need their outcome recorded before the commit lands. Presumably the landing step, but flagging it since it gates.

---

## Gate, re-run independently

- `gofmt -l .` empty; `go vet ./...` clean.
- `go test -p 1 ./... -count=1` **green**, exit 0, every package.
- `internal/battery` **139.9s** against the 180s per-mutant clock — 40s of headroom, 22%. Matches the builder's 142s. F80 stays closed; the mutate row reads `killed 9 (1 by crash), 1 did not compile` with no blocked clause.
- One full `verify` on the copy: **`12 rows: green 12, red 0, waived 0, quarantined 0, unrunnable 0`** at `10.0+r0a7f797`, exit 0.
- This repo's own stub line now reads: `24 proofs expected red: 0 red at an assertion, 0 not, 16 ahead of plan, 8 with no result: the honesty scan found no stub among them`.

The whole judgment table still holds through the built binary on real repos — three stub styles, log-only, skip, honest-ahead, build failure, panic, `os.Exit`, SIGKILL, missing test landed and unlanded, the two-suite mask, the test outside every surface. Nothing regressed.