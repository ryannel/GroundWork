"use client";

/**
 * Default layout provider.
 *
 * Used when no authentication provider is configured.
 * Serves as a passthrough — add cross-cutting client providers here
 * (analytics, feature flags, etc.) as the project grows.
 */

import type { ReactNode } from "react";

export default function DefaultLayoutProvider({
  children,
}: {
  children: ReactNode;
}) {
  return <>{children}</>;
}
