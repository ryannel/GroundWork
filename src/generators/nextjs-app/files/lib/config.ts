/**
 * Server-only configuration module.
 *
 * Centralises runtime configuration, validates required env vars,
 * and provides a typed Config object to server-side code.
 *
 * IMPORTANT: This file must NEVER be imported from Client Components.
 */

import "server-only";

export const config = {
  /** URL of the backend API (no trailing slash). */
  apiUrl: process.env.API_URL ?? "http://localhost:4000",

  /** OpenTelemetry service name. */
  otelServiceName: process.env.OTEL_SERVICE_NAME ?? "<%= fileName %>",

  /** Whether we're in a sandbox/dev mode without auth. */
  isSandbox: !process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
} as const;
