import Link from 'next/link';
import type { ReactNode } from 'react';

import { Brand } from '@/ui/brand';
import { ThemeToggle } from '@/ui/theme-toggle.client';

import styles from './top-bar.module.css';

interface TopBarProps {
  readonly workspace: { readonly name: string; readonly href: string };
  readonly title: string;
  readonly version: string | undefined;
  /** The palette's trigger. */
  readonly children: ReactNode;
}

export function TopBar({ workspace, title, version, children }: TopBarProps) {
  return (
    <header className={styles.bar}>
      <Brand />
      <nav aria-label="Trail" className={styles.trail}>
        <Link href="/">Workspaces</Link>
        <span aria-hidden="true">›</span>
        <Link href={workspace.href}>{workspace.name}</Link>
      </nav>
      <p className={styles.title}>
        {title}
        {version === undefined ? null : <span className={styles.version}> v{version}</span>}
      </p>
      <div className={styles.actions}>
        {children}
        <ThemeToggle />
      </div>
    </header>
  );
}
