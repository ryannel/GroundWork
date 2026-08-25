# Closure check, round 2 — final

Scope: F43 and F44 only. All three closed; verdict lands. The one new low, the unpinned program-file half of the counter, is F45 — fixed at landing.


Working tree left exactly as found (`git status` unchanged; all work on copies under the scratchpad).

# Round-2 closure: 3 CLOSED, 1 new LOW

**F43 — CLOSED.** My exact two-repo pair, rebuilt from scratch and run through the freshly built binary:
```
with program.md     plan  red  1 problem: …demo_s1.md sits on the milestone demo_m9, which …bet.md does not hold
                          8 rows: green 0, red 3, … unrunnable 5
without program.md  plan  red  3 problems, the first: docs/plan/demo holds no program.md
                          8 rows: green 0, red 3, … unrunnable 5
```
Same red count both ways — deleting `program.md` now *adds* a problem instead of silencing three. Dumping all three confirms the misstatement that vanished before is back on the list: `plans=2`, and problem 3 is the `demo_m9` milestone. The staying-unrunnable set behaves: README-only, empty program dir, empty bet dir, a non-`.md` file alone, a bare subdirectory — all unrunnable naming what was held; one `bet.md` or one slice file, even unparseable, is red. That is D45.2's line ("one plan file of any kind means there is a plan") drawn correctly. Blanking the walkBet counter kills four tests including two named for this finding; dropping the `plans == 0` branch kills four more.

**F44a — CLOSED.** Removing `clip(where)` in `resolveSlice` kills `TestALongFromPathIsClippedNotLeftToFillTheLine` **alone**; removing the `resolveBet` one kills `TestALongPathInAPlanFileIsClippedNotLeftToFillTheLine` alone. The two halves are mirrored and separately pinned.

**F44b — CLOSED.** I read the optional set off the parser myself — every `b.*` call site in `plan.go`, plus `b.flag` → `b.scalar(key, true)` — and it is exactly `bet: premises, facing, deferred` and `slice plan: facing, records, data`, with `program.md` holding none. The page (§1.1) says the same, and adds a distinction worth having: *"Required is not the same as holding something."* Four mutations of `optionalFields()` all die, in both directions (a field wrongly called optional dies because leaving it out really fails; a field wrongly called required dies because leaving it out really works), and gutting the page's optional block kills `TestTheContractNamesEveryOptionalField`.

**The half-applied edit — resolved.** `walkBet` now takes `plans *int`, `walkProgram` passes it at line 467, and `*plans++` fires at 479 (program file) and 540 (bet/slice file, after both `continue` guards so directories and non-`.md` files are not counted). Nothing dangling. The round-2 diff is small and confined: `plan.go` (counter + `ErrNoUnits` wording), `resolve.go` (one `clip`), `bind.go` (`optionalFields`), `planrow.go` (doc comment), the page, the tests. `parse.go` untouched.

**Nothing else broke.** `gofmt -l` clean, `go vet` clean, `go test ./...` green in every package, `6.0+ra8c0ca9` unmoved, `verify --list` still ends at `plan`, and the row on this repo is still `green … 1 program, 1 bet and 8 slices` at 90 bytes.

---

## NEW — LOW: the program-file half of the counter has no test that dies

Removing `*plans++` from `walkProgram` (leaving the `walkBet` one) leaves the whole plan and battery packages green — every fixture with a `program.md` also has a bet or slice file doing the counting. The increment is not redundant, though; it is load-bearing for one real shape:
```
docs/plan/demo/program.md alone, no bets cut yet
  as built                     green       docs/plan holds 1 program, 0 bets and 0 slices, and every id and reference in them resolves
  walkProgram counter removed  unrunnable  docs/plan is there and holds no plan file
```
That is F43 inverted — a real, readable plan reading as nothing to parse — and it is the first state of every new plan. Behaviour is correct today; only the pin is missing. Same class as F44a, and cheap: one case in `TestNothingToParseIsUnrunnableAndAPlanFileMakesItRed`.

## Nit (no finding)

`planrow.go`'s doc comment now carries a 51-word sentence explaining F43. It pushes that file's mean to 22.9 words against 18.1 last round, and it needs a second reading — CLAUDE.md's own test. Within the landed baseline, so not a defect; a full stop after *"D45 drew that line"* would fix it.

**Recommendation: lands.** The new LOW is a missing pin on correct behaviour, not a defect — fold it in here or file it, driver's call.