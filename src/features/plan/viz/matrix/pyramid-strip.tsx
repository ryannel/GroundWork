import Link from 'next/link';

import type { Model } from '@/application/plan/derive';
import { levelStats, pyramidRows, type GapNote } from '@/application/plan-viz-tests';
import { countOf } from '@/application/plan-viz-text';
import { NoneMark } from '@/features/plan/common/test-button';

import styles from './pyramid-strip.module.css';

interface PyramidStripProps {
  readonly model: Model;
  /** A team id: only that team's changes and tests count. */
  readonly lens?: string;
  /** The level the screen is about. */
  readonly focus?: string;
  /** Makes the contract note a link to the page that lists those links. */
  readonly contractHref?: string;
}

/** The gap beside a level; the contract note is a link where the page that lists those links is known. */
function Note({
  note,
  href,
}: {
  readonly note: GapNote | null;
  readonly href: string | undefined;
}) {
  if (note === null) return null;
  if (note.level !== 'contract' || href === undefined) {
    return (
      <span className={styles.note} data-gap={note.count}>
        {note.text}
      </span>
    );
  }
  return (
    <Link className={styles.note} data-gap={note.count} href={href} title="See the links">
      {note.text}
    </Link>
  );
}

/**
 * Five rows, end-to-end on top and unit at the bottom, each bar sized by its test count, so the shape reads as a pyramid
 * (or does not). Per row: the tests, how many of the shown changes have one, and where it is a gap, a note beside it.
 */
export function PyramidStrip({ model, lens, focus, contractHref }: PyramidStripProps) {
  const st = levelStats(model, lens);
  if (st.m === 0) return null;
  if (st.tests.length === 0) return <p className={styles.empty}>No tests in this plan yet.</p>;
  return (
    <div aria-label="Tests by level" className={styles.pyramid} role="group">
      {pyramidRows(model, st, lens).map((r) => (
        <div
          aria-current={focus === r.level ? 'true' : undefined}
          className={styles.row}
          data-focus={focus === r.level ? '' : undefined}
          data-gap={r.note === null ? undefined : ''}
          data-level={r.level}
          key={r.level}
        >
          <span className={styles.level} title={r.means}>
            {r.word}
          </span>
          <span className={styles.barCell}>
            {r.tests === 0 ? (
              <NoneMark title={`No ${r.word} test`} />
            ) : (
              <span className={styles.bar} data-size={Math.ceil(r.width / 10)} />
            )}
          </span>
          <span className={styles.count}>
            <b>{countOf(r.tests, 'test')}</b> · {r.changes} of {countOf(st.m, 'change')}
          </span>
          <Note href={contractHref} note={r.note} />
        </div>
      ))}
    </div>
  );
}
