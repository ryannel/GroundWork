---
title: Surface Architecture
description: Architecting the surfaces that sit over a headless capability core — the backend-for-frontend seam, surface decomposition, render placement, and the design system as a contract.
status: active
last_reviewed: 2026-06-14
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

Each surface gets a thin **BFF** that adapts the core's contracts to what that surface actually needs — aggregating, trimming, and reshaping so the client is not stitching together six calls or over-fetching a viewport's worth of data. React Server Components now act as a built-in BFF for a web surface. The BFF is an adapter, not a second core: no business rules accrete there.

### 3. Render on the server and at the edge by default

Push rendering and data assembly to the server or the edge; ship the client the least work it can do. Server-first rendering flattens latency, shrinks the JavaScript payload, and keeps data-fetching boundaries explicit. Reach for heavy client-side state only where genuine interactivity demands it.

### 4. Decompose a large surface by domain, right-sized

A surface decomposes the way services do — by bounded domain, only when teams or load genuinely demand it. **Micro-frontends** and **islands** are the tools when independent teams must ship parts of one surface autonomously; for most products a single well-structured surface (a "modular monolith" front-end) is simpler and correct. The distributed-monolith failure mode has a front-end twin: many micro-frontends that must deploy in lock-step.

### 5. The design system is architecture

The design system — tokens and components — is a contract between every surface, not decoration. It is versioned, it is the single source of visual and interaction truth, and a surface consumes it rather than re-inventing it. Design-system-as-architecture is what keeps ten screens and three platforms feeling like one product.

### 6. The contract presumes no surface

The core's contract serves every surface and presumes none — a session assumption baked into a response, markup where data belongs, or pagination sized to one viewport is the bug the next surface hits. An agent driving the interface (via **AG-UI**) is itself a surface type, and the most demanding test of a surface-neutral contract.

### 7. Accessibility and performance are architectural budgets

A surface ships against committed budgets — interaction latency, bundle size, accessibility floors — enforced in CI, because they are properties of the architecture, not polish applied at the end. A surface that meets its budget only on a fast laptop has no budget.

## How we apply this

The architect owns the *seam* — the core/surface boundary, the BFF, the decomposition decision, render placement. The design system's content and the surface's UI implementation belong to the design-system and surface-engineer skills; this reference decides where the line sits, not how the button looks.

- [Hexagonal Architecture](hexagonal-architecture.md) — the surface is a driving adapter over the core.
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
