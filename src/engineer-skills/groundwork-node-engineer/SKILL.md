---
name: groundwork-node-engineer
description: >
  Implement and review Node.js/TypeScript backend service changes using
  self-contained engineering references and the current repository as the
  source of truth. Use for Node backend handlers, Fastify routes, services,
  adapters, domain models, Drizzle schemas and migrations, async patterns,
  streams, worker threads, tests, resilience, or service architecture. This
  skill is the execution router for Node/TypeScript backend work: it loads
  reference docs selectively, preserves core/edge boundaries and the inward
  dependency rule, coordinates with adjacent skills, and verifies changes
  against contracts and tests. Use this skill whenever the user works in a
  Node service directory or asks about Node/TypeScript backend behavior, even
  if they do not explicitly ask for a "node engineer." Anything rendered in a
  browser — Next.js routes, React components — belongs to the Next.js
  engineer skill.
---

# Node Engineer

Node/TypeScript backend execution router for service repositories. Durable engineering guidance lives in `references/`; this skill decides what to load, how to route the task, what repository facts to verify, and which safety gates apply.

## Operating Rules

1. Load reference docs from `references/` for architectural and implementation guidance. Treat the current repository's code, specs, and generated contracts as the source of truth for naming, structure, and behavior.
2. Orient with the repo map and Serena before reading widely (see Required First Checks) — find the hubs, then navigate by symbol. Inspect the current repository before naming packages, commands, import paths, schemas, or generated files.
3. Load the smallest reference set that explains the task. Add more context only when the task crosses a boundary.
4. Preserve the service's dependency direction and public contracts. Code implements OpenAPI, database migrations, event schemas, and documented architecture — it does not invent them.
5. Treat observability as part of the contract, not an afterthought: a critical path emits an unbroken trace, and a missing span is a defect. Route durable engineering policy to the cross-cutting canon under `docs/principles/quality/` and `docs/principles/foundations/` rather than restating it in code comments or this skill.
6. Coordinate with adjacent skills when another skill owns the primary decision surface.

---

## Code intelligence (repo map + Serena)

Orient before reading widely: `.groundwork/skills/code-intelligence.md` covers the repo map (hub-finding by centrality) and Serena (LSP-backed symbol navigation and edits) in full, including degraded mode. TypeScript's compiler catches a missed call site inside the strict-checked tree, so treat `find_referencing_symbols` as a blast-radius and navigation win — until the reference crosses an `any`, an untyped JS module, or a dynamic import, where it is the correctness check the compiler no longer runs.

---

## Required First Checks

Before non-trivial Node implementation or review work:

| Check | Why |
|---|---|
| **Orient first** — see Code intelligence above | A blind file crawl misses the structure the map already computed |
| Service package layout and nearby examples for the touched layer | Prevents inventing structure that already has a convention |
| `package.json` for the Node version (`engines`), `"type": "module"`, and dependencies | Avoids version-specific advice that contradicts the project |
| OpenAPI spec (if HTTP behavior changes) | HTTP contracts are generated — code must match the spec |
| Drizzle schema + drizzle-kit config (if schema changes) | Schema is target-state — migrations are diff-derived from it |
| Event specs (AsyncAPI, Protobuf) for async behavior | Event types drive code generation downstream |

---

## Context Routing

Load only the rows relevant to the current task. Reference files are in the skill's `references/` directory.

| Task shape | Reference to load |
|---|---|
| Any library-version-sensitive shape — HTTP clients, env loading, `__dirname`, module format, test runner | `version-corrections.md` — check first; training data goes stale |
| Any non-trivial service change | `architecture.md`, `node-services.md` |
| Node/TS idioms — ESM layout, config validation, error classes, AbortSignal, graceful shutdown | `node-services.md` |
| Event loop, worker threads, streams, backpressure, promise hygiene | `async-runtime.md` |
| Layer placement, new boundary, dependency direction | `architecture.md` |
| Fastify endpoint, route handler, inbound defenses | `api-standards.md`, `architecture.md` |
| Idempotency, pagination, CORS, load shedding, error mapping | `api-standards.md` |
| Database schemas, migrations, transactions, test isolation, query/index evidence | `database.md` |
| Persistence port shape, raw SQL escape hatch | `database.md` |
| Events, queues, webhooks, async integration | `integration.md` |
| Any write that also publishes — a DB mutation and an event/webhook/queue emission in one unit of work | `integration.md` |
| LLM/AI feature — prompts, evals, output validation, moderation | `docs/principles/ai-native/ai-engineering.md` (canon) |
| Resilience — outbound timeouts, retries, failure isolation | `node-services.md` for the AbortSignal/error shape; retry and circuit-breaker doctrine is canon — `docs/principles/quality/reliability.md` |
| Observability — tracing, structured logging, metrics | `observability.md` |
| Any code that parses user-supplied input — request body, query, upload, webhook payload | `security.md` |
| Outbound HTTP where the URL or host derives from user input (SSRF) | `security.md` |
| Auth, secrets, supply chain | `security.md` |
| Tests, quality gates, coverage strategy, fixture design | `testing.md` |
| Error handling, domain error hierarchy | `node-services.md`, `api-standards.md` |

---

## Skill Handoffs

Keep the Node engineer as lead when the work is mainly Node/TypeScript implementation inside a backend service directory. Two real collaborators in a scaffolded project: inter-service contracts and backend coordination with Go or Python services hand off to those engineer skills, and anything rendered in a browser — Next.js routes, React components, frontend data fetching — hands off to the Next.js engineer skill. For anything else a specialized skill would normally own — API design, database design, real-time architecture, test strategy, platform engineering — no such skill exists in a GroundWork project; handle the concern inline and flag it as outside this skill's primary scope.

---

## Execution Checklist

1. **Identify the touched contract surface** — domain behavior, HTTP contract, database schema, event contract, operational behavior, or tests.
2. **Load minimal routed references** and inspect nearby code before designing.
3. **State important inferences** when guidance comes from general Node/TypeScript knowledge rather than project-specific docs or code.
4. **Implement within existing conventions** — do not create new layer boundaries without evidence from docs or existing code.
5. **Run targeted tests/checks** when feasible. If not feasible, explain the blocker and name the exact command to run later.
6. **Summarize** references consulted, files changed, verification performed, and residual risks.

---

## Safety Gates

### Naming and Boundaries
- Do not invent package paths, command names, contract files, or service boundaries. Verify them in the repository first.
- Do not create new layer boundaries without evidence from docs or existing code.

### Layer Discipline
- Do not put business decisions in route handlers, plugins, adapters, or middleware when the architecture expects them in service code.
- Do not leak adapter-specific types across the core/edge boundary. If a Drizzle table type or an SDK response appears in a core port, the architecture is broken.
- Fastify `Request`/`Reply` objects and the database client never enter the Service or Domain layers.
- Always parse configuration once at startup with a zod schema; scattered `process.env` reads are a defect.

### Inbound Defenses & API Standards
- Do not use offset/limit pagination for collections; enforce cursor-based pagination.
- Do not allow mutating endpoints (POST/PATCH) without an `Idempotency-Key` implementation to prevent duplicate side-effects.
- Do not omit inbound concurrency limits (load shedding); shed load rather than queuing indefinitely.
- Never use wildcard CORS (`origin: "*"` or `origin: true`).

### Error Handling
- Do not log and rethrow the same error at multiple layers. Wrap with domain error classes (carrying `cause`) at the adapter boundary and handle at the entrypoint.
- Map SDK errors to domain error types before retrying.

### Event Loop & Promise Discipline
- Never block the event loop. Synchronous fs/crypto/zlib on the request path is a defect; CPU-heavy work runs in `worker_threads`.
- No floating promises — every promise is awaited or explicitly handed off to a tracked owner the shutdown sequence drains.
- Thread an `AbortSignal` through outbound calls so cancellation and deadlines propagate.

### Contract & Data Integrity
- Do not change HTTP behavior without checking the OpenAPI source.
- Do not hand-write UP/DOWN migrations; the Drizzle schema is target-state and migrations are diff-derived (`drizzle-kit generate`).
- Do not add or modify event types without updating the corresponding event spec.

### Generation
- Do not run code generation manually outside documented generation flows.

---

## Quick Reference

### Domain Error Pattern

| Error class | HTTP | Use |
|---|---|---|
| `NotFoundError` | 404 | Resource lookup miss |
| `UnauthorizedError` | 401 | Missing/invalid auth |
| `ForbiddenError` | 403 | Valid auth, insufficient permission |
| `ConflictError` | 409 | Duplicate resource |
| `ValidationError` | 422 | Field-level validation |
| `TransientUpstreamError` | 503 | Retriable upstream failure |
| `PermanentUpstreamError` | 502 | Non-retriable upstream failure |

### Test Strategy

| Tier | What | Infrastructure |
|---|---|---|
| Service perimeter test (default) | HTTP → Service → Adapter | Testcontainers + composition-root fakes |
| Unit test (reserved) | Dense domain logic | None |
| System test (rare, explicit) | Bootstrap + golden path | Full live stack |

### Ports & Wiring

```ts
// Port — in src/core/ports.ts
export interface OrderStore {
  byId(id: OrderId, signal?: AbortSignal): Promise<Order | null>;
  save(order: Order): Promise<void>;
}

// Adapter — in src/adapters/postgres/order-store.ts
export class PostgresOrderStore implements OrderStore { /* Drizzle inside */ }

// Wiring — in src/entrypoints/server.ts (the composition root), typed as the port
const orderStore: OrderStore = new PostgresOrderStore(db);
const orders = new OrderService(orderStore);
```

---

## Output Expectations

- Name the references or source files that informed non-obvious decisions.
- Separate verified repository facts from recommendations based on general Node/TypeScript knowledge.
- Provide concrete verification commands and results.
- For code reviews: findings first, ordered by severity, with file references and missing-test risks.
- For implementation work: changed files, behavior, tests, and follow-up risks.
