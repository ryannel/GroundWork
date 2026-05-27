---
title: Reliability
description: SRE fundamentals, graceful degradation, circuit breakers, and the design patterns that keep systems up under load and failure.
status: active
last_reviewed: 2026-05-26
---
# Reliability

## TL;DR

Reliability is not a feature we add after the system is built. It is a design property we pay for up front, measured in error budgets, defended by graceful-degradation patterns, and rehearsed through deliberate failure injection. Every significant service owns an SLO and lives inside the error budget it implies.

## Why this matters

Users do not experience "uptime percentages" — they experience "the thing I needed did not work just now." Reliability is the discipline of holding the second experience rare enough that users learn to trust the platform. In a real-time product, unreliability compounds: a dropped request becomes a failed operation, a failed operation becomes a broken user journey. The cost of a small reliability failure is rarely proportional to its scope.

## Our principles

### 1. SLOs, not uptime percentages

Every significant service defines a Service Level Objective — a per-endpoint or per-user-journey target with a latency and a success-rate component, measured over a rolling window. "99.9% uptime" is not an SLO; "p95 `POST /resource` < 300ms over 30 days, 99.5% success" is. SLOs are the measurement surface for everything else in this page.

### 2. Error budgets govern velocity

The budget implied by the SLO — the allowed volume of "bad" events — is a spendable resource. Teams spending below budget can ship riskier changes and run experiments. Teams above budget pause feature work and pay down reliability debt. This inversion — reliability as a gate on feature velocity rather than a tax on top of it — is what makes SLOs operationally real.

### 3. Graceful degradation is a design, not a hope

Every user-facing feature has a defined behaviour when its downstream fails. A view without synthesis data still renders — the panel shows a "not yet ready" state. A pipeline without a model client enqueues and returns when it can. Degradation is decided at design time and implemented alongside the happy path, never "we will figure out what to show later."

### 4. Timeouts, retries, and circuit breakers are defaults

Every outbound call has a timeout, every retry has a bounded policy with jitter, and every client has a circuit breaker against its most important downstreams ([Integration Patterns](../system-design/integration-patterns.md)). Defaults are set in a shared library so that a new service inherits them; opting out requires a written reason.

### 5. Isolate blast radius

A single tenant, a single user, or a single noisy consumer must not be able to degrade the experience for everyone else. We isolate by quota (per-tenant rate limits), by resource (dedicated queues for hot workloads), and by bulkhead (separate worker pools for separate work types). The design question is always: "if this goes bad, who else is affected?" — and the answer we aim for is "only the thing that went bad."

### 6. Rehearse failure

Chaos engineering is a practice, not an event. We inject failures — killed pods, degraded networks, slow databases — routinely in staging and, carefully, in production. The goal is not to "test if chaos works"; it is to discover the reliability assumptions we are making without knowing it. Every chaos experiment that finds something surprising is worth a year of CI.

### 7. Alerts fire on user impact, not on mechanism

We alert when users are affected — SLO burn rate, error-rate spikes on user journeys — not when a server has 80% CPU. Pages that fire on mechanism without user impact teach on-call to ignore pages, which is how a real incident gets missed.

### 8. Every incident teaches a specific lesson

Post-incident, we write a blameless postmortem that names the specific reliability assumption the incident invalidated and proposes the specific change that would have caught it. We do not write "be more careful" as an action item. We do not write "add more monitoring" without specifying the signal. The goal is one concrete, closable ticket per incident, enforceable and measurable.

## How we apply this

- [Observability](observability.md) — the measurement layer that makes SLOs possible.
- [Performance](performance.md) — the tail-latency discipline that sits inside reliability.
- [Integration Patterns](../system-design/integration-patterns.md) — the concrete patterns (timeouts, circuit breakers) we apply.

## Anti-patterns we reject

- **"99.999% uptime" as a target.** Five-nines for a non-core service is a reckless budget. Set an SLO the team can defend.
- **Retries without policies.** Retry-forever is a self-inflicted DDoS.
- **Mechanism alerts.** Paging on CPU, memory, or disk without tying it to a user-impact signal. Noise.
- **"It has not failed yet."** The absence of a known failure mode is not evidence of its absence. Rehearse.
- **Postmortems that blame humans.** A system that depends on everyone being perfect will fail. The action item is the system fix, not the person lecture.
- **SLOs nobody tracks.** An SLO without a dashboard and a burn-rate alert is theatre.

## Further reading

- *Site Reliability Engineering*, Beyer et al. (the Google SRE book) — the canonical text for SLOs, error budgets, and the operational stance.
- *The Site Reliability Workbook* — the practical companion to the SRE book; more actionable.
- *Release It!*, Michael Nygard — the stability-patterns bible.
- *Chaos Engineering*, Rosenthal & Jones — the current state of rehearsed-failure practice.
