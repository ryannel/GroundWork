# Clean Architecture for Python Services

## Dependency Rule

Dependencies flow inward. Inner layers never import from outer layers.

## Layers

| Layer | Location | Depends on | Contains |
|---|---|---|---|
| **Domain** | `src/<pkg>/core/domain` | Nothing (stdlib + Pydantic only) | Pydantic/dataclass entities, value objects, exceptions, constants |
| **Gateways (Ports)** | `src/<pkg>/core/gateways` | Domain only | `typing.Protocol` or `abc.ABC` definitions describing capabilities |
| **Services** | `src/<pkg>/core/services` | Domain + Gateways | Use-case orchestration, workflow coordination |
| **Providers (Adapters)** | `src/<pkg>/providers/` | Domain + Gateways | Concrete implementations (Postgres, external APIs, message brokers) |
| **Entrypoints** | `src/<pkg>/entrypoints/` | Domain + Services | FastAPI routes, CLI, Pub/Sub consumers, MCP servers |

## Structural Invariants

- The Domain imports no framework, no SDK, no database driver, no HTTP library. Pydantic and stdlib only.
- Gateways define _what_ (e.g., `store`, `transcribe`), never _how_. Signatures use Domain entities exclusively.
- Gateways use generic names: `publish(msg: Message)`, not `send_to_sqs(msg: Message)`.
- Services depend on Gateways (Protocols), not concrete Providers. Return concrete Domain objects.
- Providers map external SDK responses into Domain entities. Catch library-specific errors and raise Domain exceptions.
- Entrypoints validate inputs, map request schemas to Domain objects, and delegate all business decisions to Services.
- All concrete Provider-to-Service wiring happens at the outermost edge (entrypoint startup or a dedicated `container.py`).

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

- **Framework-coupled domain.** If the domain imports FastAPI or SQLAlchemy, it is broken.
- **Leaky ports.** A gateway with SDK types in its signature is a provider in disguise.
- **Anaemic domain models.** Data structs with no behaviour and a thick service.
- **Over-layering.** Five layers of DTO translation. Adapters are thin.
- **Layer-skipping.** Entrypoints talking directly to providers.
