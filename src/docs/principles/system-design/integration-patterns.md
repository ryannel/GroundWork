---
title: Integration Patterns
description: Webhooks, the outbox pattern, idempotency, and the sync-vs-async trade-off.
status: active
last_reviewed: 2026-06-19
---
# Integration Patterns

## TL;DR

Services integrate through a small set of well-understood patterns: synchronous request/response for reads and strict writes, asynchronous events for everything else, the transactional outbox for "database and event must agree," webhooks for pushing to third parties, and idempotency everywhere. We pick the pattern based on the guarantee the integration needs, not on whatever felt easy at the time.

## Why this matters

Most production incidents trace back to an integration that chose the wrong consistency model. A synchronous call where an async event belonged, an event without idempotency, a "fire and forget" webhook that silently dropped on a retry. Integration patterns are one of the few areas where the cost of getting it wrong is paid every day, forever, in an intermittent stream of weirdness. Getting them right means thinking about guarantees explicitly, not architectural fashion.

## Our principles

### 1. Choose by coupling, not by transport — and async is not free decoupling

Between services, async events are our default, because a synchronous call binds the caller's availability and latency to the callee's. But the rule that earns its keep is *choose by the guarantee, not the transport*. Respected practitioners default the other way — sync is simpler to build, trace, and reason about, with no eventual-consistency semantics to explain to consumers — and they are right that async-by-default, applied thoughtlessly, buys a distributed monolith: the same request/reply shape over a queue, now with worse debugging. Async only decouples when the caller genuinely stops needing the result inline. Request/reply over a broker is synchronous coupling with extra steps and no inline answer.

Decision rule: stay synchronous when the caller needs the result to proceed (most user-facing reads) or needs the write committed before it continues (strict writes), and when caller and callee share a team and a release cadence. Go async when the work can complete after the caller returns, when the consumer set is open or changing, or when you need load-leveling between a fast producer and a slow consumer. If the design is "send a message, then block waiting for the reply," that is sync — build it as sync.

### 2. The outbox pattern solves the dual-write problem — pick the relay deliberately

When a state change requires both a database write and an event, and we need both or neither, publishing to the broker after the DB commits is a *dual write*: a crash between the two steps leaves the system permanently inconsistent, and at scale it will happen. The fix is to make the event part of the same transaction — write it to an `outbox` table inside the state-change transaction, then relay the outbox to the broker.

How the relay reads the outbox is a real choice, not a detail. A polling relay is the simplest correct option and right for moderate volume. Log-based change data capture (Debezium tailing the write-ahead log) removes both the polling load and the polling latency, at the cost of running and operating a CDC pipeline. The two compose: CDC *over the outbox table* gives near-real-time relay with a clean, app-controlled event schema, instead of streaming raw table changes and coupling every consumer to your column layout. Decision rule: poll until its load or latency is the thing that hurts, then move to CDC over the outbox table; reach for raw-table CDC only when the source genuinely is the table (replication, search indexing), not a domain event.

### 3. Every consumer is idempotent

Every message handler — webhook receiver, message broker worker, retry-on-failure task — is idempotent. It either carries its own de-duplication key or it operates on keys that make replay safe (an `UPSERT` on a natural key, a conditional update guarded by a version). "At-least-once delivery" is the only delivery guarantee we ever get, and idempotent handling is the only response that works.

### 4. Retries have a shape — budgets and circuit breakers are Reliability's call

Every retry policy has an explicit maximum, an explicit backoff curve *with jitter*, and an explicit dead-letter destination that fires an alert, not a bin that quietly fills. How much retrying is allowed in aggregate, and whether a circuit breaker or a retry budget is the right backstop for overload, is the reliability discipline — see [Reliability](../quality/reliability.md) §4.

### 5. Webhooks follow the Standard Webhooks shape

Don't reinvent webhook security; follow the Standard Webhooks spec. Sign with HMAC-SHA256 over `id.timestamp.body`, never a shared secret in a query string. Carry a stable event id (so receivers de-duplicate) and a timestamp (so receivers reject anything outside a short replay window). Support key rotation — multiple active signing keys, published via JWKS for asymmetric setups — so a key can be retired without downtime. Surface a retry history to the sender, and outbound, sign exactly as you expect inbound to be signed. A CloudEvents-shaped payload keeps producer and consumer honest about envelope vs. data. An unsigned webhook is not a webhook; it is an unauthenticated POST endpoint.

### 6. Timeouts are end-to-end budgets

Every synchronous call has a timeout allocated from the budget set by the outermost caller, never chosen locally — the allocation discipline is [Performance](../quality/performance.md) §1.

### 7. Every integration has a contract test

A test that exercises the real integration — the real signature verification, the real retry curve, the real idempotency behaviour — runs in CI against an emulator. "It works in the happy path" is not a test; an integration that has only happy-path coverage is an incident waiting for its trigger.

### 8. Multi-step flows: choreography, orchestration, or durable execution

Choreography — each service reacts to events and emits its own — keeps services loosely coupled but makes the overall flow implicit: no single place shows what is supposed to happen or where it stalled. Orchestration puts one coordinator in charge of the sequence and its compensations, buying visibility and explicit failure handling at the price of a central coupling point. The decision rule — choose by coupling and the need for visibility, not step count — and the durable-execution escalation for anything long-running or compensating live in one place: [Durable Execution](durable-execution.md) §5.

## How we apply this

- [Reliability](../quality/reliability.md) — the broader system-level treatment of failure modes, including retry budgets and circuit breakers.
- [Performance](../quality/performance.md) — the latency-budget discipline timeouts are allocated from.
- [Testing](../foundations/testing.md) — the contract-testing discipline.

## Anti-patterns we reject

- **Sync chains three deep.** Service A calls B calls C calls D. Every failure mode in the chain is now a failure mode for A.
- **Async that is secretly sync.** Request/reply over a queue where the caller blocks for the response. You paid the full eventual-consistency and debugging tax and bought none of the decoupling.
- **"Fire and forget" webhooks.** No signature, no retry, no idempotency. Works once; the next incident it causes is unfixable from the outside.
- **Commit-and-then-publish.** Without the outbox, the dual write will leave the system inconsistent every time a process dies between steps. It will happen.
- **Global retry policies.** "All HTTP calls retry 3 times with 1-second backoff." What matters is the *specific* downstream's failure profile, the caller's latency budget, and a cap on retries as a fraction of traffic.
- **Dead-letter queues as logs.** If the DLQ is silently accumulating, integration is not working; it is just failing quietly. Alert and act.

## Further reading

- *Release It!*, Michael Nygard — the canonical treatment of stability patterns (circuit breakers, bulkheads, timeouts).
- *Enterprise Integration Patterns*, Hohpe & Woolf — old but foundational; the vocabulary most of this page inherits.
- *Microservices Patterns*, Chris Richardson — a practical mapping of these patterns onto a modern service architecture.
- Pat Helland, "Life Beyond Distributed Transactions" — the paper that made the outbox pattern obvious in retrospect.
- Marc Brooker, "Will circuit breakers solve my problems?" — why breakers turn partial failures into total ones, and the case for retry budgets under overload.
- The Standard Webhooks spec (standardwebhooks.com) — the interoperable signing, replay-window, and verification shape worth adopting rather than reinventing.
