# Observability

A Flutter client emits no OpenTelemetry server spans. Distributed tracing lives at the capability core, where the gateway owns the request trace and asserts it with an in-memory exporter — which is why trace-assertions are N/A on the client (`references/testing.md`). The client's observability job is **crash and UX telemetry**: what broke, where, and what the user was doing when it did. Instrument for the questions you will ask when a crash report lands; the discipline is the framework canon adapted to a device you do not control (`docs/principles/quality/observability.md`).

## Crash and Error Reporting

A crash/error sink (Sentry or Firebase Crashlytics shape) captures unhandled failures. Two handlers are mandatory, because they catch different errors:

- `FlutterError.onError` — errors raised inside the Flutter framework (build, layout, paint).
- `PlatformDispatcher.instance.onError` — uncaught async and platform errors that never enter the framework.

Wiring only the first leaves the async crash invisible — the one you never see is the one outside the handler you wired. Native engine and platform-channel crashes report through the sink's native layer.

## Structured Breadcrumb Logging

Breadcrumbs, not `print`. A trail of structured events — navigation, command fired, repository call, state transition — lets a crash report reconstruct the path to the failure. `print()` is dropped in release builds and carries no structure even in debug. Attach the screen/route and the operation to each event; emit at an agreed severity rather than as free text.

## Performance Traces

Custom performance traces (Firebase Performance shape) wrap the spans the user *feels*: app start, screen render, and the gateway round-trip as seen from the device. This is client-perceived latency — a different number from the server span the core owns, and the only one that includes the user's network and frame budget. Add frame/jank metrics where smoothness is the product.

## What to Capture vs PII

- **Capture** error type and stack, the breadcrumb trail, screen, operation, client-perceived latency, and device/OS/app-version context.
- **Never** put tokens, PII, or full payloads in breadcrumbs or crash context. The sink is third-party — scrub before the event leaves the device.

## Where Distributed Tracing Lives

The end-to-end request trace is the capability core's, asserted there. The client does not mirror it with spans of its own; it correlates by attaching a request/correlation id it can surface in a breadcrumb, so a crash report points back at the server trace.

## Anti-Patterns

- **`print` as telemetry.** Dropped in release, structureless in debug.
- **One error handler.** `FlutterError.onError` alone lets async errors escape uncaught.
- **PII in crash context.** Emails, tokens, and payloads following the event off-device.
- **A client tracing story.** Re-implementing spans to mirror the backend — there is no client span surface; correlate, don't duplicate.
- **Over-instrumenting.** Custom traces nobody reads are cost without a question behind them.
