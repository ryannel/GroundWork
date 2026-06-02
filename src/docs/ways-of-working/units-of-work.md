---
title: Units of Work
description: How GroundWork structures delivery — Bet, Milestone, and Slice.
status: active
last_reviewed: 2026-05-26
---

# Units of Work

GroundWork organises delivery through three nested units — **Bet**, **Milestone**, and **Slice** — each defined by the contract its dependents can rely on. A Bet's appetite holds while scope is designed. A Milestone's capability is provable behind a flag before customers see it. A Slice's API surface is testable before anything consumes it.

## Pitch

A Pitch is the shaped plan for solving a problem within an appetite. It contains: a problem statement, a high-level solution sketch, explicit rabbit holes and no-gos, and a falsifiable success signal — the measurable outcome that confirms the bet delivered its intended value. The appetite is an opportunity-cost judgment made before the solution is designed, not a post-design estimate.

A Pitch does not contain milestones or slices. Those are derived in Decomposition, after the design is locked in Design Foundations.

Multiple Pitches may exist at once. Committing to a Pitch converts it into an active Bet.

## Bet

A Bet is the committed execution of a Pitch — active from the moment the team decides to execute through Validation. A Bet operates on a fixed appetite with variable scope: the time boundary is set upfront and does not move; scope adjusts to fit what can be delivered within it.

Milestones and slices are defined in the Decomposition phase, from the locked technical design. They are not part of the Pitch.

## Milestone

A Milestone is a demonstrable state the product reaches within a Bet — visible in the UI and verifiable behind a feature flag, but not yet exposed to customers. Milestones sequence by dependency: a Milestone that requires an earlier one to be complete must declare that dependency explicitly.

The Milestone is not a customer release. It is an internal proof point: the capability exists, can be demonstrated, and composes with other Milestones toward a customer-releasable Bet.

## Slice

A Slice is a vertical cut through a single tech stack component — a service, a module, or a domain area — that delivers a new capability at that component's API boundary. A Slice spans the full depth of its component (schema, business logic, API surface) and stops there. The component above it — the UI or a downstream service — can consume it once the Slice is complete.

The hamburger method defines what "vertical" means in practice: rather than building all schemas across components, then all business logic, then all APIs, each Slice delivers one complete column through a single component's layers. The column is independently testable before anything above it is built.

Milestones close when every Slice that contributes to the Milestone's required API surface is complete.

**Brownfield systems**: Services in brownfield codebases often own multiple domains or share domain logic across services. A Slice is architecture-agnostic — the definition does not assume one service equals one domain. What matters is that a Slice delivers a testable API-level capability at a component boundary, regardless of how that component's internal responsibilities are structured.
