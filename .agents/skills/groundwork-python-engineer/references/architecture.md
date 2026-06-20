# A Pure Core, Swappable Edges (Python)

## Dependency Rule

Dependencies flow inward. The core never imports from the edge. `import-linter` (a `[tool.importlinter]` contract in `pyproject.toml`) makes this a real gate: it forbids `<package>.core` (and `<package>.core.*`) from importing `<package>.adapters`, `<package>.entrypoints`, `fastapi`, or `sqlalchemy`, and a `<package>.core` → `<package>.adapters` import fails `lint-imports`.

## Where code lives

`src/` holds the importable package `src/<package>/` (src-layout); `<package>` is the service name in snake_case. The pieces (paths relative to `src/<package>/`):

| Zone | Location | Depends on | Contains |
|---|---|---|---|
| **Domain** | `src/<package>/core/domain` | Nothing (stdlib + Pydantic only) | Pydantic/dataclass entities, value objects, exceptions, constants |
| **Ports** | `src/<package>/core/ports.py` (+ per-capability modules like `src/<package>/core/llm.py`) | Domain only | `typing.Protocol` (default) or `abc.ABC` definitions describing the capabilities the core consumes |
| **Services** | `src/<package>/core/service` | Domain + Ports | Use-case orchestration, workflow coordination |
| **Adapters** | `src/<package>/adapters/` | Domain + Ports | Concrete implementations (Postgres, external APIs, message brokers) |
| **Entrypoints** | `src/<package>/entrypoints/` | Domain + Services | FastAPI routes, CLI, Pub/Sub consumers, MCP servers |

## Structural Invariants

- The Domain imports no framework, no SDK, no database driver, no HTTP library. Pydantic and stdlib only.
- Ports define _what_ (e.g., `store`, `transcribe`), never _how_. Signatures use Domain entities exclusively.
- Ports use domain names: `publish(msg: Message)`, not `send_to_sqs(msg: Message)`.
- Services depend on ports (Protocols), not concrete adapters. Return concrete Domain objects.
- Adapters map external SDK responses into Domain entities. Catch library-specific errors and raise Domain exceptions.
- Entrypoints validate inputs, map request schemas to Domain objects, and delegate all business decisions to Services.
- All concrete adapter-to-service wiring happens at the outermost edge (entrypoint startup or a dedicated `dependencies.py` / `container.py`).

## Dependency Injection

- **Constructor injection** via `__init__` for all dependencies.
- **Explicit lifecycles**: initialise database clients in FastAPI's `lifespan` context manager, not at module level.
- **No DI frameworks**: wiring is manual, explicit, and visible at the composition root.

## Integrity Testing

### Bootstrap Verification
A test in `tests/system/test_bootstrap.py` initialises the full dependency tree. Catches missing env vars and wiring failures before production.

### Golden Path System Tests
Run a live instance against real infrastructure via Testcontainers. Zero mocks. Verify the critical success paths end-to-end.

## Engineering Standards

1. **Pydantic everywhere.** Use Pydantic for all data boundaries (request/response and domain).
2. **Structured logging.** Use `structlog` or equivalent — never bare `print`.
3. **Acyclic dependencies.** Import cycles are an immediate signal of leaked layer responsibilities.
4. **Strict boundaries.** FastAPI `Depends`, `Request`, `Session` objects never enter the Service or Domain layers.
5. **Clean containers.** Always call `container.stop()` or equivalent in pytest fixtures.

## Anti-Patterns

- **Framework-coupled domain.** If the core imports FastAPI or SQLAlchemy, it is broken.
- **Leaky ports.** A port with SDK types in its signature is an adapter in disguise.
- **Anaemic domain models.** Data structs with no behaviour and a thick service.
- **Over-layering.** Five layers of DTO translation. Adapters are thin.
- **Layer-skipping.** Entrypoints talking directly to adapters.
