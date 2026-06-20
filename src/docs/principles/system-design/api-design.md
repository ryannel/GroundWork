---
title: API Design
description: Contract-first design, versioning, evolution, pagination, and AI-agent readiness.
status: active
last_reviewed: 2026-06-19
---
# API Design

## TL;DR

Every API starts as a contract — OpenAPI for HTTP, AsyncAPI for events — and the code is generated from that contract. APIs are versioned deliberately, evolved additively, and shaped so that both human developers and AI agents can consume them without surprise.

## Why this matters

An API is the most durable commitment a service makes. Once it is in production and a client depends on it, changing it is expensive; breaking it is catastrophic. The discipline of API design is not about getting the first version "right" — it is about making the next ten versions safe to ship. In 2026, the stakes are higher still: agents read our APIs programmatically, generate clients against them, and compose them into workflows we did not design. A poorly shaped API is no longer just a developer-experience problem; it is an agent-productivity problem.

## Our principles

### 1. Contract-first, code-generated

A verified spec is the source of truth. Specs live in `/specs`; server handlers, typed clients, and reference docs are generated from them.

The contested part is the *authoring direction*, and serious teams genuinely split. Design-first — write the spec, then implement — makes the contract a negotiation artifact teams agree on before code exists; it is the right default for public APIs and anything crossing a team boundary. Code-first — annotate handlers, emit the spec — keeps the contract welded to the implementation and removes the design-then-diverge gap; it is legitimate for internal services where one team owns both ends. Picking a side is a distraction. What is non-negotiable is that a single spec is authoritative and that CI proves the running service matches it (principle 9). Choose the direction that fits the boundary, and never let the spec decay into documentation that trails the code.

Generated clients beat hand-rolled ones because the generator, not a human, tracks every schema change. But "generated" is not "good": stock OpenAPI Generator output is often bloated and does not validate responses at runtime, which is exactly why the modern SDK generators (Stainless, Fern, Speakeasy) exist. Generate clients — and treat the generator and its configuration as code you own and review, not a black box you run once.

### 2. Explicit versioning, additive evolution

The best version bump is the one you never ship. Additive, expand-then-contract evolution — new optional fields, new endpoints, new response codes, never a removed or repurposed field — keeps clients on v1 for years. Existing clients must never break because we extended the schema.

When a break is truly unavoidable, it requires a new major version and a documented deprecation window for the prior one. URL path versioning (`/v2`) is the default: visible, cache-friendly, trivial to route, and obvious to a developer reading a log line. Date-pinned header versioning — Stripe's `Stripe-Version: 2026-05-20`, where each client is pinned to the API as it behaved on a given day — is more precise but demands a version-transformation layer that rewrites old request and response shapes from current internals. That machinery pays for itself only when you have many external customers you cannot coordinate; do not adopt it to serve three internal consumers you can just upgrade.

### 3. Resources, not RPCs

Edge HTTP endpoints model resources (`POST /items`, `GET /items/{id}`), not verbs (`POST /createItem`). The resource shape forces us to think about identity, lifecycle, and composition up front. When a true verb is unavoidable (`POST /items/{id}/publish`), we name it carefully and document why a resource shape does not fit. This is a discipline for public, REST-shaped surfaces — not a ban on RPC. Internal service-to-service calls over gRPC are verb-oriented by design, and that is correct; the resource rule applies where humans and agents browse the API, not where two services exchange procedure calls behind the edge.

### 4. Idempotency by design

HTTP already makes GET, PUT, and DELETE idempotent by definition — replaying them is safe with no extra machinery. The methods that need help are the non-idempotent ones: POST, and PATCH when it is not a full replace. Those endpoints accept an `Idempotency-Key` header. Clients that retry on failure — which includes every agent we run — depend on it.

The server owns correctness, not the client. It stores the key with the first response's status and body, returns that same response on replay, and rejects a key reused with a *different* request payload as the client bug it is (`422`) rather than silently executing twice. The header is on the IETF Standards Track (`draft-ietf-httpapi-idempotency-key-header`) and not yet a finalized RFC, but the `Idempotency-Key` spelling is already the de facto convention — use it rather than inventing your own.

### 5. Pagination and filtering are uniform

Every collection endpoint paginates with the same shape, filters with the same query-string grammar, and returns the same `next`/`prev` link structure. Reading one collection teaches you every collection. Inconsistent pagination between endpoints is a design smell that never scales.

Cursor pagination is the default: it stays correct when rows are inserted or deleted mid-scan, where offset/limit silently skips and duplicates rows under the reader. Offset paging is acceptable only for small, bounded, slow-changing sets where jump-to-page-N is a genuine user need. Pick one per collection-class and apply it without exception — an agent that learns your pagination once should never be surprised by the next endpoint.

### 6. Errors are structured and machine-readable

Every error response carries a stable code, a human message, and a `details` object. Clients — and especially agents — branch on the code, not on the prose. Error codes are catalogued and never renumbered.

### 7. AI-agent readiness is a first-class concern

A rich OpenAPI spec is the substrate: descriptions on every field, enumerations for every finite domain, explicit examples on every endpoint. An agent reading the spec should be able to use the API correctly without reading the handler — the difference between a spec that compiles and a spec that teaches.

But agent-readiness in 2026 is more than good docs. The Model Context Protocol (MCP) has become the common way agents discover and invoke tools at runtime, and the live question is whether to ship REST, an MCP server, or both. REST stays the system-of-record interface for deterministic system-to-system calls; an MCP server is a thin, intent-shaped projection over that surface for agents selecting tools from natural language. It is a façade, not a second source of truth — it wraps the same handlers, enforces the same auth, and is generated and versioned alongside the spec. Building one before you have agent consumers is speculative generality; declaring a raw 200-endpoint REST surface "agent-ready" because it has an OpenAPI file is wishful.

Design for the agent's failure modes, not just its happy path. Keep response payloads lean — an agent pays tokens for every field it reads, so a 40-field object is a tax on every call. Make each operation do one nameable thing, because tool selection degrades when operations overlap. Label side effects explicitly so a planner knows which calls are safe to retry or run speculatively.

### 8. Async events are contracts too

We treat WebSocket and message broker events with the same rigour as HTTP — an AsyncAPI spec, generated client and server models, additive evolution. Events that are "informal" today are the integration bugs of next quarter.

### 9. The contract is enforced, not just authored

A spec no one verifies drifts the moment a provider ships. We lint specs in CI (Spectral), run consumer-driven or bi-directional contract tests behind a `can-i-deploy` gate so a provider cannot break a consumer, bind errors to **RFC 9457 Problem Details**, and choose the protocol deliberately — REST at the edge, gRPC internal, federated GraphQL for composition, tRPC only inside a TypeScript monorepo. Contract-first authoring without contract testing is half the loop.

## Anti-patterns we reject

- **Breaking changes without a version bump.** "It is a small breaking change, no one uses that field" — the assumption is always wrong in an agent-consuming world.
- **Hand-written clients.** Clients drift, and drift causes outages. Generate.
- **Kitchen-sink endpoints.** `POST /doThing` that accepts a 40-field payload and does everything. Split it.
- **Error payloads as strings.** A 400 response body of `"invalid input"` is unusable by any automated caller. Structured errors, always.
- **Endpoint-scoped pagination conventions.** Cursor in the body here, page-number in a query string there, offset-limit somewhere else. Pick one and apply it universally.
- **"Agent-ready" by assertion.** Terse field names, no examples, and a 200-endpoint surface — declared agent-ready because an OpenAPI file exists. An agent needs the same teaching a new engineer does.

## Further reading

- *Designing Web APIs*, Jin, Sahni, Shevat — the working bible of HTTP API design.
- *Web API Design: The Missing Link*, Apigee — the short handbook that gets the REST vocabulary right.
- *RFC 9457: Problem Details for HTTP APIs* ([rfc-editor.org](https://www.rfc-editor.org/rfc/rfc9457)) — the standard error-body format.
- *Designing robust and predictable APIs with idempotency*, Stripe ([stripe.com/blog/idempotency](https://stripe.com/blog/idempotency)) — the reference treatment of idempotency keys.
- *Model Context Protocol* ([modelcontextprotocol.io](https://modelcontextprotocol.io)) — the emerging standard for agent tool discovery and invocation.
- *AsyncAPI Specification* ([asyncapi.com](https://www.asyncapi.com)) — the canonical format for async contracts.
- *OpenAPI Specification* ([openapis.org](https://www.openapis.org)) — the canonical format for HTTP contracts.
