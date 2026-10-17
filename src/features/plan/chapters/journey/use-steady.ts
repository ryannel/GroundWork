import { type RefObject, useEffect, useLayoutEffect, useRef } from 'react';

import { applyFolds, keepFolds } from '@/features/plan/kept';

// Stepping must not move the page under the reader's eye. Before a move the drawing's place on screen is noted;
// after it, and for a moment while pictures load and drawings measure themselves, the page scrolls by however far
// the drawing shifted. The walk grows when the page is too short to scroll that far, and never shrinks back.

interface Mark {
  /** The drawing's top, when one is shown. */
  readonly stage: number | null;
  readonly top: number;
}

const SETTLE_MS = 800;

function markOf(box: HTMLElement): Mark {
  const stage = box.querySelector('[data-walk-anchor]');
  return {
    stage: stage === null ? null : stage.getBoundingClientRect().top,
    top: box.getBoundingClientRect().top,
  };
}

function shiftFrom(was: Mark, now: Mark): number {
  return was.stage !== null && now.stage !== null ? now.stage - was.stage : now.top - was.top;
}

/** How far the page must scroll to put the drawing back, and how far it can before it ends. */
function gapOf(box: HTMLElement, was: Mark): { readonly shift: number; readonly room: number } {
  return {
    shift: Math.round(shiftFrom(was, markOf(box))),
    room: document.documentElement.scrollHeight - globalThis.innerHeight - globalThis.scrollY,
  };
}

export interface Steady {
  readonly root: RefObject<HTMLDivElement | null>;
  readonly before: () => void;
}

/** Holds the walk still across moves: put `root` on the walk, and call `before` just ahead of each move. */
export function useSteady(): Steady {
  const root = useRef<HTMLDivElement>(null);
  const mark = useRef<Mark | null>(null);
  const settling = useRef<{ readonly was: Mark; readonly until: number } | null>(null);
  const tallest = useRef(0);
  const frame = useRef(0);

  const hold = (time: number): void => {
    const box = root.current;
    const now = settling.current;
    if (box === null || now === null) return;
    const { shift, room } = gapOf(box, now.was);
    if (shift > room) {
      tallest.current = box.offsetHeight + shift - room;
      box.style.minHeight = `${String(tallest.current)}px`;
    }
    if (shift !== 0) globalThis.scrollBy(0, shift);
    if (time < now.until) frame.current = requestAnimationFrame(hold);
    else settling.current = null;
  };

  useLayoutEffect(() => {
    const box = root.current;
    if (box === null) return;
    applyFolds(box);
    tallest.current = Math.max(tallest.current, box.offsetHeight);
    box.style.minHeight = `${String(tallest.current)}px`;
    if (mark.current === null) return;
    const time = performance.now();
    settling.current = { was: mark.current, until: time + SETTLE_MS };
    mark.current = null;
    cancelAnimationFrame(frame.current);
    hold(time);
  });

  useEffect(() => {
    const box = root.current;
    const stop = box === null ? undefined : keepFolds(box);
    return () => {
      stop?.();
      cancelAnimationFrame(frame.current);
    };
  }, []);

  const before = (): void => {
    if (root.current !== null) mark.current = markOf(root.current);
  };
  return { root, before };
}
