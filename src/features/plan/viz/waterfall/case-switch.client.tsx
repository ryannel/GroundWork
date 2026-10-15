'use client';

import { type ReactNode, useState } from 'react';

import type { WaterfallCase } from '@/application/plan-viz-waterfall-facts';
import type { CaseChoice } from '@/application/plan-viz-waterfall-words';

import styles from './case-switch.module.css';

interface CaseSwitchProps {
  readonly choices: readonly CaseChoice[];
  /** The case it opens on. */
  readonly landing: WaterfallCase;
  /** Whether to offer the choice; without it the section just shows its one case. */
  readonly withControl: boolean;
  readonly compact: boolean;
  /** Printed in the header, before the control. */
  readonly head: ReactNode;
  /** One body per case, each marked data-case-of. */
  readonly children: ReactNode;
}

// The frame of a waterfall, and the choice between its cases. Every case is drawn; the others are only hidden.
export function CaseSwitch({
  choices,
  landing,
  withControl,
  compact,
  head,
  children,
}: CaseSwitchProps) {
  const [kase, setKase] = useState<WaterfallCase>(landing);
  return (
    <section
      className={styles.frame}
      data-case={kase}
      data-compact={compact ? '' : undefined}
      data-waterfall=""
    >
      <div className={styles.head}>
        {head}
        {withControl ? (
          <div aria-label="Case" className={styles.control} role="group">
            <span aria-hidden="true" className={styles.label}>
              case
            </span>
            {choices.map((c) => (
              <button
                aria-pressed={c.kase === kase}
                className={styles.choice}
                key={c.kase}
                onClick={() => {
                  setKase(c.kase);
                }}
                type="button"
              >
                {c.label}
              </button>
            ))}
          </div>
        ) : null}
      </div>
      {children}
    </section>
  );
}
