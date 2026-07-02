# Core & Boundaries

The highest-leverage structural decisions an architect makes: where the boundaries fall, which way dependencies point, and how an implementation detail is kept from leaking into the core. Get these right and every downstream change gets cheaper; get them wrong and the cost is paid on every change, forever.

## The core/surface model

Every product is **one capability core** — the domain logic, data, and contracts, always designed and validated headless — plus **zero or more surfaces**: the deployed artifacts consumers touch (web app, CLI, mobile app, MCP server). Surfaces are edges over the core. This classification is load-bearing: the scaffold generates one app per surface, and the core's behaviour is provable with no surface running.

Decide the core's **deployment** early, because it determines contract format and most topology:
- **Hosted** — services reached over a network (a fleet behind a gateway). Contracts are OpenAPI / AsyncAPI / proto.
- **Embedded** — a library in-process with its single surface (a self-contained CLI calling its core directly). The contract is a typed public module API.

Same model, one deployment answer; nothing else branches on it.

## When a boundary is justified

A service boundary earns its existence only when **multiple signals converge**: the language and mental model shift, the runtime or scaling profile is incompatible with the rest, the deployment cadence is fundamentally different. One signal alone is rarely enough. Splitting too finely manufactures operational noise; splitting too coarsely forces incompatible workloads into one deployment. Spend design conversation only where the line is genuinely contestable — an admin panel that owns its own data, a worker that renders user-facing output — not on the obvious cases.

The default is a **modular monolith**: one deployable, strong internal module boundaries, one bounded context per module. The capability-core model is exactly this — a modular core with pluggable surfaces. Treat extracting a microservice as an earned move on a converging-signals case. Name and avoid the **distributed monolith**: services that deploy in lock-step, share a database schema, or call each other synchronously three deep — its tells are a change that touches several services at once, shared tables, and a chain of sync hops where one slow link collapses throughput. Make the **consolidation signal** as first-class as the split test: two services that always change together should be merged back. Boundaries also track teams (Conway's law) — align a bounded context with a stream-aligned team and shape teams to the architecture you want, rather than letting an accidental org chart draw the lines.

## A pure core, dependencies pointing inward

Structure every non-trivial service as a pure decision-making **core** wrapped by a thin **shell** that does I/O. The rules that make it work:

1. **The core depends on nothing concrete.** No framework, no driver, no HTTP library. This is the mechanism, not dogma — a core with framework imports cannot be tested in isolation or reasoned about on its own.
2. **The core owns its abstractions, in its own language** (`Store`, `Embedder`, `Notifier`). The edge conforms to the abstraction; the abstraction is never shaped to the edge's convenience.
3. **Dependencies point inward, and it is enforceable.** An edge implementation may depend on a core abstraction; the core may never depend on an edge. This is automatable in CI (`depguard`, `import-linter`, ESLint rules) — which turns the rule from a style into a guarantee.
4. **No implementation detail leaks inward.** That storage is Postgres, the model is Anthropic, the queue is Kafka must not shape the core's types or signatures. An abstraction expressed in the vendor's terms is a leak in disguise — when the vendor changes, it changes with it.
5. **Abstract at the narrow seam the app actually uses.** A port exposes what the core calls, in the domain's language (`Orders.GetById`, `Orders.Save`, `Embed`) — not a generic `Repository<T>`, whose "generic" is usually a lie told from a sample of one. Design-time rule: simple CRUD → use the ORM directly, no bespoke repository; a rich aggregate with invariants → one repository per aggregate root with domain-named methods; a generic base only once three real aggregates exist, constrained and hidden behind specific ports. Wrap thin clients (a driver, a raw SDK, an LLM API); never re-wrap a tool that already implements the pattern, and never add an interface with one implementation "for mocking."
6. **Keep it shallow.** Three zones — core; abstractions plus the orchestration that uses them; edge implementations — is enough. The "onion with ten rings" is ritual, not rigour.

The pattern is language-native: the rule and the dependency direction are identical across Go, Python, and TypeScript, but each is written the way its own community writes it. For frontends, apply the spirit — isolate network I/O behind a data layer, keep rendering free of fetching.

## The boundary is the test seam

A well-placed boundary tells you what to stand up and what to stub: test the edge implementation against the real thing it wraps; test the core against stubs of the abstractions it consumes. A boundary you cannot test cheaply is usually a boundary in the wrong place.

## Antipatterns to catch at design time

- **Framework-coupled core** — `gin.Context` or `fastapi.Request` in the core. It is no longer the core.
- **Leaked persistence** — a port that returns `IQueryable`, a `DbSet`, or raw rows; an ORM entity standing in as a domain model. Map at the edge.
- **Vendor-shaped ports** — an abstraction that mirrors an SDK, so swapping the vendor means rewriting the port and its callers.
- **Speculative abstraction** — a generic `Repository<T>` justified by a swap that never comes, an interface with one implementation used only by tests (Speculative Generality), a wide wrapper mirroring a vendor SDK. The clean break is real; get it from owned ports + persistence-ignorant models + real-DB tests, not from premature generality.
- **Anaemic core + god service** — data classes with no behaviour and one service that holds every rule. Rules belong on the entities.
- **Boundary by org chart or by noun** — a service per team or per table. Boundaries follow converging technical signals, not the directory you wish existed.
