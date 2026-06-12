---
title: Testing
description: Continuous Risk Assurance — testing the system, not the mock of the system.
status: active
last_reviewed: 2026-05-26
---
# Testing

## TL;DR

Tests are risk-weighted assertions about production behaviour — not boxes ticked for coverage. We favour high-fidelity service tests over solitary unit tests, emulate dependencies rather than mocking them, and treat observability signals as first-class test assertions.

## Why this matters

The dominant failure mode of a test suite in 2026 is not that it is too small — it is that it passes while production breaks. Mocked dependencies drift from their real counterparts, unit tests assert on implementation rather than behaviour, and green CI gives a false sense of security. *Continuous Risk Assurance* is our name for the discipline that replaces "coverage as a target" with "risk as the thing we actually measure."

## Our principles

### 1. Favour service tests over solitary unit tests

The "sociable" service test is our foundational unit of validation. We test from the API entry point through to real, ephemeral database containers. We reserve solitary unit tests exclusively for complex isolated algorithms (parsers, validators, pure computation). In a service-oriented codebase, the interesting bugs live at the boundaries — HTTP serialisation, SQL query correctness, event emission — and those are exactly what solitary unit tests mock away.

### 2. Emulate, don't mock

If a dependency can run in a container — Postgres, a message broker, object storage — we emulate it via Testcontainers or equivalent. In-memory fakes miss critical data-integrity, serialisation, and networking issues. The startup cost is strictly worth the confidence gain; these are precisely the bugs that escape to production when you mock them out. Emulators are reset per test suite to maintain determinism and prevent test pollution.

### 3. Observability is a test surface

OpenTelemetry instrumentation is a design-time concern, not an afterthought. System tests assert that traces are unbroken end-to-end: a missing span, a lost TraceID, or a broken parent-child relationship is a test failure, not an instrumentation TODO. The boundary between "test" and "monitor" dissolves — both are asking whether the system is behaving as we claim.

### 4. Name tests by behaviour, not implementation

Every test follows a BDD-style name: `[Function] should [expected outcome] when [condition]`. This ensures the test log alone tells the story: an on-call engineer reading a failure can form a hypothesis without opening the test code. Names like `TestCreateItem_Success` are banned — they convey nothing beyond what already appears on the dashboard.

### 5. Risk-based depth, not blanket coverage

Coverage percentages are meaningless without proof that the assertions catch real faults. We score modules using a risk matrix — Impact × Complexity × Change-frequency — before deciding on test depth. High-risk modules earn live system tests and chaos experiments; low-risk modules need only small tests and static analysis. Equal test depth everywhere is wasted effort.

### 6. Tests are part of the change, not after it

A PR without tests is incomplete. A test added in a follow-up PR is a test that will never be written. We write tests alongside the code they verify, and we review the test with the same rigour as the code. If a change resists testing, that is a signal about the design of the code, not the design of the test.

## How we apply this

- [Observability](../quality/observability.md) — the OTel-first stance that makes traces-as-assertions possible.
- [Reliability](../quality/reliability.md) — how tests compose with chaos and load experiments.
- [Hexagonal Architecture](../system-design/hexagonal-architecture.md) — the structural choice that makes tests cheap to write and fast to run.

## Anti-patterns we reject

- **Mocking the database.** A test that mocks the database is a test that asserts against your SQL-writing skill, not against database behaviour. Use an ephemeral container.
- **Snapshot tests as a default.** Snapshots are a brittle, noisy substitute for behavioural assertions. They are acceptable only when the thing being snapshotted is a genuinely opaque artefact (a rendered email, a serialised response).
- **Coverage-gated CI.** "95% line coverage required" is a metric that can be gamed without improving real risk reduction. Use it as a read-out, never as a gate.
- **Shared staging environments as the integration test.** Staging has no hermetic guarantees, no reproducibility, and no determinism. It is a deployment target; it is not a test bed.
- **"It's hard to test, so we didn't."** That is a signal the code is badly designed. Fix the code.

## Further reading

- *Accelerate*, Forsgren, Humble, Kim — the empirical case for continuous delivery and its testing discipline.
- *Working Effectively with Legacy Code*, Michael Feathers — seams, test doubles, and when each is appropriate.
- *Growing Object-Oriented Software, Guided by Tests*, Freeman & Pryce — the canonical treatment of outside-in service testing.
- *xUnit Test Patterns*, Gerard Meszaros — the vocabulary we use for test doubles, fixtures, and strategies.
