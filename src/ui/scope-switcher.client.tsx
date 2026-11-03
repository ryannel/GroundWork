'use client';

import Link from 'next/link';
import { createContext, useContext, type ReactNode } from 'react';

import { IntentLink } from './intent-link.client';
import { Menu } from './menu.client';
import styles from './scope-switcher.module.css';

interface ScopeLink {
  readonly label: string;
  readonly href: string;
  readonly group: string;
  readonly note?: string;
}

interface Scope {
  readonly label: string;
  readonly current: ScopeLink;
  readonly links: readonly ScopeLink[];
  readonly index: { readonly label: string; readonly href: string };
}

const Context = createContext<Scope | null>(null);

export function ScopeProvider({
  scope,
  children,
}: {
  readonly scope: Scope;
  readonly children: ReactNode;
}) {
  return <Context value={scope}>{children}</Context>;
}

export function ScopeSwitcher() {
  const scope = useContext(Context);
  if (scope === null) return null;
  const groups = [...new Set(scope.links.map((link) => link.group))];
  return (
    <div className={styles.switcher}>
      <Menu
        align="start"
        label={`${scope.label}: ${scope.current.label}. Switch ${scope.label.toLowerCase()}`}
        button={
          <span className={styles.current}>
            <span className={styles.label}>{scope.label}</span>
            {scope.current.label}
            {scope.current.note === undefined ? '' : ` (${scope.current.note})`}
          </span>
        }
      >
        <nav aria-label={`Switch ${scope.label.toLowerCase()}`}>
          {groups.map((group) => (
            <div key={group}>
              <p className={styles.group}>{group}</p>
              <ul className={styles.links}>
                {scope.links
                  .filter((link) => link.group === group)
                  .map((link) => (
                    <li key={link.href}>
                      <IntentLink
                        aria-current={link.href === scope.current.href ? 'true' : undefined}
                        href={link.href}
                      >
                        {link.label}
                      </IntentLink>
                    </li>
                  ))}
              </ul>
            </div>
          ))}
          <Link href={scope.index.href}>{scope.index.label}</Link>
        </nav>
      </Menu>
    </div>
  );
}
