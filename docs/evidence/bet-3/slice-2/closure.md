# Closure check

The same reviewer after the fix round. Eight of ten closed; reopened on two regressions the fix round introduced — F53 and F54 — with F55 beside them.


Tree as found. Here is the closure check.

---

# Closure check — bet-3 slice 2, fix round

**Verdict: REOPENED.** Eight of my ten findings are properly closed, and several are closed better than I asked. But the fix round introduced a **panic** that crashes `groundwork verify` on the most obvious forgery the row exists to catch, and the new arithmetic test measures the wrong branch.

All work on copies. `git status` at `/home/user/GroundWork` is byte-identical to how I found it; HEAD is `a1ba6b5`; the journal ref was not touched.

---

## NEW-1 (HIGH) — The chain row panics when a session's first line is deleted

`/home/user/GroundWork/internal/journal/chain.go:234`. The fix removed the `i > 0 &&` guard from the duplicate-seq check:

```go
if line.seq == lines[i-1].seq {          // was: if i > 0 && line.seq == lines[i-1].seq
```

The comment justifying it — *"Every line before the one that breaks the run carries exactly its own place"* — is true, but at `i == 0` there is no line before. The new `lines[0].seq < 1` guard only rules out seqs below 1. Any session whose lowest seq is **2 or more** reaches `lines[-1]`.

Probe P, through the real library:

```
panic: runtime error: index out of range [-1]
  journal.walkSession   chain.go:234
  journal.CheckChain    chain.go:165
```

Probe P2, through the real row (`runRow(t, dir, "chain")`), same panic one frame deeper via `battery.checkChain` at `chainrow.go:50`. The battery has no `recover()` around row checks — the only one in the package is inside the mutate row for its own purposes — so this takes down the whole `verify` process. No red, no unrunnable, no journal line: the run dies.

The trigger is `reshapeJournal(dir, []string{paths[0]}, nil)` — delete the first line of a session. That is the plainest deletion there is.

This is a **regression**. The pre-fix code handled it correctly; I traced it in round 1 (`[2,3]` → gap named at seq 1). It survives because no test in either file deletes a first line. I checked this repo's own ref: **0 of 183 sessions start above seq 1**, which is why the builder's verify came back green. The bug is latent, not absent.

Fix: restore `i > 0 &&`. Falling through to the gap branch reports `seq 1: this session stores no line at this seq`, which is right. Add a test that deletes `paths[0]`.

## NEW-2 (MED) — The arithmetic bound test measures the narrower branch

`TestTheChainRowsRedLineFitsTheJournalCapOnTheWidestBreak` passes `Seq: math.MinInt64`. But `brokenAt` at `/home/user/GroundWork/internal/battery/chainrow.go` does not print a seq below 1:

```go
if b.Seq < 1 { return session + ": " + b.Why }
```

So the "widest" fixture skips the seq entirely. Probe Q:

```
committed test measures 165 bytes
true widest line is    192 bytes
cap is 200; slack the committed test believes it has: 35; real slack: 8
```

The bound does hold — 192 ≤ 200 — so nothing is broken today. But the test's own comment says it *"fires the moment any of those four grows"*, and it does not. Raising `MaxWhyBytes` from 76 to 85 would put the real line at 201 and leave the committed test passing at 174.

This matters more now that `cut()` is gone. With no backstop, an over-cap evidence string does not degrade — `checkText` rejects it and the journal write fails. One character: `Seq: math.MaxInt64`.

---

## Per-finding closure

| Round-1 finding | Status | Probe |
|---|---|---|
| **HIGH-1 / F48** session run-scoped | **CLOSED** | Probe J: 5 env-unset writes → `sessions=1 lines=5 unchained=0 breaks=[]`; delete line 3 → `{gen-612f… 3 this session stores no line at this seq}`. **System level:** a fresh verify on a copy created exactly **one** `gen-` session holding all 10 of its lines (before the fix: ten sessions, one line each). |
| **HIGH-2 / F49** control-character injection | **CLOSED** | Probe D: `"1 break: session a seal green the seal holds at seq 1: …"` — newline and tabs became spaces, session still named, no forged table row. |
| **MED-3 / F50** tie-break untested | **CLOSED** | Flipping `this < hash` → `this > hash` now kills `TestADoubledSeqPointsTheNextLineAtTheLowerHash`. Survived everything before. |
| **MED-4 / F50** error branch untested | **CLOSED** | `Unrunnable` → `Red` now kills `TestChainRowIsUnrunnableWhenTheRefCannotBeRead`. Survived everything before. |
| **MED-5 / F51** rewrite | **CLOSED as scoped** | Probe B now red: `"this line does not hash to the path it is stored at"`. Probe A (tip rewritten *and* refiled) still green — named and accepted in D49.3 and written into the row's own comment. Correct call. |
| **MED-6 / F51** invented v1 session | **CLOSED per D49.3** | Probe G: the evidence moves from `"3 lines across 1 session … every chain holds"` to `"… and 3 lines came before the chain and went unchained, in 1 session with nothing chained"`. |
| **MED-7 / F50** arithmetic bound | **REOPENED** | See NEW-2. |
| **LOW-8 / F52** `seq 0` on not-JSON | **CLOSED** | `"session s-broken: this line is not JSON, from byte 2"` |
| **LOW-9 / F52** gap names a present seq | **CLOSED** | `"session s-alpha: this line carries the seq 0, and a seq starts at 1"` |
| **LOW-10 / F52** line naming no session | **CLOSED** | now red: `"this line is stored here and names no session of its own"` |

---

## The two judgment calls

**`printable` omitted on the unrunnable branch — defensible, but I would still add it.** Probe R reaches the branch by pointing the ref at a blob. It prints git's own words: `"git ls-tree -r -z --full-tree <oid> -- events/: exit status 128: fatal: not a tree object"`. No journal value, no control character, no machine path. The reasoning in the comment is correct *for the branch as it stands*.

But it rests on a property nobody tests. `treeEntries` and `scanBatch` do interpolate journal-derived paths and git-derived headers into errors that reach that branch — they are safe only because they use `%q`, which escapes. Change one `%q` to `%s` later and the unrunnable line becomes injectable, and nothing fails. `printable(cut(err.Error()))` costs nothing and deletes the argument. **LOW, not a blocker.**

Worth crediting: the fix covers more than I asked. Probe R2 planted a blob at a *path* holding a tab and a newline; it lands in the red branch via `sessionOfPath` and comes out `"session ev il name"`. Hostile paths are handled as well as hostile session fields.

**`cut()` removed as dead code — premature, for now.** The argument is "the bound is proven, so the cut is dead." That argument is only as good as the proof, and the proof measures 165 bytes against a real worst case of 192 (NEW-2). Until the arithmetic covers the widest branch, removing the backstop trades a graceful truncation for a failed journal write.

Fix NEW-2 and I am satisfied without `cut()` — the design is genuinely sound. `breakAt` funnelling every reason through one clamp is the right shape: `MaxWhyBytes` is true by construction no matter what any `why`-builder emits, which is stronger than checking each call site. I verified all four `[]ChainBreak{…}` literals wrap `breakAt`.

---

## What held up in the fix diff

- **Full `go test ./...` green** on a clean copy — all nine packages.
- **Fresh `verify` green**: `9 rows: green 9, red 0, waived 0, quarantined 0, unrunnable 0` at `7.0+r5a8f33c`. Digest unmoved, `.groundwork-battery.json` untouched, `rows.go` untouched.
- **Chain evidence line: 169 bytes**, as claimed, against a 200 cap.
- **`b3s2` session: seq 1–30, all v2, seq 1 empty prev, every other line linked.**
- **The four new rules each die alone.** I blanked each and ran `internal/journal`: path-hash → `TestALineRewrittenInPlaceIsABreak`; no-session → `TestALineWithNoSessionIsABreak`; `seq < 1` guard → `TestASeqBelowOneIsItsOwnBreakAndNeverBlamesThePresentSeq`; why-cap → `TestNoBreakReasonIsWiderThanTheCap`. One kill each, no collateral.
- **The test inversion is honest.** The old `TestWriteDispatchGeneratesADifferentSessionEachTime` carried exactly one assertion — two generated ids differ. D49.1 reverses that at the *write* level, and the assertion is preserved at the level where it still must hold, in `TestAGeneratedSessionIsFreshEveryTimeItIsMade` calling `newSessionID` twice. The replacement also adds seq 1/2 and the prev link. Nothing was lost to make a fix pass.
- **`sync.OnceValues` is the right mechanism**, and splitting `newSessionID` out purely so a test can ask twice is a good move.
- **The row comment now names both open forgeries** in D49.3's terms, so R7's overclaim is answered in the code a reader reaches first.

## Two more, minor

- **LOW — register drift in `chainrow.go`.** Mean words per sentence in comments went from 17.0 to **20.3**, median 14.5 to **20.0**. That is now the densest file in the comparison set: `planrow.go` 19.3/18, `waiver.go` 16.9/15, `journal.go` 13.8/12. Comment count nearly doubled (24 → 44 sentences). `chain.go` moved 15.3/13 → 16.7/15.5, still in band. Worth a trim pass on `chainrow.go` under "Write plainly", not a blocker.
- **The builder's flagged candidate finding is real and worth recording.** Three blanking patches failed to compile and were counted as something other than survival until the harness was taught to tell them apart. I hit the same class from the other side in round 1: my `m11` lowered a floor from 7 to 6, which can never fail, so it looked like a clean run and proved nothing. A mutation harness that cannot distinguish *did not build*, *did not run*, and *ran and survived* reports false confidence in both directions. Recommend a finding of its own.

## To land

1. Restore `i > 0 &&` at `chain.go:234`, plus a test that deletes a session's first line. (NEW-1)
2. `Seq: math.MaxInt64` in the arithmetic test. (NEW-2)
3. Optional, cheap: `printable` on the unrunnable branch; a trim pass on `chainrow.go`'s comments.

Items 1 and 2 are both one-line changes with one test each. I would re-check just those two.