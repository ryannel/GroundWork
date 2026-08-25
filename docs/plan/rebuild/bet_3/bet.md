---
id: bet_3
title: Planning and the board
program: rebuild
design:
  - docs/evidence/bet-3/design.md
milestones:
  - id: m_b3_artifacts
    title: The artifacts, the chain, and the seal
  - id: m_b3_board
    title: The derived board and the rows that read it
  - id: m_b3_grading
    title: The held-out grading run
slices:
  - id: b3s1
    milestone: m_b3_artifacts
  - id: b3s2
    milestone: m_b3_artifacts
  - id: b3s3
    milestone: m_b3_artifacts
  - id: b3s4
    milestone: m_b3_board
  - id: b3s5
    milestone: m_b3_board
  - id: b3s6
    milestone: m_b3_board
  - id: b3s7
    milestone: m_b3_board
  - id: b3s8
    milestone: m_b3_grading
facing:
  - id: f_plan_files
    line: Three plan files under docs/plan say what a program, a bet and a slice are.
  - id: f_derivation_contract
    line: docs/derivation-contract.md says what shape every parsed file has.
  - id: f_plan_row
    line: verify shows a plan row, red when a plan misstates itself.
  - id: f_chain_row
    line: verify shows a chain row, red on a broken or missing journal chain.
  - id: f_seal_verb
    line: groundwork seal grants, verifies, amends and restores a seal.
  - id: f_seal_row
    line: verify shows a seal-verify row, red when a sealed path has moved.
  - id: f_board_verb
    line: groundwork board renders the board from the plan, git, and the test run.
  - id: f_board_row
    line: verify shows a board row, red when expected and actual disagree.
  - id: f_slice_trailer
    line: A slice's commit carries a Slice trailer, which is how landed-ness is read.
  - id: f_stub_row
    line: verify shows a stub row, red when a proof is not red for the right reason.
  - id: f_trace_row
    line: verify shows a trace row, red on an unresolved anchor or an unclaimed facing item.
  - id: f_record_row
    line: verify shows a record row, red when a declared record is missing or stale.
  - id: f_waiver_count_row
    line: verify shows a waiver-count row, red once one row has been waived too often.
  - id: f_history_row
    line: verify shows a history row, red when a bet closes on a squash.
---

# Bet 3 — Planning and the board

This bet builds the planning system: the artifacts a plan is written in, the seal that fixes them, and the board that derives progress from git and the test run rather than from anybody's claim.

The design is `docs/evidence/bet-3/design.md`. It was ratified with its rulings, and it is the source of every slice below.

## The milestones

The design cuts eight slices in one order: a thing is built before the thing that grades it, and the grading runs last against fixtures nobody building the checks ever saw. The three milestones follow that order.

**The artifacts, the chain, and the seal** — slices 1 to 3. The plan files and their reader, the hash-chained journal, and the seal machinery. Everything after this reads what these three build.

**The derived board and the rows that read it** — slices 4 to 7. Test markers and the board derivation, the stub check, two-direction traceability, and the record, waiver-count and history rows.

**The held-out grading run** — slice 8. The sealed fixtures are run once, and every miss and every false red is filed.

## What is not here

There are no `premises`. A premise is a sealed artifact this bet stands on, and no seal exists yet — slice 3 is what builds them. The field is left out rather than written empty, because there is nothing to declare.

There are no `deferred` entries either. Every facing item above is claimed by a slice. The gaps the design found (G1 to G4) are requirements no bet owns, not user-visible items this bet declined; they went to the ledger as findings when the design was ratified.
