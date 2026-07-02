---
name: groundwork-go-engineer
description: >
  Implement and review Go service changes using self-contained engineering
  references and the current repository as the source of truth. Use for Go
  backend handlers, services, providers, domain models, migrations, telemetry,
  structured logging, dependency injection, tests, concurrency, or service
  architecture. This skill is the execution router for Go backend work: it loads
  reference docs selectively, preserves core/edge boundaries and the inward
  dependency rule, coordinates with adjacent skills, and verifies changes
  against contracts and tests. Use this
  skill whenever the user works in a Go service directory or asks about Go
  backend behavior, even if they do not explicitly ask for a "go engineer."
---

# Go Engineer

Go backend execution router for service repositories. Durable engineering guidance lives in `references/`; this skill decides what to load, how to route the task, what repository facts to verify, and which safety gates apply.

## Operating Rules

1. Load reference docs from `references/` for architectural and implementation guidance. Treat the current repository's code, specs, and generated contracts as the source of truth for naming, structure, and behavior.
2. Orient with the repo map and Serena before reading widely (see Required First Checks) — find the hubs, then navigate by symbol. Inspect the current repository before naming packages, commands, import paths, schemas, or generated files.
3. Load the smallest reference set that explains the task. Add more context only when the task crosses a boundary.
4. Preserve the service's dependency direction and public contracts. Code implements OpenAPI, database migrations, event schemas, and documented architecture — it does not invent them.
5. Treat observability as part of the contract, not an afterthought: a critical path emits an unbroken trace, and a missing span is a defect. Route durable engineering policy to the canonical docs (`docs/principles/stack/go/`, and the cross-cutting canon under `docs/principles/quality/` and `docs/principles/foundations/`) rather than restating it in code comments or this skill.
6. Coordinate with adjacent skills when another skill owns the primary decision surface.

---

## Code intelligence (repo map + Serena)

Orient before reading widely: `.groundwork/skills/code-intelligence.md` covers the repo map (hub-finding by centrality) and Serena (LSP-backed symbol navigation and edits) in full, including degraded mode. Go's compiler already catches a missed call site, so treat `find_referencing_symbols` as a blast-radius and navigation win, not a correctness gate.

---

## Required First Checks

Before non-trivial Go implementation or review work:

| Check | Why |
|---|---|
| **Orient first** — see Code intelligence above | A blind file crawl misses the structure the map already computed |
| Service package layout and nearby examples for the touched layer | Prevents inventing structure that already has a convention |
| `go.mod` for Go and dependency versions | Avoids version-specific advice that contradicts the project |
| OpenAPI spec (if HTTP behavior changes) | HTTP contracts are generated — code must match the spec |
| Database schema file + migration tooling (if schema changes) | Schema is target-state — migrations derive from it |
| Event specs (AsyncAPI, Protobuf, etc.) for async/real-time behavior | Event types drive code generation downstream |

---

## Context Routing

Load only the rows relevant to the current task. Reference files are in the skill's `references/` directory.

| Task shape | Reference to load |
|---|---|
| Any non-trivial service change | `architecture.md`, `implementation-patterns.md`, `go-services.md` |
| Go idioms, context, interfaces, DI, errors, config validation | `go-services.md` |
| Concurrency, goroutine lifecycle, errgroup, context cancellation | `concurrency.md` |
| Layer placement, new boundary, dependency direction | `architecture.md` |
| Capability interface + provider (LLM etc.), generated adapter shape, bare-interface bet, `add-capability` | `capability-ports.md`, `architecture.md` |
| HTTP endpoint, handler, idempotency, CORS | `http-handlers.md`, `api-design.md` |
| Database repository, SQL, declarative schema, test isolation | `postgres.md` |
| Observability — tracing, structured logging, metrics | `observability.md` |
| Reliability — retries, timeouts, graceful shutdown, backpressure | `reliability-performance.md` |
| Performance — latency budgets, load shedding, profiling | `reliability-performance.md` |
| Events, Pub/Sub, WebSocket, async integration | `integration.md` |
| Any write that also publishes — a DB mutation and an event/webhook/queue emission in one unit of work | `integration.md` |
| Tests, quality gates, coverage strategy, flake triage | `testing.md` |
| Code quality, naming, simplicity, deletion | `code-craft-security.md` |
| Any code that parses user-supplied input — request body, query, upload, webhook payload | `code-craft-security.md` |
| Outbound HTTP where the URL or host derives from user input (SSRF) | `code-craft-security.md` |
| Auth, secrets, supply chain | `code-craft-security.md` |
| Doc comments, naming-as-documentation, godoc, comment-is-a-smell | `documentation.md` |

---

## Skill Handoffs

Keep the Go engineer as lead when the work is mainly Go implementation inside a service directory. The one real collaborator in a scaffolded project: Python backend coordination and inter-service contracts hand off to the Python engineer skill. For anything else a specialized skill would normally own — API design, database design, real-time architecture, test strategy, platform engineering — no such skill exists in a GroundWork project; handle the concern inline and flag it as outside this skill's primary scope.

---

## Execution Checklist

1. **Identify the touched contract surface** — domain behavior, HTTP contract, database schema, event contract, operational behavior, or tests.
2. **Load minimal routed references** and inspect nearby code before designing.
3. **State important inferences** when guidance comes from general Go knowledge rather than project-specific docs or code.
4. **Implement within existing conventions** — do not create new layer boundaries without evidence from docs or existing code.
5. **Run targeted tests/checks** when feasible. If not feasible, explain the blocker and name the exact command to run later.
6. **Summarize** references consulted, files changed, verification performed, and residual risks.

---

## Safety Gates

These constraints prevent the most common classes of architectural damage in Go services.

### Naming and Boundaries
- Do not invent package paths, command names, contract files, or service boundaries. Verify them in the repository first.
- Do not create new layer boundaries without evidence from docs or existing code.

### Layer Discipline
- Do not put business decisions in handlers, edge implementations, middleware, migrations, or generated code when the architecture expects them in domain/service code.
- Do not leak implementation-specific types across the core/edge boundary. If a database driver type appears in a core interface, the architecture is broken.
- Always validate configuration at startup (e.g., `envconfig`); do not scatter `os.Getenv` throughout the codebase.

### Inbound Defenses & API Standards
- Do not use offset/limit pagination for collections; enforce cursor-based pagination.
- Do not allow mutating endpoints (POST/PATCH) without an `Idempotency-Key` implementation to prevent duplicate side-effects.
- Do not omit inbound concurrency limits (load shedding); shed load rather than queuing indefinitely.
- Never use wildcard CORS (`AllowedOrigins: []string{"*"}`).

### Error Handling
- Do not log and return the same error at multiple layers. Wrap errors with context and log at the boundary established by existing code.

### Concurrency
- Do not launch untracked goroutines. Verify cancellation, error collection, and shutdown behavior for every concurrent operation.

### Contract & Data Integrity
- Do not change HTTP behavior without checking the OpenAPI source and any generated-client workflow.
- Do not change database behavior without checking the target-state schema, the migration workflow, and dry-run output when feasible. Use declarative schemas.
- Do not add or modify domain event types without updating the corresponding event spec.

### Generation
- Do not run code generation manually outside documented generation flows.

---

## Quick Reference

Frequently needed patterns. Verify against the actual repository before using them.

### Domain Error Pattern

| Sentinel pattern | HTTP mapping | Use |
|---|---|---|
| `ErrNotFound` | 404 | Resource lookup miss |
| `ErrUnauthorized` | 401 | Missing or invalid auth |
| `ErrForbidden` | 403 | Valid auth, insufficient permission |
| `ErrConflict` | 409 | Duplicate resource |
| `ErrPayloadTooLarge` | 413 | File exceeds size/duration limit |
| `ErrInvalidFormat` | 415 | Input format validation failure |
| `ErrValidation` (catch-all) | 422 | Field-level validation failures |

### Mock Pattern

Hand-written mocks with settable `Func` fields. Read the mock file before writing tests — function signatures often include parameters easy to miss from the interface alone.

### Event Broadcast Pattern

Domain mutations broadcast via an event hub in service methods. For testing, use a mock event hub and assert captured events. Async events use a transactional outbox pattern.

### Idempotency Middleware

Caches responses by key + user ID. For tests, implement an in-memory repository rather than depending on the production store.

---

## Output Expectations

- Name the references or source files that informed non-obvious decisions.
- Separate verified repository facts from recommendations based on general Go knowledge.
- Provide concrete verification commands and results.
- For code reviews: findings first, ordered by severity, with file references and missing-test risks.
- For implementation work: changed files, behavior, tests, and follow-up risks.
