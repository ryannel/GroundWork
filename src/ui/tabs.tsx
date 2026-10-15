import Link from 'next/link';

import styles from './tabs.module.css';

interface Tab {
  readonly href: string;
  readonly label: string;
}

interface TabsProps {
  readonly label: string;
  readonly tabs: readonly Tab[];
  readonly current: string;
}

// Tabs are links: each one is a page, so the current tab lives in the URL.
export function Tabs({ label, tabs, current }: TabsProps) {
  return (
    <nav aria-label={label} className={styles.tabs}>
      {tabs.map((tab) => (
        <Link
          aria-current={tab.href === current ? 'page' : undefined}
          className={styles.tab}
          href={tab.href}
          key={tab.href}
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}
