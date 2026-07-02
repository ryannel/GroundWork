---
name: groundwork-python-engineer
description: >
  Implement and review Python service changes using self-contained engineering
  references and the current repository as the source of truth. Use for Python
  backend handlers, services, providers, domain models, ML pipelines, FastAPI
  routes, async patterns, dependency injection, tests, resilience, or service
  architecture. This skill is the execution router for Python backend work: it
  loads reference docs selectively, preserves core/edge boundaries and the
  inward dependency rule, coordinates with adjacent skills, and verifies
  changes against contracts and tests. Use
  this skill whenever the user works in a Python service directory or asks about
  Python backend / ML engineering, even if they do not explicitly ask for a
  "python engineer."
---

# Python Engineer

Python backend execution router for service repositories. Durable engineering guidance lives in `references/`; this skill decides what to load, how to route the task, what repository facts to verify, and which safety gates apply.

## Operating Rules

1. Load reference docs from `references/` for architectural and implementation guidance. Treat the current repository's code, specs, and generated contracts as the source of truth for naming, structure, and behavior.
2. Orient with the repo map and Serena before reading widely (see Required First Checks) — find the hubs, then navigate by symbol. Inspect the current repository before naming packages, commands, import paths, schemas, or generated files.
3. Load the smallest reference set that explains the task. Add more context only when the task crosses a boundary.
4. Preserve the service's dependency direction and public contracts. Code implements OpenAPI, database migrations, event schemas, and documented architecture — it does not invent them.
5. Treat observability as part of the contract, not an afterthought: a critical path emits an unbroken trace, and a missing span is a defect. Route durable engineering policy to the canonical docs (`docs/principles/stack/python/`, and the cross-cutting canon under `docs/principles/quality/` and `docs/principles/foundations/`) rather than restating it in code comments or this skill.
6. Coordinate with adjacent skills when another skill owns the primary decision surface.

---

## Code intelligence (repo map + Serena)

Orient before reading widely: `.groundwork/skills/code-intelligence.md` covers the repo map (hub-finding by centrality) and Serena (LSP-backed symbol navigation and edits) in full, including degraded mode. Python has no compiler to catch a missed call site, so treat `find_referencing_symbols` as the pre-runtime correctness check — skipping it on a changed signature ships a runtime error.

---

## Required First Checks

Before non-trivial Python implementation or review work:

| Check | Why |
|---|---|
| **Orient first** — see Code intelligence above | A blind file crawl misses the structure the map already computed |
| Service package layout and nearby examples for the touched layer | Prevents inventing structure that already has a convention |
| `pyproject.toml` for Python version and dependencies | Avoids version-specific advice that contradicts the project |
| OpenAPI spec (if HTTP behavior changes) | HTTP contracts are generated — code must match the spec |
| Pydantic models for domain and request/response types | Boundary validation is the code; must not be duplicated |
| Event specs (AsyncAPI, Protobuf) for async behavior | Event types drive code generation downstream |

---

## Context Routing

Load only the rows relevant to the current task. Reference files are in the skill's `references/` directory.

| Task shape | Reference to load |
|---|---|
| Any non-trivial service change | `architecture.md`, `implementation-patterns.md` |
| Async, event loop, TaskGroup, lifespan, background tasks | `async-patterns.md` |
| Layer placement, new boundary, dependency direction | `architecture.md` |
| FastAPI endpoint, route handler, inbound defenses | `architecture.md`, `api-standards.md` |
| Idempotency, pagination, CORS, load shedding | `api-standards.md` |
| Database schemas, migrations, test isolation, DB sessions, query/index evidence | `database.md` |
| Events, Pub/Sub, webhooks, async integration | `integration.md` |
| Any write that also publishes — a DB mutation and an event/webhook/queue emission in one unit of work | `integration.md` |
| ML pipeline, inference, embedding, RAG, streaming | `ml-pipelines.md` |
| ML systems architecture, model serving, evals, prompts | `ml-systems-ai-engineering.md` |
| AI engineering, context design, agent architecture, moderation gates | `ml-systems-ai-engineering.md` (defers to `docs/principles/ai-native/ai-engineering.md`) |
| MCP server, tool/resource design, agent interfaces | `documentation-mcp.md` |
| Resilience — timeouts, retries, circuit breakers, health probes | `resilience.md` |
| Performance — latency budgets, load shedding, profiling | `resilience.md` |
| Graceful shutdown, degradation, lifespan management | `resilience.md`, `async-patterns.md` |
| Observability — tracing, structured logging, metrics | `observability.md` |
| Any code that parses user-supplied input — request body, query, upload, webhook payload | `security.md` |
| Outbound HTTP where the URL or host derives from user input (SSRF) | `security.md` |
| Auth, secrets, supply chain | `security.md` |
| Tests, quality gates, coverage strategy, fixture design | `testing.md` |
| Code documentation, docstrings, Pydantic Field docs | `documentation-mcp.md` |
| Error handling, exception hierarchy, domain errors | `implementation-patterns.md` |
| Dependency injection, Protocol ports, wiring | `implementation-patterns.md`, `architecture.md`, `database.md` |
| Capability port + provider (LLM etc.), generated adapter shape, bare-port bet, `add-capability` | `capability-ports.md`, `architecture.md` |

---

## Skill Handoffs

Keep the Python engineer as lead when the work is mainly Python implementation inside a service directory. The one real collaborator in a scaffolded project: Go backend coordination and inter-service contracts hand off to the Go engineer skill. For anything else a specialized skill would normally own — API design, database design, real-time architecture, test strategy, platform engineering — no such skill exists in a GroundWork project; handle the concern inline and flag it as outside this skill's primary scope.

---

## Execution Checklist

1. **Identify the touched contract surface** — domain behavior, HTTP contract, event contract, ML pipeline, or tests.
2. **Load minimal routed references** and inspect nearby code before designing.
3. **State important inferences** when guidance comes from general Python knowledge rather than project-specific docs or code.
4. **Implement within existing conventions** — do not create new layer boundaries without evidence from docs or existing code.
5. **Run targeted tests/checks** when feasible. If not feasible, explain the blocker and name the exact command to run later.
6. **Summarize** references consulted, files changed, verification performed, and residual risks.

---

## Safety Gates

### Naming and Boundaries
- Do not invent package paths, command names, contract files, or service boundaries. Verify them in the repository first.
- Do not create new layer boundaries without evidence from docs or existing code.

### Layer Discipline
- Do not put business decisions in entrypoints, adapters, or middleware when the architecture expects them in service code.
- Do not leak adapter-specific types across the core/edge boundary. If an SDK response type appears in a core port, the architecture is broken.
- FastAPI `Depends`, `Request`, `Session` objects never enter the Service or Domain layers.
- Always use `pydantic-settings` to validate configuration at startup.

### Inbound Defenses & API Standards
- Do not use offset/limit pagination for collections; enforce cursor-based pagination.
- Do not allow mutating endpoints (POST/PATCH) without an `Idempotency-Key` implementation to prevent duplicate side-effects.
- Do not omit inbound concurrency limits (load shedding); shed load rather than queuing indefinitely.
- Never use wildcard CORS (`allow_origins=["*"]`).

### Error Handling
- Do not log and re-raise the same error at multiple layers. Wrap errors with domain exceptions at the adapter boundary and handle at the entrypoint.
- Map SDK errors to domain exception types before retrying.

### Async Discipline
- Do not block the event loop. Use `asyncio.to_thread` for synchronous operations.
- Do not use bare `asyncio.create_task`. Use `asyncio.TaskGroup`.
- Do not initialise async resources at module level. Use FastAPI `lifespan`.

### Contract & Data Integrity
- Do not change HTTP behavior without checking the OpenAPI source.
- Do not change Pydantic models that are part of the public API without checking downstream consumers.
- Do not add or modify event types without updating the corresponding event spec.
- Do not use manual UP/DOWN migrations; enforce declarative schema management (e.g., `schema.sql` + diffing engine).

### ML Pipeline Integrity
- Do not trust model outputs without boundary validation (shape, length, content).
- Do not hardcode confidence thresholds — use configuration.
- Do not embed one item at a time — batch API calls.
- Prompts are code. They live in version control and are covered by evals.

### Generation
- Do not run code generation manually outside documented generation flows.

---

## Quick Reference

### Domain Error Pattern

| Exception | HTTP | Use |
|---|---|---|
| `NotFoundError` | 404 | Resource lookup miss |
| `UnauthorizedError` | 401 | Missing/invalid auth |
| `ForbiddenError` | 403 | Valid auth, insufficient permission |
| `ConflictError` | 409 | Duplicate resource |
| `ValidationError` | 422 | Field-level validation |
| `TransientInferenceError` | 503 | Retriable provider failure |
| `PermanentInferenceError` | 400/500 | Non-retriable provider failure |

### Test Strategy

| Tier | What | Infrastructure |
|---|---|---|
| Service perimeter test (default) | HTTP → Service → Adapter | Testcontainers + `dependency_overrides` |
| Unit test (reserved) | Complex domain logic | None |
| System test (rare, explicit) | Bootstrap + golden path | Full live stack |

### Dependency Injection

```python
# Port — in src/<package>/core/ports.py
class Processor(Protocol):
    async def process(self, uri: str) -> Result: ...

# Adapter — in src/<package>/adapters/
class ConcreteProcessor:
    async def process(self, uri: str) -> Result: ...

# Wiring — in entrypoints/ or dependencies.py, typed as the port
def get_service() -> ProcessingService:
    return ProcessingService(processor=ConcreteProcessor())
```

---

## Output Expectations

- Name the references or source files that informed non-obvious decisions.
- Separate verified repository facts from recommendations based on general Python knowledge.
- Provide concrete verification commands and results.
- For code reviews: findings first, ordered by severity, with file references and missing-test risks.
- For implementation work: changed files, behavior, tests, and follow-up risks.
