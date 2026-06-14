# Integration Patterns

Services integrate through a small set of well-understood patterns. Pick the pattern based on the **guarantee the integration needs**, not on whatever felt easy. Most production incidents trace back to an integration that chose the wrong consistency model — a sync call where async belonged, an event without idempotency, a fire-and-forget webhook that dropped on retry. The cost of getting it wrong is paid every day, forever, as an intermittent stream of weirdness.

## The decisions

1. **Default to async; upgrade to sync only when required.** Async events are the default for inter-service communication. Upgrade to synchronous RPC only when the response value is needed inline (most user-facing reads) or the caller needs the commit to have happened before proceeding (strict writes). Making sync the default couples services in ways invisible in code and disastrous at load.
2. **Outbox when a DB write and an event must agree.** When a state change needs both a database write and an event emission — both or neither — write the event to an `outbox` table inside the same transaction, then relay it to the broker. This is the only correct solution without distributed transactions. "Just emit after commit" leaks inconsistency every time the process dies between the two steps. It will.
3. **Every consumer is idempotent.** At-least-once is the only delivery guarantee you ever get. Every handler carries a de-duplication key or operates on keys that make replay safe (an `UPSERT` on a natural key, a version-guarded conditional update). Idempotent handling is the only response that works.
4. **Retries have policies, not defaults.** Every retry policy has an explicit maximum, an explicit backoff curve with jitter, and an explicit dead-letter destination. "Retry forever with 1-second backoff" is not a policy — it is how a transient failure becomes a thundering herd. The DLQ fires an alert; it is not a garbage bin.
5. **Webhooks verify, sign, and replay.** Inbound and outbound webhooks are authenticated with an HMAC signature over the payload, not a secret in the query string. Both sides support replay (store the signature, reject duplicates) and surface a retry history. An unsigned webhook is just an unauthenticated POST endpoint.
6. **Timeouts are end-to-end budgets.** Every sync call has a timeout allocated from a budget set by the outermost caller. A 2-second edge budget does not get to spend 1.5s on one downstream — that leaves no slack for retries or the next hop. Without budgeting, tail latencies compound unpredictably.
7. **Circuit breakers protect the system from itself.** When a downstream is failing, stop calling it. The breaker opens after a failure threshold, fast-fails the calls, and probes periodically for recovery — protecting both the recovering service and the upstream callers waiting on inevitable timeouts.
8. **Every integration has a contract test.** A test exercising the real signature verification, the real retry curve, the real idempotency behaviour, run in CI against an emulator. Happy-path-only coverage is an incident waiting for its trigger.

## The sync-vs-async call

| Choose sync when | Choose async when |
|---|---|
| The caller needs the response value inline | The work can complete after the caller returns |
| The caller must know the write committed before proceeding | Eventual consistency is acceptable |
| It is a user-facing read | It is fan-out, notification, or cross-service propagation |

When in doubt, async with an idempotent consumer is the more resilient default. Reserve sync for where the guarantee genuinely demands it.

## Dead letters, jitter, and when workflow-as-code takes over

- **Dead-letter handling is a named primitive.** A consumer that exhausts its retries routes the message to a DLQ that *alerts and is worked*, never a silent bin — poison messages are expected, not exceptional.
- **Backoff carries jitter.** Bounded exponential backoff **with jitter** is mandatory, not optional — synchronized retries without jitter are a retry storm (a self-inflicted DDoS).
- **Orchestration vs choreography is a step-count call.** Choreography (services react to events) for simple 2–4-step flows; orchestration for 5+ steps, branching, or when you need visibility. And when a flow is genuinely long-running, multi-step, or compensating, reach for **durable execution** (workflow-as-code) instead of hand-assembling outbox + idempotency + retry + sweeper — see [durable-execution.md](durable-execution.md).
- **Webhooks, current.** A stable event-id for idempotent dedup, a timestamp for a replay-window rejection, **rotating signing keys via JWKS** (not a long-lived shared HMAC secret), and a CloudEvents-shaped payload.

## Antipatterns to catch

- **Sync chains three deep** — A→B→C→D. Every failure mode in the chain becomes A's failure mode.
- **Fire-and-forget webhooks** — no signature, no retry, no idempotency. Works once; the next incident is unfixable from the outside.
- **Commit-then-publish without the outbox** — guaranteed inconsistency the first time a process dies mid-step.
- **Global retry policies** — "all HTTP calls retry 3× with 1s backoff" ignores the specific downstream's failure profile and the caller's budget.
- **Dead-letter queues as silent logs** — a DLQ quietly accumulating means integration is failing quietly. Alert and act.
