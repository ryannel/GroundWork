'use client';

import { Suspense, useSyncExternalStore } from 'react';

import { LENS_PARAM, setParam, useLens } from '@/features/plan/lens.client';
import { walkHere, watchWalk } from '@/features/plan/walk-keys';

import styles from './progress-strip.module.css';

/** Where the screen stands in one team's cut of the plan. */
export interface TeamPlace {
  readonly id: string;
  readonly name: string;
  /** The screen's place among the team's pages, from 1, or null when it is not one of them. */
  readonly at: number | null;
  readonly of: number;
}

interface StripProps {
  /** The chapter, then the screen. */
  readonly crumb: readonly string[];
  readonly teams: readonly TeamPlace[];
}

const possessive = (name: string): string => (name.endsWith('s') ? `${name}’` : `${name}’s`);

/** The team the lens names, by its id with or without the `team:` prefix. */
export const teamOf = (teams: readonly TeamPlace[], lens: string | null): TeamPlace | null =>
  lens === null ? null : (teams.find((t) => t.id === lens || t.id === `team:${lens}`) ?? null);

function TeamWords({ team }: { readonly team: TeamPlace }) {
  const name = possessive(team.name);
  return (
    <span className={styles.team}>
      <span>
        {team.at === null
          ? `Not one of ${name} pages`
          : `${name} pages · ${String(team.at)} of ${String(team.of)}`}
      </span>
      <button
        className={styles.full}
        onClick={() => {
          setParam(LENS_PARAM, null);
        }}
        type="button"
      >
        Read the full plan
      </button>
    </span>
  );
}

function Strip({
  crumb,
  team,
}: {
  readonly crumb: readonly string[];
  readonly team: TeamPlace | null;
}) {
  const step = useSyncExternalStore(watchWalk, walkHere, () => null);
  return (
    <nav aria-label="Where you are" className={styles.strip}>
      <ol className={styles.crumb}>
        {crumb.map((part) => (
          <li key={part}>{part}</li>
        ))}
      </ol>
      {step === null ? null : <span className={styles.step}>{step}</span>}
      {team === null ? null : <TeamWords team={team} />}
    </nav>
  );
}

function Lensed(props: StripProps) {
  return <Strip crumb={props.crumb} team={teamOf(props.teams, useLens())} />;
}

// A line above the screen: the chapter and screen, the step a walk stands on, and while reading as one team,
// where this screen falls in its pages and the way back to the whole plan.
export function ProgressStrip(props: StripProps) {
  return (
    <Suspense fallback={<Strip crumb={props.crumb} team={null} />}>
      <Lensed {...props} />
    </Suspense>
  );
}
