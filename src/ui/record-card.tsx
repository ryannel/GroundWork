import type { ReactNode } from 'react';

import styles from './record-card.module.css';

export interface RecordRow {
  readonly label: string;
  readonly value: ReactNode;
  /** Said at the end of the row, such as how late a date is. */
  readonly aside?: ReactNode;
  /** Draws the row in the warning colour. */
  readonly warn?: boolean;
}

interface RecordCardProps {
  /** Who it belongs to, above the title. */
  readonly owner: ReactNode;
  readonly title: ReactNode;
  /** One line under the title: who owns it, what it serves. */
  readonly meta?: ReactNode;
  readonly rows: readonly RecordRow[];
  /** Links and actions along the foot. */
  readonly actions?: ReactNode;
  /** A team's hue, 1 to 13, drawn as a stripe down the left edge. */
  readonly slot?: number | null;
  /** Fades the card a little, for work that is done. */
  readonly done?: boolean;
  readonly label?: string;
}

/**
 * One record of work as a card: its owner, its title, a line under it, then labelled rows (commitment, progress,
 * dates) and a foot of actions. The same card for every owner; only the words differ.
 */
export function RecordCard({
  owner,
  title,
  meta,
  rows,
  actions,
  slot = null,
  done = false,
  label,
}: RecordCardProps) {
  return (
    <article
      aria-label={label}
      className={styles.card}
      data-done={done ? '' : undefined}
      data-team-slot={slot ?? undefined}
    >
      <p className={styles.owner}>{owner}</p>
      <h3 className={styles.title}>{title}</h3>
      {meta === undefined ? null : <p className={styles.meta}>{meta}</p>}
      {rows.length === 0 ? null : (
        <dl className={styles.rows}>
          {rows.map((row) => (
            <div
              className={styles.row}
              data-warn={row.warn === true ? '' : undefined}
              key={row.label}
            >
              <dt className={styles.label}>{row.label}</dt>
              <dd className={styles.value}>{row.value}</dd>
              {row.aside === undefined ? null : <dd className={styles.aside}>{row.aside}</dd>}
            </div>
          ))}
        </dl>
      )}
      {actions === undefined ? null : <div className={styles.actions}>{actions}</div>}
    </article>
  );
}
