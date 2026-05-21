"use client";

/**
 * Global error boundary.
 *
 * Catches errors thrown by the root layout itself (e.g., provider import
 * failure). This is the last-resort fallback — it replaces the entire
 * <html> since the root layout may be broken.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body
        style={{
          display: "flex",
          minHeight: "100vh",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "system-ui, sans-serif",
          backgroundColor: "#0a0a0f",
          color: "#fafafa",
        }}
      >
        <div style={{ textAlign: "center", maxWidth: "24rem", padding: "2rem" }}>
          <h2 style={{ fontSize: "1.25rem", fontWeight: 600, marginBottom: "0.5rem" }}>
            Something went wrong
          </h2>
          <p style={{ fontSize: "0.875rem", color: "#a1a1aa", marginBottom: "1rem" }}>
            A critical error occurred. This has been logged.
          </p>
          {error.digest && (
            <p
              style={{
                fontSize: "0.75rem",
                color: "#71717a",
                fontFamily: "monospace",
                marginBottom: "1rem",
              }}
            >
              Error ID: {error.digest}
            </p>
          )}
          <button
            onClick={reset}
            style={{
              padding: "0.5rem 1rem",
              fontSize: "0.875rem",
              fontWeight: 500,
              borderRadius: "0.375rem",
              border: "1px solid #27272a",
              backgroundColor: "#18181b",
              color: "#fafafa",
              cursor: "pointer",
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
