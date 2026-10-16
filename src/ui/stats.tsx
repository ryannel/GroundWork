import Link from 'next/link';

import styles from './stats.module.css';

interface Stat {
  readonly value: number;
  readonly label: string;
  /** Where the things counted are listed. */
  readonly href: string;
}

// A row of numbers, each a link to what it counts, so the size of a thing is read at a glance and one click away.
export function Stats({
  label,
  stats,
}: {
  readonly label: string;
  readonly stats: readonly Stat[];
}) {
  return (
    <ul aria-label={label} className={styles.stats}>
      {stats.map((stat) => (
        <li key={stat.label}>
          <Link className={styles.stat} href={stat.href}>
            <span className={styles.value}>{String(stat.value)}</span>
            <span className={styles.label}>{stat.label}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
