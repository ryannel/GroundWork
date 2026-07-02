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

**Two-gate split:** Proof-of-work *authorship* was already judged at review time by `checklists/decomposition.md` — this gate does not re-review it. It checks only that the same artifacts still exist, are current, and agree with each other now.

## The document chain

- [ ] 🔴 **Missing link**: `docs/bets/<slug>/pitch.md`, the `technical-design/` directory, or the `decomposition/` tree does not exist — delivery has no executable plan.
- [ ] 🔴 **Status out of sequence**: the pitch frontmatter `status` is not `delivery` (or `decomposition` about to transition) — a fresh context picked up the wrong bet or a phase was skipped.
- [ ] 🔴 **Unreviewed artifact**: the technical design or the decomposition tree was committed without its review gate reaching `VERDICT: PRESENT` (visible in conversation history or flagged in the doc) — an ungated plan is a draft, not a contract.

## Surface scope

These items apply only when the project carries a surface registry (`docs/surfaces.md`). A project with no registry has a single implicit surface; none of these items fire. The ledger itself is gated at validation — a bet cannot reach `delivered` with an empty ledger cell — so readiness checks the scope agreement that makes that gate satisfiable.

- [ ] 🔴 **Pitch ↔ design surface disagreement**: the pitch's `surfaces:` frontmatter and the technical design's UI Design subsections name different surface sets — delivery would build for surfaces the bet never scoped, or skip ones it committed to, and validation's ledger row would have no honest state for the mismatched column.
- [ ] 🔴 **Slice surface unmapped**: a slice's `Surface` value in the decomposition tree is missing, or is neither `core` nor a registry slug — core-before-surface sequencing cannot run, and the slice's outcome has no ledger column to land in.

## Contracts

- [ ] 🔴 **Slice without a contract**: a slice in the decomposition tree introduces or changes a service API whose shapes are absent from the prose design (`technical-design/03-api-design.md`, or the store in `04-data-design.md`) — that slice will be implemented against guesswork.
- [ ] 🟡 **Contract orphan**: a designed interface in `technical-design/03-api-design.md` that no slice implements — either scope was silently cut in decomposition or the design carries dead weight. The interface is what the implementation's generated contract (canonical `docs/architecture/api/<service>/`, captured at validation) must eventually carry.

## Proof of work

Tests do not exist at this gate — Delivery materializes the red board from this approved prose at Step 0.5, and confirms there that every materialized stub is red for the feature's absence. Readiness checks the prose and the approval tag, not test code.

- [ ] 🔴 **Missing Proof of work**: a milestone `index.md` or slice file in `docs/bets/<slug>/decomposition/` lacks its Proof-of-work prose, or names no `Test file:` path in it — there is nothing for Delivery to materialize into a red stub, so "done" has no definition.
- [ ] 🔴 **Approval tag absent**: under git, the `bet/<slug>/approved` tag does not exist — the approved decomposition tree and technical design were never sealed, so there is no sealed baseline (the ratchet's initial point) the delivery prose-integrity reconciliation can hold the prose to. An unsealed contract is a draft, not a definition of done. (Not under git: confirm the bet record names the approval baseline the reconciliation falls back to.)
- [ ] 🔴 **Ladder or first milestone incomplete**: the `decomposition/` tree is missing a piece it must carry at delivery start — `meta.json`, any milestone `index.md` (the full ladder of headline proofs), or a slice file the **first milestone** links — so delivery would execute against a partial plan. A *later* milestone with no slice files is expected (it is sliced on arrival, not up front), not incomplete; but a slice link that resolves to nothing is a dangling reference and fails this check.
- [ ] 🟡 **Capability ↔ proof drift**: a Required Capability with no Proof of work covering it, or a Proof of work that rests on no Required Capability — the proof and the plan disagree about what is being proven.
- [ ] 🟡 **Proof-of-work prose stale**: a milestone `index.md` or slice file's Proof of work describes a shape, an interface, or an outcome the current `technical-design/` no longer carries — the sealed prose drifted from the design, so the user approved something other than what delivery will build against.
- [ ] 🟡 **Testing strategy unresolved**: a slice's stack does not resolve to a promoted engineer-skill testing strategy (`.agents/skills/groundwork-<stack>-engineer/references/testing.md`) — the slice-worker has no authority to roll the permanent best-practice tests out against, and the coverage-auditor lens no baseline to hold them to. Scaffolded services always carry one; a hand-added or non-standard service may not. Name the gap so delivery rolls out coverage deliberately rather than improvising it.

## Currency

- [ ] 🔴 **Open contradiction in discovery notes**: an entry under `## Design Details` or `## Bets` in `.groundwork/cache/discovery-notes.md` contradicts the committed design or decomposition — a captured signal was never reconciled, and delivery would build against the stale half.
- [ ] 🟡 **Stale upstream**: `groundwork check` (or its git-log baseline) reports a canonical doc this bet depends on as stale — the design may rest on a map that no longer matches the territory. Assess whether the drift touches this bet before proceeding.
- [ ] 🟡 **Maturity blocker unacknowledged**: `docs/maturity.md` carries an `open` `blocks-delivery` row that this bet neither closes nor consciously deferred during discovery — delivery is about to run into the documented obstacle.
