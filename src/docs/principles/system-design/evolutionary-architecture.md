---
title: Evolutionary Architecture
description: Designing for change and governing it with fitness functions, architecture-as-code, incremental modernization, and advisory governance rather than gatekeeping.
status: active
last_reviewed: 2026-06-14
---
# Evolutionary Architecture

## TL;DR

An architecture is not a blueprint delivered once; it is a system that must change safely under constant pressure. We design for evolvability, and we protect the characteristics we care about with **fitness functions** — automated, CI-enforced checks that *assure* an architectural property the way a test assures behaviour. A decision record documents what we chose; a fitness function proves it still holds. We modernise incrementally rather than rewriting, and we govern by advice and visibility rather than by a gate.

## Why this matters

Every architecture decays. Boundaries that were clean erode one pragmatic shortcut at a time; a layering rule that lives only in a wiki is a rule that is already being broken somewhere. The teams whose architecture stays coherent are not the ones with the strictest review board — they are the ones who turned their load-bearing rules into executable checks that fail the build, and who made change cheap enough that the system can follow the business instead of fighting it. Governance that depends on human vigilance scales until exactly the moment it matters most.

## Our principles

### 1. Design for change, not for prediction

We optimise for evolvability over speculative completeness. We cannot predict which requirements will shift, so we build the system to absorb change cheaply — clear boundaries, reversible decisions, replaceable parts — rather than guessing the future and building for it. Speculative generality is a cost paid now against a benefit that usually never arrives.

### 2. Fitness functions assure what decisions document

Every architectural characteristic we actually care about gets an automated check that fails when the characteristic is violated. Dependency direction, layering, allowed couplings, latency budgets, bundle size, API-spec conformance, security invariants — each becomes a fitness function in CI. The 2026 reframe is blunt: *a record without an enforcing check is half a decision*. The hexagonal "dependencies flow inward" rule is the archetype — it is automatable (`depguard`, `import-linter`, ArchUnit) and therefore enforceable, which is what turns it from a style into a guarantee.

### 3. Architecture as code

The rules live in the repository as executable artefacts, not as prose someone is supposed to remember. Architecture tests run on every change, the same as unit tests; a structure diagram is generated from the code, not drawn by hand and left to rot. If the only enforcement of an architectural rule is code review, the rule is advisory and will drift.

### 4. Evolve incrementally, guarded by checks

Change lands in small, reversible steps, each one guarded by the fitness functions. This is what makes continuous architectural change safe: the checks catch a regression the moment it lands, so the system can be reshaped continually instead of in fraught big-bang migrations. Atomic checks guard a single characteristic; holistic checks guard the interactions; both run continually, not as a periodic audit.

### 5. Modernise with the strangler fig, not the rewrite

Legacy systems are evolved, not replaced wholesale. New capability grows around the old behind a façade that routes traffic to the new implementation as each slice is proven, until the old system is starved and removed. The big-bang rewrite — rebuild it all, switch over once — is the modernization anti-pattern with the highest failure rate; incremental replacement keeps the system shippable the whole way across.

### 6. Governance is advisory, not a gate

We decentralise the decision and centralise the visibility. An **advice process** (whoever makes a decision must seek advice from those affected and those with expertise, but the decision stays with them), a lightweight RFC, or an architecture guild replaces the central review board that teams route around. The board-as-human-veto is a bottleneck that the 2026 field has abandoned; the fitness functions do the gatekeeping that can be automated, and people spend their judgement where automation cannot.

### 7. Reversibility is a property worth paying for

The cost of a decision is dominated by how hard it is to undo. We prefer reversible decisions, make irreversible ones deliberately and visibly (and record them — see [Architecture Decisions](architecture-decisions.md)), and design seams that let a choice be revisited. An architecture full of one-way doors cannot evolve.

### 8. Observe the architecture; do not assume it

A characteristic nobody measures is a characteristic that is already eroding. We track architectural drift — coupling creep, boundary violations, dependency-graph health — as signals, the same way we track latency and errors. The fitness functions are both the guardrail and the measurement.

## How we apply this

Fitness functions are an implementation and CI concern — the architect *advises* which characteristics deserve one and where the seam goes; the engineer skills build them. New services ship with their dependency-direction check from day one. A modernization effort starts by drawing the façade and the first strangled slice, not by scoping the rewrite.

- [Architecture Decisions](architecture-decisions.md) — the record half; fitness functions are the assurance half.
- [Hexagonal Architecture](hexagonal-architecture.md) — the inward-dependency rule is the archetypal fitness function.

## Anti-patterns we reject

- **The ADR graveyard.** Decisions documented and never enforced. A rule without a check drifts; a stale record misleads worse than none.
- **The big-bang rewrite.** Replacing a working system all at once. Strangle it incrementally instead.
- **The review board as veto.** A central gate teams learn to route around. Advise and automate.
- **Convention-only rules.** "We agreed handlers don't call repositories directly" with nothing failing the build when they do.
- **Speculative future-proofing.** Building for imagined requirements. Design for change, not for a predicted future.
- **Big-bang governance audits.** A quarterly architecture review instead of continual automated checks.

## Further reading

- *Building Evolutionary Architectures* (2e), Ford, Parsons, Kua — the canonical text on fitness functions and evolvability.
- *Strangler Fig Application*, Martin Fowler — the incremental-modernization pattern.
- *The decentralised architecture advice process* — governance without a review board.
- *Lightweight approach to RFCs*, Thoughtworks — advisory decision-making at scale.
