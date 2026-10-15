'use client';

import { createContext, useContext } from 'react';

const Focus = createContext<string | null>(null);

/** Set by a page of stops: what the current stop asks its picture to bring forward. */
export const StopFocus = Focus.Provider;

/** The current stop's focus, or null outside a page of stops. */
export function useStopFocus(): string | null {
  return useContext(Focus);
}
