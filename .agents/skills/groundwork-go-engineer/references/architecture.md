# Service Structure: A Pure Core, Swappable Edges

## Dependency Rule

Dependencies flow inward. The core depends on nothing concrete; the edge implementations depend on the core through the interfaces it owns.

## Where code lives

| Zone | Location | Depends on | Contains |
|---|---|---|---|
| **Domain** | `internal/core/domain` | Nothing | Entities, value objects, validation, sentinel errors |
| **Core service** | `internal/core/service` | Domain | Application orchestration **and** the interfaces it consumes (`Repository`, `MessageQueue`, `TextGenerator`) — declared at the point of use, in domain language |
| **Edge implementations** | technology-named packages — `internal/postgres`, `internal/kafka`, `internal/pubsub`, `internal/httpclient`, `internal/websocket`, `internal/llm` | Domain + `internal/core/service` | Concrete implementations of the core's interfaces (Postgres, Kafka, Pub/Sub, HTTP clients, the LLM client) |
| **Entrypoints (driving edge)** | `internal/entrypoints` | Domain + Services | HTTP routes, middleware, WebSocket handlers |
| **Composition root** | `cmd/` | Everything | Wires concrete implementations into services at startup |

The interface and the code that calls it live in the **same** package — Go's "accept interfaces, return structs," applied to the whole service. There is no abstract `adapters` package and no layer named for the pattern; the core is `internal/core/service`, and each implementation sits in a package named for the technology it wraps (`internal/postgres`, `internal/kafka`, …).

## Structural Invariants

- The domain and core service import no framework, no driver, no HTTP library, no SQL client.
- Interfaces are owned by the core package that consumes them, declared in domain language and named for the role (`Repository`, not `PostgresThing`).
- Edge implementations are interchangeable — swapping Postgres for another store requires zero core changes. They import `internal/core/service` and assert conformance with `var _ service.Repository = (*Repository)(nil)` (edge → core, the correct inward direction).
- The application service orchestrates; it does not contain business rules. Rules live on entities.
- Three conceptual zones: domain; the core service (interfaces + orchestration); edge implementations. More layers are ritual, not rigour.

## Dependency Enforcement

`depguard` is a **shipped gate** in `.golangci.yml.template`: it denies `internal/core/...` importing any edge package (`internal/postgres`, `internal/kafka`, `internal/pubsub`, `internal/httpclient`, `internal/websocket`, `internal/llm`) or any framework/driver, allowing it only stdlib + `internal/core/...`. The edge and the composition root in `cmd/` may import anything. A core-imports-edge violation fails `golangci-lint run`, so the inward-flow rule is a guarantee, not a hope.

## Anti-Patterns

- **Framework-coupled core.** If the core imports `gin.Context` or any HTTP type, it is no longer the core.
- **Anaemic domain models.** Data structs with no behaviour and a thick service that knows all the rules.
- **Leaky interfaces.** An interface with `*sql.DB` in its signature is a Postgres type wearing a costume.
- **Layer-skipping.** Handlers that talk directly to a store because "it is just a simple endpoint."
- **Per-implementation domain types.** Different entity definitions across packages. Map explicitly at the edge.
- **Over-layering.** Five layers of DTO translation between HTTP and the core. Edge code is thin.

## Test Seams

A pure core is trivially testable without infrastructure — every outbound dependency is an interface that can be stubbed. Test the edge implementation against the real thing it wraps; test the service against stubs of the interfaces it consumes.
