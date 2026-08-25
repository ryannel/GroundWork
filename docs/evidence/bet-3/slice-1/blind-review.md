# Blind review of slice 1

The first review of the uncommitted slice, dispatched blind with only the diff and the brief. Verdict: lands after fixes. Its findings are F35 through F42.


Working tree untouched. Review complete.

# Verdict: lands after fixes

Eight rows green at 6.0+ra8c0ca9 on a clean copy. The load-bearing lines are pinned — my whole mutation sweep found them. The defects below are narrow and additive; one of them (H1) is a landing condition by the repo's own ratified rule.

---

## HIGH

**H1 — The plan row's red evidence cuts the problem count. D33/D36/D38.2.**

`joined()` (`/home/user/GroundWork/internal/plan/plan.go:592`) puts the count last — `"<first problem> (and N more problems)"` — and `checkPlan` (`/home/user/GroundWork/internal/battery/planrow.go:59`) passes it through `cut()`, which truncates at 200 bytes from the front. When the first problem's message is long, the count is the half that dies.

Probe (real row, real fixture repo, in the battery package):
```
plan file with a 245-byte design path + a second broken reference
OUTCOME=red  LEN=200
EVIDENCE=docs/plan/demo/demo_bet/bet.md names the design doc docs/qqqq…qqq...
```
The `(and 1 more problem)` is gone. The reader fixes the path, re-runs, and meets the second problem for the first time.

D33: *"If the full line cannot fit the journal cap, words give way … never the counts. A line that still had to cut a count is a defect in the line's design, not an allowed fallback."* D38.2 generalises it: *"no new printed line lands without its bound test."* `planrow_test.go` has no bound test for either the red line or the green one. This is the fourth firing of the class (D33, D36, D38.2).

Contributing: `resolveBet`/`resolveSlice` interpolate a caller-supplied path (up to `maxPathBytes` = 300) **unclipped**, while every other value in the package goes through `clip()` at 60 runes.

---

## MED

**M1 — A bet file may declare a `program` it does not sit under.** Reproduced:
```
docs/plan/demo/demo_bet/bet.md  →  program: other
docs/plan/other/program.md      →  ladder names demo_bet
Load() → nil error, programs=2 bets=1
```
`resolveSlice` enforces exactly this rule for slices twenty lines away (`/home/user/GroundWork/internal/plan/resolve.go:174-183`), with the comment *"A slice naming another bet is a plan that reads two ways, so the file's place decides and the field has to agree with it."* The bet→program direction has no such check, so a bet can be orphaned from the program directory that physically holds it and adopted by another program's ladder.

**M2 — Two proofs may share one test name.** Reproduced: proofs `demo_p1` and `demo_p1_x` both declaring `marker: TestProof_demo_p1_x_runs` load clean. `checkMarker` only requires `TestProof_<id>_` as a prefix, and markers are never claimed in `uniqueIDs`. R9's one-spelling rule and slice 4's derivation both stand on one test result mapping to one proof.

**M3 — Ladder entry ids sit outside the unique-id space.** Three shapes load clean:
- the same bet id written twice on one ladder (the bet's own `slices` list *does* refuse a slice listed twice — asymmetric);
- two programs whose ladders both name one bet id;
- a milestone wearing a ladder entry's id.

`uniqueIDs` claims program/bet/milestone/facing/slice/proof ids but never ladder ids, and a ladder entry is a *declaration* of a bet id (R2: "ladder (ordered bet ids…)"), not a reference to something already claimed.

**M4 — `touches_data` is a machine-read field R2 does not name.** R2 lists the slice-plan fields and closes *"these are the entries proof.md names, and nothing else."* `touches_data` is not on that list; R2 says the data block is "required when the slice declares it touches data", which the block's own presence already spells. The builder added an explicit boolean and enforces agreement in both directions (`/home/user/GroundWork/internal/plan/plan.go:277-307`) — a field that can only ever disagree with the block beside it. Defensible, but it is invented, it is baked into the contract page, the dogfood and every later slice's reader, and no ruling records it.

**M5 — Nothing was written to either ledger.** `docs/decisions.md` and `docs/findings.md` are untouched by the diff. CLAUDE.md: *"take the sensible option, and write it in `docs/decisions.md`"* … *"Add to both the moment the thing happens — not later."* This slice made at least eight rulings the design does not carry: M4's field; six size/depth caps; the top-level tree rule; the flat id space excluding ladder ids; the list-entry ambiguity limit; the first-error-per-file / all-files error policy; which fields are optional. A reader of the record cannot tell any of them were decisions.

**M6 — The derivation contract claims completeness and is not complete.** `docs/derivation-contract.md:51` says **"The rules, all of them:"** and then names none of the six limits the parser enforces: `maxFileBytes` 64 KiB, `maxScalarBytes` 1000, `maxIDBytes` 64, `maxPathBytes` 300, `maxKeyBytes` 40, `maxDepth` 3. `grep -E "byte|limit|64|1000|300|nest"` over the page returns nothing. It also never states the rule that `docs/plan` itself may hold only directories (§1 states the "nothing else" rule for the program and bet levels only) — the rule that produces the README red in M8. R17 makes this page the one place a parsed shape is written down.

**M7 — The 64 KiB file cap has no test that dies when it is removed.** Blanking the `len(raw) > maxFileBytes` guard leaves `go test ./internal/plan/` green. The hostile case "an enormous file" asserts only `want: "bytes"`, which the *scalar* cap's message satisfies instead. The cap is the defence b3s1.md's own prose calls "a file large enough to be an attack".

**M8 — A `docs/plan` holding no parseable unit is red, not unrunnable.** End-to-end through the built binary:
```
$ GROUNDWORK_SESSION=review gw verify      # repo whose docs/plan holds only README.md
plan  red  docs/plan/README.md is a file, and docs/plan holds one directory per program
```
Same for a `docs/plan/<program>/` directory with no `program.md`. The design says *"a docs/plan that exists but holds no parseable unit is unrunnable (D17)"*; `ErrNoUnits` fires only when `docs/plan` is byte-for-byte empty. Red may be the better answer — but it is not the ruled one, and the divergence is unrecorded and undocumented (M6).

**M9 — All 24 `from:` anchors in the dogfood are dangling.** Computed GitHub heading slugs for `docs/evidence/bet-3/design.md` against every `from:` in `docs/plan/rebuild/bet_3/`: 24 references, **0** resolving, 16 distinct dead anchors (`r1`…`r17`, `slice-1`). The real slugs are `r1-where-plans-live-and-what-a-plan-file-is` etc.; `#slice-1` matches no heading at all — §2's slice entries are bold paragraphs. `checkFrom` deliberately checks shape and file only, so this is silent today — but R12's trace row (slice 6) *"fails when the anchor does not resolve inside a sealed design file"*, and by then R3 will have sealed design.md, so fixing it costs the amendment protocol.

---

## LOW

**L1 — `atLeastOneLine` (`bind.go:206`) is dead code.** Nothing calls it. It is unexported, so neither the deletion test (blanks exported functions) nor the wiring row (`55 exported functions in 43 files`) can see it.

**L2 — Three rules survive removal because the assertions are weaker than they read.** Removing the `.md`-suffix rule in a bet directory, and removing the "a file where directories belong" rule at the program level, both leave the suite green: the cases assert only `strings.Contains(err, "notes.txt")` / `"notes.md"`, and nearly any downstream failure names the file. Same shape as M7. `checkKey`'s charset and size rules also survive removal — `unknown()` refuses the same inputs first.

**L3 — The contract-agreement test is partly blind.** Gutting §1.3–§1.6's field tables and replacing them with one paragraph containing the common words leaves 18 of 40 fields uncaught: `id`, `title`, `line`, `real`, `from`, `bet`, `done`, `goal`, `program`, `milestone(s)`, `slices`, `facing`, `proofs` all pass on a bare `strings.Contains`. The distinctive names (`proof_sketch`, `retire_at_close`, `fixture_provenance`, …) do bite.

**L4 — `from: docs/design.md#one#two` is accepted** (`strings.Cut` on the first `#`).

---

## What held up

- **Every load-bearing line I mutated died.** Twenty-two mutations run; twenty caught. Dropped id-uniqueness → `TestProof_b3s1_ids_are_unique_across_the_repo` (all three subcases). Narrowing the id space to one file → the two cross-file subcases die and the within-file one lives, so cross-file detection is genuinely pinned. Dropped reference resolution, blanked `mustExist`, swallowed parse errors in the walk, `ErrNoUnits`→`ErrNoPlanDir`, unrunnable→green in the row, an overclaiming no-plans green, kind `plan`→`manifest`, widening the kind vocabulary, unregistering the row, plus the charset/path/marker/from/data/unknown-key/duplicate-key/tab/scalar-cap/required-field/empty-list/path-id-agreement/missing-`program.md`/missing-`bet.md` rules — all caught, most by name. The two survivors are M7 and L2.
- **F34's ParentsOf pin dies alone.** Blanking `ParentsOf` to `return nil, nil` → `TestParentsOfCountsWhatTheCommitHas` is the only failure in `internal/journal`.
- **Version discipline is intact.** `6.0` with `ra8c0ca9`, recomputed (the kind mutation moved it to `rd12021f`, so the digest really covers the new row). The kind vocabulary is pinned as a written-out list with `plan` in it. The floor test **is** there — `TestThisRepoDeclaresTheBumpThePlanRowCost` asserts `major >= 6` and the digest match, continuing the 2/3/4/5 pattern exactly. D41.2's price is pinned.
- **Full verify on a copy: 8 rows, green 8, red 0, unrunnable 0, at 6.0+ra8c0ca9**, in ~4 minutes. The 6.0 sample rotation found no survivors (`killed 9 of 9 judged`) — F34 closed it.
- **End-to-end through the built binary** in three hostile fixture repos: broken plan → red naming the file and counting the rest, exit 1; README-only → red; empty `docs/plan` → unrunnable with the D17 wording. The journal line is well-formed and carries the count when the message is short.
- **Marker reconciliation is exact.** All 8 slice-1 markers exist as real tests; the 16 markers for slices 2–8 correctly do not; there is not one orphan `TestProof_` in the tree.
- **The dogfood carries R2's fields for `program.md` and `bet.md` verbatim** — no invention there (M4 is the slice file only). Eight slice plans match the design's cut one for one, all 14 facing items claimed exactly once across slices, `docs/evidence/bet-3/holdout.md` exists for b3s8's declared record.
- **Register holds.** New comments average 14.5–16.9 words per sentence with a 33–39 word maximum, against a landed-code baseline of 12.7–21.6 and maxima up to 62. The plan files' prose is short and plain. No drift.
- Hostile shapes that behave: two frontmatter blocks, CRLF, symlinked plan file, symlinked plan directory, deep nesting, absolute and `..` paths, 64-byte ids, leading/trailing space, `[]`, tabs, an id with a dash / a capital / unicode / a space.