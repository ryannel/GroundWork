import Link from 'next/link';

import styles from './brand.module.css';

// The Groundwork mark and wordmark; always leads home to the workspaces.
export function Brand() {
  return (
    <Link aria-label="Groundwork: all workspaces" className={styles.brand} href="/">
      <span aria-hidden="true" className={styles.mark}>
        <svg fill="none" height="16" viewBox="0 0 16 16" width="16">
          <path d="M8 1.5 14.5 5 8 8.5 1.5 5Z" />
          <path d="M1.5 8 8 11.5 14.5 8" />
          <path d="M1.5 11 8 14.5 14.5 11" />
        </svg>
      </span>
      <span className={styles.wordmark}>groundwork</span>
    </Link>
  );
}
