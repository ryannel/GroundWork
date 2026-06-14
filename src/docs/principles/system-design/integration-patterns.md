---
title: Integration Patterns
description: Webhooks, the outbox pattern, idempotency, and the sync-vs-async trade-off.
status: active
last_reviewed: 2026-05-26
---
# Integration Patterns

## TL;DR

Services integrate through a small set of well-understood patterns: synchronous request/response for reads and strict writes, asynchronous events for everything else, the transactional outbox for "database and event must agree," webhooks for pushing to third parties, and idempotency everywhere. We pick the pattern based on the guarantee the integration needs, not on whatever felt easy at the time.

## Why this matters

Most production incidents trace back to an integration that chose the wrong consistency model. A synchronous call where an async event belonged, an event without idempotency, a "fire and forget" webhook that silently dropped on a retry. Integration patterns are one of the few areas where the cost of getting it wrong is paid every day, forever, in an intermittent stream of weirdness. Getting them right means thinking about guarantees explicitly, not architectural fashion.

## Our principles

### 1. Default to async; upgrade to sync when required

For any inter-service communication, async events are the default. We upgrade to synchronous RPC only when we need the response value inline (most user-facing reads) or when the caller needs the commit to have happened before it proceeds (strict writes). Making sync the default couples services together in ways that are invisible in code and disastrous at load.

### 2. Use the outbox pattern when a DB write and an event must agree

When a state change requires both a database write and an event emission, and we need both or neither, we use the transactional outbox: write the event to an `outbox` table inside the same transaction as the state change, then a worker relays the outbox to the broker. This is the only correct solution in a world without distributed transactions, and the only alternative ("just emit after commit") leaks inconsistencies whenever the process dies between the two steps.

### 3. Every consumer is idempotent

Every message handler — webhook receiver, message broker worker, retry-on-failure task — is idempotent. It either carries its own de-duplication key or it operates on keys that make replay safe (an `UPSERT` on a natural key, a conditional update guarded by a version). "At-least-once delivery" is the only delivery guarantee we ever get, and idempotent handling is the only response that works.

### 4. Retries have policies, not just defaults

Every retry policy has an explicit maximum, an explicit backoff curve, and an explicit dead-letter destination. "Retry forever with 1-second backoff" is not a policy — it is how a transient failure becomes a thundering herd. Retries that hit the dead-letter queue fire an alert; the queue is not a garbage bin.

### 5. Webhooks verify, sign, and replay

Inbound webhooks are authenticated with an HMAC signature over the payload, not with a shared secret in the query string. Outbound webhooks are signed the same way. Both sides support replay (the receiver stores the signature, rejects duplicates) and both sides surface a retry history to the sender. Unsigned webhooks are not webhooks; they are unauthenticated POST endpoints.

### 6. Timeouts are end-to-end budgets

Every synchronous call has a timeout, and the timeout is allocated from a *budget* set by the outermost caller. A request with a 2-second budget at the edge does not get to spend 1.5 seconds on a single downstream call — that leaves no slack for retries, for the handler itself, or for the next downstream. Budgeting is a cooperative discipline; without it, tail latencies compound unpredictably ([Performance](../quality/performance.md)).

### 7. Circuit breakers protect the system from itself

When a downstream is failing, we stop calling it. A circuit breaker opens after a threshold of failures, trips the calls to fast-failure, and probes the downstream periodically to see if it has recovered. This protects us from hammering a recovering service and protects upstream callers from tying up threads waiting for an inevitable timeout.

### 8. Every integration has a contract test

A test that exercises the real integration — the real signature verification, the real retry curve, the real idempotency behaviour — runs in CI against an emulator. "It works in the happy path" is not a test; an integration that has only happy-path coverage is an incident waiting for its trigger.

### 9. Dead letters, jitter, and workflow-as-code

A consumer that exhausts its retries routes to a **dead-letter queue that alerts and is worked**, never a silent bin. Retry backoff carries **jitter** — synchronized retries without it are a retry storm. We pick orchestration vs choreography by step count (choreography for simple 2–4-step flows, orchestration for 5+ or branching), and for genuinely long-running, multi-step, or compensating processes we reach for **durable execution** (workflow-as-code) rather than hand-assembling outbox + idempotency + retry + sweeper ([Durable Execution](durable-execution.md)). Webhooks carry a stable event-id, a timestamp replay-window, rotating signing keys via JWKS, and a CloudEvents payload.

## How we apply this

- [Reliability](../quality/reliability.md) — the broader system-level treatment of failure modes.
- [Testing](../foundations/testing.md) — the contract-testing discipline.

## Anti-patterns we reject

- **Sync chains three deep.** Service A calls B calls C calls D. Every failure mode in the chain is now a failure mode for A.
- **"Fire and forget" webhooks.** No signature, no retry, no idempotency. Works once; the next incident it causes is unfixable from the outside.
- **Commit-and-then-publish.** Without the outbox, the two-step process will leave the system inconsistent every time a process dies between steps. It will happen.
- **Global retry policies.** "All HTTP calls retry 3 times with 1-second backoff." What matters is the *specific* downstream's failure profile and the caller's latency budget.
- **Dead-letter queues as logs.** If the DLQ is silently accumulating, integration is not working; it is just failing quietly. Alert and act.

## Further reading

- *Release It!*, Michael Nygard — the canonical treatment of stability patterns (circuit breakers, bulkheads, timeouts).
- *Enterprise Integration Patterns*, Hohpe & Woolf — old but foundational; the vocabulary most of this page inherits.
- *Microservices Patterns*, Chris Richardson — a practical mapping of these patterns onto a modern service architecture.
- *Pat Helland, "Life Beyond Distributed Transactions"* — the paper that made the outbox pattern obvious in retrospect.
