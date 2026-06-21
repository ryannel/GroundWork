"use client";

/**
 * Production layout provider.
 *
 * Wraps children with:
 * 1. ClerkProvider — authentication
 *
 * Exported as `default` so layout.tsx can `await import()` uniformly.
 */

import { ClerkProvider } from "@clerk/nextjs";
import { dark } from "@clerk/themes";
import type { ReactNode } from "react";

export default function ProductionLayoutProvider({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <ClerkProvider
      appearance={{ theme: dark }}
      signInUrl="/sign-in"
      signUpUrl="/sign-up"
      signInFallbackRedirectUrl="/"
      signUpFallbackRedirectUrl="/"
    >
      {children}
    </ClerkProvider>
  );
}
