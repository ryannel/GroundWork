---
title: Hexagonal Architecture
description: Ports, adapters, and unidirectional dependency flow — the cornerstone structural choice for an agent-led codebase in 2026.
status: active
last_reviewed: 2026-05-26
---
# Hexagonal Architecture

## TL;DR

Every non-trivial service we build is structured as a hexagon: a domain core surrounded by ports (interfaces) and adapters (implementations at the edges). Dependencies always flow inward — the domain depends on nothing; adapters depend on the domain through ports. This is the single highest-leverage structural choice we make, and it is deliberately non-negotiable for new services.

## Why this matters

Hexagonal architecture — also called *ports and adapters* — was first articulated by Alistair Cockburn in 2005 as a way to keep the "inside" of an application (its business logic) isolated from the "outside" (databases, HTTP, message queues, UI). Twenty years later, it is an obvious fit for an AI-assisted engineering workflow for one reason that did not exist when Cockburn first wrote about it:

> **Agents perform best inside environments with strong, consistent structural constraints.**

In a hexagonal codebase, every file has a determined place: domain entities in the core, ports as interfaces, adapters at the edges, application services orchestrating them. When an agent is asked to add a new endpoint, a new integration, or a new persistence backend, the answer to "where does this code live?" is already decided by the architecture. The agent does not have to invent the layout — it inherits it. This collapses the decision space dramatically and produces code that reliably matches the existing shape.

## Our principles

### 1. The domain depends on nothing

The innermost layer — the domain — contains the entities, value objects, and business rules that define what the service is. It imports no framework, no driver, no HTTP library, no SQL client. This is not dogma; it is the mechanism that makes the rest of the architecture work. A domain with framework imports cannot be tested in isolation, cannot be reused across adapters, and cannot be reasoned about independently of the infrastructure below it.

### 2. Ports are interfaces owned by the domain

A port is an interface declared *in the domain's language*, describing a capability the domain needs. `Repository`, `EventPublisher`, `ModelClient` — each port speaks in terms the domain cares about, not in terms of the underlying technology. Crucially, the port is owned by the domain, not by the adapter. An adapter is expected to conform to the port; the port is never shaped around what is convenient for the adapter.

### 3. Adapters live at the edges and are interchangeable

Adapters translate between the outside world and the ports. A Postgres adapter implements `Repository`; a gRPC adapter implements `ModelClient`; an HTTP adapter at the *driving* edge turns inbound requests into calls on the application service. Adapters are interchangeable — swapping Postgres for another database should require zero change to the domain or to any other adapter. If it requires more, the port is leaking implementation details and must be redesigned.

### 4. Dependencies flow inward, and this is enforceable

The fundamental rule: an adapter may depend on a port (which lives in the domain), but the domain may never depend on an adapter. This rule is automatable — `depguard` in Go, `import-linter` in Python, ESLint import rules in TypeScript — and we enforce it in CI. Code that violates the inward-flow rule fails the build. This is what turns "hexagonal" from a style into a guarantee.

### 5. The application service orchestrates; it does not contain business rules

Application services (often called use-case services) coordinate ports and domain entities to fulfil a use case. Business rules — "an entity cannot transition to state X until condition Y is met" — live in the domain entity, not in the application service. The split is subtle but load-bearing: mixing rules into orchestration means the rules are not portable across drivers (CLI, HTTP, background job), which defeats the point.

### 6. Ports are natural test seams

Hexagonal makes the core domain trivially testable without touching infrastructure, because every outbound dependency is a port that can be stubbed or replaced with a high-fidelity emulator. At the same time, application services can be tested end-to-end with real adapters (see [Testing](../foundations/testing.md)) because the adapters are narrow and replaceable. The architecture tells you what to test with a real container and what to test with a stub: test the adapter against the real thing it wraps; test the application service against stubs of the ports it consumes.

### 7. Keep the hexagon shallow

Hexagonal is not an invitation to pile on layers. The mistake we actively guard against is the "onion with ten rings" pattern — entity layer, repository layer, service layer, handler layer, DTO mapping layer, controller layer, and on and on. Three conceptual zones is enough: **domain**, **ports + application services**, **adapters**. Anything more is ritual, not rigour.

### 8. The architecture is language-agnostic

Hexagonal is a mental model, not a framework. It applies equally in Go, Python, TypeScript, and any future language we adopt. The file-layout conventions differ — in Go we tend toward flat package trees with internal interfaces; in Python we use explicit `ports/` and `adapters/` directories; in TypeScript we use feature folders with `*.port.ts` and `*.adapter.ts` suffixes — but the structure and the dependency rule are the same everywhere. Agents and engineers who internalise the pattern stay productive when the stack changes.

## Default to a modular monolith; watch the distributed monolith

The starting posture is a **modular monolith** — one deployable with strong internal module boundaries, one bounded context per module — and microservice extraction is an earned move on a converging-signals case, not a default. The failure mode to name is the **distributed monolith**: services that deploy in lock-step, share a database schema, or call each other synchronously three deep — the operational cost of microservices with none of the independence. So the **consolidation signal** is as first-class as the split test: two services that always change together should be merged back. And per **Conway's law**, boundaries track teams — align a bounded context with a stream-aligned team and shape teams to the architecture (Reverse Conway), rather than letting the org chart draw the boundaries.

## How we apply this

In new backend services, every service ships hexagonal from day one. The bootstrapping template includes the directory layout, the import-linter rules, and a stub domain + one adapter to demonstrate the flow.

For frontend code, the spirit of the pattern applies by isolating network I/O behind a data layer and keeping pure rendering logic free of data-fetching concerns.

## Anti-patterns we reject

- **Framework-coupled domain.** If the domain imports `fastapi.Request` or `gin.Context`, the domain is no longer the domain.
- **Anaemic domain models.** Data classes with no behaviour and a thick application service that knows all the rules. The rules belong on the entities.
- **Leaky ports.** A port with a concrete driver type in its signature is not a port — it is a database interface wearing a costume.
- **"Pragmatic" layer-skipping.** Handlers that talk directly to repositories because "it is just a simple endpoint." This is how architecture erodes: one simple endpoint at a time.
- **Per-adapter domain types.** Different entity definitions in the domain vs. the persistence layer vs. the API layer. Map across boundaries explicitly in the adapter, not by redefining the type.
- **Onion-style over-layering.** Five layers of DTO translation between HTTP and the domain. Adapters should be thin — a handler reads request, calls an application service, writes response. That is it.

## Further reading

- *Hexagonal Architecture*, Alistair Cockburn (2005) — the original source. Read this first.
- *Implementing Domain-Driven Design*, Vaughn Vernon — the expanded, practical treatment of the pattern and its relationship to DDD.
- *Clean Architecture*, Robert C. Martin — an overlapping framework that makes the dependency-inversion argument explicitly.
- *Get Your Hands Dirty on Clean Architecture*, Tom Hombergs — a code-first tour in Java that translates cleanly to other languages.
- Mark Seemann's essays on [blog.ploeh.dk](https://blog.ploeh.dk) — in particular his treatment of ports-as-dependencies and the composition root pattern.
