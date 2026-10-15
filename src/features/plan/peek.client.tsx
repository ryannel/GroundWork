'use client';

import { useState, useSyncExternalStore, type ReactNode } from 'react';

import { Kbd } from '@/ui/kbd';

import { peekHeld, watchPeek } from './peek';
import styles from './peek.module.css';

// A What changes screen with a switch to see today: the plan's new parts fade out, and a line says so. Holding ⌥
// does the same for as long as the key is down. The switch lasts for this screen only.
export function PeekToday({ children }: { readonly children: ReactNode }) {
  const [pinned, setPinned] = useState(false);
  const held = useSyncExternalStore(watchPeek, peekHeld, () => false);
  const on = pinned || held;
  return (
    <div className={styles.peek} data-peek={on ? '' : undefined} data-peek-root="">
      <div className={styles.tools}>
        {on ? (
          <p className={styles.banner} role="status">
            <b>Showing today.</b> The plan’s new parts are faded.
            {held && !pinned ? (
              <span className={styles.hint}>
                {' '}
                Let go of <Kbd keys="⌥" /> to bring them back.
              </span>
            ) : null}
          </p>
        ) : null}
        <button
          aria-pressed={pinned}
          className={styles.toggle}
          onClick={() => {
            setPinned(!pinned);
          }}
          title="Hold ⌥ to see today for a moment"
          type="button"
        >
          {pinned ? 'Show with this plan' : 'Show today'}
        </button>
      </div>
      {children}
    </div>
  );
}
