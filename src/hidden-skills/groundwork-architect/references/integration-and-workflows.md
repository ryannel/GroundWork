# Integration & Workflows

Services integrate through a small set of well-understood patterns. Pick the pattern based on the **guarantee the integration needs**, not on whatever felt easy. Most production incidents trace back to an integration that chose the wrong consistency model — a sync call where async belonged, an event without idempotency, a fire-and-forget webhook that dropped on retry. The cost of getting it wrong is paid every day, forever, as an intermittent stream of weirdness.

For a process with many steps, a long runtime, or a must-complete-or-compensate guarantee, the same discipline scales up into **durable execution** — workflow-as-code on an engine that checkpoints every step, resuming exactly where it left off after a crash, deploy, or hours-long wait. It moves the reliability guarantee out of hand-written saga/outbox/retry glue and into the infrastructure, and it is the same primitive that makes long-running agents and human approvals safe.

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

## Dead letters, jitter, and webhooks in practice

- **Dead-letter handling is a named primitive.** A consumer that exhausts its retries routes the message to a DLQ that *alerts and is worked*, never a silent bin — poison messages are expected, not exceptional.
- **Backoff carries jitter.** Bounded exponential backoff **with jitter** is mandatory, not optional — synchronized retries without jitter are a retry storm (a self-inflicted DDoS).
- **Webhooks, current.** A stable event-id for idempotent dedup, a timestamp for a replay-window rejection, **rotating signing keys via JWKS** (not a long-lived shared HMAC secret), and a CloudEvents-shaped payload.

## When workflow-as-code takes over

Name durable execution at design time when a flow is **multi-step, long-running, or compensating** — the hand-rolled alternative (outbox + idempotency key + retry table + state column + a sweeper cron) is a fragile bespoke machine that fails in the gaps between its pieces. Don't reach for it where a single idempotent event handler suffices. A durable workflow and an event backbone are complementary, not rivals: the log decouples producers from consumers and is the source of truth for events; durable execution orchestrates stateful multi-step work on top of it.

The engine provides resume-where-you-left-off and automatic retry; application code expresses the business steps, not the recovery machinery. What it guarantees is **effectively-once**, not exactly-once: activities run *at-least-once* — an engine can crash after a side effect completes but before its result is recorded, and on recovery it runs the step again. The engine makes the *workflow* converge to a single logical outcome; it does not make a non-idempotent `POST` safe on its own. That safety is a property the step author provides with idempotency keys — the same discipline as decision 3 above, one level up.

**Choose the engine by operational shape.** Self-hosted replay engines (Temporal, Restate) for maximum power and flexibility, at the cost of operating the orchestrator. Managed state-machine orchestrators (AWS Step Functions and the equivalents) when the work is gluing managed services together on a single cloud. Embedded/library engines (DBOS, or a Postgres-backed queue plus checkpoint table) for teams already on Postgres who want no new infrastructure, with a real ceiling — every step is at least one write, so a hot workflow fanning out to thousands of children breaks first on Postgres contention. Choose by the operational burden you can carry: the architect names the pattern and the orchestration split, the engineer skill picks and wires the concrete engine.

**Orchestration vs choreography is a deliberate decision — choose by coupling and the need for visibility, not by step count.** Choreography (services react to each other's events, no central coordinator) keeps services loosely coupled and scales naturally, at the cost that no single place knows the state of the whole process. Orchestration (a durable workflow drives the steps) buys central visibility and explicit compensation, at the cost of a coordinator the flow depends on. A concrete case: a two-step order-fulfillment flow that debits payment and reserves inventory, and must refund the payment if the reservation fails, wants orchestration for its compensation and cross-step timeout; a long chain of independent fire-and-forget reactions with no shared deadline or rollback does not, however many steps it has.

**Steps are idempotent, and workflow control flow is deterministic.** Replay-based engines recover by re-executing the workflow function and replaying recorded results for steps already done — so the workflow's control flow must be deterministic (the same history always drives the same branches), while side effects themselves need only be idempotent, not deterministic. A workflow that branches on wall-clock time or unguarded randomness will not replay correctly.

**The substrate for long-running agents.** A long-running agent — plan, act, observe, pause for a human, resume — is a durable workflow: its loop is checkpointed so it survives failure and resumes instead of repeating expensive tool calls, and a human approval is a **durable interrupt** that waits hours or days without holding a thread ([agentic-systems.md](agentic-systems.md)).

## Antipatterns to catch

- **Sync chains three deep** — A→B→C→D. Every failure mode in the chain becomes A's failure mode.
- **Fire-and-forget webhooks** — no signature, no retry, no idempotency. Works once; the next incident is unfixable from the outside.
- **Commit-then-publish without the outbox** — guaranteed inconsistency the first time a process dies mid-step.
- **Global retry policies** — "all HTTP calls retry 3× with 1s backoff" ignores the specific downstream's failure profile and the caller's budget.
- **Dead-letter queues as silent logs** — a DLQ quietly accumulating means integration is failing quietly. Alert and act.
- **Hand-rolled durability** — a retry table + state column + sweeper cron re-implementing an engine.
- **Workflow-as-code for everything** — a heavyweight engine where one idempotent handler would do.
- **Assuming exactly-once side effects** — trusting the platform to make a non-idempotent `POST` safe; only idempotent steps make the outcome effectively-once.
- **Non-deterministic workflows** — branching on wall-clock time or unguarded randomness so replay diverges.
- **Holding a thread for a human** — blocking on approval instead of a durable interrupt.
