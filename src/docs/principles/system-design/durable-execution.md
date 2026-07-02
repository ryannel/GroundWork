---
title: Durable Execution
description: Workflow-as-code as a first-class primitive — moving reliability for multi-step, long-running, and must-complete processes out of application code and into the infrastructure.
status: active
last_reviewed: 2026-06-19
---
# Durable Execution

## TL;DR

For a process that has many steps, runs for a long time, or must either complete or compensate, we reach for **durable execution** — workflow-as-code on an engine that checkpoints progress so the process resumes where it left off after a crash, deploy, or hours-long wait. It moves the reliability guarantee out of hand-written saga, outbox, and retry glue and into the infrastructure. It is the same primitive that makes long-running agents and human-in-the-loop approvals safe. It is not free: it imposes a determinism contract on workflow code and a versioning discipline on every deploy, and below a complexity threshold an outbox or a queue is the better tool.

## Why this matters

The classic way to make a multi-step process reliable is to hand-assemble it: an outbox here, an idempotency key there, a retry table, a state column, a cron to sweep the stuck ones. Each piece is correct and the whole is a fragile machine that every engineer reasons about differently and that fails in the gaps between the pieces. Durable execution collapses that machine into ordinary code whose execution state is automatically persisted — "a function that survives a crash and resumes." The category predates the current AI wave (it grew out of Uber's Cadence and the workflow engines before it), but agent workloads — long-running, tool-calling, occasionally-paused processes that cannot afford to restart from zero — are exactly its best fit, and they drove it into the mainstream.

## Our principles

### 1. Workflow-as-code is a first-class primitive

For multi-step, long-running, or compensating processes, we prefer a durable execution engine over hand-rolled saga + outbox + retry orchestration. The workflow is written as ordinary, mostly-linear code; the engine persists its progress. This sits beside choreography and orchestration as a named architectural option, not buried inside "saga."

It is not the default for every async task, and the cost is real: a determinism contract, a versioning discipline, and often a new piece of infrastructure to operate. **Decision rule:** reach for durable execution when a process has three or more steps that must survive a crash *together*, holds state across minutes-to-days, or needs compensation and progress visibility. Below that — fire-and-forget work, a single idempotent event handler, "publish this event reliably" — an outbox or a queue is correct and a workflow engine is overkill. The honest failure mode runs the other way too: a queue plus cron plus a retry table that has accreted dedup windows, scattered timers, and compensations is a workflow engine you built by accident, missing the correctness guarantees and observability you would have gotten for free.

### 2. Durability lives in the infrastructure, not the code

The reliability guarantee — resume-where-you-left-off, durable timers, automatic retry — is provided by the engine, not re-implemented per process. Application code expresses the business steps; the platform owns crash recovery.

What the engine guarantees is **effectively-once**, not exactly-once. Activities and steps run *at-least-once*: an engine can crash after a side effect completes but before its result is recorded, and on recovery it runs the step again. The engine makes the *workflow* converge to a single logical outcome; it does not make a non-idempotent `POST` safe. Exactly-once side effects are a property the step author provides with idempotency keys — the platform turns at-least-once delivery into effectively-once *outcomes* only when the steps cooperate. Treating "exactly-once" as a free platform guarantee is the most common way teams get double-charges in a system they believed was safe.

### 3. Choose the engine by operational shape

The category spans distinct operational shapes, and the choice is dominated by the burden you can carry, not by popularity:

- **Self-hosted replay engines** (Temporal, Restate) — maximum power and flexibility; you operate (or pay for) the orchestrator.
- **Managed state-machine orchestrators** (AWS Step Functions and the equivalents on other clouds) — workflows declared as state machines with deep native integration to cloud services and nothing to run, traded against awkward branching/loops and single-cloud lock-in.
- **Embedded / library engines** (DBOS, or a Postgres-backed queue plus checkpoint table) — durable execution as a library inside your existing process, no separate orchestrator, minimal code change; the low-footprint option for teams already on Postgres, with a real ceiling — every step is at least one write, so a hot workflow fanning out to thousands of children breaks first on Postgres contention.

**Decision rule:** already deep in one cloud and mostly orchestrating its services → managed state machine. Already on Postgres, modest scale, want to avoid new infrastructure → embedded/library. Complex long-lived workflows, high scale, or cross-environment (hybrid/on-prem) → a self-hosted replay engine.

### 4. It complements the event log, it does not replace it

A durable workflow and an event backbone (Kafka and friends) are complementary: the log decouples producers from consumers and is the source of truth for events; durable execution orchestrates stateful, multi-step work on top. Building long workflows on the raw log alone is significant custom machinery; reaching for a workflow engine where a single event handler suffices is overkill.

### 5. Orchestration vs choreography is a deliberate decision

Choreography (services react to each other's events, no central coordinator) keeps services loosely coupled and scales naturally; its cost is that no single place knows the state of the whole process, which makes debugging and compensation hard. Orchestration (a durable workflow drives the steps) buys you central visibility, explicit compensation, and one place to reason about the flow, at the cost of a coordinator the flow depends on.

**Decision rule:** choose by coupling and the need for visibility, not by step count. Choreography when the steps are genuinely independent reactions and no one needs to ask "where is this process right now"; orchestration the moment you need compensation, branching, a process-level SLA, or an operator who can see and intervene. A concrete case: a two-step order-fulfillment flow that debits payment and reserves inventory, and must refund the payment if the reservation fails, wants orchestration for its compensation and cross-step timeout — step count is a symptom, not the criterion, and a long chain of independent fire-and-forget reactions with no shared deadline or rollback does not want it, however many steps it has.

### 6. Determinism is a replay constraint, and it lives in the control flow

Replay-based engines (Temporal, Restate) recover by re-executing the workflow function and replaying recorded results for steps already done. That imposes a hard contract: the workflow's **control flow** must be deterministic, so the same history always drives the same branches. The side effects themselves need not be deterministic — a query or API call can and should return fresh data each run; they require *idempotency or duplication tolerance*, not determinism. The bug this prevents is concrete: branch on a raw `now()` or an unguarded random value and a replay can take a different path than the original, double-charging or skipping a step. Engines supply deterministic primitives — recorded timestamps, UUIDs, random — precisely so unavoidable non-determinism becomes a durable, replayable step.

The constraint is engine-specific, not a universal law of the category. Checkpoint-based engines (DBOS, the Postgres approach) re-run the function and reuse recorded step outputs, so control-flow stability still matters but the rules are looser and differently shaped than full deterministic replay. **Decision rule:** know which model your engine uses before you write the workflow — the determinism contract is the single thing most likely to bite, and it differs between replay and checkpoint engines.

### 7. Versioning running workflows is a first-class cost, not an afterthought

A durable workflow can be in flight for days or months, so a deploy can land *while executions are mid-flight* against the old code. For a replay engine, changing the workflow's shape — reordering steps, adding a branch before an existing one — breaks replay of in-flight executions with a non-determinism error. This is the operational tax of long-lived workflows, and it must be designed for from the first deploy, not discovered in an incident.

The two mechanisms are **patching** (guard the changed code path behind a version marker so old executions take the old branch and new ones take the new) and **worker versioning** (pin in-flight executions to the worker version they started on, and let new executions adopt new code). **Decision rule:** patch small, in-place changes to a workflow's logic; pin-and-drain whole workflow versions for larger reshapes. Either way, treat "can this change replay against everything currently running?" as a release gate. Embedded/checkpoint engines soften but do not remove this concern — a function that no longer matches the steps recorded for an in-flight run is still a hazard.

### 8. It is the substrate for long-running agents

A long-running agent — plan, act, observe, pause for a human, resume — is a durable workflow: its loop is checkpointed so it survives failure and resumes rather than repeating expensive tool calls, and a human approval is modelled as a **durable interrupt** that can wait for hours or days without holding a thread. The agent loop is also where the determinism contract is easiest to violate (the model output is non-deterministic by nature), so the LLM call belongs in a recorded step, never inline in the control flow. This is the reliability backbone of [Agentic Systems](../ai-native/agentic-systems.md).

## How we apply this

The architect names durable execution as the pattern when a process is long-running, multi-step, or must-complete, decides the orchestration/choreography split, and confirms the cost is warranted over an outbox or queue; the engineer skills implement the workflow, choose the concrete engine by operational shape, and own the determinism and versioning discipline. Durable execution is shared infrastructure the system rides, not per-process scaffolding.

- [Integration Patterns](integration-patterns.md) — the outbox/saga/idempotency patterns durable execution subsumes.
- [Agentic Systems](../ai-native/agentic-systems.md) — long-running agents are durable workflows.

## Anti-patterns we reject

- **Hand-rolled durability.** A retry table, a state column, and a sweeper cron re-implementing what an engine provides — fragile and bespoke per team.
- **Workflow-as-code for everything.** A heavyweight engine where a single idempotent event handler or an outbox would do.
- **Assuming exactly-once side effects.** Trusting the platform to make a non-idempotent `POST` safe; the engine gives at-least-once execution, and only idempotent steps make the outcome effectively-once.
- **Non-deterministic workflows.** Branching on wall-clock time, unguarded randomness, or an inline LLM/API call, so replay diverges.
- **Deploying without a versioning plan.** Reshaping a workflow with executions in flight and breaking their replay — versioning is a release gate, not a cleanup task.
- **The event-sourced-monolith reflex.** Reaching for full orchestration when a simple two-step choreography is correct.
- **Holding a thread for a human.** Blocking on an approval instead of a durable interrupt that resumes on decision.

## Further reading

- *Temporal*, *Restate*, *DBOS*, *AWS Step Functions* — durable execution engines spanning self-hosted replay, embedded-library, and managed state-machine shapes.
- *Life Beyond Distributed Transactions*, Pat Helland — the reasoning the outbox and durable workflows descend from.
- *Demystifying Determinism in Durable Execution*, Jack Vanlightly (2025) — why the constraint lives in control flow, not side effects, and how it differs across engines.
- *The Rise of the Durable Execution Engine* — durable execution alongside an event backbone.
