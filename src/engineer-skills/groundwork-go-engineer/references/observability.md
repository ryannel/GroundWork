# Observability

## Core Principles

### 1. OpenTelemetry Is the Common Language

Every service emits traces, metrics, and logs through OpenTelemetry SDKs to a single collector. Vendor lock-in at the collector boundary, not inside application code.

### 2. Traces Are the Primary Signal

Given a choice between adding a metric or enriching a trace, enrich the trace. Traces preserve causality; metrics aggregate it away.

### 3. The Three Pillars Are One Pillar

Logs, metrics, and traces are different projections of the same events. A log line includes its trace ID; a metric includes dimensions to pivot back to traces; an exemplar on a metric points directly at the trace that produced it.

### 4. Dashboards Derive from SLOs

Every dashboard starts with the user-journey SLO it supports. Then latency percentiles, error rates, saturation, and traffic. Dashboards derived from SLOs stay useful; dashboards assembled by adding "interesting-looking" graphs drift.

### 5. Trace-Driven Development

Sketch the trace a new feature should produce *before* writing the handler. What spans must exist? What attributes? What parent-child relationships? The instrumentation design shapes the code.

### 6. Assert on Telemetry in Tests

System tests assert that traces are unbroken end-to-end — a missing span is a test failure. Instrumentation is part of the contract, not an optional decoration.

### 7. Logs Are Structured, Sampled, and Contextual

Every log line is structured (JSON), carries its trace ID, and is emitted at an agreed severity. Sample aggressively at debug and info; do not sample errors.

### 8. Cardinality Is a Design Choice

High-cardinality attributes (per-user, per-tenant) are valuable for debugging but expensive in storage. Tag deliberately — high cardinality on traces, lower cardinality on metrics.

## Implementation

- Use `slog` exclusively for structured logging. Always inject `trace_id` and `span_id` from the current context.
- Every HTTP endpoint and background job must initialize a Root Span.
- Adapter calls (SQL queries, Pub/Sub publishing) must extract and cascade the span.

## Anti-Patterns

- **Pillar-at-a-time adoption.** "We'll add metrics now, traces later." You will not.
- **Vendor SDKs in application code.** Application code imports OpenTelemetry; the collector talks to the vendor.
- **Dashboards without SLOs.** Pretty charts without a question they answer.
- **Logs-as-debugger.** Using `printf` style logging to trace a single bug. Write a test; add a span.
- **Cardinality explosions.** Putting a UUID in a Prometheus label.
