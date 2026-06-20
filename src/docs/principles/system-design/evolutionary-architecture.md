---
title: Evolutionary Architecture
description: Designing for change and governing it with fitness functions, architecture-as-code, incremental modernization, and advisory governance rather than gatekeeping.
status: active
last_reviewed: 2026-06-19
---
# Evolutionary Architecture

## TL;DR

An architecture is not a blueprint delivered once; it is a system that must change safely under constant pressure. We design for evolvability, and we protect the characteristics we care about with **fitness functions** — automated, CI-enforced checks that *assure* an architectural property the way a test assures behaviour. A decision record documents what we chose; a fitness function proves it still holds. We modernise incrementally rather than rewriting, and we govern by advice and visibility rather than by a gate.

## Why this matters

Every architecture decays. Boundaries that were clean erode one pragmatic shortcut at a time; a layering rule that lives only in a wiki is a rule that is already being broken somewhere. The teams whose architecture stays coherent are not the ones with the strictest review board — they are the ones who turned their load-bearing rules into executable checks that fail the build, and who made change cheap enough that the system can follow the business instead of fighting it. Governance that depends on human vigilance scales until exactly the moment it matters most. As more code is machine-generated, this stops being optional: review throughput is now the bottleneck, and an executable rule is the only form of architectural intent that keeps pace with the volume of change.

## Our principles

### 1. Design for change, not for prediction

We optimise for evolvability over speculative completeness. We cannot predict which requirements will shift, so we build the system to absorb change cheaply — clear boundaries, reversible decisions, replaceable parts — rather than guessing the future and building for it. Speculative generality is a cost paid now against a benefit that usually never arrives.

The exception is the one-way door. A handful of decisions are expensive or impossible to reverse — a public API contract, a datastore choice, a security boundary, a data model others build on — and these earn real upfront thought precisely because you cannot cheaply change your mind later. The discipline is not "never think ahead"; it is to design for change everywhere and concentrate the deliberation on the few decisions that change will be barred from undoing (see principle 7).

### 2. Fitness functions assure what decisions document

Every architectural characteristic we actually care about gets an automated check that fails when the characteristic is violated. Dependency direction, layering, allowed couplings, latency budgets, bundle size, API-spec conformance, security invariants — each becomes a fitness function in CI. The blunt reframe: *a record without an enforcing check is half a decision*. The "dependencies point inward" rule — the core depends on nothing, the edges depend inward — is the archetype: it is automatable (`depguard`, `import-linter`, ArchUnit) and therefore enforceable, which is what turns it from a style into a guarantee.

Two limits keep this honest. A fitness function is only as good as the property it proxies — measure the wrong thing and you manufacture confident drift toward it; a green build that asserts nothing real is worse than no build, because it buys false safety. And not everything is automatable: the soundness of a domain model, the ergonomics of an API, the clarity of a name stay human-judged. Write a fitness function for the load-bearing rule that has a crisp, mechanical definition. Do not invent a metric for a quality that does not have one.

### 3. Architecture as code

The rules live in the repository as executable artefacts, not as prose someone is supposed to remember. Architecture tests run on every change, the same as unit tests; a structure diagram is generated from the code, not drawn by hand and left to rot. If the only enforcement of an architectural rule is code review, the rule is advisory and will drift.

### 4. Evolve incrementally, guarded by checks

Change lands in small, reversible steps, each one guarded by the fitness functions. This is what makes continuous architectural change safe: the checks catch a regression the moment it lands, so the system can be reshaped continually instead of in fraught big-bang migrations. Atomic checks guard a single characteristic; holistic checks guard the interactions; both run continually, not as a periodic audit.

### 5. Modernise with the strangler fig, not the rewrite

Legacy systems are evolved, not replaced wholesale. New capability grows around the old behind a façade that routes traffic to the new implementation as each slice is proven, until the old system is starved and removed. The big-bang rewrite — rebuild it all, switch over once — fails most often because it commits to reproducing years of accreted, undocumented behaviour while the original keeps moving under it, and pays back nothing until the very end.

But the strangler fig is not free, and pretending it is the only honest answer is its own failure mode. The façade, the dual-running, the data kept consistent across two systems — that scaffolding is real, recurring cost, and it only earns out when the system is too large or too valuable to freeze. **Decision rule:** strangle when the system is large, revenue-bearing, and cannot stop shipping. Rewrite when the system is small enough to rebuild faster than you can stand up the routing and sync layer, when the team can tolerate a delivery freeze, or when the domain itself has shifted so far that faithfully preserving the old behaviour is the *wrong* goal. Choosing to rewrite is a legitimate engineering decision; choosing it *by default for a large live system* is the anti-pattern.

### 6. Governance is advisory, not a gate

We decentralise the decision and centralise the visibility. An **advice process** — whoever makes a decision must seek advice from everyone it affects and everyone with relevant expertise, but the decision and its record stay with them (Harmel-Law) — a lightweight RFC, or an architecture guild replaces the central review board that teams learn to route around. The board-as-human-veto is a bottleneck; the fitness functions do the gatekeeping that can be automated, and people spend their judgement where automation cannot.

Two caveats keep this from being naïve. The advice process runs on trust and shared context — it is, in Harmel-Law's framing, hierarchy replaced by decentralised trust. Drop it into a low-trust org with shallow engineering depth and it yields incoherent decisions, not aligned ones; there the guild and the written record carry more of the load until trust is earned. And in regulated domains — finance, healthcare, safety-critical — a sign-off gate is a legal control, not a bureaucratic habit, and you cannot advise it away. The move there is not to abolish the gate but to make it cheap and early: automate the evidence it needs, and review at design time rather than at the door.

### 7. Reversibility is a property worth paying for

The cost of a decision is dominated by how hard it is to undo. Most decisions are two-way doors — reversible, cheap to revisit — and should be made fast and close to the work. A few are one-way doors — irreversible or nearly so — and warrant deliberation, broad advice, and being deferred to the last responsible moment when more is known (the Bezos Type-1/Type-2 distinction). We make irreversible choices visibly and record them (see [Architecture Decisions](architecture-decisions.md)), and we design seams that convert one-way doors into two-way ones wherever the seam is cheaper than the regret. An architecture full of one-way doors cannot evolve.

### 8. Observe the architecture; do not assume it

A characteristic nobody measures is a characteristic that is already eroding. We track architectural drift — coupling creep, boundary violations, dependency-graph health — as signals, the same way we track latency and errors. The fitness functions are both the guardrail and the measurement.

## How we apply this

Fitness functions are an implementation and CI concern — the architect *advises* which characteristics deserve one and where the seam goes; the engineer skills build them. New services ship with their dependency-direction check from day one. A modernization effort starts by drawing the façade and the first strangled slice — or by making the explicit, recorded case that a rewrite is the cheaper door — not by defaulting to either.

- [Architecture Decisions](architecture-decisions.md) — the record half; fitness functions are the assurance half.
- [How We Structure Code](code-structure.md) — the inward-dependency rule is the archetypal fitness function.

## Anti-patterns we reject

- **The ADR graveyard.** Decisions documented and never enforced. A rule without a check drifts; a stale record misleads worse than none.
- **The big-bang rewrite by default.** Replacing a large, working, revenue-bearing system all at once. Strangle it incrementally instead — unless it is small enough or changed enough that a rewrite is genuinely the cheaper door, decided explicitly.
- **The vanity fitness function.** A green check that proxies the wrong thing and sells false safety. Measure the load-bearing property, or do not measure.
- **The review board as veto.** A central gate teams learn to route around. Advise and automate — except where the gate is a legal control, which you make cheap, not absent.
- **Convention-only rules.** "We agreed handlers don't call repositories directly" with nothing failing the build when they do.
- **Speculative future-proofing.** Building for imagined requirements. Design for change, not for a predicted future.
- **Big-bang governance audits.** A quarterly architecture review instead of continual automated checks.

## Further reading

- *Building Evolutionary Architectures* (2e), Ford, Parsons, Kua — the canonical text on fitness functions and evolvability.
- *Facilitating Software Architecture*, Andrew Harmel-Law (O'Reilly, 2024) — the architecture advice process and decentralised, trust-based decision-making.
- *Strangler Fig Application*, Martin Fowler — the incremental-modernization pattern.
- *Lightweight approach to RFCs*, Thoughtworks — advisory decision-making at scale.
