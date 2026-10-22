import Link from 'next/link';
import { Fragment, type ReactNode } from 'react';

import { type RailItem, RailItems } from './nav-rail-items';
import { PathRailItems } from './nav-rail-path.client';
import { RailSpy } from './nav-rail-spy.client';
import styles from './nav-rail.module.css';

export type { RailItem } from './nav-rail-items';

export interface RailGroup {
  readonly key: string;
  /** A number or letter in a circle before the title; leave out for a plain row with a dot. */
  readonly marker?: string;
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
  /** Starts a section of the rail, under this small heading. */
  readonly heading?: string;
  /** Lists its pages without a head of its own. */
  readonly bare?: boolean;
  /** Works out which page is open from the address, for a rail drawn once by a layout. */
  readonly byPath?: boolean;
  readonly items: readonly RailItem[];
}

/** Where the rail steps back to, and the name of what it lists. */
export interface RailTop {
  readonly back: { readonly label: string; readonly href: string };
  readonly title: string;
}

interface NavRailProps {
  readonly label: string;
  readonly groups: readonly RailGroup[];
  readonly top?: RailTop | undefined;
  readonly children?: ReactNode;
}

// The rail down the left of every page that has one: groups with a circled marker, each opening to its pages,
// the one being read filled in, and sections under small headings. Inside one thing, the rail steps back to
// what holds it and lists that thing's own pages.
export function NavRail({ label, groups, top, children }: NavRailProps) {
  return (
    <nav aria-label={label} className={styles.rail}>
      {top === undefined ? null : <Top top={top} />}
      {children}
      <RailSpy />
      {groups.map((group) => (
        <Fragment key={group.key}>
          {group.heading === undefined ? null : <p className={styles.heading}>{group.heading}</p>}
          <Group group={group} />
        </Fragment>
      ))}
    </nav>
  );
}

function Top({ top }: { readonly top: RailTop }) {
  return (
    <div className={styles.top}>
      <Link className={styles.back} href={top.back.href}>
        <span aria-hidden="true">←</span> {top.back.label}
      </Link>
      <p className={styles.place}>{top.title}</p>
    </div>
  );
}

function Group({ group }: { readonly group: RailGroup }) {
  if (group.bare === true) {
    return group.byPath === true ? (
      <PathRailItems items={group.items} />
    ) : (
      <RailItems flat items={group.items} />
    );
  }
  return group.items.length === 0 ? (
    <div className={styles.group} {...flags(group)}>
      <Head group={group} />
    </div>
  ) : (
    <details className={styles.group} {...flags(group)} open={group.open}>
      <summary className={styles.summary}>
        <HeadParts group={group} />
      </summary>
      <RailItems items={group.items} />
    </details>
  );
}

function flags(group: RailGroup) {
  return {
    'data-current': group.current ? '' : undefined,
    'data-side': group.side === true ? '' : undefined,
    'data-plain': group.marker === undefined ? '' : undefined,
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
      {group.marker === undefined ? (
        <span aria-hidden="true" className={styles.dot}>
          {group.current ? '●' : '○'}
        </span>
      ) : (
        <span className={styles.marker}>{group.marker}</span>
      )}
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
