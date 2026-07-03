# Observability

OpenTelemetry as the common language, traces as the primary signal, trace-driven development, SLO-derived dashboards, structured contextual logs, deliberate cardinality — the full principle set is `docs/principles/quality/observability.md`; this file states only Node's implementation shape.

## Implementation

- Register the OTel NodeSDK before any other module loads (a `--import` bootstrap module), or the auto-instrumentation patches for `http`, Fastify, and `pg` never attach.
- Use `pino` for structured logging. Inject `trace_id` and `span_id` from the active OTel context via a mixin, so every log line joins its trace.
- Every route handler and background job runs under a root span — auto-instrumentation covers routes; start one explicitly (`startActiveSpan`) for workers and relays.
- Adapter calls (HTTP, database, queues) extract and cascade the active span; hand-instrument the domain spans and attributes only you can name.

```ts
import { trace } from "@opentelemetry/api";
import pino from "pino";

const logger = pino({
  mixin() {
    const ctx = trace.getActiveSpan()?.spanContext();
    return ctx ? { trace_id: ctx.traceId, span_id: ctx.spanId } : {};
  },
});
```

## Anti-Patterns

- **Pillar-at-a-time adoption.** "We'll add metrics now, traces later." You will not.
- **Vendor SDKs in application code.** Application code imports OTel; the collector talks to the vendor.
- **SDK registered too late.** An import-order mistake silently disables auto-instrumentation; bootstrap first.
- **Dashboards without SLOs.** Charts without a question they answer.
- **`console.log` debugging.** Write a test; add a span.
- **Unstructured log lines.** pino everywhere; a bare string is noise, not a log.
- **Cardinality explosions.** UUIDs in metric labels.
