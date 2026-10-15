import type { EntityView } from '@/application/plan-pages-entity';
import { Badge } from '@/ui/badge';
import { Chip, ChipList } from '@/ui/chip';

import styles from './entity-head.module.css';

const TONES = {
  added: 'added',
  modified: 'modified',
  deprecated: 'deprecated',
  removed: 'removed',
} as const;

const SIGNS: Readonly<Record<string, string>> = {
  added: '+',
  add: '+',
  modified: '~',
  deprecated: '−',
  deprecate: '−',
  removed: '×',
  remove: '×',
};

/** A diff line as the reader says it: the summary without a sign the derive layer may have put in front. */
const unsigned = (summary: string): string => summary.replace(/^[+~×−-]\s+/, '');

// What the thing is, who owns it, and what the plan does to it, in a few lines. Today's view shows it as it is.
// It already says what a hover card would, so its chips show none.
export function EntityHead({
  view,
  today,
  heading: Heading = 'h2',
}: {
  readonly view: EntityView;
  readonly today: boolean;
  /** h1 on the thing's own page; h2 in the inspector. */
  readonly heading?: 'h1' | 'h2';
}) {
  const isNew = view.status === 'added';
  return (
    <header className={styles.head} data-no-hover="">
      <p className={styles.kind}>
        <span aria-hidden="true">{view.glyph}</span> {view.type}
        {today || view.status === 'existing' ? null : (
          <Badge tone={TONES[view.status]}>{view.status}</Badge>
        )}
      </p>
      <Heading className={styles.name}>{view.name}</Heading>
      <code className={styles.id}>{view.id}</code>
      {view.owner.length === 0 ? null : (
        <div className={styles.meta}>
          <span className={styles.metaLabel}>Owned by</span>
          <ChipList>
            {view.owner.map((ref) => (
              <Chip
                glyph={ref.glyph}
                id={ref.id}
                key={ref.id}
                label={ref.label}
                status="existing"
              />
            ))}
          </ChipList>
        </div>
      )}
      {isNew && today ? (
        <p className={styles.note}>New in this plan: it does not exist today.</p>
      ) : null}
      {isNew && !today ? <p className={styles.note}>New in this plan.</p> : null}
      {today || view.changes.length === 0 ? null : (
        <ul aria-label="What the plan does to it" className={styles.lines}>
          {view.changes.map((change, index) => (
            <li data-change={change.kind} key={`${change.summary}-${String(index)}`}>
              <span aria-hidden="true" className={styles.sign}>
                {SIGNS[change.kind] ?? '~'}
              </span>
              <span>{unsigned(change.summary)}</span>
            </li>
          ))}
        </ul>
      )}
    </header>
  );
}
