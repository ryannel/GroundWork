---
title: Units of Work
description: How GroundWork structures delivery — Bet, Milestone, and Slice.
status: active
last_reviewed: 2026-07-02
---

# Units of Work

GroundWork organises delivery through three nested units — **Bet**, **Milestone**, and **Slice** — each defined by the contract its dependents can rely on. A Bet's appetite holds while scope is designed. A Milestone's outcome is proven through the real product's front door before the next milestone builds on it. A Slice's API surface is testable before anything consumes it.

## Pitch

A Pitch is the shaped plan for solving a problem within an appetite: a problem statement, a solution sketch, explicit rabbit holes and no-gos, and a falsifiable success signal — the measurable outcome that confirms the bet delivered its intended value. The appetite is an opportunity-cost judgment made before the solution is designed, not a post-design estimate.

A Pitch does not contain milestones or slices — those are derived in Decomposition, after the design is locked. Multiple Pitches may exist at once; committing to one converts it into an active Bet.

## Bet

A Bet is the committed execution of a Pitch, active from commitment through Validation, on a fixed appetite with variable scope — the worth it is bounded to is set upfront and does not move; scope adjusts to fit what can be delivered within it.

A **quick bet** is the same commitment compressed to one milestone and one reviewable plan, for a change small enough to fit one sitting — see [How We Work](how-we-work.md) for the three-lane sizing rule.

## Milestone

A Milestone is a thin, user-visible step the product reaches — a state its consumer observes at their real surface, proven by driving the shipping build the way that consumer would. The consumer can be a person at a screen, a developer calling an SDK, an operator reading a dashboard, or another system calling the API. The test is simple: **name who sees the outcome and what they see.** If you cannot, it is not a milestone.

A milestone's proof is falsifiable by reality — the consumer's action runs the shipping build end to end, on the real pipeline, never a scripted stand-in. No feature flag gates it: trunk only ever receives a complete, validated bet, so nothing half-built lands and no feature flag is required to keep it releasable. A milestone lives on the bet's own branch until the whole bet closes and merges once; it is not shipped to customers on its own.

Milestones sequence by dependency and risk — the first proves the architecture through the bet's riskiest real path, each later one builds on the proven state before it — and the full ladder (2–5 milestones is healthy) is authored up front, but stays fluid: a milestone-close review can reveal a missing rung, and adding one within appetite is a supported, recorded move.

A milestone closes when its **agreed front-door test cases pass against the real product** — not merely when every contributing Slice is green. Green at the suite is the floor; the outcome must actually hold at the consumer's surface.

## Slice

A Slice is a vertical cut through one service, the unit of work that builds toward a milestone — the smallest unit independently buildable, deployable, and verifiable. Slices run in sequence, each built on the one before, composing toward the milestone's front-door proof. The test: can this slice be deployed and verified without any future slice existing? If it needs a downstream slice to be useful, it is too thin or horizontal.

Building all schemas, then all APIs, then all UI, is three horizontal passes, never a plan — each slice crosses whatever service boundaries a testable capability needs, end-to-end, and stops at that capability's edge.

**Brownfield systems**: Services in brownfield codebases often own multiple domains or share domain logic across services. A Slice is architecture-agnostic — the definition does not assume one service equals one domain. What matters is that a Slice delivers a testable, vertical capability, regardless of how the component's internal responsibilities are structured.
