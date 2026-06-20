---
title: Surface Architecture
description: Architecting the surfaces that sit over a headless capability core — the backend-for-frontend seam, surface decomposition, render placement, and the design system as a contract.
status: active
last_reviewed: 2026-06-19
---
# Surface Architecture

## TL;DR

A surface — web app, mobile app, CLI, desktop, an agent UI — is an adapter over the capability core, not a place for business logic. Its architecture is about the **seam**: how the surface reaches the core (a backend-for-frontend that shapes contracts to that surface), how a large surface is decomposed without sprawling, where rendering runs, and how the design system serves as a shared contract. Get the seam right and the surface stays thin, replaceable, and consistent with every sibling surface.

## Why this matters

The most common way a system rots from the front is by letting business logic leak into the surface — validation rules, pricing, state machines re-implemented in a component because the API "didn't quite return the right shape." Now the rule lives in two places and they drift. The discipline of surface architecture is to keep the core authoritative and the surface an adapter: rendering, interaction, and orchestration of contracts, nothing more. That is also what lets a second surface (a mobile app, a CLI, an agent) be added without re-deriving the domain.

## Our principles

### 1. Surfaces are adapters over the core

A surface renders state and orchestrates calls to the core's contracts; it holds no domain rules. The capability core owns business logic and is designed headless and validated with no surface running. If a rule has to be true on every surface, it lives in the core — a surface that re-implements it is a drift waiting to happen.

### 2. The backend-for-frontend shapes the contract per surface

A **BFF** adapts the core's contracts to what one surface actually needs — aggregating, trimming, and reshaping so the client is not stitching together six calls or over-fetching a viewport's worth of data. The unit is the *user experience*, not the device: a single web app serving customers, partners, and admins may warrant three BFFs, not one (Sam Newman's distinction). React Server Components are a built-in BFF for a web surface — the server-component tree *is* the aggregation layer.

The contested part is whether you need a separate BFF tier at all. You do not when there is one surface, when the core's contract is already flexible enough to let each client select and embed what it needs, or when GraphQL federation lets the client shape its own query — a dedicated BFF there is just another tier to operate. Reach for one when surfaces diverge sharply in their data needs, when chatty round-trips or over-fetching hurt, or when frontend and backend teams keep colliding on contract changes. Either way the BFF is an adapter, not a second core: the moment business rules accrete there you have built a shadow core, and a little duplication between BFFs is cheaper than the coupling you recreate by merging them back into one general-purpose tier.

### 3. Render on the server and at the edge by default

Push rendering and data assembly to the server; ship the client the least work it can do. Server-first rendering flattens latency, shrinks the JavaScript payload, and concentrates the server/client boundary in one place instead of scattering fetch logic through the component tree.

This is a default, not a dogma. Server Components add a real boundary to reason about — no `useState`, `useEffect`, or context on the server — and they are a poor fit for surfaces dominated by continuous client interaction: complex editors, real-time collaborative canvases, local-first apps that must run offline. There the state lives on the client by nature, and forcing it through the server buys latency and complexity for nothing. The decision rule: render on the server when the surface is content- and navigation-shaped — the data changes between requests, not between keystrokes — and keep state on the client when interaction is continuous and local. Most surfaces are both: render the shell and the data-bound regions on the server, island the interactive parts.

The *edge* is a separate, narrower call. It wins for latency-sensitive work that needs little or no data — auth, redirects, personalization, A/B splits — and loses when the render needs the database, because the edge node is far from your data and the round-trips dominate. Put compute at the edge only when it sits close to what it reads.

### 4. Decompose a large surface by domain, right-sized

A surface decomposes the way services do — by bounded domain, only when teams or load genuinely demand it. The driver is organizational, not technical: **micro-frontends** earn their cost when independent teams must build, test, and deploy parts of one surface on their own cadence. Absent that, a single well-structured surface — a "modular monolith" front-end with strict internal module boundaries — is simpler and correct, and it is where the field has settled: the State of Frontend survey reports self-described micro-frontend use falling from roughly 75% in 2022 to 24% in 2024 as teams found the DevOps overhead outran the benefit. The distributed-monolith failure mode has a front-end twin: many micro-frontends that must deploy in lock-step. Module Federation, the main micro-frontend mechanism, is increasingly used *inside* a monolith to update parts independently — proof the runtime tool is useful without the team-splitting topology.

### 5. The design system is architecture

The design system — tokens and components — is a contract between every surface, not decoration. It is versioned, it is the single source of visual and interaction truth, and a surface consumes it rather than re-inventing it. Design-system-as-architecture is what keeps ten screens and three platforms feeling like one product.

### 6. The contract presumes no surface

The core's contract serves every surface and presumes none — a session assumption baked into a response, markup where data belongs, or pagination sized to one viewport is the bug the next surface hits. An agent driving the interface (via **AG-UI**) is itself a surface type, and the most demanding test of a surface-neutral contract.

### 7. Accessibility and performance are architectural budgets

A surface ships against committed budgets — interaction latency, bundle size, accessibility floors — enforced in CI, because they are properties of the architecture, not polish applied at the end. A surface that meets its budget only on a fast laptop has no budget.

## How we apply this

The architect owns the *seam* — the core/surface boundary, the BFF, the decomposition decision, render placement. The design system's content and the surface's UI implementation belong to the design-system and surface-engineer skills; this reference decides where the line sits, not how the button looks.

- [How We Structure Code](code-structure.md) — the surface is a driving edge over the core.
- [API Design](api-design.md) — the surface-neutral contract the BFF adapts.
- [Agentic Systems](../ai-native/agentic-systems.md) — agent-driven surfaces and AG-UI.

## Anti-patterns we reject

- **Business logic in the surface.** A pricing rule in a component. It will drift from the core.
- **The fat BFF.** A backend-for-frontend that grows its own domain rules and becomes a shadow core.
- **Micro-frontends by default.** Distributing one surface across teams that don't need it, then deploying them in lock-step.
- **The re-invented design system.** Each screen styling its own buttons; consistency dies one component at a time.
- **Viewport-shaped contracts.** A response only the current web layout can consume, which the mobile app and the agent cannot.
- **Client-heavy by reflex.** Shipping a megabyte of JavaScript to render what the server could have sent as HTML.

## Further reading

- *Backend for Frontend*, Sam Newman — the BFF pattern and its boundaries.
- *Micro Frontends*, Luca Mezzalira — decomposition of large front-ends, and when not to.
- *Design Systems*, Alla Kholmatova — the design system as a shared, versioned contract.
