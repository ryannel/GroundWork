import { usePathname } from 'next/navigation';
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';

import { setParam } from '@/features/plan/lens.client';
import { arrivedFrom, holdKeys, walkMoved } from '@/features/plan/walk-keys';

// A screen read in stops keeps its place in the address as `?stop=<key>`, so a stop can be linked to. While it is
// on the page, → and ← move one stop and leave the screen only at its ends.

/** The search parameter a screen's stop travels in. */
const STOP_PARAM = 'stop';

interface StopName {
  /** Unique among the stops; what the address says. */
  readonly key: string;
  readonly title: string;
}

const trimmed = (path: string): string => (path.endsWith('/') ? path.slice(0, -1) : path);

function onHistory(listener: () => void): () => void {
  globalThis.addEventListener('popstate', listener);
  return () => {
    globalThis.removeEventListener('popstate', listener);
  };
}

// While the app moves between screens the new one is drawn before the address changes, so the address is read
// only when it is this screen's. The server, and the first draw in the browser, have no address.
function useNamedStop(path: string): string | null {
  return useSyncExternalStore(
    onHistory,
    () =>
      trimmed(globalThis.location.pathname).endsWith(trimmed(path))
        ? new URLSearchParams(globalThis.location.search).get(STOP_PARAM)
        : null,
    () => null,
  );
}

/** The stop the reader is at, and the way to move it; the keys and the pager drive it too. No stops, no hold. */
export function useStops(stops: readonly StopName[]): {
  readonly at: number;
  readonly go: (to: number) => void;
} {
  // Null outside the app's router, as in a test.
  const routed: unknown = usePathname();
  const path = typeof routed === 'string' ? routed : '';
  const named = useNamedStop(path);
  const [entry] = useState(() =>
    stops.length > 1 && arrivedFrom(path) === -1 ? stops.length - 1 : 0,
  );
  const [chosen, setChosen] = useState<number | null>(null);
  const fromAddress = stops.findIndex((s) => s.key === named);
  const at = chosen ?? (fromAddress === -1 ? entry : fromAddress);
  const latest = useRef(at);
  const list = useRef(stops);
  useEffect(() => {
    latest.current = at;
    list.current = stops;
    walkMoved();
  });

  const go = useCallback((to: number) => {
    const stop = list.current[to];
    if (stop === undefined) return;
    latest.current = to;
    setChosen(to);
    setParam(STOP_PARAM, stop.key);
  }, []);

  const many = stops.length > 1;
  useEffect(() => {
    if (!many) return;
    return holdKeys({
      move: (by) => {
        const to = latest.current + by;
        if (list.current[to] === undefined) return false;
        go(to);
        return true;
      },
      beside: (by) => list.current[latest.current + by]?.title ?? null,
      here: () => {
        const stop = list.current[latest.current];
        const count = `${String(latest.current + 1)} of ${String(list.current.length)}`;
        return stop === undefined ? null : `${stop.title} · ${count}`;
      },
    });
  }, [go, many]);

  return { at, go };
}
