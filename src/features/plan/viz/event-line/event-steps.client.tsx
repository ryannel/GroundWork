'use client';

import { useEffect, useRef, type ReactNode } from 'react';

import { useStops } from '@/features/plan/viz/stops/use-stops';

import { closeLast, showEvent } from './show-event';

export interface EventStop {
  /** The event's id: what the address says. */
  readonly key: string;
  readonly title: string;
}

interface EventStepsProps {
  /** The events on the page, in the order they are drawn. */
  readonly events: readonly EventStop[];
  readonly children: ReactNode;
}

/** The first stop: every line closed, as the page arrives. */
const EVERY: EventStop = { key: 'all', title: 'Every event' };

// A page of event lines read one event at a time: → and ← open the next or previous line and leave the page only
// at its ends, and the open event is in the address as `?stop=`. The page opens with every line closed.
export function EventSteps({ events, children }: EventStepsProps) {
  const { at } = useStops(events.length > 0 ? [EVERY, ...events] : []);
  const root = useRef<HTMLDivElement>(null);
  const key = at === 0 ? null : (events[at - 1]?.key ?? null);
  useEffect(() => {
    if (root.current === null) return;
    if (key === null) closeLast(root.current);
    else showEvent(root.current, key);
  }, [key]);
  return <div ref={root}>{children}</div>;
}
