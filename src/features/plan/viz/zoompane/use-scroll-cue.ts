import { type RefObject, useEffect, useState } from 'react';

import { scrollCue } from '@/application/plan-viz-zoompane';

export interface Cue {
  more: boolean;
  left: boolean;
  right: boolean;
}

const NONE: Cue = { more: false, left: false, right: false };

/** Which edges of a sideways-scrolling box have more behind them, kept up to date as it scrolls and resizes. */
export function useScrollCue(box: RefObject<HTMLElement | null>): Cue {
  const [cue, setCue] = useState<Cue>(NONE);
  useEffect(() => {
    const el = box.current;
    if (el === null) return;
    const measure = (): void => {
      const next = scrollCue(el);
      setCue((now) =>
        now.more === next.more && now.left === next.left && now.right === next.right ? now : next,
      );
    };
    measure();
    el.addEventListener('scroll', measure, { passive: true });
    const watch = typeof ResizeObserver === 'function' ? new ResizeObserver(measure) : null;
    watch?.observe(el);
    return () => {
      el.removeEventListener('scroll', measure);
      watch?.disconnect();
    };
  }, [box]);
  return cue;
}
