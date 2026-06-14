# Durable Execution

For a process with many steps, a long runtime, or a must-complete-or-compensate guarantee, durable execution — workflow-as-code on an engine that checkpoints every step — moves the reliability guarantee out of hand-written saga/outbox/retry glue and into the infrastructure. The workflow resumes exactly where it left off after a crash, deploy, or hours-long wait. It is the same primitive that makes long-running agents and human approvals safe.

## When to reach for it

Name durable execution at design time when the process is **multi-step, long-running, or compensating** — the hand-rolled alternative (outbox + idempotency key + retry table + state column + a sweeper cron) is a fragile bespoke machine that fails in the gaps between its pieces. Don't reach for it where a single idempotent event handler suffices.

## Durability lives in the infrastructure

The engine provides resume-where-you-left-off, exactly-once side effects, and automatic retry; application code expresses the business steps. This is the line between a process that survives a deploy and one that strands work. The reliability guarantee is not re-implemented per process.

## Choose the engine by operational shape

- **Temporal** — dedicated cluster, most mature, proven at scale.
- **Restate** — simpler to operate.
- **DBOS** — embedded library reusing Postgres as the durability layer, no separate orchestrator; the low-footprint option for teams already on Postgres.

Choose by the operational burden you can carry. (The architect names the pattern and the orchestration split; the engineer skill picks and wires the concrete engine.)

## It complements the event log

A durable workflow and an event backbone are complementary: the log decouples producers from consumers and is the event source of truth; durable execution orchestrates stateful multi-step work on top ([integration-patterns.md](integration-patterns.md)). Building long workflows on the raw log alone is significant custom machinery.

## Orchestration vs choreography — a deliberate call

- **Choreography** (services react to each other's events): simple 2–4-step domain flows, no central coordinator.
- **Orchestration** (a durable workflow drives the steps): 5+ steps, branching, compensation, or when you need visibility into where a process is.

Pick by step count and the need for observability, not habit.

## Steps are idempotent and deterministic

The engine delivers reliability by *replaying* workflow code, so workflow logic must be deterministic and side-effecting steps idempotent — the same contract retried messages already hold. A workflow that branches on wall-clock time or unguarded randomness will not replay correctly.

## The substrate for long-running agents

A long-running agent — plan, act, observe, pause for a human, resume — is a durable workflow: its loop is checkpointed so it survives failure and resumes instead of repeating expensive tool calls, and a human approval is a **durable interrupt** that waits hours or days without holding a thread ([agentic-systems.md](agentic-systems.md)).

## Antipatterns to catch

- **Hand-rolled durability** — a retry table + state column + sweeper cron re-implementing an engine.
- **Workflow-as-code for everything** — a heavyweight engine where one idempotent handler would do.
- **Non-deterministic workflows** — branching on wall-clock/randomness so replay diverges.
- **Holding a thread for a human** — blocking on approval instead of a durable interrupt.
