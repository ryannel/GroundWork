---
title: API Design
description: Contract-first design, versioning, evolution, pagination, and AI-agent readiness.
status: active
last_reviewed: 2026-05-26
---
# API Design

## TL;DR

Every API starts as a contract — OpenAPI for HTTP, AsyncAPI for events — and the code is generated from that contract. APIs are versioned deliberately, evolved additively, and shaped so that both human developers and AI agents can consume them without surprise.

## Why this matters

An API is the most durable commitment a service makes. Once it is in production and a client depends on it, changing it is expensive; breaking it is catastrophic. The discipline of API design is not about getting the first version "right" — it is about making the next ten versions safe to ship. In 2026, the stakes are higher still: agents read our APIs programmatically, generate clients against them, and compose them into workflows we did not design. A poorly shaped API is no longer just a developer-experience problem; it is an agent-productivity problem.

## Our principles

### 1. Contract-first, code-generated

Specs live in `/specs` and are the source of truth. Server handlers, typed clients, and reference docs are generated from them. We write the spec before we write the handler, and we let the generator produce both sides of the wire. Hand-rolled clients drift; generated clients cannot.

### 2. Explicit versioning, additive evolution

Breaking changes require a new major version — `/v2`, or equivalent media-type negotiation — and a documented deprecation window for the prior version. Within a major version, we evolve *additively*: new optional fields, new endpoints, new response codes. Existing clients must never break because we extended the schema.

### 3. Resources, not RPCs

HTTP endpoints model resources (`POST /items`, `GET /items/{id}`), not verbs (`POST /createItem`). The resource shape forces us to think about identity, lifecycle, and composition up front. When a true verb is unavoidable (`POST /items/{id}/publish`), we name it carefully and document why a resource shape does not fit.

### 4. Idempotency by design

Every write endpoint accepts an `Idempotency-Key` header. Clients that retry on failure — which includes every agent we run — must be able to do so safely. The server is responsible for storing the key long enough to detect replays, not the client for being careful.

### 5. Pagination and filtering are uniform

Every collection endpoint paginates with the same cursor shape, filters with the same query-string grammar, and returns the same `next`/`prev` link structure. Reading one collection teaches you every collection. Inconsistent pagination between endpoints is a design smell that never scales.

### 6. Errors are structured and machine-readable

Every error response carries a stable code, a human message, and a `details` object. Clients — and especially agents — branch on the code, not on the prose. Error codes are catalogued and never renumbered.

### 7. AI-agent readiness is a first-class concern

OpenAPI specs include rich descriptions on every field, enumerations for every finite domain, and explicit examples on every endpoint. An agent reading the spec should be able to use the API correctly without reading the handler. This is the difference between a spec that compiles and a spec that teaches.

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

## Further reading

- *Designing Web APIs*, Jin, Sahni, Shevat — the working bible of HTTP API design.
- *Web API Design: The Missing Link*, Apigee — the short handbook that gets the REST vocabulary right.
- *AsyncAPI Specification* ([asyncapi.com](https://www.asyncapi.com)) — the canonical format for async contracts.
- *OpenAPI Specification* ([openapis.org](https://www.openapis.org)) — the canonical format for HTTP contracts.
