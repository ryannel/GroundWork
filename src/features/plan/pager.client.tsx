'use client';

import Link from 'next/link';
import { useSyncExternalStore } from 'react';

import type { Neighbours } from '@/application/plan-pages';

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

// The next and previous screens; on a screen read in stops, the next and previous stop until its ends.
export function Pager({ neighbours }: { readonly neighbours: Neighbours }) {
  const { previous, next } = neighbours;
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
  const forward =
    next === null ? null : (
      <Link className={styles.link} data-next="" href={next.href} rel="next">
        <span className={styles.direction}>Next →</span>
        {next.title}
      </Link>
    );
  return (
    <nav aria-label="Screens" className={styles.pager}>
      {before === null ? back : <StepButton by={-1} title={before} />}
      {after === null ? forward : <StepButton by={1} title={after} />}
    </nav>
  );
}
