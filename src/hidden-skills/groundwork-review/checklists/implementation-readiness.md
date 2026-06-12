---
name: implementation-readiness-checklist
description: >
  Pre-flight gate between decomposition and delivery: verifies the artifacts the
  delivery phase is about to execute against actually exist, agree with each other,
  and are still current. Applied inline by the delivery workflow — these are
  mechanical existence and consistency checks, not authorship review.
---

# Implementation Readiness Checklist

Checked against the bet's committed artifacts immediately before the first slice is implemented. The one question this answers: **if delivery starts now, will it execute against complete, current, mutually consistent instructions — or improvise?** Any 🔴 item blocks delivery and routes back to the owning phase.

## The document chain

- [ ] 🔴 **Missing link**: any of `docs/bets/<slug>/pitch.md`, `technical-design.md`, or `decomposition.md` does not exist — delivery has no executable plan.
- [ ] 🔴 **Status out of sequence**: the pitch frontmatter `status` is not `delivery` (or `decomposition` about to transition) — a fresh context picked up the wrong bet or a phase was skipped.
- [ ] 🔴 **Unreviewed artifact**: the technical design or decomposition was committed without its review gate reaching `VERDICT: PRESENT` (visible in conversation history or flagged in the doc) — an ungated plan is a draft, not a contract.

## Surface scope

These items apply only when the project carries a surface registry (`docs/surfaces.md`). A project with no registry has a single implicit surface; none of these items fire. The ledger itself is gated at validation — a bet cannot reach `delivered` with an empty ledger cell — so readiness checks the scope agreement that makes that gate satisfiable.

- [ ] 🔴 **Pitch ↔ design surface disagreement**: the pitch's `surfaces:` frontmatter and the technical design's Surface Design subsections name different surface sets — delivery would build for surfaces the bet never scoped, or skip ones it committed to, and validation's ledger row would have no honest state for the mismatched column.
- [ ] 🔴 **Slice surface unmapped**: a slice's `surface` value in `decomposition.md` or `decomposition.json` is missing, or is neither `core` nor a registry slug — core-before-surface sequencing cannot run, and the slice's outcome has no ledger column to land in.

## Contracts

- [ ] 🔴 **Slice without a contract**: a slice in `decomposition.md` introduces or changes a service API whose shapes are absent from `docs/bets/<slug>/contracts/` — that slice will be implemented against guesswork.
- [ ] 🔴 **Spec files missing**: the bet touches an HTTP boundary, events, or persistent state but the corresponding spec file (`contracts/openapi.yaml`, `asyncapi.yaml`, `schema.sql`) does not exist — Design Foundations committed without its machine-readable output.
- [ ] 🟡 **Contract orphan**: a contract operation in the specs that no slice consumes or implements — either scope was silently cut in decomposition or the design carries dead weight.

## Proof of work

- [ ] 🔴 **Missing test scaffolding**: `tests/bets/<slug>/` does not contain the bet-progress test files the decomposition's Test Cases tables reference — there is no red suite to turn green, so "done" has no definition.
- [ ] 🔴 **Suite not sealed**: `.groundwork/bets/<slug>/test-manifest.json` is absent, or its hashes do not match the files in `tests/bets/<slug>/` — the suite was never signed at Proof of Work, or it changed after signing without an amendment. An unsealed suite is a draft, not a definition of done.
- [ ] 🔴 **Manifest missing or drifted**: `.groundwork/bets/<slug>/decomposition.json` is absent, or its milestones/slices/test paths disagree with `decomposition.md` — delivery tracking would record progress against the wrong plan.
- [ ] 🔴 **Tests not red**: a bet-progress test already passes before any implementation exists — it tests nothing, and the slice it covers will report done on arrival.
- [ ] 🟡 **Test/table drift**: a decomposition Test Cases row with no matching test, or a test file with no matching row — the proof and the plan disagree about what is being proven.
- [ ] 🟡 **Test-review surface stale**: `docs/bets/<slug>/test-review.md` is missing an entry for a test function or quotes an assertion that no longer matches the file — the user signed something other than what delivery will execute against.

## Currency

- [ ] 🔴 **Open contradiction in discovery notes**: an entry under `## Design Details` or `## Bets` in `.groundwork/cache/discovery-notes.md` contradicts the committed design or decomposition — a captured signal was never reconciled, and delivery would build against the stale half.
- [ ] 🟡 **Stale upstream**: `groundwork check` (or its git-log baseline) reports a canonical doc this bet depends on as stale — the design may rest on a map that no longer matches the territory. Assess whether the drift touches this bet before proceeding.
- [ ] 🟡 **Maturity blocker unacknowledged**: `docs/maturity.md` carries an `open` `blocks-delivery` row that this bet neither closes nor consciously deferred during discovery — delivery is about to run into the documented obstacle.
