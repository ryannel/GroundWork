import type { ReactNode } from 'react';

import styles from './today-thing.module.css';

/** Shared layout for the record and the other records at its level. */
export function TodayThingFrame({
  register,
  children,
}: {
  readonly register: ReactNode;
  readonly children: ReactNode;
}) {
  return (
    <div className={styles.layout}>
      {register}
      <article className={styles.article}>{children}</article>
    </div>
  );
}
