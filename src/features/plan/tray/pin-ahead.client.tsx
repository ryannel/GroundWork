'use client';

import { usePathname } from 'next/navigation';
import { useEffect } from 'react';

import styles from './pin-ahead.module.css';
import { addPins, planOfPath, setTrayOpen } from './tray-store';

interface PinAheadProps {
  /** What this step carries that the plan will change. */
  readonly ids: readonly string[];
  /** Why the step is marked, in words. */
  readonly reasons: readonly string[];
}

// A ◇ on a step of today's journey that the plan revisits. Reading the step pins what it carries to the tray, as
// the reader walks; the mark opens the tray.
export function PinAhead({ ids, reasons }: PinAheadProps) {
  const path: unknown = usePathname();
  const here = typeof path === 'string' ? path : '';
  const plan = planOfPath(here);
  const key = ids.join(' ');
  useEffect(() => {
    if (plan !== null) addPins(plan, key.split(' '), here);
  }, [plan, key, here]);
  return (
    <button
      className={styles.ahead}
      onClick={() => {
        setTrayOpen(true);
      }}
      title={reasons.join('; ')}
      type="button"
    >
      ◇ Changes ahead
    </button>
  );
}
