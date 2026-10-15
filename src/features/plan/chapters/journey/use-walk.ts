import { useCallback, useEffect, useRef, useState } from 'react';

import { entryOf, positionOf, stopBeside, type Walk } from '@/application/plan-story-journey-walk';
import type { JourneyMode } from '@/application/plan-viz-journey-words';
import { setParam } from '@/features/plan/lens.client';
import { arrivedFrom, holdKeys } from '@/features/plan/walk-keys';

// Where the reader is on a scenario's walk lives in the address, as `?step=` and `?mode=today|plan`, so a place
// can be shared and survives a reload.

export interface Place {
  /** Into the walk's positions. */
  readonly index: number;
  readonly mode: JourneyMode;
}

const MODE_WORDS: Readonly<Record<JourneyMode, string>> = { asIs: 'today', toBe: 'plan' };

const trimmed = (path: string): string => (path.endsWith('/') ? path.slice(0, -1) : path);

// While the app moves between screens the walk is drawn before the address changes, so the address is read only
// when it is this screen's.
function placeFromAddress(walk: Walk, href: string): Place {
  const own = trimmed(globalThis.location.pathname).endsWith(trimmed(href));
  const search = new URLSearchParams(own ? globalThis.location.search : '');
  const mode: JourneyMode = search.get('mode') === 'plan' ? 'toBe' : 'asIs';
  const named = positionOf(walk, search.get('step') ?? '');
  return { index: named === -1 ? entryOf(walk, mode, arrivedFrom(href)) : named, mode };
}

interface WalkInput {
  readonly walk: Walk;
  /** This screen's address. */
  readonly href: string;
  /** Runs ahead of every move. */
  readonly before: () => void;
}

/** The reader's place on the walk, and the ways to move it. */
export function useWalk({ walk, href, before }: WalkInput) {
  const [place, setPlace] = useState(() => placeFromAddress(walk, href));
  const latest = useRef(place);

  const go = useCallback(
    (next: Place) => {
      if (next.index === latest.current.index && next.mode === latest.current.mode) return;
      before();
      latest.current = next;
      setPlace(next);
    },
    [before],
  );

  useEffect(() => {
    const at = walk.positions[place.index];
    setParam('step', at === undefined ? null : (at.stepId ?? at.flowId));
    setParam('mode', MODE_WORDS[place.mode]);
  }, [walk, place]);

  useEffect(
    () =>
      holdKeys({
        move: (by) => {
          const index = stopBeside(walk, latest.current, by);
          if (index !== null) go({ ...latest.current, index });
          return index !== null;
        },
        toggleMode: () => {
          go({ ...latest.current, mode: latest.current.mode === 'asIs' ? 'toBe' : 'asIs' });
        },
      }),
    [walk, go],
  );

  return { place, go };
}
