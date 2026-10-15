'use client';

import { useId } from 'react';

import styles from './view-switch.module.css';

interface ViewSwitchProps {
  readonly today: boolean;
  readonly onChange: (today: boolean) => void;
}

const CHOICES = [
  { today: true, label: 'today' },
  { today: false, label: 'with this plan' },
] as const;

/** Shows the open thing as it is today or with the plan: radios, so the arrow keys move between the two. */
export function ViewSwitch({ today, onChange }: ViewSwitchProps) {
  const name = useId();
  return (
    <div className={styles.view}>
      <span className={styles.label}>Showing</span>
      <div aria-label="The inspector shows it" className={styles.seg} role="radiogroup">
        {CHOICES.map((choice) => (
          <span className={styles.choice} key={choice.label}>
            <input
              checked={choice.today === today}
              className={styles.radio}
              id={`${name}-${choice.label}`}
              name={name}
              onChange={() => {
                onChange(choice.today);
              }}
              type="radio"
            />
            <label htmlFor={`${name}-${choice.label}`}>{choice.label}</label>
          </span>
        ))}
      </div>
    </div>
  );
}
