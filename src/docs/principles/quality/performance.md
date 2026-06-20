---
title: Performance
description: Latency budgets, tail latency, backpressure, and load shedding.
status: active
last_reviewed: 2026-06-19
---
# Performance

## TL;DR

Performance is not "fast enough" — it is a budget, spent deliberately across every hop of a user interaction and enforced in CI. We optimise for tail latency, we design backpressure into real-time flows, and we measure the things users feel, not the things developers find convenient.

## Why this matters

Users notice latency before they notice almost anything else. A response that renders in 800ms feels instant; at 3000ms it feels broken. The difference is not a factor of four in effort — it is a difference of whether the team thought about latency as a design constraint or as a post-hoc tuning problem. Performance handled as an afterthought is invariably more expensive than performance designed in from the start.

## Our principles

### 1. Latency is a budget, allocated top-down

Every user-facing operation starts with a latency budget at the edge — say, 500ms — and that budget is allocated to downstream hops. If one fetch has 300ms and another join has 150ms, the handler has 50ms of its own work. When a hop overruns its allocation, somebody else's budget gets squeezed. The budgeting view makes trade-offs explicit. A budget written once and never checked is fiction: reconcile the allocation against measured per-hop latency, and when the numbers don't add up, the budget is wrong or the architecture is — decide which before you ship.

### 2. Measure tail latency, not average

p50 tells you about capacity and the typical case; it tells you almost nothing about the experience that drives your reputation. Users remember the slow request, and *which* percentile is the slow request is set by fan-out, not taste. Dean and Barroso's *The Tail at Scale* makes the arithmetic unavoidable: a request that touches 100 backends, each with a 1-in-100 chance of exceeding its p99, will overrun that latency 63% of the time end-to-end (1 − 0.99¹⁰⁰). At fan-out, a leaf service's p99.9 becomes the user's effective median.

So the budget percentile is a decision, not a default: target p99 for a single-hop interaction, p99.9 or higher for a high-fan-out request. Measure with coordinated omission in mind — naive load-test clients silently drop the slow samples that matter most (Gil Tene). And the tail is attackable directly, not only by tuning: hedged requests — issue a duplicate after the p95 elapses, take the first to return — cut Dean and Barroso's BigTable p99 from 1800ms to 74ms for roughly 2% extra backend work.

### 3. Pre-compute, cache, and denormalise deliberately

When a read is hot, we pre-compute. When a computation is stable, we cache. When a join is expensive, we denormalise. Each of these trades complexity for latency; each of them earns its keep with data, not with intuition. Speculative caching is how cache-invalidation bugs become the biggest source of data incidents.

### 4. Backpressure is designed in, not hoped for

Every producer has a bounded queue and a defined behaviour when the queue fills: shed, coalesce, block ([Real-Time](../system-design/real-time.md)). "It works fine in load tests" is not a backpressure strategy.

### 5. Load shedding protects the system from itself

When the system is saturated, the right behaviour is not to try harder — it is to serve fewer requests well, because trying harder is exactly how an overload turns into a cascading failure (Google SRE). Requests carry a criticality assigned at the edge — Netflix's CRITICAL / DEGRADED / BEST_EFFORT / BULK taxonomy is a sound template — and we shed from the bottom up: prefetch and background work long before user-initiated requests.

The shed *trigger* is adaptive, not a hand-tuned RPS or CPU threshold that is stale the day load patterns shift. An adaptive concurrency limit that watches the latency gradient finds the saturation point on its own and tracks it as the system changes. And shedding has a softer sibling: graceful degradation reduces the work *per* request — serve cached data, drop personalisation, fall back to a cheaper ranking — before it drops requests entirely. Shedding is a designed degradation mode, not an accident.

### 6. Hot paths have no allocations to spare

For the hottest inner loops — real-time processing, per-request ingestion at high throughput — we write allocation-aware code. Every allocation is a GC pause in waiting, and at high rate the pauses become the latency. The discipline is scoped, not universal: it applies to the paths a profiler has shown to be hot, and applying it everywhere is the over-optimisation it warns against. Most code does not need it; the hot paths demand it.

### 7. Profile before you optimise

Two truths usually pitched as opposites. Tuning existing code without a profile is waste — the "obvious" bottleneck is almost always wrong, and Knuth's "premature optimization is the root of all evil," read in full, says forget small efficiencies 97% of the time *and do not pass up the critical 3%*. So every non-trivial tuning effort starts with a profile, taken in production-representative conditions; profiles from developer laptops lie.

But a profiler only ever tells you where the time goes in the design you already have. It will never tell you to pick a better data structure, flatten an allocation-heavy layout, or kill an N+1 access pattern — and those design-time choices dominate the result, are cheap on the first pass, and are expensive to retrofit. "We'll profile it later" is the standard excuse for skipping them. Decision rule: choose data models, access patterns, and algorithmic complexity with performance in mind up front; reach for the profiler to direct local tuning, never to license thoughtless design.

### 8. Budgets are enforced in CI

Performance regressions that slip in once slip in a hundred times, and automation is cheaper than vigilance — so budgets live in CI against committed thresholds, and a PR that regresses one needs an explicit, reviewed waiver. But *what* you gate on matters more than *that* you gate. Shared CI runners are noisy, and a wall-clock microbenchmark that cries wolf on every PR trains engineers to ignore it — worse than no gate at all. So gate hard on the metrics that are deterministic regardless of the runner: bundle size, query count per request, allocation counts, Lighthouse scores. Treat wall-clock timings as a tracked trend with relative thresholds and statistical comparison, or run them on dedicated hardware — never as a hard pass/fail on a shared runner.

### 9. Place compute deliberately, and price the tokens

*Where* code runs is a design axis, not only *how much*: the edge for latency-sensitive, cacheable, geo-distributed work (proximity flattens the tail); WebAssembly as the edge/FaaS/plugin compute unit; containers for stateful or heavy work — most systems blend all three. Caching is multi-tier (client, CDN/edge, service, store) with an explicit hit-ratio target, and autoscaling is event-driven with real scale-to-zero (KEDA/Karpenter), not CPU-only HPA. For a model-in-the-loop path, latency and cost track **tokens, not requests** — the levers are model routing, semantic caching at the gateway, prompt/KV caching to cut time-to-first-token, and streaming so the user sees output before generation completes.

## How we apply this

- [Observability](observability.md) — the measurement surface for latency work.
- [Reliability](reliability.md) — the SLO discipline that makes performance budgets enforceable.
- [Real-Time](../system-design/real-time.md) — the streaming-specific patterns we apply.

## Anti-patterns we reject

- **Optimising on hunch.** No profile, no tuning — and no "we'll profile it later" as cover for an unconsidered data model.
- **"It is fast on my laptop."** Dev latency is not production latency. Measure in the environment that matters.
- **Average-as-metric.** Reporting only the mean or p50 hides the tail that defines your reputation. Pick the percentile your fan-out demands.
- **Unbounded queues.** A queue without a max is a latency bomb.
- **Cache invalidation left to the reader.** If the cache can serve stale data under a defined circumstance, that circumstance is documented. Otherwise it is a bug.
- **Flaky perf gates.** A wall-clock benchmark gated on a noisy shared runner teaches the team to rubber-stamp red. Gate on deterministic metrics; track the noisy ones.
- **"We will fix performance later."** If you ship slow, users will remember slow.

## Further reading

- *Systems Performance*, Brendan Gregg — the canonical reference; read the USE and RED chapters first.
- *High Performance Browser Networking*, Ilya Grigorik — the frontend-and-network half of the story.
- *Latency Numbers Every Programmer Should Know* (Jeff Dean) — calibrate your intuition.
- Gil Tene, "How NOT to Measure Latency" — the talk on coordinated omission and why naive latency measurements lie.
- Jeff Dean & Luiz Barroso, "The Tail at Scale" (CACM, 2013) — the fan-out arithmetic and the hedged-request pattern.
- *Google SRE Book*, "Handling Overload" and "Addressing Cascading Failures" — criticality, client-side throttling, and load shedding done right.
