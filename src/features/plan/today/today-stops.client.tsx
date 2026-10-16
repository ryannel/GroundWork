'use client';

import type { ReactNode } from 'react';

import { FlowStepper } from '@/features/plan/viz/flow-viewer/flow-stepper';
import { StopFocus } from '@/features/plan/viz/stops/stop-focus.client';
import { useStops } from '@/features/plan/viz/stops/use-stops';

import styles from './today-stops.module.css';

export interface TodayStop {
  readonly key: string;
  readonly title: string;
  readonly headline: string;
  readonly lede: string;
  readonly focus?: string;
  readonly body?: ReactNode;
}

// The map read in stops, under a page's own heading: who owns what, the calls, the events and the stores. Each
// stop says what is true and brings its part of the map forward.
export function TodayStops({
  stops,
  children,
}: {
  readonly stops: readonly TodayStop[];
  readonly children: ReactNode;
}) {
  const { at, go } = useStops(stops);
  const stop = stops[at];
  return (
    <StopFocus value={stop?.focus ?? null}>
      {stop === undefined ? null : (
        <div className={styles.lead}>
          <FlowStepper
            current={at}
            onGo={go}
            stops={stops.map((s) => ({ key: s.key, title: s.title }))}
          />
          <p className={styles.headline}>{stop.headline}</p>
          <p className={styles.lede}>{stop.lede}</p>
        </div>
      )}
      {children}
      {stops.map((s) => (
        <div className={styles.body} hidden={s.key !== stop?.key} key={s.key}>
          {s.body}
        </div>
      ))}
    </StopFocus>
  );
}
