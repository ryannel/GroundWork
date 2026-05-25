# Units of Work

GroundWork organises delivery through three nested units: **Bet**, **Milestone**, and **Slice**.

## Why these names

Agile vocabulary (Epic, Story, Sprint) carries an embedded assumption: every unit ships customer value on completion. GroundWork's delivery model does not work that way. Design and planning happen before any code is written; Milestones are flag-gated internal proof points, not customer releases; Slices are component-level API contributions, not user-facing increments. The naming reflects this. "Milestone" and "Slice" share surface similarity with Wordloop's vocabulary but are defined differently here — Milestones are not independently shippable user value, and Slices are not tied to a microservices topology.

## Bet

A Bet is a bounded commitment to solve a problem within an appetite. The appetite is an opportunity-cost judgment made before the solution is designed — not a post-design estimate. Every Bet is defined by a Pitch document: a problem statement, a high-level solution sketch, explicit rabbit holes, and explicit no-gos. The Pitch is not a separate level in the hierarchy; it is the document that defines the Bet.

Bets operate on a fixed appetite with variable scope: the time boundary is set upfront and does not move; scope adjusts to fit what can be delivered within it.

## Milestone

A Milestone is a demonstrable state the product reaches within a Bet — visible in the UI and verifiable behind a feature flag, but not yet exposed to customers. Milestones sequence by dependency: a Milestone that requires an earlier one to be complete must declare that dependency explicitly.

The Milestone is not a customer release. It is an internal proof point: the capability exists, can be demonstrated, and composes with other Milestones toward a customer-releasable Bet.

## Slice

A Slice is a vertical cut through a single tech stack component — a service, a module, or a domain area — that delivers a new capability at that component's API boundary. A Slice spans the full depth of its component (schema, business logic, API surface) and stops there. The component above it — the UI or a downstream service — can consume it once the Slice is complete.

The hamburger method defines what "vertical" means in practice: rather than building all schemas across components, then all business logic, then all APIs, each Slice delivers one complete column through a single component's layers. The column is independently testable before anything above it is built.

Milestones close when every Slice that contributes to the Milestone's required API surface is complete.

**Brownfield systems**: Services in brownfield codebases often own multiple domains or share domain logic across services. A Slice is architecture-agnostic — the definition does not assume one service equals one domain. What matters is that a Slice delivers a testable API-level capability at a component boundary, regardless of how that component's internal responsibilities are structured.
