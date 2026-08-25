# Handoff — Bet 3, slice 1: the plan artifacts and their reader

Status: IN PROGRESS. Code and docs written; suite and verify still to run.
Branch: current, HEAD at start a542b63. Nothing committed by me.
Rule: driver commits red then green.

## The red/green split

- **Red (tests only):** `internal/plan/plan_test.go`, `internal/battery/planrow_test.go`,
  the one-line edit to `internal/battery/battery_test.go`.
  At a542b63 the `internal/plan` package does not exist, so the build fails — the red.
- **Green (everything else):** `internal/plan/plan.go`, `parse.go`, `bind.go`, `resolve.go`,
  `internal/battery/planrow.go`, `rows.go`, `battery.go`,
  `docs/derivation-contract.md`, `docs/plan/**`, `.groundwork-battery.json`.

## Items

1. [x] Plan artifact shapes (R1, R2)
2. [x] internal/plan reader — parse, id rules, reference resolution, table tests
3. [x] `plan` battery row, kind `plan` (new kind, list pinned by a new test)
4. [x] docs/derivation-contract.md, section 1
5. [x] Dogfood plan files: docs/plan/rebuild/program.md, bet_3/bet.md, b3s1..b3s8.md
6. [x] Battery version 5.0 -> 6.0, digest ra8c0ca9
7. [ ] D16 mutation sweep
8. [ ] verify on this repo: 8 rows green at 6.0

## What landed

`internal/plan` is four files. `parse.go` reads the frontmatter subset. `bind.go`
pulls typed fields out of a parsed block and holds the id, path and marker rules.
`plan.go` holds the types, `ParseProgram`/`ParseBet`/`ParseSlice`, and `Load`,
which walks `docs/plan` and collects every problem rather than stopping at the
first. `resolve.go` holds the units together: one flat id space, and every
reference reaching something.

`internal/battery/planrow.go` is the row. Green when the plan resolves. Green with
a plain sentence when there is no `docs/plan` at all. Unrunnable when `docs/plan`
is there and holds no program (D17). Red otherwise, carrying the reader's first
problem and a count of the rest.

## Judgment calls made (for the driver's ledger — I did not touch docs/decisions.md)

1. **The frontmatter subset is hand-written, not YAML.** The module has no
   dependencies and this repo has never taken one. A full YAML parser is a
   dependency; the fields R2 names need three shapes — a line of text, a list of
   lines, a list of flat blocks. So the parser reads a small, strict, documented
   subset and refuses everything else. `docs/derivation-contract.md` section 1 is
   the definition. One limit is written on that page: a list entry whose first
   word is a bare key followed by a colon reads as a block, so a line of prose
   that starts that way cannot be a list entry.

2. **`touches_data` is a field.** R2 says the data block is "required when the
   slice declares it touches data", and gives no field for the declaration. A
   boolean every slice must answer is the honest shape: a slice that says true
   and forgets the block is red, and a slice that says false and carries one is
   red too. Without it the reader could never tell a data-touching slice from a
   forgetful one.

3. **`premises` is parsed but not written in this repo's own plan.** It is the
   one R2 field with no resolver in this bet (R13 owns it, slice 6). It is not
   omitted from the parser, because the shape is fixed now and a bet that does
   stand on a sealed artifact must be able to say so. It is omitted from
   `bet_3/bet.md` because no seal exists yet — there is genuinely nothing to
   declare. R1's "a field with no reader is not written at all" is satisfied by
   the file, not by the parser.

4. **Ids share one flat space.** R1 says an id is unique across the repo. That is
   read strictly: programs, bets, milestones, slices, proofs and facing items all
   claim from one space. A reference names an id and nothing else, so two things
   wearing one id would make every mention of it a guess.

5. **The directory or file name is the id.** `docs/plan/rebuild/bet_3/b3s1.md`
   declares `b3s1`, and a disagreement is red. This is D28's one-spelling rule,
   and it is also what makes "which bet does this slice belong to" have one
   answer: the directory decides, and the `bet` field has to agree with it.

6. **Both directions of the slice list resolve.** A slice the bet lists with no
   file is red, and a slice file the bet does not list is red. The second half is
   the shape R12's forward direction guards against, one level down.

7. **The design paths and the proofs' `from` paths are checked to exist.** Anchor
   resolution is slice 6's (R12); the file existing is not, and a path naming no
   file is wrong whoever reads it. The `from` anchors in this repo's own plan are
   short (`#r2`, `#slice-1`); slice 6 may need to restate them once it defines how
   an anchor resolves.

8. **Bet 3's three milestones are mine, not the design's.** The design cuts eight
   slices and gives their order, but names no milestones. `m_b3_artifacts`
   (slices 1-3), `m_b3_board` (4-7), `m_b3_grading` (8) follow the design's own
   stated ordering rule: a thing is built before the thing that grades it.

9. **This slice's own tests carry R9 markers.** The plan file for b3s1 declares
   eight proofs, and every marker names a test that exists. R9 lands in slice 4;
   nothing here reads a marker beyond its shape. Naming them correctly now costs
   nothing and keeps the dogfood honest.

## Log

- Read CLAUDE.md, docs/evidence/bet-3/design.md in full, docs/ladder.md.
- Read the battery package: battery.go, rows.go, lock.go, manifestrow.go,
  scan_test.go helpers, the journal's kind-pin test.
- Found: the battery's row-kind list had no pin test, though D28 calls it closed.
  Added `TestTheRowKindVocabularyIsPinned`, in the shape of the journal's own.
- Wrote the tests first. Confirmed they fail to build without the package.
- Wrote the reader, the row, the contract page, the dogfood plan.
- `go test ./internal/plan/` green. Digest recomputed: ra8c0ca9. Lock file at 6.0.
