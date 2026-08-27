# Final re-check

Scope: F113 through F115. All closed, the quoted-block argument upheld, sixteen of sixteen mutations defended. Its one reopen — three drifted page sentences — is F117, fixed and pinned in the last round.


Re-check complete. The real repo is untouched: `git status` matches the start (43 entries), HEAD still `d68025a`, journal ref still `fcd482a`, no stashes, 9 tags. Everything ran on copies.

---

# Final targeted re-check — F113, F114, F115

**VERDICT: lands after one page fix.** The code is right everywhere I probed — 16 of 16 planted mutations defended, clean baselines. One item comes back: the contract page describes the previous version of three of the lines the code now prints, and small (c) is one of them.

---

## F113 / D65.1 — the incarnation boundary — CLOSED

My reused-path probe, unchanged from last round: `honesty` waived three times at a path, deleted, then a new `wiring` waiver at the same path.

```
was: red  ... 5 grants ... wiring has 4 grants inside bet_one, at the limit of 3
now: green    1 waiver file: 1 grant, 0 merges, 0 renames not read: 0 rows at a limit, 0 misstated
```

I also built the nastiest variant — a path reborn as an exact copy of a *living* sibling, git reporting `C100`, with four dead grants underneath it. Both live waivers count 1 each; the dead grants stay dead.

The copied-waiver probe: a waiver with three grants copied to a second name. The original keeps 3 (red), the copy starts at its own commit (1). `bornAt` walks newest-first and stops at the first `A` or `C`, which is exactly the boundary. `q01` (ignore the birth), `q02` (copy is not a birth) and `q03` (add is not a birth) all died.

**On the direct predicate drives — sound, and narrower than your note says.** I reached the copy-as-birth branch through a plain repo fixture (`cp` + `git add` gives `C100`), and the builder's own `TestWaiverCountRowStartsAtAWaiverMadeAsACopy` drives it through a repo too. `R100` is likewise repo-reachable — my two-grants-plus-`mv` probe produces one. The single branch a waiver-sized file cannot reach is a *scored* rename, `R` under 100, and that is precisely the one `TestOnlyAnExactMoveDecidesNothing` drives directly, with `TestAMovePlusARewriteRestartsTheCount` holding the repo-reachable consequence beside it and F116 recording the cost. That is the disciplined use of a direct drive: it covers the one branch with no front door, and every branch that has one is proven through it. No D53.1 problem here.

One undriven branch worth naming, not a finding: `bornAt` returning empty when no add is in reach. Unreachable in the shipped path — the counter refuses shallow clones before it gets there — and the comment states the fallback and its direction ("names too much rather than too little"), which is the safe one.

## F113 / D65.2 — a rename decides nothing — CLOSED

```
2 grants, then a tidy-up git mv:  green  2 grants, 0 merges, 1 rename not read
                                         ...zz.json was moved in ebe6347, which decides nothing
3 grants, then a git mv:          red    3 grants, 0 merges, 1 rename not read
```

Counted, named, never read as a grant — and the rename does not reset the count either. `q04` (read the rename as a grant) and `q05` (treat any scored rename as deciding nothing) both died. The page cell now plants **two** grants plus a move, so its words describe what it drives; my complaint that it said "Two grants" while planting one is fixed.

## F114 / D65.3 — one repo, one line — CLOSED

Twelve runs each, same binary, same repo:

- bet-vs-bucket (3 in `bet_one`, 3 unattributed): **12/12 `inside bet_one`** — was 10/2.
- bet-vs-bet (3 in `bet_one`, 3 in `bet_two`): **12/12 `inside bet_one`**.

Buckets are read `slices.Sorted`, and the tie clause promotes a named bet over the bucket. `q06` (read the map straight) and `q07` (drop the tie-break) both died.

**The record row leads with reds** — my stale-plus-unjudged probe on a depth-3 clone:

```
was: docs/aaa.md ... was last changed at the edge of this shallow clone ... and 2 more
now: docs/zzz.md ... last changed in 0c2ea1c, before the slice's own 981a5e4 ... and 2 more
```

Only the `atTheEdge` note moved to the `loud` bucket; missing, never-committed and stale all stay reds. `q08` (put the loud hits first) died.

## F115 / D65.4 — the cluster keys — CLOSED, and the argument holds

```
Notes: / Slice: demo_s1 was the one that broke.   -> green
a lone quoted Slice: line in prose                -> green
quoted Bet: + Slice: block                        -> red
git merge --squash keeping SQUASH_MSG             -> red
GitHub-style squash                               -> red
a merge quoting a whole trailer block             -> not read
```

`trailerShaped` now asks `board.TrailerKeys()`, and the pin reads CLAUDE.md's own fenced trailer block structurally. I mutated it both ways: adding `Notes` to the list fails with *"TrailerKeys holds \"Notes\", and no page declares it"*; dropping `Tests` fails with *"the pages declare the trailer \"Tests\", and TrailerKeys does not hold it"*. `q09` (accept any key) and `q10` (add an undeclared key) both died.

**On the `Bet:`+`Slice:` red staying red — the argument holds.** Three reasons. The row's question is about readability, not intent: that message really does write two `Slice` trailers and git really does read one, so the statement is true. Excusing it would mean deciding from surrounding prose that a block "is only a quote", which is reading intent — nothing else in this battery does that, and D56.4's discipline is that a misstatement in the input landed-ness is read from is red whatever the reason. And the trade is bounded the right way: the remaining false positive is one narrow shape a writer can avoid in three ways, while an intent heuristic would buy an unbounded false negative in the row's own subject — a real squash whose quoted block happens to sit under a sentence.

The one thing I would add is in the page finding below: a writer meets this rule as a permanent red, so the page should warn before it happens.

## The six smalls

| | |
|---|---|
| **(a) usage text** | **CLOSED.** Now: *"run the bet-close scope: every row, and a refusal unless each of seal-verify, board, trace and record came back green or waived"*. |
| **(b) signing pin** | **CLOSED.** Both my evasions die. A maker spelled `{"init", "-b", "trunk"}` in a new file: *"zz_evade_test.go: 1 repos made, 0 told not to sign"*. A second unsigned maker in an already-compliant file: *"battery_test.go: 2 repos made, 1 told not to sign"*. `q11` (make the count a presence check) died. |
| **(c) page sentence** | **REOPENED.** See below. |
| **(d) head bounds** | **CLOSED, proven the right way.** `q12` "survived" only because it disabled the test's own new assertion, which is a no-op while the constants are under the cap. So I raised all three constants to 500 instead: all three tests fail, each saying *"the head's bound is 500 bytes, over the journal's cap of 200"*. |
| **(e) close_met** | **CLOSED.** Met close → `close_met: true`; refused close → `scope` present, `close_met` absent; ordinary run → no `close_met` key. Both directions pinned in `close_test.go`. `res.Met` is computed from `UnmetAtClose`, the same rule the verb refuses on, so the record and the exit code cannot disagree. `q13` and `q14` both died. |
| **(f) all-empty paths** | **CLOSED.** `TrailersFor(dir, "Bet", "", "")` → *"every path given to narrow this read is empty, and no path is not the same as every path"*. No paths at all still reads the whole history, which is what `Trailers` wants. `q15` died. |

---

## REOPENED — the contract page describes the previous version of three of its lines

Small (c) is one instance of a pattern; I found two more in the same section. R17 makes this page the one place a parsed shape is written down, and none of these three sentences is pinned by anything — which is how all three drifted.

**(i) Small (c), reproduced.** The page still says a long message is *"read only in part, and the row counts how many it read that way **rather than judging the half it saw**"*. The code judges it:

```
75351-byte message -> red  2 commits read, 0 merges not read: 1 squashed, 1 cut
```

The behaviour is the better one — it caught the squash. The sentence is what is wrong.

**(ii) D65.4 is not on the page at all.** The page says a quoted line counts *"only inside a **cluster**: 2 or more trailer-shaped lines next to each other"* and never says what trailer-shaped now means. A reader cannot derive from the page why `Notes:` / `Slice:` is green and `Bet:` / `Slice:` is red — the key set `Bet`, `Slice`, `Tests` appears nowhere in section 5. This is also where the writer's warning belongs: reproducing a whole trailer block in a commit message reads as a squash, permanently, on history nobody can change.

**(iii) The waiver-count row's counts sentence is wrong.** The page: *"the waiver files read, **how many were not waivers**, the grants counted, the merges it did not read, the rows at a **threshold**, and the grants misstated."* The line:

```
2 waiver files: 1 grant, 0 merges, 0 renames not read: 0 rows at a limit, 0 misstated
```

"How many were not waivers" left the head this round; **renames** took its place and is not on the page; and "threshold" is now spelled "limit". I checked the other two: the `record` and `history` sentences match their heads exactly.

The dropped `unread` count is itself fine — the file is still named on the row's own line and appears in the run's waiver notes as `waiver unreadable`, which is what fails the run. Trading a count that is duplicated elsewhere for one that is not, when the head holds six and a seventh will not fit, is the right call. The page just has to say so.

## LOW — the usage text now hardcodes the scope

`verifyUsage` writes "seal-verify, board, trace and record" by hand. Nothing pins it to `battery.CloseScope()`, and R14 says later bets add rows to that scope. The page is pinned in both directions; the CLI help is not, and it is the first thing a person reads. The same class as the item it just fixed.

---

## Mutation sweep — 16 rules, clean baselines for four packages

**Defended, all 16:** birth ignored; copy not a birth; add not a birth; rename read as a grant; any scored rename read as deciding nothing; buckets read unsorted; tie not broken; loud hits before reds; `trailerShaped` accepting any key; an undeclared trailer key; the signing pin as a presence check; the head bound untied from the cap (re-proven by raising the constants); `Met` forced false; `Met` forced true; all-empty paths allowed; `FileHistory` not following renames.

Two needed reshaping rather than counting as survivors: `q09` first hit an unused-import build break, and `q12` disabled a test's own assertion, which cannot fail while the constants are legal. Both were re-driven and both bite.

## Gate, independently measured

- `go test -p 1 ./...` **green, 3m15**, `internal/battery` **100.9s**.
- `verify` on the landed tree: **green on the first attempt**, `16 rows: green 15, red 0, waived 0, quarantined 0, unrunnable 1`, board green, `record ... 0 never committed ... 3 unseen`, `history ... 0 squashed, 0 cut`.
- `verify --close` on the landed tree: **exit 0, no refusal**, all four scope rows green, journal line `close_met: true`.
- Board green on both landed runs this round — five for five since F104's fix, against zero for four before it.
- `gofmt -l` clean, `go vet` clean, digest **ra48a79a** unchanged, version row red on the uncommitted tree and green on the landed one.
- Regressions re-run and clean: both squash flavours, merges not read, the two thresholds, five-across, two-quiet, an unread waiver named, missing / never-committed / stale / landed-together.

F116's four costs read accurately against what I actually found.