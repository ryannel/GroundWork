'use client';

import { type ReactNode, useId, useState } from 'react';

import styles from './flow-chooser.module.css';

export interface ChosenFlow {
  readonly id: string;
  readonly name: string;
  readonly says: string;
  readonly body: ReactNode;
}

// One flow at a time: a tab for each, and the chosen one drawn below. Every flow arrives drawn; this only picks,
// and the view the reader picked carries over to the next flow.
export function FlowChooser({ flows }: { readonly flows: readonly ChosenFlow[] }) {
  const [chosen, setChosen] = useState(flows[0]?.id ?? '');
  const base = useId();
  const panel = (i: number): string => `${base}-panel-${String(i)}`;
  const tab = (i: number): string => `${base}-tab-${String(i)}`;
  return (
    <div className={styles.chooser}>
      {flows.length > 1 ? (
        <div aria-label="Flows" className={styles.tabs} role="tablist">
          {flows.map((flow, i) => (
            <button
              aria-controls={panel(i)}
              aria-selected={flow.id === chosen}
              className={styles.tab}
              id={tab(i)}
              key={flow.id}
              onClick={() => {
                setChosen(flow.id);
              }}
              role="tab"
              type="button"
            >
              <span className={styles.name}>{flow.name}</span>
              <span className={styles.says}>{flow.says}</span>
            </button>
          ))}
        </div>
      ) : null}
      {flows.map((flow, i) => (
        <div
          aria-labelledby={flows.length > 1 ? tab(i) : undefined}
          hidden={flow.id !== chosen}
          id={panel(i)}
          key={flow.id}
          role={flows.length > 1 ? 'tabpanel' : undefined}
        >
          {flow.id === chosen ? flow.body : null}
        </div>
      ))}
    </div>
  );
}
