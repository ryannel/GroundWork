# Reliability

## Core Principles

### 1. SLOs, Not Uptime Percentages

Every significant service defines a Service Level Objective — a per-endpoint or per-user-journey target with latency and success-rate components, measured over a rolling window. "99.9% uptime" is not an SLO; "p95 `POST /entities` < 300ms over 30 days, 99.5% success" is.

### 2. Error Budgets Govern Velocity

The budget implied by the SLO is a spendable resource. Teams spending below budget ship riskier changes. Teams above budget pause feature work and pay down reliability debt.

### 3. Graceful Degradation Is a Design, Not a Hope

Every user-facing feature has a defined behaviour when its downstream fails. Degradation is decided at design time and implemented alongside the happy path.

### 4. Timeouts, Retries, and Circuit Breakers Are Defaults

Every outbound call has a timeout. Every retry has a bounded policy with jitter. Every client has a circuit breaker against its most important downstreams. Defaults are set in a shared library; opting out requires a written reason.

### 5. Isolate Blast Radius

A single tenant, user, or noisy consumer must not degrade the experience for everyone else. Isolate by quota (per-tenant rate limits), by resource (dedicated queues), and by bulkhead (separate worker pools).

### 6. Rehearse Failure

Inject failures routinely — killed pods, degraded networks, slow databases. Every chaos experiment that finds something surprising is worth a year of CI.

### 7. Alerts Fire on User Impact, Not Mechanism

Alert when users are affected — SLO burn rate, error-rate spikes on user journeys — not when a server has 80% CPU.

### 8. Every Incident Teaches a Specific Lesson

Post-incident: blameless postmortem, specific reliability assumption invalidated, specific change proposed. No "be more careful" action items.

## Anti-Patterns

- **"99.999% uptime" as a target.** Five-nines for a non-core service is reckless.
- **Retries without policies.** Retry-forever is a self-inflicted DDoS.
- **Mechanism alerts.** Paging on CPU without user-impact signal.
- **Postmortems that blame humans.** The action item is the system fix.
- **SLOs nobody tracks.** An SLO without a dashboard and burn-rate alert is theatre.

---

# Performance

## Core Principles

### 1. Latency Is a Budget, Allocated Top-Down

Every user-facing operation starts with a latency budget at the edge. The budget is allocated to downstream hops. Budgeting makes trade-offs explicit.

### 2. Measure Tail Latency, Not Average

p50 is a marketing number. p95 and p99 are what users experience. Design for the tail.

### 3. Pre-Compute, Cache, and Denormalise Deliberately

Each trades complexity for latency. Each earns its keep with data, not intuition.

### 4. Backpressure Is Designed In

Every producer has a bounded queue and a defined behaviour when the queue fills: shed, coalesce, block.

### 5. Load Shedding Protects the System

When saturated, serve fewer requests well. Shed on clearly-defined criteria: low-priority traffic first.

### 6. Hot Paths Have No Allocations to Spare

For the hottest inner loops, write allocation-aware code. Every allocation is a GC pause in waiting.

### 7. Profile Before You Optimise

Every non-trivial optimisation starts with a profile. The "obvious" bottleneck is almost always wrong.

### 8. Budgets Are Enforced in CI

Bundle sizes, handler latencies — measured in CI against committed thresholds. Regressions require a reviewed waiver.

## Anti-Patterns

- **Optimising on hunch.** No profile, no optimisation.
- **Average-as-metric.** p50 is a lie. Use percentiles.
- **Unbounded queues.** A queue without a max is a latency bomb.
- **"We will fix performance later."** If you ship slow, users remember slow.
