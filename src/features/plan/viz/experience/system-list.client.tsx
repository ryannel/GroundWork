'use client';

import { type ReactNode, useRef } from 'react';

import styles from './system-list.module.css';
import { useScrollCurrent } from './use-scroll-current';

interface SystemListProps {
  readonly children: ReactNode;
  /** Changes when the reader moves, so the current step is brought into view again. */
  readonly current: string;
}

// The system steps of a moment; tall lists scroll inside themselves and keep the current step visible.
export function SystemList({ children, current }: SystemListProps) {
  const list = useRef<HTMLOListElement>(null);
  useScrollCurrent(list, current);
  return (
    <ol className={styles.list} ref={list}>
      {children}
    </ol>
  );
}
