'use client';

import Link from 'next/link';
import { useSyncExternalStore } from 'react';

import type { Chapter, Neighbours, Page } from '@/application/plan-pages';

import styles from './pager.module.css';
import { walkBeside, walkMove, watchWalk } from './walk-keys';

const WORDS = { [-1]: '← Previous step', 1: 'Next step →' } as const;

/** The title of the stop one step away on a screen read in stops, or null in the browser's first draw. */
function useStopBeside(by: -1 | 1): string | null {
  return useSyncExternalStore(
    watchWalk,
    () => walkBeside(by),
    () => null,
  );
}

function StepButton({ by, title }: { readonly by: -1 | 1; readonly title: string }) {
  return (
    <button
      className={styles.link}
      data-next={by === 1 ? '' : undefined}
      onClick={() => {
        walkMove(by);
      }}
      type="button"
    >
      <span className={styles.direction}>{WORDS[by]}</span>
      {title}
    </button>
  );
}

/** The story's last screen closes the plan: back to the workspace, or on to the Reference. */
function EndCard({ workspace, next }: { readonly workspace: string; readonly next: Page | null }) {
  return (
    <div className={styles.end}>
      <span className={styles.endWords}>That is the whole plan.</span>
      <span className={styles.endLinks}>
        <Link className={styles.button} href={workspace}>
          Back to the workspace
        </Link>
        {next === null ? null : (
          <Link className={styles.button} data-primary="" href={next.href} rel="next">
            Browse the {next.chapter === 'ref' ? 'Reference' : next.title} →
          </Link>
        )}
      </span>
    </div>
  );
}

/** "Next · Chapter 3" when the next screen opens a chapter of the story, else "Next". */
function nextWord(opens: Chapter | null): string {
  const number = opens?.number ?? null;
  return number === null ? 'Next →' : `Next · Chapter ${number} →`;
}

function Forward({ neighbours }: { readonly neighbours: Neighbours }) {
  const { next, opens, end } = neighbours;
  if (end !== null) return <EndCard next={next} workspace={end} />;
  if (next === null) return null;
  return (
    <Link className={styles.link} data-next="" href={next.href} rel="next">
      <span className={styles.direction}>{nextWord(opens)}</span>
      {opens === null ? next.title : opens.title}
    </Link>
  );
}

// The next and previous screens; on a screen read in stops, the next and previous stop until its ends.
export function Pager({ neighbours }: { readonly neighbours: Neighbours }) {
  const { previous } = neighbours;
  const before = useStopBeside(-1);
  const after = useStopBeside(1);
  const back =
    previous === null ? (
      <span />
    ) : (
      <Link className={styles.link} href={previous.href} rel="prev">
        <span className={styles.direction}>← Previous</span>
        {previous.title}
      </Link>
    );
  return (
    <nav aria-label="Screens" className={styles.pager}>
      {before === null ? back : <StepButton by={-1} title={before} />}
      {after === null ? <Forward neighbours={neighbours} /> : <StepButton by={1} title={after} />}
    </nav>
  );
}
