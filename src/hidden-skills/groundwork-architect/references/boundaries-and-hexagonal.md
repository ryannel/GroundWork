# Service Boundaries & Hexagonal Structure

The single highest-leverage structural decision. Get the boundaries and the dependency direction right and every downstream choice gets easier; get them wrong and the cost is paid on every change, forever.

## The core/surface model

Every product is **one capability core** — the domain logic, data, and contracts, always designed and validated headless — plus **zero or more surfaces**: the deployed artifacts consumers touch (web app, CLI, mobile app, MCP server). Surfaces are adapters over the core. This classification is load-bearing: the scaffold generates one app per surface, and capability behaviour is provable with no surface running.

Decide the core's **deployment** early, because it determines contract format and most topology:
- **Hosted** — services reached over a network (a fleet behind a gateway). Contracts are OpenAPI / AsyncAPI / proto.
- **Embedded** — a library in-process with its single surface (a self-contained CLI calling its core directly). The contract is a typed public module API.

It is the same model with one deployment answer; nothing else branches on it.

## When a boundary is justified

A service boundary earns its existence only when **multiple signals converge**:
- the language and mental model shift,
- the runtime or scaling profile is incompatible with the rest,
- the deployment cadence is fundamentally different.

One signal alone is rarely enough. Right-sized means few enough to avoid distributed-systems overhead, well-defined enough that each deploys and scales independently. Splitting too finely manufactures operational noise for no benefit; splitting too coarsely forces incompatible workloads into one deployment. Spend conversation only where the line is genuinely contestable — an admin panel that owns its own data, a worker that renders user-facing output — not on the obvious cases.

## Default to a modular monolith; watch the distributed monolith

The 2026 default is a **modular monolith** — one deployable with strong internal module boundaries (one bounded context per module) — and microservice extraction is an *earned* move, made when a converging-signals case appears, not a starting posture. The capability-core model is exactly this: a modular core with pluggable surfaces.

The failure mode to name and avoid is the **distributed monolith** — services that must deploy in lock-step, share a database schema, or call each other synchronously three deep. Its tells: a change touches several services at once, services share tables, a chain of sync hops where one slow link collapses throughput. Distribution bought the operational cost of microservices and none of the independence.

So make the **consolidation signal** as first-class as the split test: a boundary that was drawn wrong — two services that always change together, a chatty sync seam — should be *merged back*. The right question is "do these deploy, scale, and change independently?", and the honest answer sometimes argues for fewer services.

Boundaries also track teams: per **Conway's law**, the system mirrors the org's communication structure, so align a bounded context with a **stream-aligned team** (Team Topologies) and use the Reverse Conway maneuver — shape the teams to the architecture you want — rather than letting an accidental org chart draw the boundaries.

## The hexagon: dependencies flow inward

Structure every non-trivial service as a hexagon — a domain core surrounded by ports (interfaces) and adapters (edge implementations). The rule that makes it work:

1. **The domain depends on nothing.** No framework, no driver, no HTTP library. This is the mechanism, not dogma — a domain with framework imports cannot be tested in isolation or reasoned about independently.
2. **Ports are interfaces owned by the domain**, expressed in the domain's language (`Repository`, `EventPublisher`, `ModelClient`). The adapter conforms to the port; the port is never shaped for the adapter's convenience.
3. **Adapters live at the edges and are interchangeable.** Swapping Postgres for another store should touch zero domain code. If it touches more, the port is leaking implementation detail.
4. **Dependencies flow inward, and it is enforceable.** An adapter may depend on a port; the domain may never depend on an adapter. This is automatable in CI (`depguard`, `import-linter`, ESLint rules) — which turns "hexagonal" from a style into a guarantee.
5. **Application services orchestrate; they do not hold business rules.** Rules live on the domain entity so they stay portable across drivers (CLI, HTTP, background job).
6. **Keep the hexagon shallow.** Three conceptual zones — domain; ports + application services; adapters — is enough. The "onion with ten rings" is ritual, not rigour.

Why it matters for an agent-led codebase: in a hexagonal layout every file has a determined place, so "where does this code live?" is already answered. That collapses the decision space and produces code that reliably matches the existing shape.

The pattern is language-agnostic — file conventions differ across Go, Python, TypeScript, but the structure and the inward-dependency rule are identical everywhere. For frontends, apply the spirit: isolate network I/O behind a data layer, keep rendering logic free of fetching concerns.

## Ports are the test seam

Hexagonal tells you what to test with a real container and what to stub: test the adapter against the real thing it wraps; test the application service against stubs of the ports it consumes. A boundary you cannot test cheaply is usually a boundary in the wrong place.

## Antipatterns to catch at design time

- **Framework-coupled domain** — `gin.Context` or `fastapi.Request` in the domain. It is no longer the domain.
- **Anaemic domain + god application service** — data classes with no behaviour and one service that knows every rule. Rules belong on the entities.
- **Leaky ports** — a concrete driver type in a port signature. A database interface wearing a costume.
- **Pragmatic layer-skipping** — handlers talking straight to repositories "because it's a simple endpoint." This is how architecture erodes, one endpoint at a time.
- **Per-adapter domain types** — different entity definitions in domain, persistence, and API layers. Map across boundaries explicitly in the adapter instead.
- **Boundary by org chart or by noun** — a service per team or per table. Boundaries follow converging technical signals, not the directory you wish existed.
