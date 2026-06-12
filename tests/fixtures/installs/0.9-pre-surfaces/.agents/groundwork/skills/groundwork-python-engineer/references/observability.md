# Observability

## Core Principles

### 1. OpenTelemetry Is the Common Language
Every service emits traces, metrics, and logs through OpenTelemetry SDKs to a single collector. Vendor lock-in at the collector boundary, not inside application code.

### 2. Traces Are the Primary Signal
Given a choice between adding a metric or enriching a trace, enrich the trace. Traces preserve causality; metrics aggregate it away.

### 3. The Three Pillars Are One Pillar
Logs, metrics, and traces are different projections of the same events. A log line includes its trace ID; a metric includes dimensions to pivot back to traces.

### 4. Dashboards Derive from SLOs
Every dashboard starts with the user-journey SLO it supports. Dashboards derived from SLOs stay useful; dashboards assembled by adding "interesting-looking" graphs drift.

### 5. Trace-Driven Development
Sketch the trace a new feature should produce _before_ writing the handler. What spans must exist? What attributes? The instrumentation design shapes the code.

### 6. Assert on Telemetry in Tests
System tests assert that traces are unbroken end-to-end — a missing span is a test failure.

### 7. Logs Are Structured, Sampled, and Contextual
Every log line is structured (JSON), carries its trace ID, and is emitted at an agreed severity. Sample aggressively at debug/info; do not sample errors.

### 8. Cardinality Is a Design Choice
High-cardinality on traces (per-user, per-tenant), lower cardinality on metrics.

## Python Implementation

- Use `structlog` for structured logging. Inject `trace_id` and `span_id` from the current OTel context.
- Every route handler and background task initialises a root span.
- Provider calls (API, database, Pub/Sub) extract and cascade the span.
- ML model calls emit spans with: input hash, prompt version, model ID, latency, token counts, cost.

```python
from opentelemetry import trace

tracer = trace.get_tracer(__name__)

async def process(self, input_uri: str) -> Result:
    with tracer.start_as_current_span("Process") as span:
        span.set_attribute("input.uri", input_uri)
        span.set_attribute("model.id", self._model_id)
        result = await self._call_model(input_uri)
        span.set_attribute("model.tokens", result.usage.total)
        return result
```

## Anti-Patterns

- **Pillar-at-a-time adoption.** "We'll add metrics now, traces later."
- **Vendor SDKs in application code.** Application code imports OTel; the collector talks to the vendor.
- **Dashboards without SLOs.** Charts without a question they answer.
- **`print` debugging.** Write a test; add a span.
- **Cardinality explosions.** UUIDs in Prometheus labels.
- **Model calls without spans.** An uninstrumented model call is a black box.
