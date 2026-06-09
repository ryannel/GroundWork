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

## Contracts

- [ ] 🔴 **Slice without a contract**: a slice in `decomposition.md` introduces or changes a service API whose request/response shapes are absent from `technical-design.md` — that slice will be implemented against guesswork.
- [ ] 🔴 **Contract format gap with no plan**: the technical design promises machine-readable contracts (OpenAPI, protobuf, AsyncAPI) but no slice produces them and none exist — the "documented in machine-readable format before the bet closes" obligation cannot be met.
- [ ] 🟡 **Contract orphan**: an API contract in the technical design that no slice consumes or implements — either scope was silently cut in decomposition or the design carries dead weight.

## Proof of work

- [ ] 🔴 **Missing test scaffolding**: `tests/bets/<slug>/` does not contain the bet-progress test files the decomposition's Test Cases tables reference — there is no red suite to turn green, so "done" has no definition.
- [ ] 🔴 **Tests not red**: a bet-progress test already passes before any implementation exists — it tests nothing, and the slice it covers will report done on arrival.
- [ ] 🟡 **Test/table drift**: a decomposition Test Cases row with no matching test, or a test file with no matching row — the proof and the plan disagree about what is being proven.

## Currency

- [ ] 🔴 **Open contradiction in discovery notes**: an entry under `## Design Details` or `## Bets` in `.groundwork/cache/discovery-notes.md` contradicts the committed design or decomposition — a captured signal was never reconciled, and delivery would build against the stale half.
- [ ] 🟡 **Stale upstream**: `groundwork check` (or its git-log baseline) reports a canonical doc this bet depends on as stale — the design may rest on a map that no longer matches the territory. Assess whether the drift touches this bet before proceeding.
- [ ] 🟡 **Maturity blocker unacknowledged**: `docs/maturity.md` carries an `open` `blocks-delivery` row that this bet neither closes nor consciously deferred during discovery — delivery is about to run into the documented obstacle.
