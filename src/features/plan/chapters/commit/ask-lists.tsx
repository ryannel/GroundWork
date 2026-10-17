import type { Model } from '@/application/plan/derive';
import { type Also, isLate } from '@/application/plan-story-commit-ask';
import { type Deciding, isDecision, numberOf, titleOf } from '@/application/plan-viz-decision';
import { shortDate } from '@/application/plan-viz-state';
import { short } from '@/application/plan-viz-text';
import { NamedChip } from '@/features/plan/common/named-chip';
import { TeamTag } from '@/features/plan/common/team-dot';
import { Badge } from '@/ui/badge';
import { Glyph } from '@/ui/icon';

import styles from './ask-lists.module.css';

/** After approval, what is still open, one line each. */
export function StillOpen({
  model,
  open,
}: {
  readonly model: Model;
  readonly open: readonly Deciding[];
}) {
  if (open.length === 0) return null;
  return (
    <section className={styles.section}>
      <h3 className={styles.heading}>Still open</h3>
      <ul className={styles.open}>
        {open.map((e) => (
          <li key={e.id}>
            <button className={styles.name} data-inspect={e.id} type="button">
              <span className={styles.number}>{numberOf(model, e.id)}</span>
              <Glyph glyph={isDecision(e) ? '⚖' : '?'} />
              <span>{titleOf(e)}</span>
            </button>
            {e.decider === undefined ? null : <TeamTag model={model} teamId={e.decider} />}
            {e.decide_by === undefined ? null : (
              <span className={styles.faint}>
                decide by <time dateTime={e.decide_by}>{shortDate(e.decide_by, model.today)}</time>
              </span>
            )}
            {isLate(e, model.today) ? <Badge tone="removed">overdue</Badge> : null}
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Open items that no gate counts, each with why it does not hold the plan up. */
export function AlsoOpen({
  model,
  also,
}: {
  readonly model: Model;
  readonly also: readonly Also[];
}) {
  if (also.length === 0) return null;
  return (
    <p className={styles.line}>
      Also open:{' '}
      {also.map(({ e, why }, i) => (
        <span key={e.id}>
          {i === 0 ? '' : '; '}
          <NamedChip id={e.id} label={short(titleOf(e), 60)} model={model} />{' '}
          <span className={styles.faint}>({why})</span>
        </span>
      ))}
      .
    </p>
  );
}

/** A rest of fewer than three items is a line here, not a screen. */
export function RestLine({
  model,
  items,
}: {
  readonly model: Model;
  readonly items: readonly Deciding[];
}) {
  if (items.length === 0) return null;
  return (
    <p className={styles.line}>
      Also kept, with nothing waiting on {items.length === 1 ? 'it' : 'them'}:{' '}
      {items.map((e) => (
        <NamedChip id={e.id} key={e.id} label={short(titleOf(e), 70)} model={model} />
      ))}
    </p>
  );
}
