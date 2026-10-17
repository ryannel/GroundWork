import Link from 'next/link';
import type { ReactNode } from 'react';

import styles from './nav-rail.module.css';

export interface RailItem {
  readonly href: string;
  readonly title: string;
  readonly current: boolean;
  /** The mark before the name; a dot by default, filled when current. */
  readonly mark?: ReactNode;
}

export interface RailGroup {
  readonly key: string;
  /** A number or letter in a circle before the title. */
  readonly marker: string;
  readonly title: string;
  /** Where the title leads; leave out and the title only opens the group. */
  readonly href?: string;
  /** A quiet count on the right. */
  readonly count?: ReactNode;
  /** The group holds the page being read. */
  readonly current: boolean;
  readonly open: boolean;
  /** Sits apart from the groups above it, under a rule. */
  readonly side?: boolean;
  readonly items: readonly RailItem[];
}

interface NavRailProps {
  readonly label: string;
  readonly groups: readonly RailGroup[];
  readonly children?: ReactNode;
}

// The rail down the left of every page that has one: groups with a circled marker, each opening to its pages,
// the one being read filled in.
export function NavRail({ label, groups, children }: NavRailProps) {
  return (
    <nav aria-label={label} className={styles.rail}>
      {children}
      {groups.map((group) =>
        group.items.length === 0 ? (
          <div className={styles.group} key={group.key} {...flags(group)}>
            <Head group={group} />
          </div>
        ) : (
          <details className={styles.group} key={group.key} {...flags(group)} open={group.open}>
            <summary className={styles.summary}>
              <HeadParts group={group} />
            </summary>
            <Items items={group.items} />
          </details>
        ),
      )}
    </nav>
  );
}

function flags(group: RailGroup) {
  return {
    'data-current': group.current ? '' : undefined,
    'data-side': group.side === true ? '' : undefined,
  };
}

function Head({ group }: { readonly group: RailGroup }) {
  if (group.href === undefined) {
    return (
      <div className={styles.summary}>
        <HeadParts group={group} />
      </div>
    );
  }
  return (
    <Link
      aria-current={group.current ? 'page' : undefined}
      className={styles.summary}
      href={group.href}
    >
      <HeadParts group={group} />
    </Link>
  );
}

function HeadParts({ group }: { readonly group: RailGroup }) {
  return (
    <>
      <span className={styles.marker}>{group.marker}</span>
      {group.href === undefined || group.items.length === 0 ? (
        <span className={styles.title}>{group.title}</span>
      ) : (
        <Link className={styles.title} href={group.href}>
          {group.title}
        </Link>
      )}
      {group.count === undefined ? null : <span className={styles.count}>{group.count}</span>}
    </>
  );
}

function Items({ items }: { readonly items: readonly RailItem[] }) {
  return (
    <ol className={styles.items}>
      {items.map((item) => (
        <li key={item.href}>
          <Link
            aria-current={item.current ? 'page' : undefined}
            className={styles.item}
            href={item.href}
          >
            <span aria-hidden="true" className={styles.mark}>
              {item.mark ?? (item.current ? '●' : '○')}
            </span>
            <span className={styles.name}>{item.title}</span>
          </Link>
        </li>
      ))}
    </ol>
  );
}
