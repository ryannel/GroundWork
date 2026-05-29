/**
 * Next.js instrumentation hook — bootstraps OpenTelemetry for server-side
 * tracing, metrics, and context propagation.
 *
 * Automatically invoked by Next.js when the app starts (server-side only).
 *
 * Configuration is driven by standard OTEL_* environment variables so the
 * same code works for local development (OTLP → Jaeger) and
 * production (Google Cloud Trace / Monitoring).
 *
 * @see https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */

export async function register() {
    // Only instrument the Node.js runtime (not Edge)
    if (process.env.NEXT_RUNTIME === "nodejs") {
        const { NodeSDK } = await import("@opentelemetry/sdk-node");
        const { OTLPTraceExporter } = await import(
            "@opentelemetry/exporter-trace-otlp-http"
        );
        const { OTLPMetricExporter } = await import(
            "@opentelemetry/exporter-metrics-otlp-http"
        );
        const { PeriodicExportingMetricReader } = await import(
            "@opentelemetry/sdk-metrics"
        );
        const { getNodeAutoInstrumentations } = await import(
            "@opentelemetry/auto-instrumentations-node"
        );
        const { resourceFromAttributes } = await import("@opentelemetry/resources");
        const {
            ATTR_SERVICE_NAME,
            ATTR_SERVICE_VERSION,
        } = await import("@opentelemetry/semantic-conventions");

        const serviceName =
            process.env.OTEL_SERVICE_NAME ?? "<%= fileName %>";
        const endpoint =
            process.env.OTEL_EXPORTER_OTLP_ENDPOINT ??
            "http://localhost:4318";

        const sdk = new NodeSDK({
            resource: resourceFromAttributes({
                [ATTR_SERVICE_NAME]: serviceName,
                [ATTR_SERVICE_VERSION]: "0.1.0",
            }),

            // ── Traces ──────────────────────────────────────────────────
            traceExporter: new OTLPTraceExporter({
                url: `${endpoint}/v1/traces`,
            }),

            // ── Metrics ─────────────────────────────────────────────────
            metricReaders: [
                new PeriodicExportingMetricReader({
                    exporter: new OTLPMetricExporter({
                        url: `${endpoint}/v1/metrics`,
                    }),
                    exportIntervalMillis: 15_000,
                }),
            ],

            // ── Auto-instrumentation ────────────────────────────────────
            instrumentations: [
                getNodeAutoInstrumentations({
                    // Disable fs instrumentation to reduce noise
                    "@opentelemetry/instrumentation-fs": { enabled: false },
                }),
            ],
        });

        sdk.start();

        // Graceful shutdown
        process.on("SIGTERM", () => {
            sdk.shutdown()
                // eslint-disable-next-line no-console
                .then(() => console.log("OTel SDK shut down"))
                .catch((err: unknown) =>
                    // eslint-disable-next-line no-console
                    console.error("OTel SDK shutdown error:", err)
                );
        });

        // eslint-disable-next-line no-console
        console.log(
            `[otel] ${serviceName} v0.1.0 → ${endpoint} (traces + metrics)`
        );
    }
}
