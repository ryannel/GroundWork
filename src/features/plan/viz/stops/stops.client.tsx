'use client';

import type { ReactNode } from 'react';

import { FlowStepper } from '@/features/plan/viz/flow-viewer/flow-stepper';
import { PageHeader } from '@/ui/page-header';

import { StopFocus } from './stop-focus.client';
import styles from './stops.module.css';
import { useStops } from './use-stops';

export interface StopPanel {
  readonly key: string;
  readonly title: string;
  /** What is true at this stop. */
  readonly headline: string;
  readonly lede: string;
  /** What the picture should bring forward; the picture reads it. */
  readonly focus?: string;
  /** What sits under the picture at this stop. */
  readonly body?: ReactNode;
}

interface StopsProps {
  /** The screen's name. */
  readonly title: string;
  readonly stops: readonly StopPanel[];
  /** The picture every stop shares. */
  readonly children?: ReactNode;
}

// One screen read in stops: a headline for each, one picture that follows, and what sits under it. Every stop's
// text is in the page, so the stops a reader has not reached are only hidden. The stop is in the address, and
// the arrow keys and the pager step through the stops before they leave the screen.
export function Stops({ title, stops, children }: StopsProps) {
  const { at, go } = useStops(stops);
  const stop = stops[at];
  if (stop === undefined) return null;
  return (
    <StopFocus value={stop.focus ?? null}>
      <PageHeader description={stop.headline} title={title}>
        <p>{stop.lede}</p>
      </PageHeader>
      <FlowStepper
        current={at}
        onGo={go}
        stops={stops.map((s) => ({ key: s.key, title: s.title }))}
      />
      {children}
      {stops.map((s) => (
        <div className={styles.body} hidden={s.key !== stop.key} key={s.key}>
          {s.body}
        </div>
      ))}
    </StopFocus>
  );
}
