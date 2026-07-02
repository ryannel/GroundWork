# Observability

OpenTelemetry as the common language, traces as the primary signal, trace-driven development, SLO-derived dashboards, structured contextual logs, deliberate cardinality — the full principle set is `docs/principles/quality/observability.md`; this file states only Go's implementation shape.

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
