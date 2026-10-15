'use client';

import { Suspense, useId } from 'react';

import type { BarTeam } from '@/application/plan-bar';

import { LENS_PARAM, setParam, useLens } from './lens.client';
import styles from './read-as.module.css';

type Teams = readonly BarTeam[];

function Picker({ teams, lens }: { readonly teams: Teams; readonly lens: string | null }) {
  const id = useId();
  const value = teams.find((t) => t.id === lens || t.id === `team:${lens ?? ''}`)?.id ?? '';
  return (
    <span className={styles.readAs} data-on={value === '' ? undefined : ''}>
      <label className={styles.word} htmlFor={id}>
        Read as
      </label>
      <select
        className={styles.select}
        id={id}
        onChange={(event) => {
          setParam(LENS_PARAM, event.target.value === '' ? null : event.target.value);
        }}
        title="Read the plan as one team: its pages, its part"
        value={value}
      >
        <option value="">Everyone</option>
        {teams.map((t) => (
          <option key={t.id} value={t.id}>
            {t.name}
          </option>
        ))}
      </select>
    </span>
  );
}

function Live({ teams }: { readonly teams: Teams }) {
  return <Picker lens={useLens()} teams={teams} />;
}

// The team lens as a picker in the bar: Everyone, or one team, kept in `?team=`.
export function ReadAs({ teams }: { readonly teams: Teams }) {
  if (teams.length === 0) return null;
  return (
    <Suspense fallback={<Picker lens={null} teams={teams} />}>
      <Live teams={teams} />
    </Suspense>
  );
}
