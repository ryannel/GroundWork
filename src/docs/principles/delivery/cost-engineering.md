---
title: Cost Engineering
description: FinOps, cost-aware architecture, and the economics of autoscaling.
status: active
last_reviewed: 2026-05-26
---
# Cost Engineering

## TL;DR

Cost is a non-functional requirement with a dashboard and a dollar sign. Every significant architectural decision considers cost-per-user and cost-per-call; every service has a budget it lives inside; surprising spend is an incident. FinOps is how we stay honest about the economics of running what we build.

## Why this matters

Most teams discover cost too late — after a quarterly bill raises eyebrows in a meeting. By then, the decisions that drove the cost are in production, have consumers, and are expensive to reverse. Cost engineering is the discipline of making the economic consequences of decisions visible at the point of the decision. It turns cost from a finance concern into an engineering variable.

## Our principles

### 1. Cost is a first-class metric

Cost-per-call, cost-per-user, cost-per-feature — all tracked alongside latency and error rate. A feature's success includes its unit economics, not just its engagement numbers. A team that does not know what its features cost cannot reason about trade-offs that matter.

### 2. Budgets are set and defended

Every significant service runs inside a cost budget. The budget is set at design time, reviewed monthly, and treated as a commitment. Exceeding budget triggers the same response as exceeding any other SLO: investigate, remediate, or explicitly negotiate an increase.

### 3. Autoscaling is designed, not enabled

Autoscaling is a tool with sharp edges. Aggressive autoscaling on a bursty workload can multiply cost without improving user experience; conservative autoscaling on a steady workload wastes headroom. Each scaling policy is tuned per workload with the production load profile in mind, not set to vendor defaults and left.

### 4. Cheap queries beat fast queries

The fastest query is the one that does not run. We cache what we can, compute what we must, and denormalise when the read-to-write ratio justifies it. A cheap-and-fast query is a rare combination; when they conflict, the cheap version is usually the right default.

### 5. Egress is expensive; plan for it

Cloud provider egress is the most mispriced line item in most bills. Inter-region chatter, chatty logs, large payloads sent frequently — these add up. We place data where its consumers are, batch where we can, and compress where it is cheap to do so.

### 6. AI spend has the same discipline

Every model call has a measured cost and a caching strategy. Prompts are versioned with token-count measurement; expensive prompts are justified by value. "Just pass the whole context to the largest model" is how an AI feature becomes a cost incident.

### 7. Reservations and commits where they pay

For predictable baseline workloads, reserved instances and committed-use discounts save 30-50% over on-demand. The discipline is to match the reservation to the baseline — over-reserving locks us in, under-reserving wastes the committed spend.

### 8. FinOps is a practice, not an office

Cost engineering is something every team does, not a team that does it on behalf of others. The central function provides tooling and visibility; the distributed decisions are made by the teams that built the spend.

## How we apply this

- [Observability](../quality/observability.md) — the measurement substrate for cost per unit.
- [Platform](platform.md) — the shared infra that every team's cost sits on.
- [Performance](../quality/performance.md) — cheap code is often also fast code.

## Anti-patterns we reject

- **"We will optimise cost later."** Later never comes; the architecture is what it is by then.
- **Autoscale-and-forget.** Default autoscaling on a workload you have not profiled is how you get a thousand-dollar day.
- **Chatty logs forever.** Unstructured debug logs at volume are a non-trivial line on the bill.
- **AI calls without budget.** Model spend without a measured cost-per-request grows silently until it does not.
- **"It's just pennies."** Pennies × N × daily = a real number. Track it.

## Further reading

- *Cloud FinOps*, Storment & Fuller — the canonical text on cross-functional cost management.
- *AWS Well-Architected Framework — Cost Optimization pillar* — applicable beyond AWS, useful as a checklist.
- *FinOps Foundation framework* ([finops.org](https://finops.org)) — the practitioner's handbook.
