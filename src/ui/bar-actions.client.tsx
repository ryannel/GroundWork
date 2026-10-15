'use client';

import { useRef, useState, type ReactNode } from 'react';

import styles from './bar-actions.module.css';
import { useDismiss } from './menu.client';

// The bar's actions: in a row on a wide window, and behind one "More" button on a narrow one, so nothing wraps
// or slides under the title. The actions are drawn once either way, so each keeps its own state.
export function BarActions({ children }: { readonly children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  useDismiss(root, open, () => {
    setOpen(false);
  });
  return (
    <div className={styles.wrap} ref={root}>
      <button
        aria-controls="bar-actions"
        aria-expanded={open}
        aria-label="More"
        className={styles.more}
        onClick={() => {
          setOpen(!open);
        }}
        title="More"
        type="button"
      >
        <svg aria-hidden="true" fill="currentColor" height="15" viewBox="0 0 16 16" width="15">
          <circle cx="3.5" cy="8" r="1.4" />
          <circle cx="8" cy="8" r="1.4" />
          <circle cx="12.5" cy="8" r="1.4" />
        </svg>
      </button>
      <div className={styles.actions} data-open={open ? '' : undefined} id="bar-actions">
        {children}
      </div>
    </div>
  );
}
