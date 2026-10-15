'use client';

import { useId, useState, type ReactNode } from 'react';

import { useStops } from '@/features/plan/viz/stops/use-stops';

import styles from './seg-tabs.module.css';

export interface SegTab {
  readonly label: string;
  /** What the address says while this tab shows, on stepped tabs; the label when not given. */
  readonly key?: string;
  readonly content: ReactNode;
  /** Shown beside the control while this tab is: a Copy button. */
  readonly action?: ReactNode;
}

interface SegTabsProps {
  /** What the control chooses, for assistive tech: "Show the plan as". */
  readonly label: string;
  /** The first is showing. */
  readonly tabs: readonly SegTab[];
  /** The tabs are the screen's stops: the current one is in the address, and the keys and pager step through them. */
  readonly stepped?: boolean;
}

/** A segmented control and its panes: radios, so the arrow keys move between the choices while one has focus. */
export function SegTabs({ label, tabs, stepped = false }: SegTabsProps) {
  const name = useId();
  const [picked, setPicked] = useState(0);
  const stops = useStops(
    stepped && tabs.length > 1 ? tabs.map((t) => ({ key: t.key ?? t.label, title: t.label })) : [],
  );
  const current = stepped ? stops.at : picked;
  const setCurrent = stepped ? stops.go : setPicked;
  const [only] = tabs;
  if (only === undefined) return null;
  if (tabs.length === 1) {
    return (
      <div>
        {only.action === undefined ? null : <div className={styles.bar}>{only.action}</div>}
        {only.content}
      </div>
    );
  }
  return (
    <div className={styles.tabs}>
      <div className={styles.bar}>
        <div aria-label={label} className={styles.seg} role="radiogroup">
          {tabs.map((t, i) => (
            <span className={styles.choice} key={t.label}>
              <input
                checked={i === current}
                className={styles.radio}
                id={`${name}-${String(i)}`}
                name={name}
                onChange={() => {
                  setCurrent(i);
                }}
                type="radio"
              />
              <label htmlFor={`${name}-${String(i)}`}>{t.label}</label>
            </span>
          ))}
        </div>
        {tabs[current]?.action}
      </div>
      {tabs.map((t, i) => (
        <div hidden={i !== current} key={t.label}>
          {t.content}
        </div>
      ))}
    </div>
  );
}
