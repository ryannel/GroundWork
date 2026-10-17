import { useCallback, useEffect, useRef, useState } from 'react';

import { entryOf, positionOf, stopBeside, type Walk } from '@/application/plan-story-journey-walk';
import type { JourneyMode } from '@/application/plan-viz-journey-words';
import { setParam } from '@/features/plan/lens.client';
import { arrivedFrom, holdKeys, walkMoved } from '@/features/plan/walk-keys';

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
function placeFromAddress(walk: Walk, input: WalkInput): Place {
  const own = trimmed(globalThis.location.pathname).endsWith(trimmed(input.href));
  const search = new URLSearchParams(own ? globalThis.location.search : '');
  const plan = input.today !== true && search.get('mode') === 'plan';
  const mode: JourneyMode = plan ? 'toBe' : 'asIs';
  const named = positionOf(walk, search.get('step') ?? '');
  return { index: named === -1 ? entryOf(walk, mode, arrivedFrom(input.href)) : named, mode };
}

/** The title of the stop one step away in the reader's view, or null at the walk's end; the pager offers it. */
function titleBeside(walk: Walk, at: Place, by: -1 | 1): string | null {
  const index = stopBeside(walk, at, by);
  return index === null ? null : (walk.titles[at.mode][index] ?? null);
}

interface WalkInput {
  readonly walk: Walk;
  /** This screen's address. */
  readonly href: string;
  /** Runs ahead of every move. */
  readonly before: () => void;
  /** Outside any plan: today only, so there is no view to switch or keep in the address. */
  readonly today?: boolean | undefined;
}

/** The reader's place on the walk, and the ways to move it. */
export function useWalk(input: WalkInput): {
  readonly place: Place;
  readonly go: (next: Place) => void;
} {
  const { walk, before, today = false } = input;
  const [place, setPlace] = useState(() => placeFromAddress(walk, input));
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
    if (!today) setParam('mode', MODE_WORDS[place.mode]);
    walkMoved();
  }, [walk, place, today]);

  useEffect(
    () =>
      holdKeys({
        move: (by) => {
          const index = stopBeside(walk, latest.current, by);
          if (index !== null) go({ ...latest.current, index });
          return index !== null;
        },
        ...(today
          ? {}
          : {
              toggleMode: () => {
                go({ ...latest.current, mode: latest.current.mode === 'asIs' ? 'toBe' : 'asIs' });
              },
            }),
        beside: (by) => titleBeside(walk, latest.current, by),
        here: () => walk.titles[latest.current.mode][latest.current.index] ?? null,
      }),
    [walk, go, today],
  );

  return { place, go };
}
