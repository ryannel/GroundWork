---
title: Observability
description: OpenTelemetry-first design, SLOs, error budgets, and trace-driven development.
status: active
last_reviewed: 2026-05-26
---
# Observability

## TL;DR

Observability is a design property, not a monitoring bolt-on. We instrument every service with OpenTelemetry from day one, build dashboards from the instrumentation, and use traces as both a debugging tool and a first-class test assertion. If a system is behaving strangely and we cannot see why in our data, the instrumentation — not the guessing — is what we fix.

## Why this matters

The difference between a team that can ship with confidence and one that cannot is, most of the time, a difference in what they can see. Observability gives a team three things: the ability to know whether the system is healthy, the ability to localise a fault when it is not, and the ability to explain what happened after the fact. Without those, every deploy is a gamble and every incident is a fresh investigation. With them, the team moves faster and sleeps better.

## Our principles

### 1. OpenTelemetry is the common language

Every service emits traces, metrics, and logs through OpenTelemetry SDKs to a single collector. Vendor lock-in at the collector boundary, not inside application code. Switching backends is a collector configuration change, not an application rewrite.

### 2. Traces are the primary signal

Given a choice between adding a metric or enriching a trace, we enrich the trace. Traces preserve causality; metrics aggregate it away. For a system where one user action traverses half a dozen services, causality is the difference between a diagnosable incident and a guessing game.

### 3. The "three pillars" are one pillar

Logs, metrics, and traces are not independent data — they are different projections of the same events. A log line includes its trace ID; a metric includes the dimensions that let you pivot back to traces; an exemplar on a metric points directly at the trace that produced it. If a team has three disconnected telemetry systems, it has no observability.

### 4. Dashboards derive from SLOs

Every dashboard starts with the user-journey SLO it supports ([Reliability](reliability.md)). Then latency percentiles, error rates, saturation, and traffic — the "RED/USE" layers — filling in detail. Dashboards assembled by adding "interesting-looking" graphs drift into uselessness; dashboards derived from SLOs stay useful.

### 5. Trace-driven development

When building a new feature, we sketch the trace it should produce *before* we write the handler. What spans must exist? What attributes must each span carry? What parent-child relationships are required? The instrumentation design shapes the code, not the other way around. This makes it essentially impossible to ship a feature that is unobservable.

### 6. Assert on telemetry in tests

System tests assert that traces are unbroken end-to-end — a missing span is a test failure ([Testing](../foundations/testing.md)). This makes drift impossible: the instrumentation is part of the contract, not an optional decoration, and any regression catches before merge.

### 7. Logs are structured, sampled, and contextual

Every log line is structured (JSON), carries its trace ID, and is emitted at a severity that the team has actually agreed on. We sample aggressively at debug and info — nobody needs every log line in production — and we do not sample errors. Unstructured log lines are not logs; they are a different kind of noise.

### 8. Cardinality is a design choice

High-cardinality attributes (per-user, per-tenant, per-session) are valuable for debugging but expensive in storage. We tag deliberately — high cardinality on traces where it is queryable, lower cardinality on metrics where it multiplies by every time window. Runaway cardinality is one of the most expensive mistakes a team can make in observability; it is a design call, not a default.

## How we apply this

- [Reliability](reliability.md) — the SLO layer built on top of this telemetry.
- [Testing](../foundations/testing.md) — how we assert on traces in system tests.
- [Performance](performance.md) — the latency work that depends on good tracing.

## Anti-patterns we reject

- **Pillar-at-a-time adoption.** "We'll add metrics now, traces later." You will not.
- **Vendor SDKs in application code.** Application code imports OpenTelemetry; the collector talks to the vendor.
- **Dashboards without SLOs.** Pretty charts without a question they are answering.
- **Logs-as-debugger.** Using `printf` style logging to trace a single bug. Write a test; add a span.
- **Print-statement-style `Debug` in production.** If every deploy adds ten debug logs and the next removes twelve, we are missing structure.
- **Cardinality explosions.** Putting a UUID in a Prometheus label. The bill and the query planner will both remember.

## Further reading

- *Observability Engineering*, Majors, Fong-Jones, Miranda — the canonical text on traces-first observability.
- *Distributed Systems Observability*, Cindy Sridharan — the short, sharp introduction.
- *The OpenTelemetry specification* ([opentelemetry.io/docs/specs](https://opentelemetry.io/docs/specs)) — worth reading the high-level overview at least once.
- *Systems Performance*, Brendan Gregg — the canonical reference for the "USE method" (utilisation, saturation, errors).
