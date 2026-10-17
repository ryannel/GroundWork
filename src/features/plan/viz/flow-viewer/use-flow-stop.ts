import { useCallback, useState } from 'react';

interface FlowStopInput {
  readonly count: number;
  /** The stop to open on. */
  readonly start?: number | undefined;
  /** Set when a parent holds the place; the viewer then follows it. */
  readonly stop?: number | undefined;
  readonly onStop?: ((stop: number) => void) | undefined;
}

const clamp = (i: number, count: number): number => Math.max(0, Math.min(i, count - 1));

/** The stop the reader is on, kept here or by a parent, and the ways to move it. */
export function useFlowStop({ count, start = 0, stop, onStop }: FlowStopInput): {
  readonly current: number;
  readonly go: (i: number) => void;
  readonly move: (by: -1 | 1) => void;
} {
  const [own, setOwn] = useState(start);
  const current = clamp(stop ?? own, count);
  const go = useCallback(
    (i: number) => {
      const next = clamp(i, count);
      setOwn(next);
      onStop?.(next);
    },
    [count, onStop],
  );
  const move = useCallback(
    (by: -1 | 1) => {
      go(current + by);
    },
    [go, current],
  );
  return { current, go, move };
}
