# Observability

OpenTelemetry as the common language, traces as the primary signal, trace-driven development, SLO-derived dashboards, structured contextual logs, deliberate cardinality — the full principle set is `docs/principles/quality/observability.md`; this file states only Python's implementation shape.

## Implementation

- Use `structlog` for structured logging. Inject `trace_id` and `span_id` from the current OTel context.
- Every route handler and background task initialises a root span.
- Adapter calls (API, database, Pub/Sub) extract and cascade the span.
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

- **Pillar-at-a-time adoption.** "We'll add metrics now, traces later." You will not.
- **Vendor SDKs in application code.** Application code imports OTel; the collector talks to the vendor.
- **Dashboards without SLOs.** Charts without a question they answer.
- **`print` debugging.** Write a test; add a span.
- **Cardinality explosions.** UUIDs in Prometheus labels.
- **Model calls without spans.** An uninstrumented model call is a black box.
