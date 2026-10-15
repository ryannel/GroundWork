'use client';

import { useEffect, useSyncExternalStore } from 'react';

// The screens of a plan the reader has opened, kept for the browser tab so a reload keeps the ticks.

const listeners = new Set<() => void>();
const cache = new Map<string, ReadonlySet<string>>();
const NONE: ReadonlySet<string> = new Set();

const keyOf = (plan: string): string => `groundwork:read:${plan}`;

function readOf(plan: string): ReadonlySet<string> {
  const held = cache.get(plan);
  if (held) return held;
  let read: ReadonlySet<string> = NONE;
  try {
    const kept: unknown = JSON.parse(sessionStorage.getItem(keyOf(plan)) ?? '[]');
    if (Array.isArray(kept)) read = new Set(kept.filter((href) => typeof href === 'string'));
  } catch {
    // no storage: the ticks last for this page only
  }
  cache.set(plan, read);
  return read;
}

function markRead(plan: string, href: string): void {
  const read = readOf(plan);
  if (read.has(href)) return;
  const next = new Set([...read, href]);
  cache.set(plan, next);
  try {
    sessionStorage.setItem(keyOf(plan), JSON.stringify([...next]));
  } catch {
    // no storage: the ticks last for this page only
  }
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

const serverRead = (): ReadonlySet<string> => NONE;

function useRead(plan: string): ReadonlySet<string> {
  return useSyncExternalStore(subscribe, () => readOf(plan), serverRead);
}

/** Counts the screen at `href` of the plan at `plan` as read. */
export function MarkRead({ plan, href }: { readonly plan: string; readonly href: string }) {
  useEffect(() => {
    markRead(plan, href);
  }, [plan, href]);
  return null;
}

interface TickProps {
  readonly plan: string;
  readonly href: string;
  readonly current: boolean;
}

/** ● for the screen being read, ✓ for one read before, ○ for one not yet opened. */
export function Tick({ plan, href, current }: TickProps) {
  const read = useRead(plan);
  if (current) return '●';
  return read.has(href) ? '✓' : '○';
}

interface ReadCountProps {
  readonly plan: string;
  readonly hrefs: readonly string[];
  readonly current: string;
}

/** How many of a chapter's screens have been read, as `2/5`. */
export function ReadCount({ plan, hrefs, current }: ReadCountProps) {
  const read = useRead(plan);
  const count = hrefs.filter((href) => href === current || read.has(href)).length;
  return (
    <span title={`${String(count)} of ${String(hrefs.length)} screens read`}>
      {count}/{hrefs.length}
    </span>
  );
}
