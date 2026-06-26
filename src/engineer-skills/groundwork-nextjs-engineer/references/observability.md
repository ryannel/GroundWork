# Observability

A Next.js app has two telemetry surfaces, and they obey different rules. The **server side** — route handlers, Server Actions, `instrumentation.ts` — is genuinely backend-like: it emits OpenTelemetry spans the same way a service does. The **browser client** emits user-experience signal: Core Web Vitals and errors from a device you do not control. Instrument each for the questions you will actually ask in an incident; the signal that proves a path correct in test is the signal you debug with in production (`docs/principles/quality/observability.md`).

## Server Side — OpenTelemetry Spans

`instrumentation.ts` is the registration point; from there, route handlers and Server Actions emit spans through the OTel SDK to a collector. This half follows the backend canon unchanged: vendor lock-in lives at the collector boundary, not in application code.

- **Trace-driven.** Sketch the span a server path should produce — name, attributes, parent — before writing the handler. The instrumentation design shapes the code.
- **Assert what you debug.** The in-memory span exporter that proves a route's trace in `references/testing.md` (Trace Assertions) reads the same span a dashboard or SLO does. A critical-path span a query depends on is part of the contract, not decoration — a missing span is a test failure.
- **Structured logs carry the trace.** Server logs are JSON and inject `trace_id`/`span_id` from the active context, so a log line pivots to the trace that produced it. Sample debug/info; never sample errors.

## Client Side — Web Vitals and Error Reporting

The browser cannot run a collector. It reports field signal to a sink.

- **Core Web Vitals (RUM).** Report LCP, INP, CLS, and TTFB from real sessions via `useReportWebVitals` to a sink. These are the user's experience; a green Lighthouse lab score is not — it measures one synthetic load, not the field.

  ```tsx
  // app/_components/web-vitals.tsx — mounted once in the root layout
  'use client';
  import { useReportWebVitals } from 'next/web-vitals';

  export function WebVitals() {
    useReportWebVitals(({ name, value, id }) => {
      navigator.sendBeacon('/api/rum', JSON.stringify({ name, value, id }));
    });
    return null;
  }
  ```

- **Error reporting.** `error.tsx` and `global-error.tsx` catch render errors; a `window` `error`/`unhandledrejection` handler catches the rest. Both forward to the sink. An error boundary that renders a fallback but reports nothing is a silent failure — the user sees the broken state and you never do.
- **Structured events, not `console.log`.** `console` output in a production bundle is not telemetry; emit structured events the sink can query.
- **Connect the halves.** The browser `fetch` can inject a W3C `traceparent` so a client interaction links to the server trace it triggered — one causal thread across the boundary.

## What to Capture vs PII

- **Capture** route, status, duration, the span attributes a dashboard queries, the web-vital name and value, error type and stack.
- **Never** put tokens, full request bodies, or emails/PII in span attributes, breadcrumbs, or client events. The sink is third-party — redact at the edge.
- **Cardinality is a design choice.** High cardinality on server traces where it is queryable; keep it off client metric dimensions, which multiply by every session.

## Anti-Patterns

- **`console.log` as telemetry.** It is noise in the field, not a signal you can query.
- **Boundary without report.** A fallback UI that swallows the error instead of forwarding it.
- **Lab metrics as field RUM.** Lighthouse is a synthetic check, not what users experienced.
- **A collector in the bundle.** The client reports to a sink; it does not run backend OTel infrastructure.
- **Over-instrumenting.** A span or metric nobody will query during an incident is cost and clutter — instrument the questions, not the surface area.
