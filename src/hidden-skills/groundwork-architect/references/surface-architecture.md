# Surface Architecture

A surface — web, mobile, CLI, desktop, an agent UI — is an adapter over the capability core, not a home for business logic. The architect owns the **seam**: how the surface reaches the core, how a large surface decomposes, where rendering runs, and where the design-system contract sits. (UI implementation belongs to the surface-engineer skills; design language to the design-system skill — this reference decides where the line is, not how the button looks.)

## Surfaces are adapters over the core

A surface renders state and orchestrates calls to the core's contracts; it holds no domain rules. If a rule must hold on every surface, it lives in the core — a surface that re-implements pricing, validation, or a state machine is a drift waiting to happen. The core is designed headless and proven with no surface running.

## The backend-for-frontend shapes the contract per surface

Each surface gets a thin **BFF** that adapts the core's contracts to what that surface needs — aggregating, trimming, reshaping — so the client is not stitching six calls or over-fetching a viewport. React Server Components act as a built-in BFF for a web surface. Keep it an adapter: the moment business rules accrete in the BFF, it has become a shadow core.

## Render on the server / edge by default

Push rendering and data assembly server-side or to the edge; ship the client the least work it can do. Server-first flattens latency, shrinks the JS payload, and keeps data-fetching boundaries explicit. Reach for heavy client state only where genuine interactivity demands it ([performance-and-scale.md](performance-and-scale.md) on compute placement).

## Decompose a large surface by domain, right-sized

A surface decomposes like services do — by bounded domain, only when teams or load demand it. **Micro-frontends** / **islands** are for independent teams shipping parts of one surface autonomously; for most products a single well-structured surface is simpler and correct. The distributed-monolith failure mode has a front-end twin: many micro-frontends that must deploy in lock-step. Apply the same converging-signals discipline as [core-and-boundaries.md](core-and-boundaries.md).

## The design system is a contract

Tokens and components are a versioned contract across every surface, not decoration — the single source of visual and interaction truth a surface consumes rather than re-invents. Design-system-as-architecture is what keeps many screens and platforms feeling like one product.

## The contract presumes no surface

The core's contract serves every surface and presumes none — a session assumption in a response, markup where data belongs, viewport-sized pagination is the bug the next surface hits ([api-and-contracts.md](api-and-contracts.md)). An agent driving the interface via **AG-UI** is itself a surface type, and the most demanding test of a surface-neutral contract.

## Budgets are architectural

A surface ships against committed budgets — interaction latency, bundle size, accessibility floors — enforced in CI as a fitness function, because they are properties of the architecture, not end-of-project polish.

## Antipatterns to catch

- **Business logic in the surface** — a rule that will drift from the core.
- **The fat BFF** — a backend-for-frontend grown into a shadow core.
- **Micro-frontends by default** — distributing one surface across teams that don't need it, deployed in lock-step.
- **Re-invented design system** — each screen styling its own components.
- **Viewport-shaped contracts** — a response only the current layout can consume.
- **Client-heavy by reflex** — a megabyte of JS to render what the server could have sent.
