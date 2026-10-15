'use client';

import { type ChangeEvent, type ReactNode, useState } from 'react';

import styles from './before-after.module.css';
import { PlanImage } from './plan-image';
import { useSameShape } from './use-same-shape';

type View = 'side' | 'swipe';

export interface BeforeAfterViewProps {
  /** Today's picture; null when the screen is not there today. */
  readonly today: ReactNode;
  /** The picture with this plan; null when the plan removes the screen. */
  readonly plan: ReactNode;
  /** Beside "With this plan": the proposed-revision mark. */
  readonly planTag?: ReactNode;
  /** The two pictures' addresses, when both exist; without them there is nothing to swipe. */
  readonly pictures: { readonly today: string; readonly plan: string } | null;
}

function Switch({ view, onView }: { readonly view: View; readonly onView: (v: View) => void }) {
  const choice = (value: View, text: string) => (
    <button
      aria-checked={view === value}
      onClick={() => {
        onView(value);
      }}
      role="radio"
      type="button"
    >
      {text}
    </button>
  );
  return (
    <div className={styles.bar}>
      <div aria-label="Compare the pictures" className={styles.seg} role="radiogroup">
        {choice('side', 'Side by side')}
        {choice('swipe', 'Swipe')}
      </div>
    </div>
  );
}

// The dividing line is a CSS variable, moved straight on the element so dragging never re-renders.
const cut = (event: ChangeEvent<HTMLInputElement>) => {
  event.currentTarget.parentElement?.style.setProperty('--cut', `${event.currentTarget.value}%`);
};

function Swipe({
  today,
  plan,
  hidden,
}: {
  readonly hidden: boolean;
  readonly today: string;
  readonly plan: string;
}) {
  return (
    <div className={styles.swipe} hidden={hidden}>
      <div className={styles.swipePic}>
        <PlanImage alt="With this plan" className={styles.swipeImg} src={plan} />
        <PlanImage alt="Today" className={styles.swipeToday} src={today} />
        <span aria-hidden="true" className={styles.swipeBar} />
        <span className={styles.key} data-side="today">
          Today
        </span>
        <span className={styles.key} data-side="plan">
          With this plan
        </span>
      </div>
      <input
        aria-label="Today on the left, with this plan on the right"
        className={styles.range}
        defaultValue={50}
        max={100}
        min={0}
        onChange={cut}
        type="range"
      />
    </div>
  );
}

// Today | with this plan for one screen: side by side, or a swipe when both pictures exist and are the same shape.
export function BeforeAfterView({ today, plan, planTag, pictures }: BeforeAfterViewProps) {
  const [view, setView] = useState<View>('side');
  const { ref, onLoadCapture, same } = useSameShape();
  const swiping = same && view === 'swipe';
  return (
    <div
      className={styles.ba}
      data-view={swiping ? 'swipe' : 'side'}
      onLoadCapture={onLoadCapture}
      ref={ref}
    >
      {pictures !== null && same ? <Switch onView={setView} view={view} /> : null}
      <div className={styles.side} hidden={swiping}>
        <div className={styles.col} data-today="">
          <span className={styles.eyebrow}>Today</span>
          {today ?? <div className={styles.none}>Not there today</div>}
        </div>
        <div className={styles.col} data-plan="">
          <span className={styles.eyebrow}>With this plan {planTag}</span>
          {plan ?? <div className={styles.none}>Removed</div>}
        </div>
      </div>
      {pictures === null ? null : (
        <Swipe hidden={!swiping} plan={pictures.plan} today={pictures.today} />
      )}
    </div>
  );
}
