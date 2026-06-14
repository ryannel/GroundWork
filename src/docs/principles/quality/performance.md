---
title: Performance
description: Latency budgets, tail latency, backpressure, and load shedding.
status: active
last_reviewed: 2026-05-26
---
# Performance

## TL;DR

Performance is not "fast enough" — it is a budget, spent deliberately across every hop of a user interaction and enforced in CI. We optimise for tail latency, we design backpressure into real-time flows, and we measure the things users feel, not the things developers find convenient.

## Why this matters

Users notice latency before they notice almost anything else. A response that renders in 800ms feels instant; at 3000ms it feels broken. The difference is not a factor of four in effort — it is a difference of whether the team thought about latency as a design constraint or as a post-hoc tuning problem. Performance handled as an afterthought is invariably more expensive than performance designed in from the start.

## Our principles

### 1. Latency is a budget, allocated top-down

Every user-facing operation starts with a latency budget at the edge — say, 500ms — and that budget is allocated to downstream hops. If one fetch has 300ms and another join has 150ms, the handler has 50ms of its own work. When a hop overruns its allocation, somebody else's budget gets squeezed. The budgeting view makes trade-offs explicit.

### 2. Measure tail latency, not average

p50 is a marketing number. p95 and p99 are what users experience. We measure and alert on the tail; we design for the tail. A system with a great median and a terrible p99 will have an awful reputation, no matter what the dashboard says.

### 3. Pre-compute, cache, and denormalise deliberately

When a read is hot, we pre-compute. When a computation is stable, we cache. When a join is expensive, we denormalise. Each of these trades complexity for latency; each of them earns its keep with data, not with intuition. Speculative caching is how cache-invalidation bugs become the biggest source of data incidents.

### 4. Backpressure is designed in, not hoped for

Every producer has a bounded queue and a defined behaviour when the queue fills: shed, coalesce, block ([Real-Time](../system-design/real-time.md)). "It works fine in load tests" is not a backpressure strategy.

### 5. Load shedding protects the system from itself

When the system is saturated, the right behaviour is not to try harder — it is to serve fewer requests well. We shed on clearly-defined criteria: low-priority traffic first, new sessions before active ones, non-interactive before interactive. Shedding is a designed degradation mode, not an accident.

### 6. Hot paths have no allocations to spare

For the hottest inner loops — real-time processing, per-request ingestion at high throughput — we write allocation-aware code. Every allocation is a GC pause in waiting, and at high rate the pauses become the latency. Most code does not need this discipline; the hot paths demand it.

### 7. Profile before you optimise

Every non-trivial optimisation starts with a profile. The "obvious" bottleneck is almost always wrong, and effort spent tuning a cold path is effort wasted. We profile in production-representative conditions; profiles from developer laptops lie.

### 8. Budgets are enforced in CI

Bundle sizes, lighthouse scores, worst-case handler latencies — these are measured in CI against committed thresholds. A PR that regresses a budget requires an explicit, reviewed waiver. Performance regressions that slip in once slip in a hundred times; automation is cheaper than vigilance.

### 9. Place compute deliberately, and price the tokens

*Where* code runs is a design axis, not only *how much*: the edge for latency-sensitive, cacheable, geo-distributed work (proximity flattens the tail); WebAssembly as the edge/FaaS/plugin compute unit; containers for stateful or heavy work — most systems blend all three. Caching is multi-tier (client, CDN/edge, service, store) with an explicit hit-ratio target, and autoscaling is event-driven with real scale-to-zero (KEDA/Karpenter), not CPU-only HPA. For a model-in-the-loop path, latency and cost track **tokens, not requests** — the levers are model routing, semantic caching, and an AI gateway.

## How we apply this

- [Observability](observability.md) — the measurement surface for latency work.
- [Reliability](reliability.md) — the SLO discipline that makes performance budgets enforceable.
- [Real-Time](../system-design/real-time.md) — the streaming-specific patterns we apply.

## Anti-patterns we reject

- **Optimising on hunch.** No profile, no optimisation.
- **"It is fast on my laptop."** Dev latency is not production latency. Measure in the environment that matters.
- **Average-as-metric.** p50 is a lie. Use percentiles.
- **Unbounded queues.** A queue without a max is a latency bomb.
- **Cache invalidation left to the reader.** If the cache can serve stale data under a defined circumstance, that circumstance is documented. Otherwise it is a bug.
- **"We will fix performance later."** If you ship slow, users will remember slow.

## Further reading

- *Systems Performance*, Brendan Gregg — the canonical reference; read the USE and RED chapters first.
- *High Performance Browser Networking*, Ilya Grigorik — the frontend-and-network half of the story.
- *Latency Numbers Every Programmer Should Know* (Jeff Dean) — calibrate your intuition.
- Gil Tene, "How NOT to Measure Latency" — the talk on coordinated omission and why naive latency measurements lie.
