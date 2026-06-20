---
title: Reliability
description: SRE fundamentals, graceful degradation, circuit breakers, and the design patterns that keep systems up under load and failure.
status: active
last_reviewed: 2026-06-19
---
# Reliability

## TL;DR

Reliability is not a feature we add after the system is built. It is a design property we pay for up front, measured in error budgets, defended by graceful-degradation patterns, and rehearsed through deliberate failure injection. Every significant service owns an SLO and lives inside the error budget it implies.

## Why this matters

Users do not experience "uptime percentages" — they experience "the thing I needed did not work just now." Reliability is the discipline of holding the second experience rare enough that users learn to trust the platform. In a real-time product, unreliability compounds: a dropped request becomes a failed operation, a failed operation becomes a broken user journey. The cost of a small reliability failure is rarely proportional to its scope.

## Our principles

### 1. SLOs, not uptime percentages

Every significant service defines a Service Level Objective — a per-endpoint or per-user-journey target with a latency and a success-rate component, measured over a rolling window. "99.9% uptime" is not an SLO; "p95 `POST /resource` < 300ms over 30 days, 99.5% success" is. SLOs are the measurement surface for everything else on this page.

### 2. Error budgets govern velocity

The budget implied by the SLO — the allowed volume of "bad" events — is a spendable resource. Teams spending below budget ship riskier changes and run experiments; teams that exhaust it pause feature work and pay down reliability debt. This inversion — reliability as a gate on velocity rather than a tax on top of it — is what makes SLOs operationally real.

The honest failure mode is enforcement. A budget that any team can override under deadline pressure is a dashboard, not a policy. The gate only bites if it is pre-negotiated in writing before the budget is spent: product, engineering, and on-call agree the consequence of exhaustion, name the person empowered to declare and lift a freeze, and define a small, explicit set of "silver bullet" exceptions for genuinely business-critical launches. Decision rule: if you cannot name who enforces the freeze and what the exceptions are, you do not have an error-budget policy — you have an SLO with a graph next to it.

### 3. Graceful degradation is a design, not a hope

Every user-facing feature has a defined behaviour when its downstream fails. A view without synthesis data still renders — the panel shows a "not yet ready" state. A pipeline without a model client enqueues and returns when it can. Degradation is decided at design time and implemented alongside the happy path, never "we will figure out what to show later."

### 4. Timeouts, retries, and load shedding are the defaults; circuit breakers are not automatic

Every outbound call has a timeout. Every retry has a bounded policy with full jitter. These are non-negotiable and set in a shared library so a new service inherits them ([Integration Patterns](../system-design/integration-patterns.md)); opting out requires a written reason.

The contested part is what sits on top. Retries amplify: a request retried at every layer of a call chain produces attempts equal to the *product* of the per-layer counts, so a small downstream blip becomes a self-inflicted DDoS. Two rules contain this. Retry at exactly one layer of the stack, not at every hop. And cap retries with a shared retry budget — a token bucket where successes refill and retries spend, so retries stop automatically once a downstream is failing (this is how gRPC's retry throttling and the AWS SDK adaptive-retry mode work). Per-call backoff alone does not bound aggregate load; the budget does.

Circuit breakers are widely prescribed as the default backstop. They are not automatic here. A binary client-side breaker, estimated locally by each of many small or short-lived clients, trips on noisy local samples and can make a partial outage worse by cutting off capacity that was still serving — Marc Brooker's simulations show distributed breakers tripping far too early. Prefer the token-bucket / adaptive throttle, which degrades smoothly instead of snapping fully open. Reach for a real circuit breaker when a downstream fails *slowly* (the failure mode is timeout exhaustion, not fast error responses) or when a cheap local fallback exists — and tune its thresholds against measured traffic, never the library defaults.

Decision rule: timeout always; retry at one layer with jitter and a shared budget; reach for a circuit breaker only against slow/hanging dependencies or where a cheap fallback exists; and treat server-side load shedding as the backstop you actually trust, because it protects the server regardless of whether every client is well-behaved.

### 5. Isolate blast radius

A single tenant, a single user, or a single noisy consumer must not be able to degrade the experience for everyone else. We isolate by quota (per-tenant rate limits), by resource (dedicated queues for hot workloads), and by bulkhead (separate worker pools for separate work types). The design question is always: "if this goes bad, who else is affected?" — and the answer we aim for is "only the thing that went bad."

### 6. Rehearse failure

Chaos engineering is a practice, not an event. We inject failures — killed pods, degraded networks, slow databases — to surface the reliability assumptions we are making without knowing it. The point is not to "test if chaos works"; it is to find the dependency we forgot was load-bearing before an incident finds it for us.

Where you inject is a real trade-off, not a slogan. Production is where the signal lives — staging differs in traffic shape, data volume, and dependency topology, so a system that passes every staging experiment can still fall over in production, and a clean staging run buys false confidence. But you do not earn production chaos for free: the precondition is observability good enough to see the blast as it lands and an automated stop that aborts the experiment the moment a real SLO starts to burn. Decision rule: start in staging to shake out the obvious, but treat the experiment as incomplete until it has run in production behind a bounded blast radius and an automatic abort. If you cannot safely abort, you are not ready to inject.

### 7. Alerts fire on user impact, not on mechanism

We alert when users are affected — SLO burn rate, error-rate spikes on user journeys — not when a server has 80% CPU. Pages that fire on mechanism without user impact teach on-call to ignore pages, which is how a real incident gets missed.

### 8. Every incident teaches a specific lesson

Post-incident, we write a blameless postmortem that names the specific reliability assumption the incident invalidated and proposes the specific change that would have caught it. We do not write "be more careful" as an action item. We do not write "add more monitoring" without specifying the signal. The goal is one concrete, closable ticket per incident, enforceable and measurable.

### 9. Cells, living SLOs, and semantic failure

Blast-radius isolation generalises at scale to **cell-based architecture** — independent cells, each serving a slice of users, so a failure is contained to one cell rather than the fleet. SLOs are hypotheses reviewed against burn (multi-window, multi-burn-rate alerting), not contracts carved once and forgotten. And a model in the loop fails differently: a wrong answer returns 200 OK — valid, on time, and confidently incorrect — so latency and error-rate SLIs miss it entirely. AI features therefore carry a **per-SLI accuracy/consistency budget** distinct from latency, and the model provider is treated as the least-reliable dependency in the chain, with a defined degraded behaviour for when it is slow, wrong, or down.

## How we apply this

- [Observability](observability.md) — the measurement layer that makes SLOs possible.
- [Performance](performance.md) — the tail-latency discipline that sits inside reliability.
- [Integration Patterns](../system-design/integration-patterns.md) — the concrete patterns (timeouts, circuit breakers) we apply.

## Anti-patterns we reject

- **"99.999% uptime" as a target.** Five-nines for a non-core service is a reckless budget. Set an SLO the team can defend.
- **Retries without policies.** Retry-forever is a self-inflicted DDoS.
- **Retries at every layer.** Retrying at each hop multiplies one user request into a retry storm. Retry at one layer, and budget it.
- **Circuit breakers as a reflex.** A binary breaker on library defaults, copied into every client, trips on noise and can deepen a partial outage. Earn it, tune it against real traffic, and prefer adaptive throttling.
- **Mechanism alerts.** Paging on CPU, memory, or disk without tying it to a user-impact signal. Noise.
- **"It has not failed yet."** The absence of a known failure mode is not evidence of its absence. Rehearse.
- **Postmortems that blame humans.** A system that depends on everyone being perfect will fail. The action item is the system fix, not the person lecture.
- **SLOs nobody tracks.** An SLO without a dashboard and a burn-rate alert is theatre.

## Further reading

- *Site Reliability Engineering*, Beyer et al. (the Google SRE book) — the canonical text for SLOs, error budgets, and the operational stance; the "Addressing Cascading Failures" and "Handling Overload" chapters cover retry budgets and client-side throttling.
- *The Site Reliability Workbook* — the practical companion to the SRE book; more actionable, including the error-budget policy template.
- *Release It!*, Michael Nygard — the stability-patterns bible (timeouts, bulkheads, the original circuit breaker).
- *Chaos Engineering*, Rosenthal & Jones — the current state of rehearsed-failure practice.
- *Amazon Builders' Library* — "Timeouts, retries, and backoff with jitter" (Marc Brooker) and "Using load shedding to avoid overload" (David Yanacek): the load-and-overload patterns this page leans on.
- Marc Brooker, ["Fixing retries with token buckets and circuit breakers"](https://brooker.co.za/blog/2022/02/28/retries.html) — why distributed circuit breakers misfire and what to reach for instead.
