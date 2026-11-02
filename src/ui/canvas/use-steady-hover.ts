import { useEffect, useRef, useState } from 'react';

/** How long the pointer must rest on a card before the diagram focuses on it, and how long to keep it. */
const FOCUS_MS = 120;
const UNFOCUS_MS = 300;
/** A line stays raised briefly after the pointer leaves it, so crossing its edge does not flicker. */
const LINE_GRACE_MS = 150;

function componentOf(target: EventTarget | null): string | null | undefined {
  if (!(target instanceof Element)) return null;
  // Lines float above cards: passing over one says nothing about which card is meant.
  if (target.closest('[data-edge]') !== null) return undefined;
  return target.closest<SVGElement>('[data-component]')?.dataset.component ?? null;
}

function useTimer(): {
  readonly after: (ms: number, run: () => void) => void;
  readonly cancel: () => void;
} {
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(
    () => () => {
      clearTimeout(timer.current);
    },
    [],
  );
  return {
    after: (ms, run) => {
      clearTimeout(timer.current);
      timer.current = setTimeout(run, ms);
    },
    cancel: () => {
      clearTimeout(timer.current);
    },
  };
}

/**
 * Two kinds of hover, kept apart. Resting on a card focuses the diagram on its lines, after a short delay so
 * sweeping across the canvas does not flash every card's lines in turn. Pointing at a line raises that one
 * line at once and changes nothing else, so moving across many lines is calm.
 */
export function useSteadyHover(): {
  readonly component: string | null;
  readonly edge: string | null;
  readonly settle: (target: EventTarget | null) => void;
  readonly clear: () => void;
  readonly enterEdge: (id: string) => void;
  readonly leaveEdge: () => void;
} {
  const [component, setComponent] = useState<string | null>(null);
  const [edge, setEdge] = useState<string | null>(null);
  const wanted = useRef<string | null>(null);
  const focus = useTimer();
  const line = useTimer();
  const settle = (target: EventTarget | null): void => {
    const next = componentOf(target);
    if (next === undefined || next === wanted.current) return;
    wanted.current = next;
    if (next === component) {
      focus.cancel();
      return;
    }
    focus.after(next === null ? UNFOCUS_MS : FOCUS_MS, () => {
      setComponent(next);
    });
  };
  const clear = (): void => {
    focus.cancel();
    line.cancel();
    wanted.current = null;
    setComponent(null);
    setEdge(null);
  };
  return {
    component,
    edge,
    settle,
    clear,
    enterEdge: (id) => {
      line.cancel();
      setEdge(id);
    },
    leaveEdge: () => {
      line.after(LINE_GRACE_MS, () => {
        setEdge(null);
      });
    },
  };
}
