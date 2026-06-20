---
title: Testing
description: Continuous Risk Assurance — testing the system, not the mock of the system.
status: active
last_reviewed: 2026-06-19
---
# Testing

## TL;DR

Tests are risk-weighted assertions about production behaviour — not boxes ticked for coverage. We favour high-fidelity service tests over solitary unit tests, run dependencies we own as real ephemeral containers rather than mocking them, contract-test the ones we don't, and treat observability signals as first-class assertions. The measure of a suite is whether its assertions actually catch faults — not its line-coverage number.

## Why this matters

The dominant failure mode of a test suite in 2026 is not that it is too small — it is that it passes while production breaks. Mocked dependencies drift from their real counterparts, unit tests assert on implementation rather than behaviour, and green CI gives a false sense of security. *Continuous Risk Assurance* is our name for the discipline that replaces "coverage as a target" with "risk as the thing we actually measure."

This matters more, not less, as code generation gets cheaper. When an agent can produce a plausible implementation in seconds, the bottleneck moves from writing code to *trusting* it. The test suite becomes the executable specification that constrains generated code — the thing that says what "correct" means when the author is a model and the reviewer is short on time. A weak suite that generated code passes is worse than no suite, because it manufactures confidence.

## Our principles

### 1. Favour service tests over solitary unit tests

The "sociable" service test is our foundational unit of validation. We test from the API entry point through to real, ephemeral database containers. In a service-oriented codebase the interesting bugs live at the boundaries — HTTP serialisation, SQL query correctness, transaction semantics, event emission — and those are exactly what solitary unit tests mock away. This is the *test honeycomb* shape popularised by Spotify's engineering teams: a fat middle of integrated service tests, a thin layer of solitary unit tests, and a few end-to-end checks on top — not the classic Mike Cohn pyramid that pushes most weight onto isolated units.

The honest tension: service tests buy fidelity at the cost of speed and diagnostic precision. A solitary unit test that fails names the broken function; a service test that fails tells you "the create-order flow is broken" and leaves you to find where. And a slow, flaky service layer is corrosive — teams that can't trust or tolerate it quietly retreat to mocking everything, which is the exact failure this principle exists to prevent. So fidelity is not a licence to be slow: keep service tests parallelisable, keep fixtures cheap, and treat suite latency as a first-class defect.

Decision rule: reach for a solitary unit test when the logic is **algorithmically dense and boundary-poor** — a parser, a pricing calculator, a state machine, a validator — where the combinatorics are the risk and a container adds only latency. Reach for a service test when the risk lives in the **wiring** — serialisation, persistence, queries, events, auth. When a service-test failure is routinely hard to localise, that is a signal to factor out the dense core and unit-test it directly, not to mock the boundary.

### 2. Run real dependencies you own; contract the ones you don't

For a dependency you own and deploy — Postgres, your message broker, object storage — run the real thing in an ephemeral container (Testcontainers or equivalent). In-memory fakes miss the bugs that actually escape to production: schema and migration mismatches, serialisation edge cases, transaction and isolation behaviour, query-planner surprises. Pin the image to the version you run in production — never `latest`, which turns an upstream release into a flaky build. Reset state between tests for determinism, and share a container across a suite rather than per-test so startup cost doesn't dominate the run.

But "emulate everything" is a false absolute, and applied carelessly it wrecks the feedback loop — full brokers and databases spun up for tests that exercise none of their behaviour buy nothing but minutes. Two cases break the rule:

- **Third-party services you do not control** (a payments API, a SaaS provider) usually cannot be containerised faithfully, and a hand-written mock of them is the worst of both worlds — it encodes *your belief* about their behaviour, which is precisely what drifts. Verify against a **contract** instead: a consumer-driven contract (Pact) or a recorded/replayed interaction captured from the real provider, plus a small, periodically-run live suite against a sandbox to detect drift. Pact's leverage is weaker here because you can't compel an external provider to verify your contract, so treat the contract as a drift detector, not proof.
- **Pure logic with no real I/O.** If the unit under test has no genuine dependency, don't invent one to stand a container up behind. Test it directly.

Decision rule: emulate the data and serialisation boundaries you own; contract-test the boundaries you don't; mock only at a seam you fully control and only when the real thing adds latency without adding risk. A mock that stands in for a database is almost always the wrong call (see anti-patterns); a recorded contract for a remote API you can't run is often the right one.

### 3. Observability is a test surface

OpenTelemetry instrumentation is a design-time concern, not an afterthought. System tests assert that traces are unbroken end-to-end: a missing span, a lost TraceID, or a broken parent-child relationship is a test failure, not an instrumentation TODO. The boundary between "test" and "monitor" dissolves — both ask whether the system is behaving as we claim. The payoff is double-counted: the same instrumentation that proves correctness in CI is what lets you debug the incident in production.

### 4. Name tests by behaviour, not implementation

A test name must let an on-call engineer form a hypothesis from the failure log alone, without opening the test file. The default form — `[Unit] should [expected outcome] when [condition]` — encodes that intent, and names like `TestCreateItem_Success` are banned because they convey nothing beyond what the dashboard already shows. The format serves the goal; the goal is the rule. A name that states behaviour and condition in another shape is fine. A name that follows the template but says nothing specific (`should work when called`) is not.

### 5. Risk-based depth, and prove the assertions bite

Coverage percentages are meaningless without proof that the assertions catch real faults — a suite can execute every line and assert nothing. We score modules on Impact × Complexity × Change-frequency before deciding test depth: high-risk modules earn live system tests and chaos experiments; low-risk modules need only small tests and static analysis. Equal depth everywhere is wasted effort.

The honest measure of whether assertions bite is **mutation testing** (PIT, Stryker, or equivalent): inject deliberate faults and confirm a test fails. A surviving mutant is a line you cover but do not actually check. Mutation testing is expensive — its naive cost is the suite run times the number of mutants — so don't run it across the whole tree. Run it on the high-risk modules the matrix flags, and on changed code in CI, where it doubles as a quality gate on new tests (the use Meta reported for its LLM-assisted mutation work in 2025). Use it as a periodic read-out of assertion quality, never as a blanket gate.

### 6. Tests are part of the change, not after it

A feature PR without tests is incomplete, and we review the test with the same rigour as the code. Tests deferred to a "follow-up PR" compete with the next feature and usually lose, so the work isn't done until the verification ships with it. The exceptions are honest and narrow: a spike or throwaway prototype whose purpose is to be deleted does not need tests — but the moment it becomes the implementation, it does.

This is a discipline about *what ships together*, not a mandate to write tests first. Test-first (TDD) is a powerful design tool — it forces you to use your own interface before committing to it — but it is a tool, not a law, and the "Is TDD Dead?" exchange between Kent Beck, Martin Fowler, and DHH named the real cost: dogmatic test-first can induce *design damage*, contorting code with needless indirection purely to make it mockable. Hold both signals. If a change resists testing, that usually means the design is wrong — fix the code. But if the *only* way to test it is to shatter a cohesive unit into layers of indirection nothing else needs, the test is making the demand, and the design was right. Write the test with the change; let it pressure the design; don't let it deform the design.

## How we apply this

- [Observability](../quality/observability.md) — the OTel-first stance that makes traces-as-assertions possible.
- [Reliability](../quality/reliability.md) — how tests compose with chaos and load experiments.
- [How We Structure Code](../system-design/code-structure.md) — the structural choice that makes tests cheap to write and fast to run.

## Anti-patterns we reject

- **Mocking the database.** A test that mocks the database asserts against your SQL-writing skill, not against database behaviour. Use an ephemeral container.
- **Retrying flaky tests until green.** A test that passes on the third run is a failing test with a coin flip attached, and rerun-to-green trains the whole team to ignore red. Quarantine the flake out of the gating suite, file it, and fix the root cause — non-determinism, timing, shared state, test order. Quarantine is a triage state with a deadline, not a graveyard.
- **Snapshot tests as a default.** Snapshots are a brittle, noisy substitute for behavioural assertions, and "update snapshots" becomes a reflex that launders bugs into the baseline. Acceptable only when the artefact is genuinely opaque (a rendered email, a serialised response).
- **Coverage-gated CI.** "95% line coverage required" is a metric gamed without reducing real risk. Use coverage as a read-out, mutation score as the quality signal, never line coverage as the gate.
- **Shared staging environments as the integration test.** Staging has no hermetic guarantees, no reproducibility, no determinism. It is a deployment target, not a test bed.
- **"It's hard to test, so we didn't."** That is a signal the code is badly designed. Fix the code.

## Further reading

- *Accelerate*, Forsgren, Humble, Kim — the empirical case for continuous delivery and its testing discipline.
- *Working Effectively with Legacy Code*, Michael Feathers — seams, test doubles, and when each is appropriate.
- *Growing Object-Oriented Software, Guided by Tests*, Freeman & Pryce — the canonical treatment of outside-in service testing.
- *xUnit Test Patterns*, Gerard Meszaros — the vocabulary we use for test doubles, fixtures, and strategies.
- *Is TDD Dead?*, Beck, Fowler & Heinemeier Hansson — the conversation that maps the contested zone between test-first discipline and test-induced design damage.
- "UnitTest" and "Testing Pyramid", Martin Fowler (martinfowler.com) — the sociable-vs-solitary distinction and the shape trade-offs.
