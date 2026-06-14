# Observability

Observability is a design property, not a monitoring bolt-on. The difference between a team that ships with confidence and one that cannot is, most of the time, a difference in what they can see. Observability buys three things: knowing whether the system is healthy, localising a fault when it is not, and explaining what happened after the fact. Decide instrumentation at design time — when a system behaves strangely and you cannot see why in your data, the instrumentation is the bug.

## The design decisions

1. **OpenTelemetry is the common language.** Every service emits traces, metrics, and logs through OTel SDKs to a single collector. Vendor lock-in lives at the collector boundary, not in application code — switching backends is a config change, not a rewrite.
2. **Traces are the primary signal.** Given the choice between a metric and a richer trace, enrich the trace. Traces preserve causality; metrics aggregate it away. When one user action crosses half a dozen services, causality is the difference between a diagnosable incident and a guessing game.
3. **The three pillars are one pillar.** Logs, metrics, and traces are projections of the same events: a log line carries its trace ID; a metric carries dimensions that pivot back to traces; an exemplar points at the trace that produced it. Three disconnected telemetry systems is no observability.
4. **Dashboards derive from SLOs.** Every dashboard starts with the user-journey SLO it supports, then fills in latency percentiles, error rates, saturation, and traffic. Dashboards assembled from "interesting-looking" graphs drift into uselessness.
5. **Trace-driven development.** Sketch the trace a feature should produce — what spans, what attributes, what parent-child relationships — *before* writing the handler. The instrumentation design shapes the code, making it nearly impossible to ship an unobservable feature.
6. **Assert on telemetry in tests.** System tests assert traces are unbroken end-to-end; a missing span is a test failure. The instrumentation is part of the contract, not optional decoration.
7. **Logs are structured, sampled, contextual.** Every line is JSON, carries its trace ID, and is emitted at an agreed severity. Sample aggressively at debug/info; never sample errors.
8. **Cardinality is a design choice.** High-cardinality attributes (per-user, per-tenant) are valuable on traces where they are queryable, expensive on metrics where they multiply by every time window. Runaway cardinality is one of the most expensive mistakes in observability — a deliberate call, not a default.
9. **Wide events over pre-aggregation ("observability 2.0").** Prefer emitting arbitrarily-wide, high-cardinality structured events you can slice after the fact over pre-deciding which metrics to aggregate. The query you need is rarely the one you anticipated.
10. **Auto-instrument with eBPF; profiling is a signal.** Kernel-level, zero-code instrumentation (OpenTelemetry OBI / eBPF) gives high-cardinality telemetry without touching application code; continuous profiling correlated to trace IDs is a first-class signal, not a special exercise. Reserve hand-instrumentation for the domain spans that auto-instrumentation cannot infer.

## AI/LLM observability

A model in the system needs telemetry classic APM does not capture, via the **OTel GenAI semantic conventions**:

- **Token usage** (`gen_ai.usage.input_tokens` / `output_tokens`) — because cost and latency correlate with *token* count, not request count. Telemetry that does not capture tokens cannot explain the bill.
- **Prompt/response capture and eval traces** — the inputs, outputs, and scored quality of model calls, plus agent-orchestration and **MCP tool-call** spans, all on the same trace.
- **Online evals** feeding the loop: failed production traces are promoted into the eval set so the suite grows from real behaviour ([agentic-systems.md](agentic-systems.md)).

## What this means at design time

When you set a boundary or a data flow, decide what it must emit. Observability is a downstream obligation of the contract: name the spans a flow must produce and the SLO a dashboard will track, so the instrumentation ships with the feature rather than chasing it.

## Antipatterns to catch

- **Pillar-at-a-time adoption** — "metrics now, traces later." You will not.
- **Vendor SDKs in application code** — application code imports OTel; the collector talks to the vendor.
- **Dashboards without SLOs** — pretty charts without a question they answer.
- **Logs-as-debugger** — `printf`-tracing a single bug instead of writing a test and adding a span.
- **Cardinality explosions** — a UUID in a Prometheus label. The bill and the query planner both remember.
