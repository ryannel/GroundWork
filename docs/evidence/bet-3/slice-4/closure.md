# Closure re-check

After the fix round. All thirteen closed; one new medium — the render cap the fix itself added, unproved (F81) — and the smalls of F82. F80's cause named.


Closure re-check complete. Tree as found — `git status` identical to the start, HEAD at 640e990, journal ref, stashes and tags unchanged. All work on copies.

---

# Closure re-check — bet-3 slice 4, fix round

Fix diff derived by comparing the current tree against my own pre-fix copy: 15 files, of which 5 are source (`board.go`, `render.go`, `boardrow.go`, `scan.go`, `for.go`), 8 are tests, and 2 are the ledgers. `internal/board/run.go` and `history.go` are untouched.

## Verdict: lands after one fix

All five MEDs and all eight LOWs are closed, each confirmed by re-running my original probe and by a blanking mutation. The fixes are good ones — several go further than I asked. One new MED came out of the sweep, in the test the fix round rewrote; three new LOWs.

Baseline on the fixed tree: `go build`, `go vet`, `gofmt` clean. `go test -p 1 ./...` green in 5m31s.

---

## Per finding

**MED1 / F74 — CLOSED.** `TestBoardFailsOnAMisstatedTrailer` drives the verb on my exact `s_nine` probe and pins `exitFailed`. Both halves of `Holds()` now die:

```
h1_holds_drops_wrong   KILLED  TestBoardFailsOnAMisstatedTrailer, TestTheContractNamesEveryShapeATrailerCanTake (+4 subtests)
h2_holds_drops_behind  KILLED  TestBoardFailsOnAProofBehindItsPlan, TestTheContractNamesBothDirectionsOfDisagreement
```

The strengthened contract pin kills them too, which is a second, independent guard I did not ask for.

**MED2 / F75 — CLOSED.** My three-boards probe now separates them:

```
four merges, nothing misstated   -> green  ... 0 trailers misstated, 4 unread: ...
four misstatements, no merge     -> red    ... 4 trailers misstated, 0 unread: ...
one misstatement, three merges   -> red    ... 1 trailers misstated, 3 unread: ...
```

Folding them back (`h4`) is killed by six tests. The head arithmetic checks out exactly: empty head 79 bytes, widest head **197** with six `MaxInt64` counts and the shallow note, against the 200 cap — the comment's 83 + 6×19 is right. The searched line test now varies both new counts and asserts each survives.

**MED3 / F76 — CLOSED.** The clean board keeps the clause:

```
1 proof, 0 landed: 0 ahead of plan, 0 behind, 0 trailers misstated, 0 unread:
every proof sits where its plan puts it; 1 test was reported by more than one suite
```

`h5` (dropping `tailOf` from the no-hits branch) and `h6` (dropping the render's line) both die. `TestACleanBoardStillSaysOneTestCameFromTwoSuites` builds a real second Go package with a same-named test and drives it through the row — a fixture, not a hand-built `Run`.

**MED4 / F77 — CLOSED.** All five flips die, each with a message naming what disagrees:

```
merge row flipped to "The slice has landed | yes"  -> 3 failures incl. "the board reads red=false, and the page says true"
doubled row flipped to "... | no"                  -> 3 failures
disagreement table, red and green swapped          -> 2 failures
"later commit is named" -> "earlier commit"        -> 1 failure
```

`rowsOf` now cuts rows into cells and checks the cell count against the heading; `h9` (removing that check) dies.

**MED5 / F78 — CLOSED.** Through real git:

```
0efeb4b  a later commit   <- carries the stray "Slice: s_one"; this is what gets named
29c350d  land s_one       <- lands the slice
  unread trailer  s_one  0efeb4b9...  names a slice an earlier commit already landed
```

`h3` (walking claims forward again) is killed by three tests, including a real-git one asserting the later id is on the line and the earlier is not. `slices.Backward` is the right shape, and the page's row now says "an earlier commit already landed / the later commit is named".

**All eight LOWs — CLOSED.**

| | evidence |
|---|---|
| L1 fallback on the page | §3.1 names it with the 8192 cap; `TestTheContractWritesTheCapThePatternFallsBackAt` pins the number and that the page says what it falls back to |
| L2 `adapter.For` / D25 | seam doc and §3.4 both name the manifest row as the red's owner; verb still fails closed, exit 1; new `for_test.go` drives all three branches, and `h15` (blanking the refusal) now dies |
| L3 render search | rewritten to search — but see NEW-1 |
| L4 pattern boundary | `TestAPlanJustInsideTheCapDoesNotFallBack` grows markers to the tipping point and asserts the last-fitting plan is selected exactly and is within 100 bytes of the cap |
| L5 verb writes-nothing | now hashes every file including `.git`, same reading as the row's proof |
| L6 ladder drops the why | `the first on ccccccccc... is not an id: it holds '😀', which is not a lowercase letter...` — reason kept, and the slash case no longer reaches `filepath.Base`; `h7` dies |
| L7 unpinned branches | `TestAnOutcomeTheSeamDoesNotNameIsNotAPass` drives the fourth outcome; the empty plan dir is reachable and honest — `groundwork board: docs/plan is there and holds no plan file`, exit 1 |
| L8 wrapping | §3 unwrapped; the page is one style throughout |

The new `firstOf` rung is well guarded. I checked every other `hit` construction in the battery: the mutate, token, honesty and wiring rows all set `line > 0`, and the run-evidence row sets no subject, so none of their ladders change.

---

## New in the fix diff

**NEW-1 (MED) — the render's bound is unproved for the line the fix added.**

`listed`'s `const most = 3` is what holds the new multi-suite line inside `maxLineBytes`. Blanking that cap survives the whole unfiltered suite:

```
h11_listed_no_cap   SURVIVED (re-run against ./... )
```

With the cap gone:

```
twice=4   widest=  308  over the 400 bound: false   <- what the shipped search builds
twice=10  widest=  705  over the 400 bound: true
twice=40  widest= 2685  over the 400 bound: true
```

`TestTheWidestRenderedLineIsSomewhereInTheInputSpace` still passes on that mutant, reporting 308. Its `twice` axis is `{0, 1, 4}`, so it never varies the count that drives the width — the same F54/F61/D52.4 shape the test was rewritten to close, now on the line the fix introduced. It reaches ~271 bytes on the shipped code at a large count, which the search also never sees.

The `maxLineBytes` comment beside the constant is stale with it. It still says the widest line is the table's, "That comes to 242 bytes, and the stamp and the notes below are narrower" — while the test's own log says 253, on a line the comment does not mention. That comment is the arithmetic justifying the constant.

The bound does hold on the shipped code, with margin. What is missing is the proof.

**NEW-2 (LOW) — `isRed`'s refusal is unpinned.** Blanking the `t.Fatalf` for a verdict cell that is neither `yes` nor `no` survives the whole unfiltered suite (`h8`). The guard has a real job — a cell rewritten into prose on a *not-red* row would read as "no" by luck and pass — but nothing drives it.

**NEW-3 (LOW) — the head lost its singular.** It now prints `1 trailers misstated, 1 unread`. `counted()` is used two fields earlier for `1 proof`, and using it here costs nothing: the plural is the longer form and sets the 19-byte bound either way. The searched test now pins the ungrammatical spelling in place, so a fix touches both.

**NEW-4 (LOW, and it bears on F80) — the sixth count axis is what tipped the battery out of the deletion test.** The widest-line search went from 11⁵ to 11⁶ combinations:

```
TestTheBoardRowLineIsWidestSomewhereInTheCountSpace   8.26s -> 74.60s
internal/battery package                               144s -> 199s
```

and the verify run now says:

```
mutate  green  killed every mutant judged: 10/114 ...: killed 8, 1 uncompiled, 1 blocked;
               internal/battery holds 1 target and its own tests do not finish in time
```

So the package holding `boardrow.go` has no deletion-test coverage on this repo, and this slice is what put it over. F80 records the class and assigns it; this is its cause and its price, and 75 seconds of it sit in one test whose count axes are monotone and need not be swept as a full cross product.

**Ledger.** F74–F79 all still read `What happened: open`. The working agreement says a slice cannot close while a finding on it is still open — the driver's line to write, but it gates the landing.

---

## What held up in the sweep

15 blanking mutations over the fix diff, each scoped first and every scoped survivor re-run against the whole unfiltered suite before being reported. 13 killed, 2 survived (NEW-1, NEW-2). Every one of the five MED fixes is pinned by a mutation, and the two harness hardenings the builder describes match what I saw: the b3s4 proofs are in reach of the filters, and no survivor was reported without a full-suite run behind it.

Verify on a pristine copy, 11m8s, exit 0:

```
board  green  24 proofs, 0 landed (shallow): 15 ahead of plan, 0 behind,
              0 trailers misstated, 0 unread: b3s1_shapes is expected red and passed in the run and 14 more
11 rows: green 11, red 0, waived 0, quarantined 0, unrunnable 0
```

at 9.0+r4326bda, digest unchanged as claimed. `go test -p 1 ./...` green beside it.

One thing not worth a finding: `Render`'s early return for a board with no rows skips the multi-suite line. Both the row and the verb refuse before rendering when a plan names no proof, so nothing reaches it.

Everything else from my first pass that I re-drove — the three landed positions, the four red trailer shapes, merges, forged values, the shallow note, the plan-and-no-manifest and broken-build paths — still behaves as it did, now with the two-count head.