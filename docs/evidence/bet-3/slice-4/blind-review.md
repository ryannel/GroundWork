# Blind review of slice 4

The first review. Verdict: lands after fixes — no highs; five mediums led by the half-proved Holds() that falsified the build's forty-for-forty table. Its findings are F74 through F79.


The review is complete and the working repo is byte-identical to how I found it. Here is the report.

---

# Blind review — bet-3 slice 4: test markers and the board derivation

Reviewed uncommitted on `claude/v2-clean-slate-tkuacl` at 198791c. I had no part in building it. All work was done on copies under the scratchpad; the working repo's `git status`, HEAD, refs, tags and journal ref are unchanged.

**One disclosure.** While probing the digest I ran `git checkout-index` against the real repo by mistake and overwrote `.groundwork-battery.json` with the committed 8.0 line. I restored it within a minute and confirmed it byte-identical to an untouched copy made earlier. `git status` now matches my recorded baseline exactly. No other write reached the working repo.

## Verdict: lands after fixes

The derivation is right. I drove every case in the sweep through the built binary against real fixture repos, and the shipped behaviour was correct in all of them but one. What I found is mostly missing proof and a record that has drifted from the code — not broken machinery. Five MED findings, seven LOW. No HIGH.

One build claim is false: the blanking sweep was not 40 for 40.

---

## MED 1 — `Holds()`'s trailer half is unproved, and a blanking mutation survives the whole suite

`internal/board/board.go:369`

```go
func (b Board) Holds() bool {
	return len(b.Behind()) == 0 && len(b.Wrong) == 0
}
```

Blank the second half and `go test ./...` stays green — every package, unfiltered, 2m33s. This is not a filter artefact; I ran the full suite.

The consequence is the verb's exit code, which is what stops CI:

```
fixture: one commit carrying "Slice: s_nine", a slice the plan does not declare
shipped groundwork board      -> exit 1
Holds() with the Wrong half blanked -> exit 0   (still prints the misstated trailer)
```

The row still goes red, so the verb and the row disagree about one board — the exact thing the function's own doc comment says it exists to prevent, citing D54.1. `cmd/groundwork/board_test.go` drives the verb on a green board, on a proof behind its plan, on a repo with no plan and on a repo with no manifest, but never on a repo with a misstated trailer.

This falsifies "40 blanking mutations, 40 killed with the four-way table clean". I ran ~40 of my own; this one survived. Two others survived as equivalent mutants (below).

Fix: one cmd-level case driving the verb on a repo with a bad `Slice:` trailer and asserting `exitFailed`.

## MED 2 — the row's head folds the red kind of trailer and the harmless kind into one count

`internal/battery/boardrow.go:168,284`

```go
unread:  len(b.Wrong) + len(b.Unread),
...
counted(t.unread, "trailer not read", "trailers not read")
```

Three very different boards, driven through `boardVerdict`:

```
four merges, nothing misstated   -> green  ... 4 trailers not read: ...
four misstatements, no merge     -> red    ... 4 trailers not read: ...
one misstatement, three merges   -> red    ... 4 trailers not read: ...
```

Every count is in the head where no cut reaches it — that part is right and F61's lesson is learned. But the head is the only part guaranteed to survive, and it says one number for two states the render itself prints under two different words ("misstated trailer" / "unread trailer"). D52.3 ruled this shape already, for unverified and unsigned: "counted and printed apart, everywhere — summary, row clause, journal." The row's line is the summary.

Fix: two counts in the head.

## MED 3 — the "reported by more than one suite" clause vanishes on a clean board, and never reaches the render at all

`internal/battery/boardrow.go:265`

```go
if len(t.hits) == 0 {
	return Result{Outcome: t.outcome(), Evidence: cutTo(head+t.say(), journal.MaxTextBytes)}
}
```

`t.clauses` is dropped on that branch. Reproduced:

```
board otherwise on plan, one test reported by two suites:
  "1 proof, 0 landed: 0 ahead of plan, 0 behind, 0 trailers not read: every proof sits where its plan puts it"
same board with one ahead proof to name:
  "... p_one is expected red and passed in the run; 1 test was reported by more than one suite"
```

So the signal is shown exactly when something else is already wrong and hidden when the board looks clean — which is when a duplicated proof name is most misleading, because `ReadRun` has silently folded two suites' answers at their worst. The run-evidence row's green branch does `tailOf(clauses)` for precisely this reason (`runevidencerow.go:203`); this row is the only one in the battery with a no-hits branch that drops them.

`Run.Twice` also never reaches `Render`. Its own doc says it is "a thing the reader has to see", and `groundwork board` never shows it.

Fix: `tailOf(t.clauses)` on the no-hits branch, and a line on the render.

## MED 4 — the contract page's verdict columns can be flipped to say the opposite of the code, and everything stays green

`internal/board/contract_test.go:139` — `hasRow` matches only each row's **first** cell.

I flipped four verdicts on `docs/derivation-contract.md` §3, leaving the prose and the row headings alone:

- doubled trailer: `Nothing lands, and each is named | yes` → `The slice has landed | no`
- merge trailer: `Not read, and named | no` → `The slice has landed | yes`
- both rows of the disagreement table, red and green swapped

`go test ./internal/board/` → `ok`.

Gutting the cells *is* caught (I checked: all seven rows report). So the pin fails a gutted table and survives a lying one. D54.1's named model is the slice 3 contract pin, which "survived a prose mention and failed a gutted cell, which is the right way round". This one only has half of that, and the half it is missing is the column that carries the ruling — "is it red" is the whole content of §3.2.

Fix: read the verdict cell and drive it, instead of hard-coding `c.wrong` in the test.

## MED 5 — a slice claimed twice: the board credits the stray commit and names the real landing commit

`internal/board/board.go:224`. Claims arrive newest-first from `git log`, so the first claim read is the newest commit.

```
ded42b5  a commit          <- carries a stray "Slice: s_one"; this is what lands
646c210  land s_one        <- the real landing commit; this is what gets named
468bb72  the plan and the proofs

board says: unread trailer  s_one  646c2108...  names a slice another commit has already landed
```

A reader chasing "which claim is the stray one" is sent to the genuine landing commit. The contract page says "The slice has landed, and **the second** commit is named" — in commit order the second is the newer one, so the page and the code disagree too.

Neither `TestASliceClaimedByTwoCommitsIsLandedAndSaidSo` nor the contract test asserts which commit is named, so the direction is unpinned.

Fix: read claims oldest-first for landing, or name the later commit. Then pin the commit id.

---

## LOW findings

**L1 — the page overstates the filter.** §3.1: "The board runs the tests the plan's markers name, and no others." False in the fallback branch, where `Pattern` returns `^TestProof_` and runs every proof-named test in the repo. D56.2 records the fallback; the page does not mention it.

**L2 — `adapter.For`'s doc and the board row disagree about D25.** `internal/adapter/for.go:12` says "a stack with no command is a fail-closed red rather than a skip". The manifest row makes it red; the board row folds it into `blocked` and makes it unrunnable. I confirmed the verb fails closed on a node surface with no adapter, so nothing is unsafe — but the seam's doc claims something one of its two callers does not do, and no row-level test covers the case.

**L3 — the render's widest-line test does not search.** `TestEveryRenderedLineIsBounded` feeds 4000-byte strings into every field at once and never varies a count — D52.4's own named anti-pattern, applied to the render while the row's line does search properly. I checked the bound holds: with `MaxInt64` in every count and 64-byte values everywhere, the widest rendered line is **242 bytes** against the bound of 400, which matches the `maxLineBytes` comment's arithmetic exactly. So this is discipline, not a hole.

**L4 — the `maxPatternBytes` threshold is not tested at its boundary.** `TestThePatternFallsBackWhenThePlanIsEnormous` builds 4000 markers, far past 8192, and does exercise the branch that fires. Nothing pins that a pattern just under the cap does not fall back.

**L5 — the verb's writes-nothing test is much weaker than the row's.** `TestBoardWritesNothing` compares `git status --porcelain`; the row's proof hashes every file under the repo, `.git` included. A verb that wrote a ref or an ignored file would pass. I hashed the tree around a real `groundwork board` run myself — it writes nothing, and `git for-each-ref` is unchanged — so this is test strength only.

**L6 — a single wrong trailer at the page's own maximum drops its reason.** With a 64-byte value (what §3.2 allows) and the longest `CheckID` message, `hitEvidence` cannot fit one whole hit and falls to the `firstOf` ladder:

```
1 proof, 0 landed: 0 ahead of plan, 0 behind, 1 trailer not read: the first is on ccccccccc... at "vvvv…"
```

Red, with the value and the commit, and no word about why. Reachable with ordinary input, not a crafted one.

**L7 — two unpinned branches.** `actual()`'s `default:` (an outcome outside the seam's closed three) survives blanking to `Passed` — equivalent today, but the comment claims it matters. `plan.ErrNoUnits` (a `docs/plan` that exists and is empty) has no test; the "no proof" test reaches the `pattern == ""` branch instead.

**L8 — wrapping.** §3 is hard-wrapped at ~80 columns; sections 1 and 2 are one line per paragraph (63 lines over 90 chars before §3, 1 after). One page, two styles.

---

## What held up

I attacked these and could not break them.

**The derivation.** Every case in the sweep, driven through the built binary against real repos with real commits and real `go test` runs:

| probe | result |
|---|---|
| nothing landed, tests green | 3 ahead, row green, exit 0 |
| one slice of a two-slice milestone landed | still expected red — the milestone is the unit |
| whole milestone landed | expected green for its proofs, the other milestone still red |
| every slice landed | 3 on plan |
| expected green, test fails | behind, red, exit 1, proof named |
| expected red, test fails | on plan, quiet |
| expected red, test passes | ahead, named, row green — never red |
| `Slice:` on a merge | named, not read, milestone stays unlanded, not red |
| doubled / empty / bad charset / unknown id | all four red and named, exit 1 |
| claimed twice | landed once, second named (but see MED 5) |

Empty values are real, not synthetic: git 2.43 emits an empty line for `Slice:` and for `Slice: ` alike, and the parser counts values off the framing rather than dropping blanks — I confirmed against raw `git log` output.

**Writes nothing.** I hashed the whole tree, `.git` included, around a real verb run: no writes, no new refs. The `b3s4_silent` proof does the same through the shipped row on three paths and kills a planted `os.WriteFile` immediately. D53.2 is vacuous here in the good way — the row writes nothing on any path, so there is no partial state to leave. Both headline proofs go through `Default().Rows()` with `Context{RepoDir: dir}`, which is the shipped path; the only deviation is clearing `GROUNDWORK_BATTERY`, which mimics a CLI invocation where the variable is unset.

**Forged inputs.** A 10KB value, a tab-separated value, an RTL override, a soft hyphen, a Cyrillic homoglyph and a folded multi-line trailer all reached the render as one safe clipped line each. Nothing drew a row of its own; nothing unprintable survived. `Why` strings look unsanitised at first glance but are safe — `CheckID` uses `%q` on the offending rune. Error-path evidence is clean too: no machine path and no control character on the bad-plan, broken-package, unmapped-stack or no-manifest paths (`scanned.reason` collapses whitespace). Test names never reach output — the row prints the plan's marker, already `say()`d.

**QuoteMeta.** A marker holding `.*` compiles to a pattern that matches only its own literal name. The plan parser refuses such a marker anyway, so this is defence in depth, and the test says so.

**Verdict table.** No `docs/plan` → green, honest, and answered before the row looks for a manifest (pinned by the red-summary test). Plan present, no manifest → unrunnable, named. Broken build or unrunnable surface → unrunnable, never a red manufactured from missing data. Unreadable plan → board unrunnable, plan row red, no double red. Unlisted slice and milestone disagreement are refused by the plan reader, so the `plans[entry.ID]` guard in `Derive` is genuinely unreachable, as its comment claims.

**Evidence discipline.** Counts first, and the search over the count space finds a widest line of exactly 200 bytes — the journal's cap, reached exactly. The head is 179 bytes at `MaxInt64` in every field, matching its comment. Shallow is pinned three ways and the survivor pin bites.

**Mutation sweep.** ~40 blanking mutations, run serially with the four-way table and a filter that included the proofs (`-run 'Board|board|b3s4'` and full-package runs). All killed except MED 1 and two equivalent mutants (`reached()` returning true for a milestone with no slices, which draws no row; `actual()`'s unreachable default). The three b3s4 proofs do real work — the position proof killed the ignores-behind and ahead-is-red mutants, the silent proof killed a planted write, the marker proof killed a prefix join, a changed `MarkerPrefix` and never-ran-reads-as-pass.

**Mechanics.** Red set re-derived at ff80ad0: three packages fail to build (`internal/board`, `internal/journal`, `internal/battery`) and `cmd/groundwork` fails nine tests — the three row-count pins plus six board verb tests. `TestShallowTellsAWholeCloneFromAShallowOne` is green at ff80ad0 on pre-existing code, which is what a survivor pin should be. Digest confirmed by drift. Floor test at 9 continues 2,3,4,5,6,7,8. Row arithmetic: 5 unrunnable + 2 red + 4 green = 11.

**One full verify on a pristine copy** (I restarted it after contaminating the first run with my own probe files):

```
battery 9.0+r4326bda
board  green  24 proofs, 0 landed of a shallow history: 15 ahead of plan, 0 behind,
              0 trailers not read: b3s1_shapes is expected red and passed in the run and 14 more
11 rows: green 11, red 0, waived 0, quarantined 0, unrunnable 0
real 11m20s, exit 0
```

The board line matches the claim, and I derived the 24/15 independently: 24 markers in `docs/plan`, 9 of them naming tests that do not exist yet (b3s5–b3s8), so 15 green ahead. `go test ./...` green beside it on the same tree, 2m29s. gofmt and vet clean. 24 chained journal lines under session b3s4, chain row green.

**Wall clock, as asked.** Verify is 11m20s. The board row's own proof run is only ~8s warm (pattern 1355 bytes) — the cost is the cold compile inside verify plus the b3s4 proofs, which clear the run guard and spawn a second layer of `go test` on fixture repos. That nesting is deliberate and the guard is correctly set on the child env only, but it is where the minutes go.

**The record.** §3 matches the code in both directions apart from MED 4, MED 5 and L1. The `records:` field names the page. All three proofs exist exactly once, no duplicates, no orphans among them. The `facing` ids are declared in the bet file and claimed by this slice. Register is plain throughout — short sentences, everyday words, consistent with the rest of the repo.

One thing worth naming that is not a defect: on this repo the board row can only be green for now. Nothing has landed a `Slice:` trailer yet, so every milestone is expected red and the row's red half is proved by fixtures alone. That is D56.1 and D56.3 working as ruled. Related: a proof whose test does not exist reads "never ran", and on an unlanded milestone that is "on plan" and green. R10's stub check in slice 5 closes it, and `board.go` says so.