'use client';

import { useState, type ReactNode } from 'react';

import styles from './filterable-groups.module.css';

export interface FilterGroup {
  readonly key: string;
  readonly head: ReactNode;
  readonly rows: readonly {
    readonly key: string;
    readonly search: string;
    readonly node: ReactNode;
  }[];
}

interface Props {
  readonly groups: readonly FilterGroup[];
  /** Draws the filter box (the page does so past six endpoints). */
  readonly filter: boolean;
}

/** Interfaces with a filter box that narrows the endpoint rows to those whose text holds every word typed. */
export function FilterableGroups({ groups, filter }: Props) {
  const [query, setQuery] = useState('');
  const words = query
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w !== '');
  const shown = groups
    .map((g) => ({ ...g, rows: g.rows.filter((r) => words.every((w) => r.search.includes(w))) }))
    .filter((g) => g.rows.length > 0);
  return (
    <div className={styles.stack}>
      {filter ? (
        <input
          aria-label="Filter endpoints"
          className={styles.filter}
          onChange={(e) => {
            setQuery(e.target.value);
          }}
          placeholder="Filter endpoints, e.g. order or POST"
          type="search"
          value={query}
        />
      ) : null}
      {shown.map((g) => (
        <div className={styles.group} key={g.key}>
          {g.head}
          <div className={styles.list}>
            {g.rows.map((r) => (
              <div key={r.key}>{r.node}</div>
            ))}
          </div>
        </div>
      ))}
      {shown.length === 0 ? <p className={styles.none}>No endpoint matches.</p> : null}
    </div>
  );
}
