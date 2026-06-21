# Phase 3 — Observability completion

**Prerequisite:** Phase 0 complete (the trace assertion test `test_traces.py` is the acceptance mechanism — it polls the Jaeger query API until a span with a known trace id appears, proving the OTLP export pipeline works end-to-end. A header-presence check does NOT count.).

**Phase goal:** Make every generated service actually emit telemetry that reaches the backend, not merely declare instrumentation dependencies. The flagship fix is Python: it currently starts NO OpenTelemetry SDK and emits ZERO spans. This phase also adds Go/Next.js metrics export, log↔trace correlation across all three stacks, and browser-side tracing for Next.js.

**Phase acceptance gate (run from repo root after ALL tasks):**

```bash
# 0. Build the generators and run the cheap structural + compile gates first.
npm run build
./dev test generation
./dev test compilation

# 1. Regenerate a fresh sample workspace WITH a Python service that has postgres
#    (postgres is required: the GET /examples probe route only exists when postgres=true).
GJSON=/Users/ryannel/Workspace/groundWork/generators.json
TMP=/Users/ryannel/Workspace/groundWork/.sandboxes/demo
rm -rf $TMP; mkdir -p $TMP/services; printf '{}' >$TMP/nx.json; printf '{"name":"demo"}' >$TMP/package.json
(cd $TMP && npx --yes nx g $GJSON:workspace-dev-cli --appName demo)
(cd $TMP && npx --yes nx g $GJSON:go-microservice --name api --auth service)
(cd $TMP && npx --yes nx g $GJSON:python-microservice --name worker --rest true --postgres true)
(cd $TMP && npx --yes nx g $GJSON:system-test-runner)

# 2. Boot the stack (docker compose + native runners) and wait for health.
(cd $TMP && bash ./dev start)
(cd $TMP && bash ./dev status)   # expect db, jaeger, api, worker all present and not "dead"

# 3. FLAGSHIP: prove the PYTHON service exports a span to Jaeger.
#    Point the trace test at the python service instead of the Go default.
#    NOTE: test_traces.py is a SEPARATE file from test_system.py and is NOT run by
#    `./dev test scaffolds` (test_07 runs only test_system.py). Invoke it explicitly.
#    Find the python service's host port from docker-compose.yml (the `worker` service
#    publishes <assignedPort>:<assignedPort>; read it, e.g. 4002) and the Jaeger query
#    port (dev stack maps 16686).
(cd $TMP/tests/system && \
  TRACE_TARGET_URL=http://localhost:<WORKER_PORT> \
  TRACE_BACKEND_URL=http://localhost:16686 \
  TRACE_PROBE_PATH=/examples \
  TRACE_SERVICE_NAME=worker \
  uv run pytest test_traces.py -v -s)
# EXPECT: test_instrumented_request_exports_span_to_backend PASSES — i.e. a span whose
# serviceName == "worker" lands in Jaeger. If Python emits no spans, _fetch_trace returns
# None and the test FAILS with "the OTLP export pipeline is broken". That failure is the
# whole point of the gate.

# 4. Re-run the Go trace test (default targets the Go `api` service) to prove this phase
#    did not regress the working Go pipeline.
(cd $TMP/tests/system && uv run pytest test_traces.py -v -s)
# EXPECT: passes with serviceName "api" (default TRACE_PROBE_PATH=/api/v1/entities).
```

> The brief's vocabulary `GROUNDWORK_REQUIRE_TRACES=1 ./dev test integration` refers to the
> Phase-0 wrapper. If Phase 0 added that wrapper it shells out to exactly the `pytest
> test_traces.py` invocations above. The runnable source of truth is the explicit pytest
> commands. Do not type `./dev test integration` unless Phase 0 has verifiably created it.

---

### Task 3.1 — Python OTel initialization (FLAGSHIP)
- **Files:**
  - NEW: `/Users/ryannel/Workspace/groundWork/src/generators/python-microservice/files/src/provider/telemetry.py.template`
  - EDIT: `/Users/ryannel/Workspace/groundWork/src/generators/python-microservice/files/src/main.py.template`
  - EDIT: `/Users/ryannel/Workspace/groundWork/src/generators/python-microservice/files/src/provider/config.py.template`
  - EDIT: `/Users/ryannel/Workspace/groundWork/src/generators/python-microservice/files/pyproject.toml.template`
- **Depends on:** none
- **Goal:** Start a real `TracerProvider` with an OTLP gRPC exporter inside the FastAPI lifespan, set `service.name` from the templated service name, call `FastAPIInstrumentor.instrument_app(app)`, and shut down cleanly. Without this, Python emits zero spans and Task gate step 3 fails.

- **Anchor (current code to find):**

  `pyproject.toml.template` lines 10-14 — deps declare API/SDK/instrumentation but NO OTLP exporter:
  ```toml
      "opentelemetry-api",
      "opentelemetry-sdk",
      "opentelemetry-instrumentation-fastapi",
  ```

  `config.py.template` lines 4-7 — Settings has a port but no OTLP endpoint:
  ```python
  class Settings(BaseSettings):
      model_config = SettingsConfigDict(env_file='.env', env_file_encoding='utf-8', extra='ignore')

      server_port: int = <%= assignedPort %>
  ```

  `main.py.template` lines 23-49 — lifespan and app construction have NO OTel anywhere:
  ```python
  @asynccontextmanager
  async def lifespan(app: FastAPI):
      # Initialize resources like Redis pools, DB connections
      app.state.startup_failed = False
      try:
  <% if (postgres) { %>
          app.state.db_engine = engine
  <% } %>
          pass
      except Exception:
          app.state.startup_failed = True

      yield

      # Cleanup resources gracefully
  <% if (postgres) { %>
      await engine.dispose()
  <% } %>

  app = FastAPI(
      title="<%= name %> API",
      lifespan=lifespan
  )
  ```

- **Change:**

  **Step 1 — add the OTLP gRPC exporter dependency.** In `pyproject.toml.template`, replace the three OTel lines (10-14 anchor) with:
  ```toml
      "opentelemetry-api",
      "opentelemetry-sdk",
      "opentelemetry-instrumentation-fastapi",
      "opentelemetry-exporter-otlp-proto-grpc",
  ```

  **Step 2 — add the endpoint setting.** In `config.py.template`, immediately after the `server_port` line (line 7), add:
  ```python
      # OTLP gRPC endpoint. Compose injects OTEL_EXPORTER_OTLP_ENDPOINT=http://jaeger:4317
      # for docker; this default covers native (`./dev start`) runs.
      otel_exporter_otlp_endpoint: str = "http://localhost:4317"
  ```
  (BaseSettings reads the env var case-insensitively, so `OTEL_EXPORTER_OTLP_ENDPOINT` maps to `otel_exporter_otlp_endpoint`.)

  **Step 3 — create the new file** `src/provider/telemetry.py.template` with EXACTLY this content (note `<%= name %>` resolves to the raw service name, matching Go's `main.go` so the Jaeger `serviceName` is e.g. `worker`):
  ```python
  """OpenTelemetry bootstrap for the FastAPI app.

  Builds a TracerProvider with an OTLP gRPC exporter and instruments the FastAPI
  app so inbound requests produce spans that are exported to the configured
  collector (Jaeger in dev). Mirrors the Go scaffold: BatchSpanProcessor +
  ParentBased(AlwaysSample) default sampler, service.name set on the resource.
  """
  from opentelemetry import trace
  from opentelemetry.exporter.otlp.proto.grpc.trace_exporter import OTLPSpanExporter
  from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor
  from opentelemetry.sdk.resources import Resource
  from opentelemetry.sdk.trace import TracerProvider
  from opentelemetry.sdk.trace.export import BatchSpanProcessor
  from opentelemetry.semconv.resource import ResourceAttributes


  def setup_telemetry(app, endpoint: str) -> TracerProvider:
      """Initialize tracing and instrument the FastAPI app.

      Returns the TracerProvider so the caller can shut it down (flush the
      BatchSpanProcessor) on application stop.
      """
      resource = Resource.create({ResourceAttributes.SERVICE_NAME: "<%= name %>"})

      provider = TracerProvider(resource=resource)
      # insecure=True: the dev endpoint is plain h2c (http://...:4317), no TLS.
      exporter = OTLPSpanExporter(endpoint=endpoint, insecure=True)
      provider.add_span_processor(BatchSpanProcessor(exporter))

      trace.set_tracer_provider(provider)
      FastAPIInstrumentor.instrument_app(app)
      return provider
  ```

  **Step 4 — wire it into the lifespan.** In `main.py.template`:

  Add to the import block (after line 7, `from src.entrypoints.api.router import router as example_router`):
  ```python
  from src.provider.telemetry import setup_telemetry
  ```

  Then rewrite the lifespan body (the anchor, lines 23-44) to call `setup_telemetry` before `yield` and shut the provider down after. Replace the anchor block with:
  ```python
  @asynccontextmanager
  async def lifespan(app: FastAPI):
      # Initialize resources like Redis pools, DB connections
      app.state.startup_failed = False
      # Start OpenTelemetry: instruments `app` and begins exporting spans via OTLP.
      tracer_provider = setup_telemetry(app, settings.otel_exporter_otlp_endpoint)
      try:
  <% if (postgres) { %>
          # Provide the repository for the idempotency middleware
          app.state.db_engine = engine
  <% } %>
          pass
      except Exception:
          app.state.startup_failed = True

      yield

      # Cleanup resources gracefully
      # Flush any buffered spans before exit (BatchSpanProcessor flushes on shutdown).
      tracer_provider.shutdown()
  <% if (postgres) { %>
      await engine.dispose()
  <% } %>
  ```

  > `FastAPIInstrumentor.instrument_app(app)` must run BEFORE the app serves traffic. Calling it inside the lifespan (which runs at startup, before the first request) is correct. Do NOT call it at import time / module scope — `app` is already constructed below the lifespan, and instrumenting in the lifespan keeps the wiring testable and ordered.

- **Acceptance:**
  ```bash
  npm run build
  ./dev test generation        # python service still generates correctly
  ./dev test compilation       # `uv sync` resolves the new exporter dep; `import src.main` succeeds
  ```
  Then the full phase gate steps 1-3 above. The decisive check: `TRACE_PROBE_PATH=/examples TRACE_SERVICE_NAME=worker ... uv run pytest test_traces.py` finds a span with `serviceName=="worker"` in Jaeger. Before this task, that test fails (no spans). After, it passes.

- **Guardrails:**
  - Do NOT touch the Go (`otel.go.template`) or Next.js (`instrumentation.ts`) tracing — they work; this task is Python-only.
  - The new file MUST end in `.template` (it contains `<%= name %>`).
  - `service.name` MUST come from `<%= name %>` in code — the Python compose injection (generator.ts lines 150-161) injects `OTEL_EXPORTER_OTLP_ENDPOINT` but NOT `OTEL_SERVICE_NAME`, so the resource attribute is the only source. Verify generator.ts still does NOT inject `OTEL_SERVICE_NAME`; if a later edit adds it, the env var would override and that's fine, but the code default must stand alone.
  - Known pre-existing issue, OUT OF SCOPE: `test_05b` in `tests/scaffolds/test_scaffolds.py` expects the health body `status=="ok"` but Python `/health` returns `{"status":"alive"}`. Do NOT fix it here. It does NOT block the trace test — `_reachable()` checks only HTTP status code, not the body.

---

### Task 3.2 — Metrics export (Go)
- **Files:**
  - EDIT: `/Users/ryannel/Workspace/groundWork/src/generators/go-microservice/files/internal/config/otel.go.template`
  - EDIT: `/Users/ryannel/Workspace/groundWork/src/generators/go-microservice/files/go.mod.template`
- **Depends on:** none
- **Goal:** Add an OTLP metric exporter + `MeterProvider`, set it as the global meter provider so the existing `otelhttp` middleware (router.go line 32) records baseline HTTP server metrics (request count, latency histogram, in-flight). Keep `InitProvider`'s return signature so `main.go` wiring is untouched.

- **Anchor (current code to find):**

  `otel.go.template` lines 6-14 (imports — traces only):
  ```go
  	"go.opentelemetry.io/otel"
  	"go.opentelemetry.io/otel/exporters/otlp/otlptrace"
  	"go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracegrpc"
  	"go.opentelemetry.io/otel/propagation"
  	"go.opentelemetry.io/otel/sdk/resource"
  	sdktrace "go.opentelemetry.io/otel/sdk/trace"
  	semconv "go.opentelemetry.io/otel/semconv/v1.24.0"
  ```

  `otel.go.template` lines 47-58 (provider setup + return — traces only):
  ```go
  	tp := sdktrace.NewTracerProvider(
  		sdktrace.WithBatcher(exporter),
  		sdktrace.WithResource(res),
  	)

  	otel.SetTracerProvider(tp)
  	otel.SetTextMapPropagator(propagation.NewCompositeTextMapPropagator(
  		propagation.TraceContext{},
  		propagation.Baggage{},
  	))

  	return tp.Shutdown, nil
  ```

  `main.go.template` lines 31-36 (the call site — DO NOT change its shape):
  ```go
  	otelShutdown, err := config.InitProvider(context.Background(), "<%= name %>", cfg.Telemetry.CollectorURL)
  	if err != nil {
  		log.Fatal().Err(err).Msg("Failed to initialize OpenTelemetry")
  	}
  	defer otelShutdown(context.Background())
  ```

- **Change:**

  **Step 1 — add deps to `go.mod.template`.** After the existing trace exporter lines (anchor 14-15), add the metric exporter and metric SDK at matching version `v1.24.0`:
  ```go
  	go.opentelemetry.io/otel/exporters/otlp/otlpmetric/otlpmetricgrpc v1.24.0
  	go.opentelemetry.io/otel/metric v1.24.0
  	go.opentelemetry.io/otel/sdk/metric v1.24.0
  ```
  (Leave the `otelhttp v0.49.0` line on line 32 as-is — it already records server metrics when a global MeterProvider exists.)

  **Step 2 — add imports** to the `otel.go.template` import block. Replace the anchor import block with:
  ```go
  	"go.opentelemetry.io/otel"
  	"go.opentelemetry.io/otel/exporters/otlp/otlpmetric/otlpmetricgrpc"
  	"go.opentelemetry.io/otel/exporters/otlp/otlptrace"
  	"go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracegrpc"
  	"go.opentelemetry.io/otel/propagation"
  	"go.opentelemetry.io/otel/sdk/resource"
  	sdkmetric "go.opentelemetry.io/otel/sdk/metric"
  	sdktrace "go.opentelemetry.io/otel/sdk/trace"
  	semconv "go.opentelemetry.io/otel/semconv/v1.24.0"
  ```

  **Step 3 — build the MeterProvider and combine shutdown.** Replace the provider-setup-and-return anchor block (lines 47-58) with:
  ```go
  	tp := sdktrace.NewTracerProvider(
  		sdktrace.WithBatcher(exporter),
  		sdktrace.WithResource(res),
  	)

  	otel.SetTracerProvider(tp)
  	otel.SetTextMapPropagator(propagation.NewCompositeTextMapPropagator(
  		propagation.TraceContext{},
  		propagation.Baggage{},
  	))

  	// --- Metrics ---
  	// otelhttp records baseline HTTP server metrics (request count, latency
  	// histogram, active in-flight requests) automatically once a global
  	// MeterProvider is registered. We export them over OTLP gRPC on a periodic
  	// reader to the same collector as traces.
  	metricExporter, err := otlpmetricgrpc.New(ctx,
  		otlpmetricgrpc.WithEndpointURL(collectorURL),
  		otlpmetricgrpc.WithInsecure(),
  	)
  	if err != nil {
  		return nil, fmt.Errorf("create otel metric exporter: %w", err)
  	}

  	mp := sdkmetric.NewMeterProvider(
  		sdkmetric.WithReader(sdkmetric.NewPeriodicReader(metricExporter)),
  		sdkmetric.WithResource(res),
  	)
  	otel.SetMeterProvider(mp)

  	// Combined shutdown: flush and close both providers. Returned to main.go,
  	// whose `defer otelShutdown(ctx)` call is unchanged.
  	shutdown := func(ctx context.Context) error {
  		var firstErr error
  		if err := tp.Shutdown(ctx); err != nil {
  			firstErr = err
  		}
  		if err := mp.Shutdown(ctx); err != nil && firstErr == nil {
  			firstErr = err
  		}
  		return firstErr
  	}

  	return shutdown, nil
  ```

  > `otelhttp.NewMiddleware` in `router.go` (line 32) already creates instruments off the global meter provider. No router change is required for baseline server metrics — registering the global MeterProvider in `InitProvider` is sufficient. The return type is still `func(context.Context) error`, so `main.go` line 32-36 stays byte-for-byte identical.

- **Acceptance:**
  ```bash
  npm run build
  ./dev test generation
  ./dev test compilation   # `go build` resolves the three new metric deps and compiles
  ```
  Then boot (phase gate steps 1-2) and confirm metrics export by curling the Go service and checking the periodic reader pushed to the collector:
  ```bash
  curl -s http://localhost:<GO_PORT>/api/v1/entities >/dev/null   # generate one server metric
  # After ~one reader interval, Go logs show no exporter errors; the OTLP collector
  # (jaeger all-in-one) receives metrics on 4317. Absence of "metric exporter" errors in
  # `./dev status` / service logs confirms the MeterProvider is wired.
  ```
  The Go trace test (phase gate step 4) must still pass — proves InitProvider's signature change did not break boot.

- **Guardrails:**
  - Do NOT change `InitProvider`'s parameters or return type. If you must, you also have to edit `main.go` line 32 — avoid that.
  - Do NOT touch the trace exporter, propagator, or `WithEndpointURL`/`WithInsecure` usage — those are the verified-working bits.
  - Pin metric deps to `v1.24.0` to match the existing otel core version; mismatched majors break `go build`.

---

### Task 3.3 — Custom metric (Next.js)
- **Files:**
  - EDIT: `/Users/ryannel/Workspace/groundWork/src/generators/nextjs-app/files/app/api/proxy/__path__/route.ts.template`
- **Depends on:** none
- **Goal:** The Next.js `instrumentation.ts` already wires a `PeriodicExportingMetricReader`, but no app code emits a CUSTOM metric. Add one counter in the proxy route to demonstrate the pattern.

- **Anchor (current code to find):**

  `route.ts.template` line 3 (existing OTel import):
  ```ts
  import { trace, context, propagation } from "@opentelemetry/api";
  ```

  `route.ts.template` lines 66-77 (start of the handler where we can count requests):
  ```ts
  async function handler(
      request: NextRequest,
      { params }: { params: Promise<{ path: string[] }> }
  ): Promise<NextResponse> {
      const { path } = await params;
      const url = getUpstreamUrl(request, path);

      const activeSpan = trace.getActiveSpan();
      if (activeSpan) {
          activeSpan.setAttribute("proxy.upstream_path", `/${path.join("/")}`);
      }
  ```

- **Change:**

  **Step 1 — import the metrics API.** Replace line 3 with:
  ```ts
  import { trace, context, propagation, metrics } from "@opentelemetry/api";
  ```

  **Step 2 — define a module-scoped counter** (created once, reused per request) directly after the `HOP_BY_HOP` set (after line 31). Add:
  ```ts
  // Custom metric: counts proxied requests, labelled by upstream path + method.
  // Exported via the PeriodicExportingMetricReader configured in instrumentation.ts.
  const proxyMeter = metrics.getMeter("<%= fileName %>-proxy");
  const proxyRequestCounter = proxyMeter.createCounter("proxy_requests_total", {
      description: "Total number of requests forwarded by the API proxy.",
  });
  ```

  **Step 3 — increment it in the handler.** In the handler, immediately after the `activeSpan` block (after line 76), add:
  ```ts
      proxyRequestCounter.add(1, {
          "http.route": `/${path.join("/")}`,
          "http.method": request.method,
      });
  ```

  > `metrics.getMeter` resolves against the global MeterProvider that `instrumentation.ts`'s `NodeSDK` registers. No SDK change is needed — the counter exports automatically on the existing 15s reader interval.

- **Acceptance:**
  ```bash
  npm run build
  ./dev test generation
  ./dev test compilation   # `tsc` type-checks the new metrics import + counter usage
  ```
  Then boot and exercise the proxy:
  ```bash
  curl -s http://localhost:<NEXT_PORT>/api/proxy/api/v1/entities >/dev/null
  # Within ~15s the OTLP metric exporter pushes proxy_requests_total to the collector;
  # confirm no exporter errors in the Next.js server logs.
  ```

- **Guardrails:**
  - Do NOT add a new SDK or reader — `instrumentation.ts` already owns the MeterProvider. Only the app-level counter is new.
  - Do NOT change the proxy's request-forwarding logic, header filtering, or trace-context injection.
  - The file already ends in `.template`; keep `<%= fileName %>` for the meter name.

---

### Task 3.4 — Log↔trace correlation (Go, Python, Next.js)
- **Files:**
  - Go: `/Users/ryannel/Workspace/groundWork/src/generators/go-microservice/files/internal/entrypoints/api/router.go.template`, and NEW `/Users/ryannel/Workspace/groundWork/src/generators/go-microservice/files/internal/entrypoints/api/middleware_logging.go.template`
  - Python: `/Users/ryannel/Workspace/groundWork/src/generators/python-microservice/files/src/provider/telemetry.py.template` (extend), `pyproject.toml.template`, `main.py.template`
  - Next.js: NEW `/Users/ryannel/Workspace/groundWork/src/generators/nextjs-app/files/lib/logger.ts`
- **Depends on:** 3.1 (Python edits build on the new `telemetry.py`)
- **Goal:** Inject `trace_id`/`span_id` from the active span context into structured logs in all three services so logs are joinable to traces.

- **Anchor (current code to find):**

  Go `router.go.template` lines 30-38 (the otelhttp middleware — the logging middleware must run AFTER this so the span exists):
  ```go
  	// OpenTelemetry HTTP middleware
  	router.Use(func(next http.Handler) http.Handler {
  		otelHandler := otelhttp.NewMiddleware("<%= name %>",
  			otelhttp.WithFilter(func(r *http.Request) bool {
  				return !strings.HasPrefix(r.URL.Path, "/health")
  			}),
  		)
  		return otelHandler(next)
  	})
  ```

  Python `telemetry.py.template` (created in 3.1) — the `setup_telemetry` function returns the provider; logging setup will live alongside it.

  Next.js — there is currently NO server logger helper under `lib/`. (`lib/` contains `utils.ts`, `config.ts`, `schemas/`, `api/fetcher.ts.template`.)

- **Change:**

  **Go — Step 1: create** `internal/entrypoints/api/middleware_logging.go.template`:
  ```go
  package api

  import (
  	"context"
  	"net/http"

  	"github.com/rs/zerolog"
  	"github.com/rs/zerolog/log"
  	"go.opentelemetry.io/otel/trace"
  )

  type loggerCtxKey struct{}

  // LoggerFromContext returns the request-scoped logger (carrying trace_id/span_id
  // when a span is active), or the global logger as a fallback.
  func LoggerFromContext(ctx context.Context) *zerolog.Logger {
  	if l, ok := ctx.Value(loggerCtxKey{}).(*zerolog.Logger); ok {
  		return l
  	}
  	return &log.Logger
  }

  // TraceLoggingMiddleware stores a request-scoped logger in the context, enriched
  // with the active span's trace_id and span_id. Must be registered AFTER the
  // otelhttp middleware so the span context is populated.
  func TraceLoggingMiddleware(next http.Handler) http.Handler {
  	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
  		l := log.Logger
  		sc := trace.SpanContextFromContext(r.Context())
  		if sc.IsValid() {
  			l = l.With().
  				Str("trace_id", sc.TraceID().String()).
  				Str("span_id", sc.SpanID().String()).
  				Logger()
  		}
  		ctx := context.WithValue(r.Context(), loggerCtxKey{}, &l)
  		next.ServeHTTP(w, r.WithContext(ctx))
  	})
  }
  ```

  **Go — Step 2: register it** in `router.go.template` immediately after the otelhttp middleware block (after line 38, before the CORS block):
  ```go
  	// Per-request logger carrying trace_id/span_id (must run after otelhttp).
  	router.Use(TraceLoggingMiddleware)
  ```
  Handlers obtain the correlated logger via `api.LoggerFromContext(r.Context())`.

  **Python — Step 1: add deps.** In `pyproject.toml.template`, after the OTLP exporter line added in 3.1, add the JSON logger:
  ```toml
      "python-json-logger>=2.0.0",
  ```

  **Python — Step 2: add logging setup to `telemetry.py.template`.** Add these imports at the top (with the existing imports):
  ```python
  import logging

  from pythonjsonlogger import jsonlogger
  ```
  And append this function to the module:
  ```python
  class _TraceContextFilter(logging.Filter):
      """Attaches the active span's trace_id/span_id to every log record."""

      def filter(self, record: logging.LogRecord) -> bool:
          span = trace.get_current_span()
          ctx = span.get_span_context()
          if ctx.is_valid:
              record.trace_id = format(ctx.trace_id, "032x")
              record.span_id = format(ctx.span_id, "016x")
          else:
              record.trace_id = ""
              record.span_id = ""
          return True


  def setup_logging() -> None:
      """Configure root logging as JSON with trace correlation fields."""
      handler = logging.StreamHandler()
      handler.setFormatter(
          jsonlogger.JsonFormatter(
              "%(asctime)s %(levelname)s %(name)s %(message)s %(trace_id)s %(span_id)s"
          )
      )
      handler.addFilter(_TraceContextFilter())
      root = logging.getLogger()
      root.handlers.clear()
      root.addHandler(handler)
      root.setLevel(logging.INFO)
  ```

  **Python — Step 3: call it in `main.py.template`.** Inside the lifespan, immediately after the `setup_telemetry(...)` call added in 3.1, add:
  ```python
      setup_logging()
  ```
  And extend the telemetry import line to:
  ```python
  from src.provider.telemetry import setup_telemetry, setup_logging
  ```

  **Next.js — Step 1: create** `lib/logger.ts` (NOT a `.template` — no EJS vars):
  ```ts
  import { trace } from "@opentelemetry/api";

  type LogFields = Record<string, unknown>;

  /**
   * Structured server-side logger that includes the active span's traceId/spanId
   * so logs are joinable to traces. Server-only — do not import in client components.
   */
  function emit(level: "info" | "warn" | "error", message: string, fields?: LogFields) {
      const span = trace.getActiveSpan();
      const spanCtx = span?.spanContext();
      const record = {
          level,
          message,
          timestamp: new Date().toISOString(),
          ...(spanCtx
              ? { trace_id: spanCtx.traceId, span_id: spanCtx.spanId }
              : {}),
          ...fields,
      };
      // eslint-disable-next-line no-console
      console[level === "error" ? "error" : "log"](JSON.stringify(record));
  }

  export const logger = {
      info: (message: string, fields?: LogFields) => emit("info", message, fields),
      warn: (message: string, fields?: LogFields) => emit("warn", message, fields),
      error: (message: string, fields?: LogFields) => emit("error", message, fields),
  };
  ```

- **Acceptance:**
  ```bash
  npm run build
  ./dev test generation
  ./dev test compilation   # go build / uv sync (python-json-logger) / tsc all pass
  ```
  Then boot and produce a correlated log line. For Python (use a handler that logs, or hit the instrumented route and inspect container logs):
  ```bash
  curl -s -H 'traceparent: 00-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-01' \
       http://localhost:<WORKER_PORT>/examples >/dev/null
  docker logs worker 2>&1 | tail -n 5
  # EXPECT a JSON log line containing "trace_id":"0af7651916cd43dd8448eb211c80319c"
  ```
  For Go: hit `/api/v1/entities` with a traceparent and grep the native `air`/service log for a line with `"trace_id":`. For Next.js: call a route that uses `logger.info(...)` and confirm the JSON line carries `trace_id`/`span_id`.

- **Guardrails:**
  - Go logging middleware MUST be registered AFTER otelhttp (span must exist first). Do not reorder above it.
  - Do NOT replace the existing `setupLogger()` in `main.go` (console writer) — the per-request middleware adds fields on top of `log.Logger`; leave the global logger setup intact.
  - Python: do not double-configure logging (the `root.handlers.clear()` is intentional). Call `setup_logging()` exactly once, in the lifespan.
  - Next.js `lib/logger.ts` is server-only; do not import it from client components (no `"use client"` files).

---

### Task 3.5 — Next.js client-side spans
- **Files:**
  - NEW: `/Users/ryannel/Workspace/groundWork/src/generators/nextjs-app/files/components/providers/telemetry.tsx`
  - EDIT: `/Users/ryannel/Workspace/groundWork/src/generators/nextjs-app/files/app/layout.tsx`
  - EDIT: `/Users/ryannel/Workspace/groundWork/src/generators/nextjs-app/files/package.json`
- **Depends on:** none
- **Goal:** `instrumentation.ts` only runs server-side (`NEXT_RUNTIME==='nodejs'`). Add browser-side tracing scoped to fetch instrumentation, so client `fetch()` calls to `/api/proxy` produce spans and propagate W3C `traceparent` to the proxy (which already continues the trace — see `route.ts` line 61).

- **Anchor (current code to find):**

  `instrumentation.ts` line 16 (server-only guard — proves nothing runs in the browser):
  ```ts
      if (process.env.NEXT_RUNTIME === "nodejs") {
  ```

  `package.json` lines 14-23 (current OTel deps — note NO web/fetch packages):
  ```json
      "@opentelemetry/api": "^1.9.1",
      "@opentelemetry/auto-instrumentations-node": "^0.72.0",
      "@opentelemetry/exporter-metrics-otlp-http": "^0.214.0",
      "@opentelemetry/exporter-trace-otlp-http": "^0.214.0",
      "@opentelemetry/instrumentation": "^0.214.0",
      "@opentelemetry/resources": "^2.6.1",
      "@opentelemetry/sdk-metrics": "^2.6.1",
      "@opentelemetry/sdk-node": "^0.214.0",
      "@opentelemetry/sdk-trace-base": "^2.6.1",
      "@opentelemetry/semantic-conventions": "^1.40.0",
  ```

  `app/layout.tsx` lines 1-5 (imports) and lines 42-43 (the `<body>` open + first child `<ThemeProvider>` — the mount point). Note: this file has no `.template` suffix but DOES contain `<%= className %>`, so Nx still processes it as EJS — treat templated values normally.
  ```tsx
  import { ThemeProvider } from '@/components/theme-provider'
  ...
      <body className={`${geistSans.variable} ${geistMono.variable} font-sans antialiased`}>
        <ThemeProvider
  ```

- **Change:**

  **Step 1 — add browser OTel packages** to `package.json` dependencies (after line 16, keeping alphabetical-ish grouping with the other `@opentelemetry/*` entries):
  ```json
      "@opentelemetry/context-zone": "^2.6.1",
      "@opentelemetry/instrumentation-fetch": "^0.214.0",
      "@opentelemetry/sdk-trace-web": "^2.6.1",
  ```
  (Match the version families already present: SDK packages `^2.6.1`, instrumentation packages `^0.214.0`.)

  **Step 2 — create the client bootstrap** `components/providers/telemetry.tsx` (NOT a `.template` — uses `NEXT_PUBLIC_*` env, no EJS):
  ```tsx
  "use client";

  import { useEffect } from "react";

  /**
   * Browser-side OpenTelemetry: traces client `fetch()` calls and propagates W3C
   * traceparent to same-origin requests (the /api/proxy route continues the trace
   * server-side). Scoped to fetch instrumentation to keep the client bundle small.
   *
   * Endpoint is read from NEXT_PUBLIC_OTEL_EXPORTER_OTLP_ENDPOINT (must be
   * browser-reachable — the in-container `jaeger:4318` is NOT reachable from a
   * browser, so default to localhost).
   */
  export function TelemetryProvider() {
      useEffect(() => {
          let shutdown: (() => Promise<void>) | undefined;

          (async () => {
              const { WebTracerProvider, BatchSpanProcessor } = await import(
                  "@opentelemetry/sdk-trace-web"
              );
              const { OTLPTraceExporter } = await import(
                  "@opentelemetry/exporter-trace-otlp-http"
              );
              const { ZoneContextManager } = await import(
                  "@opentelemetry/context-zone"
              );
              const { FetchInstrumentation } = await import(
                  "@opentelemetry/instrumentation-fetch"
              );
              const { registerInstrumentations } = await import(
                  "@opentelemetry/instrumentation"
              );
              const { resourceFromAttributes } = await import(
                  "@opentelemetry/resources"
              );
              const { ATTR_SERVICE_NAME } = await import(
                  "@opentelemetry/semantic-conventions"
              );

              const endpoint =
                  process.env.NEXT_PUBLIC_OTEL_EXPORTER_OTLP_ENDPOINT ??
                  "http://localhost:4318";

              const provider = new WebTracerProvider({
                  resource: resourceFromAttributes({
                      [ATTR_SERVICE_NAME]: "browser",
                  }),
                  spanProcessors: [
                      new BatchSpanProcessor(
                          new OTLPTraceExporter({ url: `${endpoint}/v1/traces` })
                      ),
                  ],
              });

              provider.register({ contextManager: new ZoneContextManager() });

              registerInstrumentations({
                  instrumentations: [
                      new FetchInstrumentation({
                          // Propagate traceparent to same-origin /api/proxy calls.
                          propagateTraceHeaderCorsUrls: [/.*/],
                      }),
                  ],
              });

              shutdown = () => provider.shutdown();
          })();

          return () => {
              void shutdown?.();
          };
      }, []);

      return null;
  }
  ```

  **Step 3 — mount it in `app/layout.tsx`.** Import and render `<TelemetryProvider />` inside `<body>` (it returns `null`, so position is irrelevant; place it as the first child of `<body>`):
  ```tsx
  import { TelemetryProvider } from "@/components/providers/telemetry";
  ```
  and place it as the first child of `<body>`, immediately before `<ThemeProvider` (line 42-43):
  ```tsx
      <body className={`${geistSans.variable} ${geistMono.variable} font-sans antialiased`}>
        <TelemetryProvider />
        <ThemeProvider
  ```

  **Step 4 — document the browser endpoint env** in `.env.example.template` (append under the existing `# OpenTelemetry` block):
  ```
  # Browser-reachable OTLP HTTP endpoint for client-side spans (NOT the in-container host).
  NEXT_PUBLIC_OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318
  ```

- **Acceptance:**
  ```bash
  npm run build
  ./dev test generation
  ./dev test compilation   # tsc resolves the three new web packages and the new component
  ```
  Then boot, open the app in a browser (or drive a client fetch), trigger a `/api/proxy/...` call, and verify in Jaeger (`http://localhost:16686`) that a trace contains a `browser` service span linked to the downstream proxy/backend spans (same traceId). The proxy already injects/continues context (`route.ts` line 61), so a single traceId should span browser → proxy → backend.

- **Guardrails:**
  - Scope browser OTel to FETCH instrumentation only — do NOT pull in `auto-instrumentations-web` or document-load/user-interaction instrumentation (heavy bundle). If the full web SDK proves too heavy, fetch instrumentation alone satisfies the requirement.
  - Do NOT touch `instrumentation.ts` — the server SDK is correct and must keep its `NEXT_RUNTIME==='nodejs'` guard. Client tracing is additive via the new component.
  - The browser exporter endpoint MUST be `NEXT_PUBLIC_*` and browser-reachable (`localhost:4318`), never the in-container `jaeger:4318` — a browser cannot resolve compose service names.
  - Lazy-import all OTel web modules inside `useEffect` (as shown) so they never enter the server bundle or run during SSR.

---

## Definition of done for Phase 3

> **Status: EXECUTED 2026-06-21.** Implemented against the *current* (post-restructure)
> scaffold layout, not the stale paths in the task bodies above — Python telemetry lives
> in `src/<pkg>/adapters/telemetry.py`, and the trace-assertion harness is `test_system.py`
> (not `test_traces.py`). Verified at the generation + compilation gates; the live Jaeger
> boot assertion is blocked locally only by the Docker daemon being down (env limit), not
> by code. Caveat: a **pre-existing** `@clerk/themes` `baseTheme` type error in
> `production.tsx` fails `tsc` on Clerk Next.js cases — unrelated to this phase.

- [x] `npm run build` succeeds after every generator.ts/template edit.
- [x] `./dev test generation` passes (135 Python combos + Next/Go green).
- [x] `./dev test compilation` passes — Go `go build` (9), Python `uv sync` + `import src.main` (12, resolves `opentelemetry-exporter-otlp-proto-grpc` + `python-json-logger`), Next.js `tsc` on all non-Clerk cases (the new web OTel packages resolve). *Clerk cases blocked by the pre-existing `baseTheme` drift, not this work.*
- [~] **FLAGSHIP:** Python now initializes a TracerProvider + OTLP exporter + `FastAPIInstrumentor` (`adapters/telemetry.py`), and the span test is un-xfail'd for Python with a `/examples` probe. End-to-end Jaeger assertion (`GROUNDWORK_REQUIRE_TRACES=1 ./dev test scaffolds`, `test_07`) is **pending a running Docker daemon** — the boot suite failed only on "Cannot connect to the Docker daemon".
- [~] Go trace test not regressed — pending the same live boot; trace exporter internals untouched.
- [x] Go: OTLP MeterProvider registered globally in `InitProvider`; signature unchanged so `main.go` is untouched.
- [x] Next.js: `proxy_requests_total` custom counter added to the proxy route.
- [x] Log↔trace correlation: Go `TraceLoggingMiddleware`, Python `setup_logging` JSON filter, Next.js `lib/logger.ts` — each stamps `trace_id`/`span_id`.
- [x] Next.js client-side fetch spans: `components/providers/telemetry.tsx` (browser WebTracerProvider, fetch instrumentation), mounted in layout.
- [x] No edits to: Go `otel.go` trace exporter internals, Next.js server `instrumentation.ts`, or the otelhttp/propagator wiring.
