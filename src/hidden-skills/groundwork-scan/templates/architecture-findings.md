# Architecture Findings

> Consumed by `groundwork-architecture-extract`. Exact structural facts extracted from the codebase and the `repo-map.json` code map. The heaviest findings slice — the architecture phase reverse-engineers `docs/architecture/index.md`, domain stubs, and contract docs from it.

## Service / Partition Map

<!-- One row per service or partition: name, root path, language, runtime, responsibility, and — for partitions a consumer interacts with — the interface surface type (graphical-ui | cli | agentic-protocol); `—` for core services. Record every surface-bearing partition: the architecture extract writes the surface registry from this column, and a surface missing here is missing from the registry. -->

| Service | Root | Language | Responsibility | Surface |
|---|---|---|---|---|

## Entry Points

<!-- Per service: the process entry point(s) — main.go, the server bootstrap, the worker loop. -->

## External Contracts

<!-- Every machine-readable contract found, with its path: OpenAPI/Swagger specs, AsyncAPI schemas, Protobuf/gRPC definitions, GraphQL SDL. When a service exposes HTTP routes with NO formal spec, record that gap explicitly — it is a candidate gap-ledger entry. -->

## Data Models & Persistence

<!-- Entities from schemas, migrations, ORM models. The datastores in use (Postgres, Redis, etc.) and where each service's schema/migrations live. -->

## Dependencies

<!-- Internal: which service depends on which (from the code map). External: third-party services and SDKs each service calls (Stripe, Clerk, a message broker, an LLM provider). -->

## Communication Patterns

<!-- Sync (HTTP/gRPC) vs async (queue/stream/pubsub) edges between services, with the transport. -->

## Infrastructure & Deployment

<!-- docker-compose services and ports, IaC (Terraform/k8s/helm), CI workflows, env examples. Whether a system-test harness exists. -->

## Notable Patterns

<!-- Architectural patterns observed: hexagonal layering, transactional outbox, CQRS, repository pattern, etc. -->

## Risks & TODOs

<!-- TODO/FIXME markers of architectural weight, deprecated paths, obvious divergences from a clean service standard. Feeds the gap ledger. -->
