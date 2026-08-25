# Closure check, round 1

The same reviewer, re-probing all fourteen findings after the first fix round. Thirteen closed, one closed with residue, and the M8 fix opened F43; F44 carries the two smalls.


Working tree left exactly as found. All work done on copies.

# Closure: 13 CLOSED, 1 CLOSED-with-residue, 1 NEW finding

## Per finding

**H1 — CLOSED.** My 245-byte-path probe re-run through the real row:
```
outcome=red  len=172
2 problems, the first: docs/plan/demo/demo_bet/bet.md names the design doc docs/qqqq…qqq..., which is not a file in this repo
```
Count first, path clipped to 60 runes, line under the cap. Moving the count back to the end kills `TestThePlanRowsRedLineNeverLosesTheCount` **and** `TestALongPathInAPlanFileIsClippedNotLeftToFillTheLine`; dropping the one-problem count kills the first; unclipping the design path kills the second; making the green line say less kills `TestThePlanRowsGreenLineSaysWhatItRead`. Both D38.2 bound tests are real and both bite. *(Residue below.)*

**M1 — CLOSED.** My probe was contaminated (both my programs' ladders named `demo_later`, so `uniqueIDs` fired first). Isolated it — `demo`'s ladder no longer names `demo_bet`, `other`'s does:
```
REFUSED  1 problem: docs/plan/demo/demo_bet/bet.md names the program other, and it sits in the directory of demo
```
Blanking the check kills `TestABetBelongsToTheProgramItSitsUnder`.

**M2 — CLOSED.** My `demo_p1`/`demo_p1_x` pair is refused on both halves — shared marker, and one proof id opening with another plus underscore, each with its own message. Blanking `oneTestPerProof` kills `TestOneTestNameAnswersForOneProof`. No false red: `demo_p1` beside `demo_p12` loads clean (the rule reads the underscore boundary, not a bare prefix).

**M3 — CLOSED, all four shapes.** Same bet twice on one ladder; two ladders naming one *filed* bet (isolated so `uniqueIDs` could not do the work); a milestone wearing a ladder entry's id; and a facing item wearing one. Blanking `oneLadderPerBet` kills `TestABetSitsAtOnePlaceOnOneLadder`; un-claiming ladder ids kills `TestALadderEntryWithNoFilesStillHoldsItsID`. A second, independent program with its own distinct ladder still loads clean.

**M4 — CLOSED.** `touches_data`/`TouchesData` are gone from the parser, the struct, the key list, the contract page and all eight dogfood slices; only a regression test that refuses the field remains. Writing it now returns *"the field "touches_data" is not one of the fields a slice plan holds"*. Blanking the data-presence rule kills `TestTheDataBlockIsItsOwnDeclaration`.

**M5 — CLOSED.** D45 records four rulings; F35–F42 carry all fourteen of my findings, grouped, each with what caught it and its class. F37 names the invented field and the eight unrecorded rulings by name.

**M6 — CLOSED with one residue.** *"The rules, all of them:"* is now true, and a second block — *"And the caps, all of them"* — carries all six with their numbers (65536, 1000, 64, 300, 40, 3). §1.2 states the flat repo-wide id space and the ladder-entry declaration rule; §1 states the three-level tree including *"`docs/plan` holds one directory per program. A file sitting there is refused."* The page also picked up M1, M2, M3, L4, M8 and H1's count-first rule.
*Residue (LOW):* the page still never says which fields may be left out. It says `fixtures`/`real`/`faked` must be written and (now) that `data` is written or left out — but `facing`, `records`, `premises` and `deferred` are all optional in the parser and the page is silent. A writer cannot learn from the page that a bet may omit `facing:` entirely, which the bet-3 dogfood does for `premises` and `deferred`.

**M7 — CLOSED.** The case now wants `"for a plan file"`. Blanking the `maxFileBytes` guard kills `TestProof_b3s1_hostile_frontmatter_is_refused_by_name`; the scalar cap's message no longer satisfies it.

**M8 — CLOSED as ruled, but the fix opened a new hole (see below).** All four D45.2 shapes behave, end to end through the built binary:
```
README only                       unrunnable  docs/plan is there and holds no program file. 1 problem: docs/plan/README.md is a file…
empty program directory           unrunnable  … 1 problem: docs/plan/demo holds no program.md
stray file beside a real program  red         1 problem: docs/plan/notes.md is a file, and docs/plan holds one directory per program
program.md that will not read     red         1 problem: docs/plan/demo/program.md does not open with a frontmatter block…
```
Blanking the `files == 0` branch kills two tests.

**M9 — CLOSED, and my first-round computation was the thing that was wrong.** GitHub's rule replaces each space with a hyphen and does *not* collapse runs, so a stripped em dash leaves the double hyphen the builder wrote. Recomputed with the real rule: **24 references, 24 resolving, 0 dangling**, no duplicate slugs in design.md, and `git status docs/evidence/` is empty — design.md untouched, as D45.4 requires. My original finding stands regardless: the old anchors were bare `#r1`/`#slice-1`, which resolve under no algorithm.

**L1 — CLOSED.** `atLeastOneLine` deleted; `atLeastOneBlock` remains and has four callers.

**L2 — CLOSED, all three.** Removing the `.md`-suffix rule kills `TestTheTreeShapeIsHeldTo`; removing the file-where-directories-belong rule kills that plus `TestNothingToParseIsUnrunnableAndAMisshapenPlanIsNot`; blanking `checkKey` kills the hostile table. The assertions now name the rule's own words instead of just the file name.

**L3 — CLOSED.** Gutting the field tables kills it (the sections stop existing); keeping the headings and stripping every backtick kills it with **43** field errors. My third variant — renaming the `### 1.5` heading text — correctly survives: the section key is the number, which is the right anchor.

**L4 — CLOSED.** `docs/design.md#one#two` → *"which holds a second #, and a proof comes from one anchor"*. Blanking the check kills the hostile table.

---

## NEW — MED: dropping `program.md` silences a plan that misstates itself

`walkPlans` counts `program.md` files only, so a `docs/plan` holding a complete, parseable bet and its slices — but no `program.md` — reports **unrunnable**, and per `battery.go`'s own rule *"Only red fails a run … unrunnable … never turn a run red."*

Two repos, identical but for one file, both through the built binary. The slice sits on a milestone its bet does not hold — a real misstatement, present in both:
```
with program.md     plan  red         1 problem: …demo_s1.md sits on the milestone demo_m9, which …bet.md does not hold
                          8 rows: green 0, red 3, … unrunnable 5
without program.md  plan  unrunnable  docs/plan is there and holds no program file. 1 problem: docs/plan/demo holds no program.md
                          8 rows: green 0, red 2, … unrunnable 6
```
Deleting one file moves the row out of the red column and the misstatement stops being reported. D45.2's own test — *"Only a docs/plan that offers nothing to parse has nothing to misstate"* — is not met: that directory offers a bet file and a slice file to parse, and they do misstate. The counter wants to count parseable plan units (or any plan file met), not `program.md` alone. Narrow — it needs zero `program.md` across the whole tree — but the consequence is a check that stops checking.

## NEW — LOW: the second `clip()` has no test that dies

`resolveBet`'s `clip(where)` on the design path is pinned by `TestALongPathInAPlanFileIsClippedNotLeftToFillTheLine`. The identical `clip(where)` on the proof's `from` path, five lines away in `resolveSlice`, survives removal — the whole battery package stays green. It works today (a 295-byte `from` path yields a 188-byte line ending `...`, verdict intact), but by D38.2's standard the bound is unproven on that half of the line.

---

## What I swept beyond the fixes

- **The fix diff itself.** `parse.go` is byte-identical to the pre-fix tree. `bind.go` carries only the two intended edits. `plan.go` and `resolve.go` are minimal and readable; `*files++` sits before the read, so an unreadable `program.md` still counts, which is what D45.2 wants. `fmt.Errorf("%w. %s", …)` puts the count at ~byte 49 behind a fixed prefix, so it is inside the cap by construction.
- **24-mutation re-sweep.** Every applicable rule dies — including all the round-one ones (`uniqueIDs`, `mustExist`, `resolveBet`, `resolveSlice`, id/path/marker/from charsets, tabs, scalar cap, duplicate keys, path-vs-name agreement) and every rule the fixes added. Two survivors only, both reported above; the round-one survivors (M7, L2×3) are now caught.
- **No false reds.** The good fixture, this repo's own plan (1 program / 1 bet / 8 slices), a second independent program, and prefix-adjacent proof ids all load clean.
- **Version discipline unmoved:** `6.0+ra8c0ca9`, floor still `major < 6`, row-count pins still `8 rows`, `go test ./...` green, `gofmt -l` clean, `go vet` clean.
- **Dogfood reconciled:** eight slices, all eight b3s1 markers exist as real tests, no orphan `TestProof_` anywhere, all three declared record paths exist.
- **Register held.** New prose averages 14.6–18.1 words per sentence with a 33–41 word maximum, against a landed-code baseline of 12.7–21.6 and maxima to 62.

**Recommendation:** land after the `program.md`-counter fix. The `clip` bound test and the optional-field line on the contract page are cheap to fold into the same change.