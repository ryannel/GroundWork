# Builder reports

## The build


The slice is built and green. Report:

## What was built

**The chained journal (`internal/journal/`)**
- `chain.go` (new): `CheckChain` walks every session at the ref's tip and returns `ChainResult{HasRef, Sessions, Lines, Unchained, Breaks}`. A break names the session, the seq, and one plain clause. Breaks sort by session then seq, so the same journal reports the same first break every run.
- `journal.go`: `version` 1 → 2; the envelope gains `Prev` (sha256 of the previous line of the same session) after `Seq`, written even when empty; `nextSeq`/`highestSeq` became `sessionTip`/`highestLine`, which return that hash alongside the seq; `treeOIDs` is now a thin call on a new `treeEntries` that keeps paths too. No reader in the package read `v`, so v1 and v2 were already both accepted — a test now proves it through `Spend`, `VerifyTokens` and the dial.

**The ninth row (`internal/battery/`)**
- `chainrow.go` (new): kind `chain`, blocking. Green when every chain holds (naming the unchained v1 prefix), red on a break (count first: `2 breaks, the first: session … at seq …`), unrunnable when the ref cannot be read or holds no event, green-and-plain on a repo with no ref.
- `rows.go`, `battery.go`: registration and the row-kind vocabulary.
- `.groundwork-battery.json`: 6.0+ra8c0ca9 → **7.0+r5a8f33c**, the digest taken from the tool's own drift error, never by hand.

## Red/green split

Red set (fails at 9d8963d): `internal/journal/chain_test.go`, `internal/battery/chainrow_test.go`, plus one-line pin edits — `"v", 1` → `2` in five journal test files, `prev` into the three key lists, `chain` into the row-kind pin and `TestDefaultHoldsExactlyTheShippedRows`, and `8 rows` → `9 rows` in the three cmd pins. Red observed in three runs, recorded in the handoff: pin failures (`field "v" is 1, want 2`, `the event is missing field "prev"`), the journal package failing to build without `CheckChain`, and every row test failing with "the default battery holds no chain row".

## Blank-the-rule

All 19 rules blanked one at a time; each died alone; each restored. Table in the handoff. Two needed a second pass and both are worth the reviewer's eye: blanking `prev` first failed to compile rather than failing a test (moved down into `sessionTip`'s return), and **blanking "group by the line's own session, not its path" SURVIVED** — no test proved it. `TestALineIsGroupedByWhatItSaysNotWhereItSits` was added and the rule now dies alone.

## The 7.0 bump

Two mutants survived the rotated sample, both pre-existing gaps in other packages, both fixed the F29/F34 way: `(*Go).Name` → `TestTheGoAdapterNamesItsStack`, `ChangedFiles` → `TestChangedFilesNamesEachWayAFileDisagreesWithTheCommit`. Finding the second survivor needed temporary instrumentation of `mutaterow.go` (reverted; its diff is empty).

## Verify tail

```
mutate  green  ... killed 8 (1 by crash), 2 did not compile
plan    green  docs/plan holds 1 program, 1 bet and 8 slices ...
chain   green  371 lines across 183 sessions in refs/groundwork/journal: every
               chain holds, and 353 lines came before the chain and went unchained
9 rows: green 9, red 0, waived 0, quarantined 0, unrunnable 0
```
at 7.0+r5a8f33c. The battery's own writes for that run are chained v2 lines: session b3s2 holds seq 1–20, `"v":2` throughout, seq 1 with an empty prev.

## Candidate ledger entries

Nine decisions and three findings are written up in the handoff at `/tmp/claude-0/-home-user-GroundWork/a5b7b708-4ccf-5ae9-9ab1-41cce247b571/scratchpad/handoff-b3s2.md`. I did not touch `docs/findings.md` or `docs/decisions.md`. The two the driver most needs to rule on: a v1 line written *after* a session's chain began is red (a downgrade is the cheapest forgery), and every `CheckChain` error makes the row unrunnable including `ErrNotARepo` — which diverges from the plan row, where a `RepoRoot` failure is red.

Left open: the row reads every event blob per run and grows with the ref; the chain cannot stop a forger rewriting it forward (R4's signature, slice 3); and finding 1 — `runRow` builds a `Context` with no `Digest`, so the mutate row samples against a different version there than in a real run.
---

## The fix round


Fix round done. All eight items landed, nothing committed, ledgers untouched.

## The two HIGHs

**HIGH-2 / F49** — `clipSession` is now `cutTo(printable(session), most)`. `TestNothingTheChainRowSaysCarriesAControlCharacter` uses the reviewer's own planted name and asserts no unprintable rune, no newline or tab, and that the session is *still named* — a row that dropped it would say nothing useful. On D49.2's "every value": the red branch is the only one carrying a value off a journal line. I tried `say` (cut+printable) on the unrunnable branch too and **took it back out** — git's words about an unwalkable ref are not a journal value, and no test can reach a control character in them. An unprovable rule is what F50 is about.

**HIGH-1 / F48 / D49.1** — the generated id comes from `sync.OnceValues(newSessionID)`. `newSessionID` is split out so a test can ask it twice, which is what proves a second process gets a different id without starting one. Probe J through the real row now passes: five writes with the variable unset are one session of five lines, green; delete a blob and the row is red on seq 3. **One existing test was inverted** — `TestWriteDispatchGeneratesADifferentSessionEachTime` asserted the behaviour D49.1 rules against, and is now `TestWritesShareOneGeneratedSessionForTheWholeProcess`. It is the only test in the tree that assumed per-write ids; flagged in the handoff for the reviewer.

## The MEDs and LOWs

3–4: probe K adapted; the error branch reached by pointing the ref at a **blob** (`rev-parse` resolves it, `ls-tree` refuses it) — no permissions or corrupt objects, so it behaves the same as root.

5 (MED-7): `countedBreaks` now takes the count instead of reading it off a slice, so the arithmetic test can hand it `math.MaxInt64`. The bound sums four caps: 20-byte count, 20-byte seq, the 40-byte session clip, and the new `journal.MaxWhyBytes` (76, enforced in `breakAt` so it is true by construction). **`cut()` came off both lines** — with the bound proven it was dead code that m17 could remove unnoticed.

6–7: the walk compares each line's computed sha256 to the hash its path is named for; probe B goes red. `UnchainedSessions` counts sessions holding nothing but v1 lines, and both lines carry "…in 182 sessions with nothing chained" through `addIfItFits` — the break count still leads, the clause is what gives way. What stays open is written into the row's comment in D49.3's terms.

8: not-JSON names the byte and carries no seq; a seq below 1 is its own break (which is what makes the gap message *provably* honest — the argument is in `walkSession`'s comment); a line naming no session is a break, placed by where it sits or as "an unnamed session".

## Proof

17 rules blanked, each died alone (`blank2.py`, `blank2-out*.txt`). Three first returned **"SURVIVED (build failed)"** — the patch did not compile, so it proved nothing. Each was rewritten to compile and re-run, and the table prints the build failure rather than folding it into "SURVIVED"; reading one as a survivor would send the next round chasing a rule that is already proven. That is a candidate finding.

`gofmt`/`vet` clean, `go test ./...` green. One verify (`verify-b3s2-fix.txt`):

```
chain  green  381 lines across 183 sessions in refs/groundwork/journal: every chain holds,
              and 353 lines came before the chain and went unchained, in 182 sessions with
              nothing chained
9 rows: green 9, red 0, waived 0, quarantined 0, unrunnable 0
```

At **7.0+r5a8f33c** — digest unmoved, no row identity changed. The chain line is 169 bytes. Session b3s2 now runs seq 1–30, all v2, every prev matching. Five decisions and one finding are written up as candidates in the handoff.