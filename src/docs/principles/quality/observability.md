---
title: Observability
description: OpenTelemetry-first design, SLOs, error budgets, and trace-driven development.
status: active
last_reviewed: 2026-06-26
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

Given a choice between adding a metric and enriching a trace, we enrich the trace: traces preserve causality, metrics aggregate it away, and for a request that crosses half a dozen services causality is the difference between a diagnosable incident and a guessing game.

But "traces over metrics" is not absolute, and a thoughtful operator will push back. You cannot keep every trace — at scale they are sampled, and a sampled signal is a weak base for an alert that must fire on a single bad request. Metrics are cheap, always-on, and the right substrate for the things you can enumerate in advance. So the decision rule: the health signals you alert on (the RED/USE rates) live as metrics, carrying exemplars back to the traces that produced them; the open-ended question — *why is this slow, and for whom* — lives in traces and wide events. Sample to control cost, but sample at the tail so errors and slow outliers survive the cut (principle 7).

### 3. The "three pillars" are one pillar

Logs, metrics, and traces are not independent data — they are different projections of the same events. A log line includes its trace ID; a metric includes the dimensions that let you pivot back to traces; an exemplar on a metric points directly at the trace that produced it. If a team has three disconnected telemetry systems, it has no observability — only three bills and three places to look. The pillars are a storage and query detail; the unit of truth is the event, and every signal must link back to it.

### 4. Dashboards derive from SLOs

Every dashboard starts with the user-journey SLO it supports ([Reliability](reliability.md)). Then latency percentiles, error rates, saturation, and traffic — the "RED/USE" layers — filling in detail. Dashboards assembled by adding "interesting-looking" graphs drift into uselessness; dashboards derived from SLOs stay useful.

### 5. Trace-driven development

When building a new feature, we sketch the trace it should produce *before* we write the handler. What spans must exist? What attributes must each span carry? What parent-child relationships are required? The instrumentation design shapes the code, not the other way around. This makes it essentially impossible to ship a feature that is unobservable.

### 6. Assert on telemetry in tests

System tests assert that traces are unbroken end-to-end — a missing span on a critical path is a test failure ([Testing](../foundations/testing.md)). This makes the instrumentation part of the contract rather than an optional decoration, so it cannot silently rot. The mechanism is an in-memory span exporter registered in the test process: exercise the system, then assert on the finished spans. It is a built-in of every OTel SDK and the durable approach now that the dedicated trace-test tools (Tracetest, Malabi) have gone dormant. The failure mode to avoid is over-asserting: a test that pins the exact span tree and every attribute is coupled to implementation detail and will break on every harmless refactor, training the team to delete the assertion rather than trust it. So assert on what the contract actually promises — the spans that must exist on the user journey, that the trace stays connected across service hops, and the attributes a dashboard or SLO query depends on — and let the rest float.

### 7. Logs are structured, sampled, and contextual

Every log line is structured (JSON), carries its trace ID, and is emitted at a severity that the team has actually agreed on. We sample aggressively at debug and info — nobody needs every log line in production — and we never sample errors away. Traces obey the same logic with the timing reversed: prefer tail-based sampling, where the keep-or-drop decision is made after the trace completes, so every error and slow outlier is retained instead of being dropped at random the way head-based sampling does. Tail sampling costs more to operate (every span of a trace must be buffered to one place); where that cost is not justified, fall back to head-based sampling with errors force-kept. Unstructured log lines are not logs; they are a different kind of noise.

### 8. Cardinality is a design choice

High-cardinality attributes (per-user, per-tenant, per-session) are valuable for debugging but expensive in storage. We tag deliberately — high cardinality on traces where it is queryable, lower cardinality on metrics where it multiplies by every time window. Runaway cardinality is one of the most expensive mistakes a team can make in observability; it is a design call, not a default.

### 9. Wide events, and instrument by default

We lean toward "observability 2.0" — arbitrarily-wide, high-cardinality structured events queried after the fact — over pre-aggregated metrics that fix the question in advance. The honest caveat: a single wide-event store is a north star, not a free lunch. Wide events cost more to ingest and store than the metrics they would replace, and folding every signal into one backend trades correlation power for a sharper lock-in. The escape is a columnar store and an open wire format (OpenTelemetry) so the data stays portable and the bill tracks query value rather than vendor pricing — and pre-aggregated metrics keep their place for the cheap, always-on signals of principle 2.

We also auto-instrument: kernel-level eBPF (OpenTelemetry OBI) and continuous profiling correlated to trace IDs give broad telemetry with no code change. But eBPF sees the wire, not the intent — it cannot name a business operation, attach a domain attribute, or reliably propagate trace context through compiled or encrypted paths, and OBI today is Linux-only with no logs signal. So the division of labour is fixed: auto-instrumentation for breadth and coverage, hand-instrumentation for the domain spans and attributes only we can name.

### 10. AI systems are observed through GenAI conventions

A model in the system is instrumented with the OTel GenAI semantic conventions: token usage (cost and latency track tokens, not requests, and prompt-cache hits are tracked separately), prompt/response capture, agent and MCP tool-call spans, and eval traces — with failed production traces promoted into the eval set so the suite grows from real behaviour. A model call logged as an opaque string is unobservable. Two caveats keep this honest: the GenAI conventions are still experimental as of 2026, so pin the semconv version and use the stability opt-in rather than assuming attribute names are frozen; and full prompt/response capture is a PII and storage liability — capture it deliberately, redact at the edge, and sample the payloads rather than the spans.

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
- Charity Majors, *Observability 1.0 vs 2.0* — the wide-events thesis and the honest argument about its cost, on charity.wtf and the Honeycomb blog.
- *The OpenTelemetry specification* ([opentelemetry.io/docs/specs](https://opentelemetry.io/docs/specs)) — worth reading the high-level overview at least once; see also the GenAI semantic conventions for LLM instrumentation.
- *Systems Performance*, Brendan Gregg — the canonical reference for the "USE method" (utilisation, saturation, errors).
