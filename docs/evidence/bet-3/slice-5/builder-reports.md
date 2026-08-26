# Builder reports

## The build


The slice is built. Final state:

## What was built

The **stub check** — the battery's twelfth row, kind `stub`, in `internal/battery/stubrow.go`. It reads the board the board row derives (no second derivation of expected state), judges every proof the plan expects red, and asks whether each is red for the right reason. The vacuous judgment is the honesty scan's own `vacuousShape`, reached through a new shared `readTests` — same package, called, never copied.

Supporting: the plan/run/derive opening both rows start from was extracted into `derivation`/`derived` in `boardrow.go`; `adapter.ErrCrashed` joins `ErrBuildFailed` and `ErrTimedOut` so the row reads the seam's markers instead of its sentences; `docs/derivation-contract.md` gains §3.5 with a verdict table the tests drive.

## The rulings I had to make

R10's paragraph 1 ("green ahead of plan is flagged, never red") and paragraph 2 ("passing fails the row") contradict each other on any repo whose work runs ahead of its plan — this one included, and every mid-bet repo, since a landed slice on an unfinished milestone always passes while expected red. **D56 ruling 1 already settled that direction**, so I reconciled them through what R10's paragraph 4 makes load-bearing: a passing expected-red proof is red *when the honesty scan says its test cannot fail*, in the scan's own words. The three ladder styles are exactly the three shapes it names. The cost — a stub the scan cannot see passes — is filed as F-a. Both sealed fixtures described in `holdout.md` grade the same under this rule as under the strict one.

**The missing-test ruling:** a proof whose test does not exist is counted, and red only when its own slice has landed — a slice that landed without its proof claimed work it never wrote, and nothing else in the battery sees that. A plan naming slices 6-8's proofs before they exist is a plan doing its job.

**This repo's honest line:** `24 proofs expected red: 0 red at an assertion, 0 not, 16 ahead of plan, 8 with no test: none of them is a stub, a skip or a red that proves nothing`.

Build failures, crashes and timeouts arrive per-surface, not per-test, so they get their own red line naming the surface; anything else a surface broke on stays unrunnable.

## Proof

- **Red/green split** in the handoff. Red side fails at 6db5dc2 by construction (`undefined: readTests`): `stubrow_test.go` plus four pins. Green side: the row, the two refactors, the sentinel, the contract page, the lock at `10.0+r0a7f797`.
- **Row-count pins** 11→12; the hostile-repo split moves `green 4`→`green 5` because the stub row answers no-plan green before it looks for a manifest, as the board row does.
- **Blanking:** 21 rules, all killed. Two needed a second pass and both are recorded — M21 survived until an adapter test for a binary that walks out (SIGKILL; `os.Exit` is caught by the testing package and lands on the crash path), M12 did not compile until the mutant was made to use its variable. One mutation outside this slice (the crash marker's goroutine-dump guard) survives; it is landed adapter code and F22 names its class.
- **Sample rotation at 10.0 found one real survivor:** `internal/seal/verify.go (Result).Authority`. R4's control was proved only on its false side, because this container has no ssh-keygen and no test here can make a verified tag. Pinned in the owning package with `TestOnlyAVerifiedSignatureIsHumanAuthority`, checked against a blanked copy.
- **`go test -p 1 ./...` green alone.** internal/battery is 145s, still inside the mutate row's 180s per-mutant clock (F80 stays closed).
- **Verify tail:** `12 rows: green 12, red 0, waived 0, quarantined 0, unrunnable 0` at `10.0+r0a7f797`, run alone under `GROUNDWORK_SESSION=b3s5`; the run's 13 journal lines chain seq 1-13 under that session.

## Left open

Two findings for the driver: **F-a** (the stub check sees only the stubs the honesty scan sees; a constant condition is as vacuous as a self-comparison and `selfComparison` could learn it in a slice of its own) and **F-b** (this repo's record lags its work — twelve of the sixteen ahead-of-plan proofs belong to b3s1-b3s3, whose commits predate the Slice trailer and cannot be amended).

Handoff with all seven ruling texts, both finding drafts, the blanking table and the verify tail: `/tmp/claude-0/-home-user-GroundWork/a5b7b708-4ccf-5ae9-9ab1-41cce247b571/scratchpad/handoff-b3s5.md`. Nothing committed; ledgers untouched.
---

## The fix round


Fix round done. gofmt and vet clean, tree ready for re-review.

## What changed

**F87 — the sentences.** The quiet line now reads `the honesty scan found no stub among them`: who looked and what they found, never a state of the world a precision-over-recall scan cannot establish. `TestStubRowReadsAScanEscapingStubAsAheadOfPlan` plants seven tests that pass while nothing in them can fail (`if false`, `if 1 == 2`, `if 2 < 1`, `if len("") > 0`, a `switch` on false, a no-op helper in another file, a fake recorder) and pins all seven green ahead of plan under that sentence — and fails if the old wording returns. The row's doc comment loses its track-record claim, is split, and names the escape set.

**F87/M2 — the three styles.** One fixture per style, so the whole hit fits and each style's own reason is asserted by name; each case also fails if the line carries "more". A fourth case keeps all three together and asserts only the count, which is what one line honestly holds.

**F88 — the five survivors.** All now die: the honest-reading skip (two-suite fixture, honest in alpha, stub in beta, stays red); clauses on the quiet branch; the scan-blocked clause; the broke-some-other-way clause (a Go surface with no module of its own); and the map comment now describes what the code does.

**F89 — the broken surface.** `brokenSurfaces` no longer answers alone. It returns hits for what R10 names, a clause for what it cannot name, and the fact that some surface went unrun. The row reads every surface that did run, counts lead on that branch, and the two-surface case pins both the stub and the broken surface on one line. One consequence taken deliberately: a proof with no result is blamed only when every surface ran, or a broken surface would redden every landed proof out of missing data.

**F90 — the nine smalls.** All addressed: the plan file declares the contract page under `records`; the stub section is 3.4 and the closer 3.5, with the stub row's sentence added to the closer; the prose names all five shapes the scan knows and says the ladder's three are among them; the pin drives the middle column through a name-to-judgment map; `board.Actuals()` is exported, pinned, and walked; the sentence reads "no test of it ran on any declared surface"; the unreachable red arm is gone and the search no longer builds a state the row cannot be in; `brokenSurfaces` uses `d.name`; the clock arm's comment names the default-clock reality; the scan-stance sentence is split.

## Blanking

31 killed. One non-answer: M8b (first-wins among vacuous shapes) can never fail, since only vacuous shapes reach the map — the comment now says so. Two rules removed rather than left unproved: the seam-marker trim (the tail-keeping already dropped it) and the old clause that never fitted — it now carries the *end* of the stack's message, where a compiler puts the thing to fix, and the build-failure case asserts the compiler's own word on the line. The harness itself got one correction: its did-not-build detector read compiler words out of test output, which called a live mutant dead; it now asks `go vet` on the mutant instead.

## Verify tail

```
stub   green  24 proofs expected red: 0 red at an assertion, 0 not, 16 ahead of plan, 8 with no result: the honesty scan found no stub among them
12 rows: green 12, red 0, waived 0, quarantined 0, unrunnable 0
```

Digest unchanged at `r0a7f797`. `go test -p 1 ./...` green alone; internal/battery is 142s against the 180s clock — seven seconds of headroom spent on eleven new cases. No cmd pin needed changing: the summary carries counts, not row evidence.

Round-2 section appended to the handoff at `scratchpad/handoff-b3s5.md`; no ledger edits.