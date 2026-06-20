---
title: How We Structure Code
description: A pure core, swappable edges, no leaked implementation details, and one obvious place for everything — the structural discipline that makes a codebase legible to a human and navigable to an agent, expressed in each language's own idiom.
status: active
last_reviewed: 2026-06-19
---
# How We Structure Code

## TL;DR

Every service is a **pure core** that makes decisions, wrapped in a **thin shell** that does I/O. The core depends only on abstractions it owns; the concrete implementations — the database, the LLM, the queue — plug in at the edges and are swappable. No implementation detail leaks inward: the core never knows it is talking to Postgres or Anthropic. And the structure is **opinionated and predictable**, so a developer or an agent never has to guess where a thing lives or where a new thing goes. The discipline is the same in every language; its expression is native to each.

This is the single highest-leverage structural choice we make, and it is deliberately non-negotiable for new code.

## Why this matters

There is one idea here, and the industry has named it five times — Dependency Inversion, Hexagonal / Ports & Adapters, Onion, Clean Architecture, Functional Core / Imperative Shell. They are restatements of a single constraint. As Robert C. Martin put it of the variants, *"they all have the same objective, which is the separation of concerns… by dividing the software into layers"* — and the rule under all of them is the **Dependency Inversion Principle** (Martin, 1996): high-level policy depends on abstractions, not on low-level detail. We state the rules directly and in plain language; the named frameworks live in Further Reading, for the lineage. What we hold is the discipline, not a label — and we keep it shallow, never the "onion with ten rings."

Holding the structure pays off twice:

- **Changeability.** Because dependencies plug in behind abstractions the core owns, swapping a database, an LLM provider, or a message broker is a configuration change at the edge, not a rewrite through the middle.
- **Testability.** A pure core has many branches and no dependencies, so it is tested exhaustively with plain input→output assertions and no mocks; the thin shell has few branches and many dependencies, so it is tested for real against the things it wraps (Gary Bernhardt's *Boundaries*). The architecture tells you what to stub and what to stand up.

And there is a payoff specific to how we work in 2026: **an opinionated structure collapses an agent's decision space.** When "where does this code live?" is already answered by the convention, the agent inherits the layout instead of inventing one, and produces code that matches the existing shape. Two cautions keep this honest, both from recent evidence: conventions help an agent only when they are **legible** — explicit and discoverable in the code — not when they are hidden framework magic the agent must already know (the *Constraint Decay* finding, that agents do worse in convention-heavy environments whose rules are implicit). And an obvious structure beats verbose prose guidance: piling requirements into instruction files measurably *reduces* success. So we make the structure speak for itself, and we keep the guidance minimal.

## Our principles

### 1. A functional core, an imperative shell

Decisions are pure functions over plain values — no I/O, no hidden mutation, no clock or network reached for in the middle. All side effects live in a thin shell at the edges that gathers inputs, calls the core, and acts on what it returns (Mark Seemann's *impure→pure→impure* sandwich). The core is deterministic and does not know the shell exists.

This is a discipline, not a religion, and it bends where it must: when a decision genuinely needs more data part-way through, or a filter must run database-side for performance, the shell reaches back for it. That is expected. The goal is to keep *as much branching as possible* in the dependency-free core — not to achieve a zero-effect purity the language fights. In Go, that means functions over values and errors-as-values, not a framework of structs-with-methods; in Python, injecting a clock and keeping logic in pure functions; in TypeScript, the same. Keep it native.

### 2. Depend on abstractions you own, and make them point inward

The core declares the interface it needs, **in its own language** — `Store`, `Embedder`, `Notifier` — and the implementation conforms to it. The dependency points inward: the edge depends on the core's abstraction; the core never depends on the edge. This is not aesthetic. It is **enforceable in CI** — `depguard` in Go, `import-linter` in Python, ESLint import rules in TypeScript — and a violation fails the build. Enforcement is what turns the structure from a style we hope for into a guarantee we have.

### 3. Never leak an implementation detail

That storage is Postgres, that the model is Anthropic, that the queue is Kafka — none of it may shape the core's types or its method signatures. No ORM entities standing in as domain models, no `IQueryable`- or SQL-shaped methods on a port, no vendor SDK type in a port's signature. An abstraction expressed in the vendor's terms is a leak wearing a costume — when the implementation changes, the "abstraction" changes with it, which is the proof it was never one. The port speaks the domain's goals: *"methods that make sense to the goals of a user in a domain, not to a database"* (Brett Schuchert).

Hold this as a direction, not a fantasy. *All non-trivial abstractions leak to some degree* (Joel Spolsky's law) — a query that is fast on an index and slow without one leaks through any storage port. We minimise leakage rigorously; we do not pretend it reaches zero.

### 4. Abstract at the narrow seam you actually use — never speculatively

A port exposes only what the application actually calls, named in the application's language: `Orders.GetById` and `Orders.Save` over an aggregate, an `Embed(text) → vector`. Narrow, domain-named ports are cheap to carry and easy to change — effort YAGNI explicitly exempts as *making the software easier to modify*. The speculative version is the trap: an interface invented "for mocking" with exactly one implementation, a wide wrapper mirroring a vendor SDK for a swap that never comes, or a generic `Repository<T>` / `IRepository<TEntity>`.

The generic repository deserves a careful word, because it is seductive for a real reason: it *forces a clean break* between the domain and the store — a hard, uniform boundary — and that break is genuinely valuable. The lie is the word "generic." We have almost always seen exactly **one** implementation, so the generality is unproven — Brian Foote's *Speculative Generality*, "spotted when the only users are test cases." And a uniform CRUD surface (`GetAll`, `Find(query)`, an exposed `IQueryable`) ends up advertising the *store's* capabilities, not the *domain's* needs — the leak from principle 3, wearing the costume of an abstraction.

So take the clean break from where it actually comes — an owned port, a persistence-ignorant core, and adapter tests against the real database (principle 5) — not from a generic CRUD contract. The decision rule:

- **Simple CRUD or read-heavy work: no bespoke repository.** A mature ORM or query layer already *is* a unit of work and a collection-like store; wrapping it again is indirection that hides the details you need. Use it directly, or a query object.
- **A rich aggregate with invariants: one repository per aggregate root** — domain-named methods, the interface owned by the core, the implementation in the adapter. Speak the ubiquitous language, never the schema; when query variety grows, reach for a *specification*, not more methods or a leaked query type.
- **A generic base is legitimate only once the generality is proven** — three real aggregates exist (the rule of three), the base is *constrained* to enforce the aggregate-root rule, and it is reached *only* through specific domain-named ports. A generic base with one implementation is the lie; delete it.

The same logic governs every external dependency: **wrap thin clients, not rich tools** — a driver, a raw HTTP SDK, an LLM API earn a narrow owned port; a tool that already implements the pattern does not (Jimmy Bogard's heuristic; Go's *"the bigger the interface, the weaker the abstraction"*). This is the principle that most needs **judgment**, which is why it is carried in the engineer skills (principle 8) and applied consistently rather than reinvented per file. The wrong abstraction costs more than the duplication it removes (Sandi Metz) — when in doubt, wait for the third case.

### 5. Swappable by design; integration-tested for real

Because implementations plug in behind owned abstractions, a dependency is replaceable — and we prove it the right way. Stub the port to test the core's logic exhaustively and fast; run the **real** adapter against the **real** dependency in a container, never a mock of it. We test the system, not a mock of the system. A boundary you cannot test cheaply is usually a boundary drawn in the wrong place. (See [Testing](../foundations/testing.md).)

### 6. One obvious place for everything

The structure is opinionated on purpose: for any change there is a single predictable place it belongs, and for any feature a single place to find all of its parts. The top-level layout should **announce the domain, not the framework** — it should read as *Payments* and *Catalogue*, not as the web framework underneath (Robert C. Martin's *Screaming Architecture*). Prefer colocating what changes together — a feature owns its handler, its logic, its types — over scattering a feature across technical layers; *"minimise coupling between slices, maximise coupling within a slice"* (Jimmy Bogard). Decide the thousand trivial layout choices **once**, in the scaffold, so no one re-litigates them per service — *"a place for everything, and everything in its place; constraints liberate"* (the Rails doctrine). Python's Zen says the same: *one obvious way*, and *in the face of ambiguity, refuse the temptation to guess.* The test of the structure is that nobody — human or agent — has to guess.

### 7. Keep it shallow

Three zones are enough: the **core**; the **abstractions plus the orchestration** that uses them; the **edge implementations**. Resist the extra rings — the five-hop DTO translation, the layer that exists only to forward a call. Indirection is not abstraction: a layer that hides no complexity is just a tax on every reader and every change, and it should be deleted. Shallow keeps cognitive load low, which is the real limit on how fast anyone moves through the code.

### 8. The discipline is constant; the expression is native

The rules above hold identically in Go, Python, and TypeScript — but each is written the way its own community writes it, and we never impose a uniform cross-language layout (a uniform layout would itself read as a framework fingerprint, and we avoid it). Go defines narrow interfaces at the point of use and returns concrete structs; Python expresses ports as `Protocol`s — structural typing, not inheritance ceremony; TypeScript leans on structural types, where a port costs almost nothing to declare. The **engineer skill for each stack is the carrier of its native expression** — it is where these principles become a specific, idiomatic shape the agent can scaffold, extend, and recognise.

## How we apply this

- **New services ship this shape from the scaffold** — the directory layout, the dependency-rule lint config wired into CI, and a stub core with one real adapter that demonstrates the flow. The convention is generated, not asked for.
- **The per-language engineer skill is the delivery vehicle.** `groundwork-go-engineer`, `groundwork-python-engineer`, and the surface engineers teach the agent the native expression of these rules: where to look, where new code goes, and what idiomatic looks like for that stack. An agent equipped with the skill navigates and extends any codebase built to the convention without guessing — which is the whole point of holding a convention.
- **Brownfield is guided toward the same shape.** The scan → extract → adopt path reads an existing codebase, names where it already follows these principles and where it diverges, and moves it toward the convention incrementally rather than demanding a rewrite.
- **For frontends, apply the spirit:** isolate network I/O behind a data layer and keep rendering logic free of fetching concerns; the core/edge split survives even where the file conventions differ.

## Right-size the boundaries

Structure within a service is one decision; how many services exist is another, and the default is conservative. Start as a **modular monolith** — one deployable with strong internal module boundaries, one bounded context per module — and treat extracting a microservice as an *earned* move, justified only when multiple signals converge (the language and mental model shift, the scaling profile is incompatible, the deploy cadence is fundamentally different). The failure mode to name is the **distributed monolith**: services that deploy in lock-step, share a schema, or call each other synchronously three deep — the cost of microservices with none of the independence. Make the consolidation signal as first-class as the split: two services that always change together should be merged back. (See [Surface Architecture](surface-architecture.md) and [Evolutionary Architecture](evolutionary-architecture.md).)

## Anti-patterns we reject

- **Framework-coupled core.** `gin.Context`, `fastapi.Request`, or an ORM entity living in the core. The moment the core imports the framework, it is no longer the core.
- **Leaked persistence.** The core knows it is Postgres; a "port" that returns `IQueryable`, a `DbSet`, or raw rows. Map at the edge, in the adapter — not by letting the storage shape reach inward.
- **Vendor-shaped ports.** A port that mirrors an SDK's methods. Swapping the vendor then means rewriting the port and everything that calls it — the opposite of what the port was for.
- **Speculative abstraction.** A generic `Repository<T>`, an interface with a single implementation added "for mocking," a wide wrapper over a mature tool to enable a swap no one will make. Indirection sold as foresight.
- **Anaemic core, god service.** Data classes with no behaviour and one application service that holds every rule. Rules belong on the entities they govern.
- **Over-layering.** Five DTO translations between the HTTP edge and the core. Adapters are thin: read the request, call the core, write the response.
- **Guessing-required structure.** No single obvious home for a change; the parts of one feature scattered so widely you have to grep to assemble it. If placement is ambiguous, the structure has failed its one job.
- **Mock-the-world testing.** Proving the system against mocks of its own dependencies. Stub the port to test the core; use the real thing to test the adapter.

## Further reading

These are the sources behind the idea. You may know the discipline under any of their names — read one treatment in full; they converge.

- *The Dependency Inversion Principle*, Robert C. Martin (1996) — the root rule beneath every variant. Start here.
- *The Clean Architecture* (Martin, 2012), *Hexagonal / Ports & Adapters* (Alistair Cockburn, 2005), and *Onion Architecture* (Jeffrey Palermo, 2008) — three names for the inward-dependency rule. Any one of them is the same message.
- *Boundaries* / Functional Core, Imperative Shell, Gary Bernhardt (2012), and Mark Seemann's *Composition Root* and *impureim sandwich* essays on [blog.ploeh.dk](https://blog.ploeh.dk) — the pure-core framing and where it stops.
- *Screaming Architecture* (Martin, 2011) and *Vertical Slice Architecture* (Jimmy Bogard, 2018) — making placement obvious.
- The honest counter-camp, read so you abstract with judgment rather than reflex: Sandi Metz, *The Wrong Abstraction* (2016); Joel Spolsky, *The Law of Leaky Abstractions* (2002); and the repository-pattern critiques (Derek Comartin, Vladimir Khorikov) on when the abstraction is worth its cost and when it is ceremony.
