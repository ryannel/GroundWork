---
title: Engineering Manifesto
description: The core beliefs that shape how we build software — complexity, contracts, reliability, testing, architecture, documentation, decisions, and AI-native development.
status: active
last_reviewed: 2026-05-26
---
# Engineering Manifesto

Software engineering is the discipline of managing complexity and optimising for change. A platform that processes high-volume asynchronous workloads and serves users in real time at scale must lean hard on a solid technical foundation, frictionless developer velocity, and a rigorous engineering culture.

> [!IMPORTANT]
> These principles are the shared vocabulary we use to decide what to build, how to build it, and what trade-offs we accept. Every page in this hub stands on its own and does not require context from any other document to be useful.

## What we believe

1. **Complexity is the enemy; clarity is the goal.** We choose simple designs, simple tools, and simple processes — and we accept the cost of doing so. Speculative abstraction, premature generalisation, and fear of deletion all compound into the kind of complexity that slows teams down.
2. **Contracts are the single source of truth.** API specifications, event schemas, and database definitions are authoritative. Clients, tests, documentation, and UIs are derived from them. When a spec is wrong, everything downstream is wrong — and that is the correct failure mode, because one visible error beats silent drift across hand-maintained artefacts.
3. **Reliability is designed in, not patched in.** We build for failure from the first commit: idempotency at the API boundary, graceful degradation at the edges, backpressure when downstream systems slow, and observability as a design-time concern rather than an afterthought.
4. **We test the system, not the mock of the system.** Tests that run against real databases, real message brokers, and real HTTP stacks catch the bugs that mocked tests hide. Emulation beats mocking wherever the dependency can run in a container.
5. **Hexagonal architecture is how we structure services.** Ports and adapters, with dependencies flowing inward toward the domain. The predictable file topology is as valuable for the humans reading the code as it is for the agents writing it.
6. **Documentation is a product, not a by-product.** This documentation is versioned, reviewed, and shipped with the same discipline as code. It serves humans and AI agents, and the structures that help one help the other.
7. **Architectural decisions are recorded and governed.** We capture each significant decision with the context, assumptions, and trade-offs that shaped it, then govern it — an owner, a review trigger, and supersession rather than silent edits when it changes. The record is immutable so the trail of *why* survives; the decision stays open to re-evaluation when its assumptions break. Re-deciding is healthy engineering; re-deciding without recording it is how teams lose their memory. See [Architecture Decisions](system-design/architecture-decisions.md).
8. **AI agents are first-class engineers.** They read our docs, write our code, review our diffs, and run our tooling. We design our codebase, our conventions, and this documentation so an agent can operate at the same level of quality as a senior engineer.
