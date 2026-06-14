---
title: Durable Execution
description: Workflow-as-code as a first-class primitive — moving reliability for multi-step, long-running, and must-complete processes out of application code and into the infrastructure.
status: active
last_reviewed: 2026-06-14
---
# Durable Execution

## TL;DR

For a process that has many steps, runs for a long time, or must either complete or compensate, we reach for **durable execution** — workflow-as-code on an engine that checkpoints every step so the process resumes exactly where it left off after a crash, deploy, or hours-long wait. It moves the reliability guarantee out of hand-written saga, outbox, and retry glue and into the infrastructure. It is the same primitive that makes long-running agents and human-in-the-loop approvals safe.

## Why this matters

The classic way to make a multi-step process reliable is to hand-assemble it: an outbox here, an idempotency key there, a retry table, a state column, a cron to sweep the stuck ones. Each piece is correct and the whole is a fragile machine that every engineer reasons about differently and that fails in the gaps between the pieces. Durable execution collapses that machine into ordinary code whose execution state is automatically persisted — "a function that survives a crash and resumes." It became mainstream because the AI era produced exactly the workload it is best at: long-running, tool-calling, occasionally-paused agent processes that cannot afford to restart from zero.

## Our principles

### 1. Workflow-as-code is a first-class primitive

For multi-step, long-running, or compensating processes, we prefer a durable execution engine over hand-rolled saga + outbox + retry orchestration. The workflow is written as ordinary, mostly-linear code; the engine persists its progress. This sits beside choreography and orchestration as a named architectural option, not buried inside "saga."

### 2. Durability lives in the infrastructure, not the code

The reliability guarantee — resume-where-you-left-off, exactly-once side effects, automatic retry — is provided by the engine, not re-implemented per process. Application code expresses the business steps; the platform owns the crash recovery. This is what makes the difference between a process that survives a deploy and one that strands work.

### 3. Choose the engine by operational shape

The category has distinct shapes: **Temporal** (a dedicated cluster, the most mature, proven at scale), **Restate** (simpler to operate), and **DBOS** (an embedded library that reuses Postgres as the durability layer, no separate orchestrator — the low-footprint option for teams already on Postgres). Choose by the operational burden you can carry, not by popularity.

### 4. It complements the event log, it does not replace it

A durable workflow and an event backbone (Kafka and friends) are complementary: the log decouples producers from consumers and is the source of truth for events; durable execution orchestrates stateful, multi-step work on top. Building long workflows on the raw log alone is significant custom machinery; reaching for a workflow engine where a single event handler suffices is overkill.

### 5. Orchestration vs choreography is a deliberate decision

Choreography (services react to each other's events) suits simple, 2–4-step domain flows with no central coordinator. Orchestration (a durable workflow drives the steps) suits 5+ steps, branching logic, compensation, or when you need visibility into where a process is. Pick by step count and the need for observability, not by habit.

### 6. Steps are idempotent and deterministic

The engine delivers reliability by *replaying* workflow code, so the workflow's own logic must be deterministic and its side-effecting steps idempotent — the same contract the rest of the system already holds for retried messages. A workflow that branches on wall-clock time or an unguarded random value will not replay correctly.

### 7. It is the substrate for long-running agents

A long-running agent — plan, act, observe, pause for a human, resume — is a durable workflow: its loop is checkpointed so it survives failure and resumes rather than repeating expensive tool calls, and a human approval is modelled as a **durable interrupt** that can wait for hours or days without holding a thread. This is the reliability backbone of [Agentic Systems](../ai-native/agentic-systems.md).

## How we apply this

The architect names durable execution as the pattern when a process is long-running, multi-step, or must-complete, and decides the orchestration/choreography split; the engineer skills implement the workflow and choose the concrete engine. Durable execution is shared infrastructure the system rides, not per-process scaffolding.

- [Integration Patterns](integration-patterns.md) — the outbox/saga/idempotency patterns durable execution subsumes.
- [Agentic Systems](../ai-native/agentic-systems.md) — long-running agents are durable workflows.

## Anti-patterns we reject

- **Hand-rolled durability.** A retry table, a state column, and a sweeper cron re-implementing what an engine provides — fragile and bespoke per team.
- **Workflow-as-code for everything.** A heavyweight engine where a single idempotent event handler would do.
- **Non-deterministic workflows.** Branching on wall-clock time or unguarded randomness, so replay diverges.
- **The event-sourced-monolith reflex.** Reaching for full orchestration when a simple two-step choreography is correct.
- **Holding a thread for a human.** Blocking on an approval instead of a durable interrupt that resumes on decision.

## Further reading

- *Temporal*, *Restate*, *DBOS* — the durable execution engines and their differing operational shapes.
- *Life Beyond Distributed Transactions*, Pat Helland — the reasoning the outbox and durable workflows descend from.
- *The rise of the durable execution engine* — durable execution alongside an event backbone.
