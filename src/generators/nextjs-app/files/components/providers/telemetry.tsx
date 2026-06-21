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
