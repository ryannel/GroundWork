---
title: Testing
description: Continuous Risk Assurance — testing the system, not the mock of the system.
status: active
last_reviewed: 2026-06-26
---
# Testing

## TL;DR

Tests are risk-weighted assertions about production behaviour — not boxes ticked for coverage. We favour high-fidelity service tests over solitary unit tests, run dependencies we own as real ephemeral containers rather than mocking them, contract-test the ones we don't, and treat observability signals as first-class assertions. Above the honeycomb sits one more level: a proof that drives the real shipping build through its front door on the real pipeline, because parts that each pass in isolation can still assemble into a product that does nothing — and a fake a test leans on needs a real test behind it. The measure of a suite is whether its assertions actually catch faults — not its line-coverage number. The invariant under all of it: a test that captures whatever the system currently does is worthless unless something *independent* of the implementation asserts that behaviour is correct. Independent oracles and reproducible failures are the spine; the distribution shape is a detail teams over-argue.

## Why this matters

The dominant failure mode of a test suite in 2026 is not that it is too small — it is that it passes while production breaks. Mocked dependencies drift from their real counterparts, unit tests assert on implementation rather than behaviour, and green CI gives a false sense of security. *Continuous Risk Assurance* is our name for the discipline that replaces "coverage as a target" with "risk as the thing we actually measure."

This matters more, not less, as code generation gets cheaper. When an agent can produce a plausible implementation in seconds, the bottleneck moves from writing code to *trusting* it. The test suite becomes the executable specification that constrains generated code — the thing that says what "correct" means when the author is a model and the reviewer is short on time. A weak suite that generated code passes is worse than no suite, because it manufactures confidence.

## Our principles

### 1. Favour service tests over solitary unit tests

Our default shape is the **test honeycomb**, popularised by Spotify's engineering teams: a fat middle of integrated, "sociable" service tests, a thin layer of solitary unit tests, and a few end-to-end checks on top — not the classic Mike Cohn pyramid that pushes most weight onto isolated units. We test from the API entry point through to real, ephemeral database containers, because in a service-oriented codebase the interesting bugs live at the boundaries — HTTP serialisation, SQL query correctness, transaction semantics, event emission — exactly what solitary unit tests mock away.

The honeycomb is a stack-appropriate heuristic, not a law. No empirical study ranks the pyramid, honeycomb, and trophy by defect detection — they are practitioner shapes for different interaction surfaces (service-to-service for the honeycomb, component-interaction for Kent Dodds's frontend trophy), and the word "integration" means something far cheaper in one than the other. What the evidence does support is that test *quality* outweighs distribution: a suite of fast, reliable, expressive tests that fail only for useful reasons beats any ratio of tests that don't. So pick the shape that fits the stack — the honeycomb for our backends, the trophy for a frontend — and spend the saved argument on making each test bite.

The honest tension: service tests buy fidelity at the cost of speed and diagnostic precision. A solitary unit test that fails names the broken function; a service test that fails tells you "the create-order flow is broken" and leaves you to find where. And a slow, flaky service layer is corrosive — teams that can't trust or tolerate it quietly retreat to mocking everything, which is the exact failure this principle exists to prevent. So fidelity is not a licence to be slow: keep service tests parallelisable, keep fixtures cheap, and treat suite latency as a first-class defect.

Decision rule: reach for a solitary unit test when the logic is **algorithmically dense and boundary-poor** — a parser, a pricing calculator, a state machine, a validator — where the combinatorics are the risk and a container adds only latency. Reach for a service test when the risk lives in the **wiring** — serialisation, persistence, queries, events, auth. When a service-test failure is routinely hard to localise, that is a signal to factor out the dense core and unit-test it directly, not to mock the boundary.

### 2. Run real dependencies you own; contract the ones you don't

For a dependency you own and deploy — Postgres, your message broker, object storage — run the real thing in an ephemeral container (Testcontainers or equivalent). In-memory fakes miss the bugs that actually escape to production: schema and migration mismatches, serialisation edge cases, transaction and isolation behaviour, query-planner surprises. Pin the image to the version you run in production — never `latest`, which turns an upstream release into a flaky build. Reset state between tests for determinism, and share a container across a suite rather than per-test so startup cost doesn't dominate the run.

But "emulate everything" is a false absolute, and applied carelessly it wrecks the feedback loop — full brokers and databases spun up for tests that exercise none of their behaviour buy nothing but minutes. Two cases break the rule:

- **Third-party services you do not control** (a payments API, a SaaS provider) usually cannot be containerised faithfully, and a hand-written mock of them is the worst of both worlds — it encodes *your belief* about their behaviour, which is precisely what drifts. Verify against a **contract** instead: a consumer-driven contract (Pact) or a recorded/replayed interaction captured from the real provider, plus a small, periodically-run live suite against a sandbox to detect drift. Pact's leverage is weaker here because you can't compel an external provider to verify your contract, so treat the contract as a drift detector, not proof.
- **Pure logic with no real I/O.** If the unit under test has no genuine dependency, don't invent one to stand a container up behind. Test it directly.

Decision rule: emulate the data and serialisation boundaries you own; contract-test the boundaries you don't; mock only at a seam you fully control and only when the real thing adds latency without adding risk. A mock that stands in for a database is almost always the wrong call (see anti-patterns); a recorded contract for a remote API you can't run is often the right one.

### 3. Observability is a test surface

OpenTelemetry instrumentation is a design-time concern, not an afterthought — sketch the trace a feature should produce before writing the handler (the observability-driven development stance, [Observability](../quality/observability.md) principle 5). System tests then assert that traces are unbroken end-to-end: a missing span, a lost TraceID, or a broken parent-child relationship is a test failure, not an instrumentation TODO. The boundary between "test" and "monitor" dissolves — both ask whether the system is behaving as we claim. The payoff is double-counted: the same instrumentation that proves correctness in CI is what lets you debug the incident in production.

The mechanism is an **in-memory span exporter**: register one in the test process, exercise the system, and assert on the finished spans — the DB span exists with the attributes a dashboard query depends on, the spans emit in the expected order, the TraceID propagates across a service hop. This is a built-in capability of every OTel SDK, and it is the durable approach now that the dedicated trace-based-testing tools (Tracetest, Malabi) have gone dormant. Assert on what the contract promises and let the rest float (the over-assertion trap is real — see [Observability](../quality/observability.md) principle 6). "Trace coverage" as a *metric* — a line-or-branch-coverage equivalent for spans — is still aspirational research, not a number to gate on; the proven practice is traces-as-assertions, not a coverage percentage.

### 4. Name tests by behaviour, not implementation

A test name must let an on-call engineer form a hypothesis from the failure log alone, without opening the test file. The default form — `[Unit] should [expected outcome] when [condition]` — encodes that intent, and names like `TestCreateItem_Success` are banned because they convey nothing beyond what the dashboard already shows. The format serves the goal; the goal is the rule. A name that states behaviour and condition in another shape is fine. A name that follows the template but says nothing specific (`should work when called`) is not.

### 5. Risk-based depth, and prove the assertions bite

Coverage percentages are meaningless without proof that the assertions catch real faults — a suite can execute every line and assert nothing. We score modules on Impact × Complexity × Change-frequency before deciding test depth: high-risk modules earn live system tests and chaos experiments; low-risk modules need only small tests and static analysis. Equal depth everywhere is wasted effort.

The honest measure of whether assertions bite is **mutation testing** (PIT, Stryker, mutmut, or equivalent): inject deliberate faults and confirm a test fails. A surviving mutant is a line you cover but do not actually check. This is the honeycomb's natural complement: a fat sociable service test drives a huge number of branches through one HTTP call, and it is easy for it to *execute* them all while only asserting on the response body — mutation testing is the one instrument that proves the suite checks what it runs rather than merely exercising it. It correlates with real fault detection better than coverage does, though not once you control for suite size, so treat it as a quality read-out, not a bug-finding proxy.

Mutation testing is expensive — its naive cost is the suite run times the number of mutants — so never run it across the whole tree and never make it a blanket gate. Run it on the high-risk modules the matrix flags and on changed code only, the model Google operates at scale: incremental, mutate-the-diff, surfaced in review. Tooling maturity is uneven and the guidance degrades gracefully with it — Stryker (JS/TS), PIT (JVM), and mutmut/cosmic-ray (Python) are production-grade; Go's options are pre-1.0 and slow, so there it stays a hand-run spot check, not an expectation. The same read-out is the antidote to AI-generated tests, whose oracles are derived from the current implementation and so cement existing bugs as expected behaviour: generate the test, mutate the code under it, and feed any surviving mutant back as the missing assertion — the assurance filter that turns a coverage-inflating suite into one that bites.

### 6. Tests are part of the change, not after it

A feature PR without tests is incomplete, and we review the test with the same rigour as the code. Tests deferred to a "follow-up PR" compete with the next feature and usually lose, so the work isn't done until the verification ships with it. The exceptions are honest and narrow: a proof of concept or throwaway prototype whose purpose is to be deleted does not need tests — but the moment it becomes the implementation, it does.

This is a discipline about *what ships together*, not a mandate to write tests first. Test-first (TDD) is a powerful design tool — it forces you to use your own interface before committing to it — but it is a tool, not a law, and the "Is TDD Dead?" exchange between Kent Beck, Martin Fowler, and DHH named the real cost: dogmatic test-first can induce *design damage*, contorting code with needless indirection purely to make it mockable. Hold both signals. If a change resists testing, that usually means the design is wrong — fix the code. But if the *only* way to test it is to shatter a cohesive unit into layers of indirection nothing else needs, the test is making the demand, and the design was right. Write the test with the change; let it pressure the design; don't let it deform the design.

### 7. Generate the inputs you can't enumerate

Example-based tests check the cases you thought of; the bugs live in the cases you didn't. Where the input space is large and a property holds across all of it — a round-trip (`decode ∘ encode = id`), a parser that must never panic, a calculation with an algebraic invariant, a state machine whose transitions must preserve a constraint — assert the property and let the framework generate and shrink counterexamples (Hypothesis, fast-check, jqwik, rapid). This is the highest-leverage complement to the dense-logic unit tests of principle 1: one property covers an infinity of examples, and in practice most caught faults surface on a single generated input, so it earns its keep cheaply. The cost is authoring — a meaningful property needs domain insight and a generator — so reach for it where invariants are real, not everywhere.

The same generator-driven idea spans two more surfaces. At the service boundary, **Schemathesis** derives a semantics-aware fuzzer straight from an OpenAPI/GraphQL spec and is the bridge between contract testing and property-based testing — it finds materially more defects than example-based API tests for the cost of pointing it at the schema. At the byte boundary, coverage-guided **fuzzing** (`go test -fuzz`, cargo-fuzz/libFuzzer) is first-class for parsers and decoders, and a failing input is saved as a permanent regression seed. For stateful or distributed cores where ordering and failure timing are the risk, deterministic simulation testing (Antithesis, FoundationDB/TigerBeetle-style seeded simulators) is the frontier worth knowing — every bug reproduces from `seed + commit` — but its setup cost is real, so treat it as a deliberate investment for the system's hardest core, not a default.

### 8. Prove the whole product at the front door

The honeycomb proves the parts. One level sits above it: a proof that drives the **real shipping build** — the packaged, embedded artifact a user actually launches — through its **real front door**, on the **real pipeline**, end to end, the way a user's action travels. A service test that proves an engine behind a harness and a UI test that drives screens against a scripted stand-in can both pass while the assembled product does nothing, because the wiring between them was nobody's test. The front-door proof is the one that fails when the real thing is unwired, and it is what "done" means for a feature a user touches.

This is where **a fake needs a real test behind it** becomes load-bearing. Every stub, fixture, or seeded file a test leans on is a claim that something real produces that value, and the claim is honest only when another test exercises the real producer. A media library whose tests write fixture thumbnails passes green while the shipping grid renders blank — nothing in the suite ever generated a real thumbnail, so the fixture stood in for a stage that did not exist. Seeded inputs are not the violation: handing the real pipeline a known fixture folder tests the pipeline on controlled data. Replacing the pipeline with a script that emits the expected output is the violation. The line is whether the work in the middle runs for real.

Non-functional outcomes a user feels — latency, throughput, memory headroom — are proven the same way. A number measured against an early prototype decays the moment the design that produced it changes; it has to be re-proven on the shipping path, not carried forward as a one-time measurement.

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
- **Proving the engine, shipping the product.** A headless proof that the core behaves behind a harness is a slice of confidence, not the product. Until a test drives the assembled, shipping build through the front door on the real pipeline, "it works" is unproven where a user stands.
- **A fake with no real test behind it.** A fixture or stub that nothing real ever produces is a green light wired to nothing. Every fake is a debt; the real test that exercises the producer is how it gets paid.
- **"It's hard to test, so we didn't."** That is a signal the code is badly designed. Fix the code.

## Further reading

- *Accelerate*, Forsgren, Humble, Kim — the empirical case for continuous delivery and its testing discipline.
- *Working Effectively with Legacy Code*, Michael Feathers — seams, test doubles, and when each is appropriate.
- *Growing Object-Oriented Software, Guided by Tests*, Freeman & Pryce — the canonical treatment of outside-in service testing.
- *xUnit Test Patterns*, Gerard Meszaros — the vocabulary we use for test doubles, fixtures, and strategies.
- *Is TDD Dead?*, Beck, Fowler & Heinemeier Hansson — the conversation that maps the contested zone between test-first discipline and test-induced design damage.
- "UnitTest", "TestPyramid", and "On the Diverse and Fantastical Shapes of Testing", Martin Fowler (martinfowler.com) — the sociable-vs-solitary distinction, the shape trade-offs, and Justin Searls's argument that the shape debate is a distraction from test quality.
- "Testing of Microservices", Spotify Engineering — the honeycomb shape and the integrated-vs-integration-test distinction it rests on.
- "Practical Mutation Testing at Scale: A View from Google" — the changed-code-only, surfaced-in-review model that makes mutation testing affordable.
- "A Next Step Beyond Test-Driven Development", Honeycomb.io (Charity Majors) — observability-driven development and testing in production.
- *Deriving Semantics-Aware Fuzzers from Web API Schemas* (Schemathesis, ICSE 2022) — the empirical case for spec-driven property fuzzing at the service boundary.
