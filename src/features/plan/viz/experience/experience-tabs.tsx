import type { ReactNode } from 'react';

import type { MomentTab } from '@/application/plan-viz-experience';

import styles from './experience-tabs.module.css';

interface TabsProps {
  readonly tabs: readonly MomentTab[];
  /** Marks under a moment's title, in the order of `tabs`. */
  readonly marks?: readonly ReactNode[] | undefined;
}

// The moments of the flow, in order; each takes the reader to the stop that opens it.
export function ExperienceTabs({ tabs, marks }: TabsProps) {
  return (
    <nav aria-label="Moments in this flow" className={styles.nav}>
      {tabs.map((tab, i) => (
        <button
          aria-current={tab.current ? 'step' : undefined}
          className={styles.moment}
          data-current={tab.current ? '' : undefined}
          data-step={tab.stop}
          key={tab.anchor}
          type="button"
        >
          <span>
            {tab.word}
            {tab.screen === null ? '' : ` · ${tab.screen}`}
          </span>
          <strong>{tab.title}</strong>
          {marks?.[i]}
        </button>
      ))}
    </nav>
  );
}
