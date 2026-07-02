---
title: How We Work
description: The GroundWork lifecycle — Setup, Delivery Loop, and Living Documents.
status: active
last_reviewed: 2026-07-02
---

# How We Work

GroundWork is an AI-driven framework that enforces **Upfront Technical Delivery**: software is designed, contracted, and verified *before* code is written, eliminating "just-in-time" engineering. "Verified" means a milestone is proven by driving the real product through its real front door — not by a stub the design intended to replace later.

## The GroundWork Lifecycle

GroundWork operates in two modes: **Setup** (one-time) and **Delivery Loop** (ongoing).

### Setup

A greenfield project runs five phases in sequence, each producing a canonical document the next phase depends on:

| Phase | Skill | Output |
|---|---|---|
| 1. Product Brief | `groundwork-product-brief` | `docs/product-brief.md` |
| 2. Design System | `groundwork-design-system` | `docs/design-system.md` |
| 3. Architecture | `groundwork-architecture` | `docs/architecture/index.md` |
| 4. Scaffolding | `groundwork-scaffold` | `docs/architecture/infrastructure.md` |
| 5. MVP Planning | `groundwork-mvp` | `docs/bets/<slug>/pitch.md` |

Every phase commits its document, then hands off to the orchestrator, which routes to the next incomplete phase. The MVP→Bet handoff preserves context across the transition — greenfield discovery feeds directly into the first bet without a context reset.

**Brownfield** projects — an existing codebase — run a parallel five-phase track, implemented, not a roadmap item: `groundwork-scan` reads the code and writes a resumable baseline, three `-extract` skills reverse-engineer the same canonical documents from it, and `groundwork-infra-adopt` bolts on the missing operational layer without regenerating the app. There is no MVP phase — the first bet cold-starts its own discovery from the gap ledger infra adoption commits. Both tracks converge on the same `docs/` set and the same Delivery Loop below.

Once every setup phase completes, GroundWork runs **Setup Graduation** once — the setup-only context graduates into `docs/` and ADRs, then is torn down — so delivery starts against `docs/` as the single source of truth.

### Delivery Loop

After setup graduates, every request is sized into one of **three lanes** before any code is written — the orchestrator's Work Intake triage:

- **patch** — one user-facing goal, no new capability, no API or schema change, not the third patch clustering in one area.
- **quick bet** — one small new capability: a single user-visible step, deliverable in one sitting, touching at most a local, non-structural contract delta — a compressed bet, authored into one reviewable plan instead of five gated phases, proving exactly one milestone.
- **bet** — anything that spans more than one demonstrable milestone, or changes a contract structurally or across services. Runs the full five phases below.

A borderline request resolves to the lighter lane, with the escalation trigger named out loud — a quick bet promotes to a bet, or a patch to a quick bet, the moment reality proves it bigger.

A full **bet** runs `groundwork-bet`'s five phases:

| Bet Phase | Purpose |
|---|---|
| Discovery | Shape the problem into a Pitch — problem statement, appetite, solution sketch, success signal, explicit no-gos. |
| Design Foundations | Produce the technical design contract: interface design, data flows, API contracts, data schema. |
| Decomposition | Break the bet into a milestone ladder and, for the first milestone, vertical slices — each carrying a prose **Proof of work**. Prose only; no test or implementation code. |
| Delivery | Materialize the approved prose into a red test board, then turn it green milestone by milestone — each milestone proven by driving the real product through its real front door, never a stub, mock, or hardcoded return. |
| Validation | Run the full suite, capture the canonical API contract, apply Living Documents updates, merge the bet to trunk in one gated step, and seed the next bet via discovery notes. |

Discovery produces a **Pitch**. Committing to it makes it the active **Bet** — quick or full — through Validation. Multiple Pitches may exist at once.

All `docs/` artifacts are living documents. They grow as the project learns. Any phase, any bet, any conversation: if new information refines an existing document, update it immediately.

## The Operating Contract

All methodology skills share one set of behavioral protocols — Discovery Notes, Living Documents, phase lifecycle, review gating, and more — defined once in `.groundwork/skills/operating-contract.md` and referenced everywhere, never duplicated. Read it directly for the mechanics; every skill you run is bound by it.

## The Philosophy: Upfront Technical Delivery

GroundWork rejects "just start coding and figure it out." Instead:

1. **Pitch**: Every bet begins with a problem statement bounded by an appetite (an opportunity-cost judgment of how much the work is worth) and a falsifiable success signal.
2. **Design First**: Before decomposition, Design Foundations produces the technical contract — interfaces, data flows, API contracts, data schema — that Decomposition and Delivery execute against.
3. **Prose Proofs, Not Tests Up Front**: Decomposition breaks the locked design into a milestone ladder and writes, in prose, what each milestone proves: a thin, user-visible step, proven by driving the shipping build the way that consumer would. This prose, not a red suite, is what the team reviews and approves; the tests are generated from it when Delivery starts.
4. **Front-Door Delivery**: Delivery turns the red board green slice by slice. A milestone closes only when its agreed front-door test cases pass against the real product — never satisfied by a stub, a mock, or a hardcoded return. A design flaw routes through the bet's Amendment Protocol or Change Navigation, never a silent edit.
5. **Validation & Living Documents**: The canonical API contract is captured from the running service, upstream docs are surgically updated, and the bet merges to trunk in one user-gated step — trunk only ever receives a complete, validated bet, so nothing half-built lands and no feature flag is required to keep it releasable.

If a developer cannot implement the API contracts purely from the Architecture and Design Foundations artifacts, those artifacts are incomplete. **GroundWork builds the map before it drives the car.**

## Where to Go Next

- [Units of Work](units-of-work.md) — the delivery vocabulary: what a Bet, Milestone, and Slice are and how they nest.
- [Documentation Protocol](documentation.md) — how Living Documents work in practice, the document hierarchy, and how `groundwork-check` detects drift.
