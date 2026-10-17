'use client';

import { useState } from 'react';

import { countOf } from '@/application/plan-viz-text';
import type { JourneyIndex, JourneyRow } from '@/application/today-journey-index';
import { IntentLink } from '@/ui/intent-link.client';

import styles from './journey-finder.module.css';

const ANY = '';

function Row({ row }: { readonly row: JourneyRow }) {
  const who = row.actor === '' ? row.through : `${row.actor} · ${row.through}`;
  return (
    <li>
      <IntentLink className={styles.row} href={row.href}>
        <span className={styles.title}>{row.title}</span>
        <span className={styles.claim}>{row.claim}</span>
        <span className={styles.who}>{who}</span>
      </IntentLink>
    </li>
  );
}

// Every journey and flow as a line, to be narrowed by words and by domain: a workspace can run thousands, so they
// are a list to search rather than a wall of cards.
export function JourneyFinder({ index }: { readonly index: JourneyIndex }) {
  const [query, setQuery] = useState('');
  const [domain, setDomain] = useState(ANY);
  const words = query.toLowerCase().split(/\s+/u).filter(Boolean);
  const fits = (row: JourneyRow): boolean =>
    (domain === ANY || row.domains.includes(domain)) &&
    words.every((word) => row.terms.includes(word));
  const groups = index.groups
    .map((group) => ({ ...group, rows: group.rows.filter(fits) }))
    .filter((group) => group.rows.length > 0);
  const shown = groups.reduce((sum, group) => sum + group.rows.length, 0);
  return (
    <div className={styles.finder}>
      <div className={styles.bar}>
        <input
          aria-label="Find a journey or flow"
          className={styles.find}
          onChange={(event) => {
            setQuery(event.target.value);
          }}
          placeholder={`Find among ${countOf(index.total, 'journey and flow', 'journeys and flows')}`}
          type="search"
          value={query}
        />
        {index.domains.length < 2 ? null : (
          <select
            aria-label="Only in a domain"
            className={styles.domain}
            onChange={(event) => {
              setDomain(event.target.value);
            }}
            value={domain}
          >
            <option value={ANY}>In any domain</option>
            {index.domains.map((d) => (
              <option key={d.id} value={d.id}>
                In {d.name}
              </option>
            ))}
          </select>
        )}
        <span className={styles.shown}>
          {shown === index.total ? 'All shown' : `${String(shown)} of ${String(index.total)}`}
        </span>
      </div>
      {groups.length === 0 ? <p className={styles.none}>Nothing matches that.</p> : null}
      {groups.map((group) => (
        <section className={styles.group} key={group.id}>
          <h2 className={styles.heading}>
            {group.title} <span className={styles.count}>{group.rows.length}</span>
          </h2>
          <ul className={styles.rows}>
            {group.rows.map((row) => (
              <Row key={row.key} row={row} />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
