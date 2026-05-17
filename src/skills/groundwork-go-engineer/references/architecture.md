# Hexagonal Architecture

## Dependency Rule

Dependencies flow inward. The domain depends on nothing; adapters depend on the domain through ports.

## Layers

| Layer | Location | Depends on | Contains |
|---|---|---|---|
| **Domain** | `internal/core/domain` | Nothing | Entities, value objects, validation, sentinel errors |
| **Gateways (Ports)** | `internal/core/gateway` | Domain only | Interfaces describing external capabilities |
| **Services** | `internal/core/service` | Domain + Gateways | Business orchestration, use-case coordination |
| **Providers (Adapters)** | `internal/provider` | Domain + Gateways | Concrete implementations (Postgres, Pub/Sub, HTTP clients) |
| **Entrypoints (Driving Adapters)** | `internal/entrypoints` | Domain + Services | HTTP routes, middleware, WebSocket handlers |

## Structural Invariants

- The domain imports no framework, no driver, no HTTP library, no SQL client.
- Ports are interfaces owned by the domain, declared in domain language.
- Adapters are interchangeable — swapping Postgres for another store requires zero domain changes.
- The application service orchestrates; it does not contain business rules. Rules live on entities.
- Three conceptual zones: domain, ports + services, adapters. More layers are ritual, not rigour.

## Dependency Enforcement

Automate with `depguard` or equivalent import-linter rules in CI. Code that violates the inward-flow rule fails the build.

## Anti-Patterns

- **Framework-coupled domain.** If the domain imports `gin.Context` or any HTTP type, the domain is broken.
- **Anaemic domain models.** Data structs with no behaviour and a thick service that knows all the rules.
- **Leaky ports.** A port with `*sql.DB` in its signature is a Postgres interface wearing a costume.
- **Layer-skipping.** Handlers that talk directly to repositories because "it is just a simple endpoint."
- **Per-adapter domain types.** Different entity definitions across layers. Map explicitly in the adapter.
- **Over-layering.** Five layers of DTO translation between HTTP and the domain. Adapters are thin.

## Test Seams

Hexagonal makes the core domain trivially testable without infrastructure — every outbound dependency is a port that can be stubbed. Test the adapter against the real thing it wraps; test the service against stubs of the ports it consumes.
