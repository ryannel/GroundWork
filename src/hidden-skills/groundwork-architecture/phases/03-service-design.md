# Phase 3: Service Design

Decide how the system is divided into services and what each one owns. This decision determines deployment independence, operational complexity, and every integration contract downstream. Getting the boundaries wrong is expensive to undo.

The goal is right-sized services — few enough to avoid distributed systems overhead, well-defined enough that each can be deployed and scaled independently. Splitting too finely creates operational noise for no benefit. Splitting too coarsely forces incompatible workloads into a single deployment.

**Apply from the architect references:** `core-and-boundaries.md` — the converging-signals test for when a boundary is justified, the core/surface model, and the inward-dependency rule that keeps the domain clean. This is the persona's core reference; load it before proposing the service map.

A service boundary is justified when multiple signals converge: the language and mental model shift, the runtime or scaling profile is incompatible with the rest, or the deployment cadence is fundamentally different. One signal alone is rarely enough.

**The core/surface classification.** Every product is one **capability core** — the domain logic, data, and contracts, always designed and validated headless — plus zero or more **surfaces**, the deployed artifacts consumers interact with: a web app, a CLI binary, a mobile app, an MCP server. Surfaces are adapters over the core. The service map carries this classification because downstream phases read it: the scaffold generates one app per surface, and the bet loop proves capability behaviour against the core's contracts with no surface running.

The core's **deployment** is decided here too: **hosted** (services reached over a network) or **embedded** (a library in-process with its single surface). A service fleet behind a gateway is a hosted core; a self-contained CLI is an embedded core its command layer calls in-process — the same model with one deployment answer. The decision determines the contract spec format downstream (OpenAPI/AsyncAPI for hosted HTTP/event boundaries, a typed public module API for an embedded core); nothing else branches on it.

**How to run this conversation:**

Start by sharing your current read of the system from the existing documents. Then explore with the user where the natural fault lines are — where the work feels different, where the technology or scaling needs diverge.

Propose the service map in text form: for each component, what it owns, why the boundary sits where it does, whether it is a core service or a surface app, and a name following modern service naming conventions. The surface set comes from the product brief's summary — propose the classification rather than interrogating for it. For most products it is obvious (each client app is a surface; everything that owns domain logic or persistence is core), and for a single-surface product it settles in the same exchange as the service map. Spend conversation only where the line is genuinely contestable — an admin panel that owns its own data, a worker that renders user-facing output. Propose the core's deployment alongside the classification: one surface over an in-process core is embedded; anything reached over a network is hosted. Confirm before moving on.
