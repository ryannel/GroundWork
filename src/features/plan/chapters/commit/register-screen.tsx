import type { Model } from '@/application/plan/derive';
import {
  type RegisterGroup,
  registerGroups,
  restGroups,
  restHeadline,
  restLede,
} from '@/application/plan-story-commit';
import { type Deciding, isDecision, numberOf, titleOf } from '@/application/plan-viz-decision';
import { shortDate } from '@/application/plan-viz-state';
import { DeliveryHead } from '@/features/plan/chapters/delivery/delivery-head';
import { EmptyState } from '@/features/plan/chapters/delivery/empty-state';
import { TeamTag } from '@/features/plan/common/team-dot';
import type { BodyProps } from '@/features/plan/screen-bodies';
import { Glyph } from '@/ui/icon';

import styles from './register-screen.module.css';

const WHEN: Readonly<Record<string, string>> = { deferred: 'revisit by', loose: 'decide by' };

function Row({
  model,
  e,
  group,
}: {
  readonly model: Model;
  readonly e: Deciding;
  readonly group: string;
}) {
  const label = WHEN[group];
  return (
    <li className={styles.row}>
      <button className={styles.name} data-inspect={e.id} type="button">
        <span className={styles.number}>{numberOf(model, e.id)}</span>
        <Glyph glyph={isDecision(e) ? '⚖' : '?'} />
        <span>{titleOf(e)}</span>
      </button>
      <span className={styles.meta}>
        {label === undefined || e.decide_by === undefined ? null : (
          <>
            <span className={styles.when}>{label}</span>
            <time dateTime={e.decide_by}>{shortDate(e.decide_by, model.today)}</time>
          </>
        )}
        {e.decider === undefined ? null : <TeamTag model={model} teamId={e.decider} />}
      </span>
    </li>
  );
}

function Fold({
  model,
  g,
  open,
}: {
  readonly model: Model;
  readonly g: RegisterGroup;
  readonly open: boolean;
}) {
  if (g.items.length === 0) return null;
  return (
    <details className={styles.fold} open={open}>
      <summary className={styles.summary}>
        <span>{g.label}</span>
        <span className={styles.count}>{g.items.length}</span>
        <span className={styles.note}>{g.note}</span>
      </summary>
      <ul className={styles.rows}>
        {g.items.map((e) => (
          <Row e={e} group={g.key} key={e.id} model={model} />
        ))}
      </ul>
    </details>
  );
}

// 8.3: what the plan keeps but does not wait on, folded by kind.
export function RegisterScreen({ model, outline, page }: BodyProps) {
  const groups = restGroups(registerGroups(model));
  const total = groups.reduce((sum, g) => sum + g.items.length, 0);
  const lede = restLede(groups);
  return (
    <>
      <DeliveryHead
        chapter="commit"
        headline={restHeadline(groups)}
        model={model}
        outline={outline}
        page={page}
      >
        {lede === '' ? null : <p>{lede}</p>}
      </DeliveryHead>
      {total === 0 ? <EmptyState>Nothing is deferred, loose or set aside.</EmptyState> : null}
      <div className={styles.folds}>
        {groups.map((g) => (
          <Fold g={g} key={g.key} model={model} open={g.key === 'deferred' || total <= 5} />
        ))}
      </div>
    </>
  );
}
