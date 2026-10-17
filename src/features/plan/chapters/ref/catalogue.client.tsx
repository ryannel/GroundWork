'use client';

import { Suspense, useEffect, useId, useRef, useState, type ReactNode } from 'react';

import { DEFAULT_SHOW, SHOWS, SHOW_WORD, type Show, showOf } from '@/application/plan-story-ref';
import { LENS_PARAM, setParam, useLens, useParam } from '@/features/plan/lens.client';
import { Legend } from '@/ui/legend';

import { filterRows } from './catalogue-filter';
import styles from './catalogue.module.css';

const SHOW_PARAM = 'show';

const STATUS_KEY = [
  { label: 'added', swatch: 'add' },
  { label: 'changed', swatch: 'mod' },
  { label: 'deprecated', swatch: 'dep' },
  { label: 'removed', swatch: 'rem' },
] as const;

export interface CatalogueProps {
  /** What the rows are, for the filter box: "services". */
  readonly noun: string;
  /** The page for each mode; with one, there is no switch. */
  readonly bodies: Readonly<Partial<Record<Show, ReactNode>>>;
  /** Every team's name, by id: what the lens note says. */
  readonly teams: Readonly<Record<string, string>>;
  /** Rows carry words and teams the box and the lens read. False leaves the box off. */
  readonly search?: boolean;
}

const firstBody = (bodies: CatalogueProps['bodies']): ReactNode =>
  bodies[DEFAULT_SHOW] ?? bodies.tobe ?? bodies.asis;

function Switch({ shows, show }: { readonly shows: readonly Show[]; readonly show: Show }) {
  const name = useId();
  if (shows.length < 2) return null;
  return (
    <div aria-label="Show the system" className={styles.seg} data-cycle="" role="radiogroup">
      {SHOWS.filter((s) => shows.includes(s)).map((s) => (
        <span className={styles.choice} key={s}>
          <input
            checked={s === show}
            className={styles.radio}
            id={`${name}-${s}`}
            name={name}
            onChange={() => {
              setParam(SHOW_PARAM, s === DEFAULT_SHOW ? null : s);
            }}
            type="radio"
          />
          <label htmlFor={`${name}-${s}`}>{SHOW_WORD[s]}</label>
        </span>
      ))}
    </div>
  );
}

function Live({ noun, bodies, teams, search = true }: CatalogueProps) {
  const shows = SHOWS.filter((s) => bodies[s] !== undefined);
  const asked = showOf(useParam(SHOW_PARAM));
  const show = shows.includes(asked) ? asked : (shows[0] ?? DEFAULT_SHOW);
  const param = useLens();
  const lens =
    Object.keys(teams).find((id) => id === param || id === `team:${param ?? ''}`) ?? null;
  const [query, setQuery] = useState('');
  const root = useRef<HTMLDivElement>(null);
  const count = useRef<HTMLSpanElement>(null);
  const tally = useRef<HTMLSpanElement>(null);
  const none = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    if (root.current === null) return;
    const t = filterRows(root.current, query, lens);
    if (count.current !== null) {
      count.current.textContent =
        query.trim() === '' ? '' : `${String(t.shown)} of ${String(t.inLens)}`;
    }
    if (tally.current !== null) {
      tally.current.textContent = `${String(t.inLens)} of ${String(t.total)}`;
    }
    if (none.current !== null) none.current.hidden = t.shown > 0 || t.total === 0;
  }, [show, lens, query]);
  return (
    <div className={styles.catalogue}>
      <div className={styles.tools}>
        <Switch show={show} shows={shows} />
        {search ? (
          <label className={styles.search}>
            <span className={styles.hidden}>Filter {noun}</span>
            <input
              autoComplete="off"
              onChange={(e) => {
                setQuery(e.target.value);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Escape' && query !== '') {
                  e.stopPropagation();
                  setQuery('');
                }
              }}
              placeholder={`Filter ${noun}…`}
              spellCheck={false}
              type="search"
              value={query}
            />
          </label>
        ) : null}
        <span className={styles.count} ref={count} />
        {lens === null ? null : (
          <span className={styles.lens}>
            {teams[lens]}’s <span ref={tally} />
            <button
              className={styles.everyone}
              onClick={() => {
                setParam(LENS_PARAM, null);
              }}
              type="button"
            >
              Show everyone
            </button>
          </span>
        )}
      </div>
      {show === 'diff' && shows.length > 1 ? <Legend items={STATUS_KEY} /> : null}
      <div className={styles.body} ref={root}>
        {bodies[show]}
        <p className={styles.none} hidden ref={none}>
          Nothing matches that filter.
        </p>
      </div>
    </div>
  );
}

/** A catalogue's controls and its page: the mode in `?show=`, the team lens in `?team=`, and a filter box. */
export function Catalogue({ bodies, ...rest }: CatalogueProps) {
  return (
    <Suspense fallback={<div className={styles.body}>{firstBody(bodies)}</div>}>
      <Live bodies={bodies} {...rest} />
    </Suspense>
  );
}
