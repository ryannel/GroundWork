# API & Contracts

A contract is the most durable commitment a service makes. Once a client depends on it, changing it is expensive and breaking it is catastrophic. Contract design is not about getting v1 "right" — it is about making the next ten versions safe to ship. And in an agent-consuming world, a poorly shaped contract is an agent-productivity problem, not just a developer-experience one.

## Contract-first, code-generated

The spec is the source of truth — OpenAPI for HTTP, AsyncAPI for events, proto for gRPC, a typed module API for an embedded core. Author the spec before the handler; generate both sides of the wire from it. Hand-rolled clients drift; generated clients cannot. This is the invariant across every format: **a shape that exists only in prose is an unfinished contract.**

Where the contract is designed (a bet's design phase), the spec files are written at design time so that decomposition writes tests against the same artifact delivery implements against. The prose carries purpose, error guidance, and rationale; the spec carries the shapes; neither restates the other.

## The principles

1. **Explicit versioning, additive evolution.** Breaking changes require a new major version and a documented deprecation window. Within a major version, evolve additively — new optional fields, new endpoints, new response codes. Existing clients must never break because the schema grew.
2. **Resources, not RPCs.** Model resources (`POST /items`, `GET /items/{id}`), not verbs (`POST /createItem`). The resource shape forces thinking about identity, lifecycle, and composition up front. When a genuine verb is unavoidable (`POST /items/{id}/publish`), name it deliberately and document why.
3. **Idempotency by design.** Every write endpoint accepts an `Idempotency-Key`. Every client that retries — which includes every agent — must retry safely. The server stores the key long enough to detect replays; the burden is not on the client to be careful.
4. **Uniform pagination and filtering.** One cursor shape, one query-string grammar, one `next`/`prev` structure across every collection. Reading one collection should teach you every collection. Per-endpoint pagination conventions never scale.
5. **Structured, machine-readable errors.** Every error carries a stable code, a human message, and a `details` object. Callers — especially agents — branch on the code, not the prose. Codes are catalogued and never renumbered.
6. **Agent-readiness is first-class.** Rich descriptions on every field, enumerations for every finite domain, explicit examples on every endpoint. A competent agent should use the API correctly without reading the handler — the difference between a spec that compiles and a spec that teaches.
7. **Async events are contracts too.** WebSocket and broker events get the same rigour as HTTP: an AsyncAPI spec, generated models, additive evolution. The "informal" event today is the integration bug next quarter.

## The contract serves every surface and presumes none

Design the contract against all of its consumers at once — it is the cheapest moment to catch a web-shaped API a mobile client or CLI cannot use: a session assumption baked into a response, markup where data belongs, pagination sized to a viewport. Walk each surface's design against the contract before locking it. When only one surface is in scope, the latent programmatic caller stands in as the second consumer — would an agent with no UI and no session find this contract complete?

## Embedded cores

An embedded core's contract is a typed public API in the project's own language (a `.d.ts`, a Go interface, a Python protocol): every exported function, type, and error the surface consumes, with full signatures. The discipline is identical to OpenAPI's — only the format speaks the language the core is linked in.

## The contract is enforced, not just authored

Authoring a spec is half the loop; a contract no one verifies drifts the moment a provider ships a change. Enforce it:

- **Lint the spec in CI** (Spectral) on every PR — naming, examples, error shapes, breaking-change detection.
- **Contract tests with a deploy gate.** Consumer-driven or bi-directional contract tests, with a `can-i-deploy`-style gate that blocks a provider from shipping a change no consumer can tolerate. This is the contract's fitness function ([evolutionary-architecture.md](evolutionary-architecture.md)).
- **Bind the error model to a standard** — **RFC 9457 Problem Details** (it obsoletes 7807), and idempotency to the `Idempotency-Key` header — so "structured errors" is a named shape, not a local convention.

**Protocol selection** is a decision, not a default: REST at the public/partner edge (cacheable, familiar), **gRPC** for internal service-to-service (binary, typed), **GraphQL** (federated) for composition-heavy clients, **tRPC** only inside a TypeScript monorepo. A uniform contract surface does not mean one protocol everywhere.

## Antipatterns to catch

- **Breaking changes without a version bump** — "no one uses that field" is always wrong in an agent-consuming world.
- **Hand-written clients** — they drift, and drift causes outages. Generate.
- **Kitchen-sink endpoints** — `POST /doThing` with a 40-field payload that does everything. Split it.
- **Error payloads as bare strings** — `"invalid input"` is unusable by any automated caller.
- **Endpoint-scoped pagination** — cursor here, page-number there, offset-limit elsewhere. Pick one, apply it universally.
