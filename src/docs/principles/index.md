---
title: Engineering Manifesto
description: The core beliefs that shape how we build software — complexity, contracts, reliability, testing, architecture, documentation, decisions, and AI-native development.
status: active
last_reviewed: 2026-06-19
---
# Engineering Manifesto

Software engineering is the discipline of managing complexity and optimising for change. A product a team ships and operates — whatever its shape, from a high-volume real-time platform to a CLI or a desktop app — must lean hard on a solid technical foundation, frictionless developer velocity, and a rigorous engineering culture.

> [!IMPORTANT]
> These principles are the shared vocabulary we use to decide what to build, how to build it, and what trade-offs we accept. Every page in this hub stands on its own and does not require context from any other document to be useful.

## What we believe

1. **Complexity is the enemy; clarity is the goal.** We choose simple designs, simple tools, and simple processes — and we accept the cost of doing so. Speculative abstraction, premature generalisation, and fear of deletion all compound into the kind of complexity that slows teams down.
2. **Contracts are the single source of truth.** API specifications, event schemas, and database definitions are authoritative. Clients, tests, documentation, and UIs are derived from them. When a spec is wrong, everything downstream is wrong — and that is the correct failure mode, because one visible error beats silent drift across hand-maintained artefacts.
3. **Reliability is designed in, not patched in.** We build for failure from the first commit: idempotency at the API boundary, graceful degradation at the edges, backpressure when downstream systems slow, and observability as a design-time concern rather than an afterthought.
4. **We prove software by using the real thing the way its user does.** A feature is proven when a test drives the shipping build through its real front door, on the real pipeline, the way the user's action actually travels — and the user is whoever observes the outcome, a person at a screen or a caller of an API. Tests that run against real databases, real message brokers, and real HTTP stacks catch the bugs that mocked tests hide, and any fake a test leans on needs a real test behind it. Parts that each pass behind a harness can still assemble into a product that does nothing; the front-door proof is the one that catches it. See [Testing](foundations/testing.md).
5. **A pure core, swappable edges, and one obvious place for everything.** Every service is a pure decision-making core wrapped in a thin shell that does I/O; concrete dependencies plug in behind abstractions the core owns and stay swappable, with no implementation detail leaking inward. The structure is opinionated, so neither a human reading the code nor an agent writing it ever has to guess where a thing belongs. See [How We Structure Code](system-design/code-structure.md).
6. **Documentation is a product, not a by-product.** This documentation is versioned, reviewed, and shipped with the same discipline as code. It serves humans and AI agents, and the structures that help one help the other.
7. **Architectural decisions are recorded and governed.** We capture each significant decision with the context, assumptions, and trade-offs that shaped it, then govern it — an owner, a review trigger, and supersession rather than silent edits when it changes. The record is immutable so the trail of *why* survives; the decision stays open to re-evaluation when its assumptions break. Re-deciding is healthy engineering; re-deciding without recording it is how teams lose their memory. See [Architecture Decisions](system-design/architecture-decisions.md).
8. **AI agents are first-class engineers.** They read our docs, write our code, review our diffs, and run our tooling. We design our codebase, our conventions, and this documentation so an agent can operate at the same level of quality as a senior engineer.
9. **Software is made to be used, so it lands fully formed.** A feature is finished when it works, looks right, and is a genuine pleasure to use — reachable, complete, with no dead ends and every state accounted for. Function, form, and experience are one bar, not a core that ships and polish that waits. When code generation is cheap, the considered touch that makes a product feel cared-for is cheap too, so the bar is high. See [Usability and UX](design/usability-and-ux.md).
