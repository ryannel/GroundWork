---
title: How We Work
description: The GroundWork lifecycle — Setup, Delivery Loop, and Living Documents.
status: active
last_reviewed: 2026-05-26
---

# How We Work

GroundWork is an AI-driven framework that enforces **Upfront Technical Delivery**: software is meticulously designed, contracted, and verified *before* code is written, eliminating "just-in-time" engineering.

## The GroundWork Lifecycle

GroundWork operates in two modes: **Setup** (one-time) and **Delivery Loop** (ongoing).

### Setup

A greenfield setup runs six phases in sequence, each producing a canonical document the next phase depends on:

| Phase | Skill | Output |
|---|---|---|
| 1. Product Brief | `groundwork-product-brief` | `docs/product-brief.md` |
| 2. Design System | `groundwork-design-system` | `docs/design-system.md` |
| 3. Architecture | `groundwork-architecture` | `docs/architecture/index.md` |
| 4. Scaffolding | `groundwork-scaffold` | `docs/architecture/infrastructure.md` |
| 5. MVP Planning | `groundwork-mvp` | `docs/bets/<slug>/pitch.md` |
| 6. First Bet | `groundwork-bet` | First delivered feature; enters Delivery Loop afterwards |

Every setup phase commits to its final document, then hands off to the orchestrator, which routes to the next incomplete phase. The MVP→Bet handoff is the one exception that preserves context across the transition — the rich greenfield discovery feeds directly into the first bet without a context reset.

Brownfield projects (initialising GroundWork against an existing codebase) are on the roadmap. They are not currently implemented.

### Delivery Loop

After the first bet ships, the project enters an ongoing cycle. Every bet runs `groundwork-bet`'s five phases:

| Bet Phase | Purpose |
|---|---|
| Discovery | Shape the problem into a Pitch — problem statement, appetite, solution sketch, success signal, and explicit no-gos. |
| Design Foundations | Produce the technical design contract: interface design, data flows, API contracts, and data schema. The design is locked before any decomposition begins. |
| Decomposition | Break the bet into milestones and slices; author bet-progress tests from the locked design. Tests are written red, up front. |
| Delivery | Turn bet-progress tests green, slice by slice. All APIs must be documented in machine-readable format (OpenAPI/protobuf/AsyncAPI) by end of delivery. |
| Validation | Run the full test suite, archive the bet-progress suite, apply Living Documents updates to upstream docs, and seed the next bet via discovery notes. |

Discovery produces a **Pitch**. When the team decides to execute the Pitch, it becomes a **Bet** — active from that moment through Validation. Multiple Pitches may exist at once; committing to one converts it to the active Bet.

**Roadmap:** A Betting Table will support queuing and prioritising multiple Pitches before committing to one. The current implementation takes one Pitch at a time.

All `docs/` artifacts are living documents. They grow as the project learns. Any phase, any bet, any conversation: if new information surfaces that refines an existing document, update it immediately.

## The Operating Contract

All methodology skills share a single set of behavioral protocols defined in the Operating Contract (`operating-contract.md`). These protocols govern:

- **Discovery Notes**: How out-of-phase signals are captured under a canonical 5-section header set (`## Product Brief`, `## Design System`, `## Architecture`, `## Design Details`, `## Bets`) and carried forward to the phase that needs them.
- **Living Documents**: How any phase or bet updates upstream `docs/` artifacts when new information warrants — surgically, without asking permission, with a report of what changed.
- **Phase Lifecycle**: How each phase initialises (checks cache and discovery notes), executes (works through its stages), commits (writes the final artifact, runs Living Documents scan, updates discovery notes), and hands off.

Every methodology skill loads and follows the Operating Contract. The protocols are defined once and referenced everywhere — never duplicated.

## The Philosophy: Upfront Technical Delivery

GroundWork explicitly rejects the common AI-assisted workflow of "just start coding and figure it out." Instead, it operationalises a disciplined progression:

1. **Pitch**: Every bet begins with a problem statement bounded by an appetite (an opportunity-cost judgment of how much time the work is worth). A Pitch includes a falsifiable success signal — a measurable outcome that confirms the bet delivered its intended value.
2. **Design First**: Before any decomposition begins, Design Foundations produces the technical contract — interface design, data flows, API contracts, and data schema. This is the document Decomposition and Delivery execute against.
3. **Tests-Up-Front**: With the design locked, Decomposition authors bet-progress tests derived from the design contract — failing tests that define exactly what "done" means for each milestone and slice. These are Proof of Work.
4. **Constrained Delivery**: Implementation turns bet-progress tests green, slice by slice. All APIs must be documented in machine-readable format (OpenAPI, protobuf, or AsyncAPI) by the end of delivery — clients are generated from this documentation. Discovering a flaw in the contracts means pausing, reverting to Design Foundations, updating, and re-approving — not improvising.
5. **Validation & Living Documents**: After tests pass, upstream docs are surgically updated to reflect what the bet delivered. The architecture, brief, design system, and infrastructure documents continue to describe the system as it is.

If a developer cannot implement the API contracts purely from the Architecture and Design Foundations artifacts, those artifacts are incomplete. **GroundWork builds the map before it drives the car.**

## Where to Go Next

- [Units of Work](units-of-work.md) — the delivery vocabulary: what a Bet, Milestone, and Slice are and how they nest.
- [Documentation Protocol](documentation.md) — how Living Documents work in practice, the document hierarchy, and how `groundwork-check` detects drift.
