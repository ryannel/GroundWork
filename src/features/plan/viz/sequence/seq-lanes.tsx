import type { ReactNode } from 'react';

import { type Place, columnPlace } from '@/application/plan-viz-sequence-text';

import styles from './seq-lanes.module.css';

interface LanesProps {
  readonly children: ReactNode;
}

/** The strip of half-columns a row's arrows, boxes and lifelines are placed on. */
export function Lanes({ children }: LanesProps) {
  return <div className={styles.lanes}>{children}</div>;
}

interface LaneItemProps {
  readonly place: Place;
  /** Where it sits in the height of the row. */
  readonly align?: 'stretch' | 'start' | 'end';
  readonly children: ReactNode;
}

/** One thing on the lane strip, between the grid lines `place` names. */
export function LaneItem({ place, align = 'stretch', children }: LaneItemProps) {
  return (
    <div className={styles.item} data-align={align} data-span={place.span} data-start={place.start}>
      {children}
    </div>
  );
}

/** One thin line down the middle of each column, so the eye can follow a participant down the rows. */
export function Lifelines({ cols }: { readonly cols: number }) {
  const at = Array.from({ length: cols }, (_, col) => columnPlace(col));
  return at.map((place) => (
    <LaneItem key={place.start} place={place}>
      <span aria-hidden="true" className={styles.life} />
    </LaneItem>
  ));
}
