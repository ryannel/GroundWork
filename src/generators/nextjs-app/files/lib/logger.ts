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
