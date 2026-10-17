import type { Model } from '@/application/plan/derive';
import {
  chipSummary,
  msFacts,
  msState,
  type MilestoneState,
} from '@/application/plan-viz-milestone';
import { shortDate } from '@/application/plan-viz-state';
import { EntityChip } from '@/features/plan/common/entity-chip';
import { ModelText } from '@/features/plan/common/model-text';
import { Badge } from '@/ui/badge';

import { GateChip } from './gate-chip';
import styles from './milestone-card.module.css';

interface MilestoneCardProps {
  readonly model: Model;
  readonly msId: string;
  /** The full card, or the strip form: the name and its state. */
  readonly density?: 'card' | 'chip';
  readonly today?: Date;
}

function Late() {
  return (
    <Badge tone="neutral">
      <span title="Its due date is before today and it is not done">due date passed</span>
    </Badge>
  );
}

/** One segment for each work item, filled once it is done. */
function Bar({ st }: { readonly st: MilestoneState }) {
  if (!st.started || st.total === 0 || st.allDone) return null;
  return (
    <span aria-hidden="true" className={styles.bar}>
      {st.items.map((id, i) => (
        <span data-done={i < st.done ? '' : undefined} key={id} />
      ))}
    </span>
  );
}

function StripForm({ model, st }: { readonly model: Model; readonly st: MilestoneState }) {
  const sum = chipSummary(st);
  return (
    <span className={styles.chip} data-facts={msFacts(st)}>
      <EntityChip id={st.id} label={st.short} model={model} />
      {sum === '' ? null : <span className={styles.sum}>{sum}</span>}
      {st.late ? <Late /> : null}
    </span>
  );
}

function Meta({ st, today }: { readonly st: MilestoneState; readonly today: Date }) {
  return (
    <div className={styles.meta}>
      {st.due === null ? null : (
        <span>
          due <time dateTime={st.due}>{shortDate(st.due, today)}</time>
        </span>
      )}
      {st.late ? <Late /> : null}
      <span className={styles.state}>
        <Bar st={st} />
        <span>{st.text}</span>
      </span>
    </div>
  );
}

/**
 * A milestone: a diamond, its name, the due date, where it stands (before delivery "When M1 is done"; in delivery
 * "2 of 4 done" with a bar; all done "M1 done 1 Oct"; past its date and not done "due date passed"), what works when
 * it is done, and what it waits on. The chip form is the strip's: name and state only.
 */
export function MilestoneCard({ model, msId, density = 'card', today }: MilestoneCardProps) {
  const now = today ?? new Date();
  const st = msState(model, msId, now);
  if (st === null) return null;
  if (density === 'chip') return <StripForm model={model} st={st} />;
  const gates = model.blockersOf(msId);
  return (
    <aside
      aria-label={st.short}
      className={styles.card}
      data-done={st.allDone ? '' : undefined}
      data-facts={msFacts(st)}
    >
      <header className={styles.head}>
        <span aria-hidden="true" className={styles.mark}>
          ◆
        </span>
        <button className={styles.name} data-inspect={msId} type="button">
          {st.short}
        </button>
        {st.title === '' ? null : <span className={styles.title}>{st.title}</span>}
      </header>
      <Meta st={st} today={now} />
      {st.ms.exit === undefined ? null : (
        <div className={styles.exit}>
          <span className={styles.eyebrow}>What works</span>
          <ModelText model={model} text={st.ms.exit} />
        </div>
      )}
      {gates.length === 0 ? null : (
        <div className={styles.waits}>
          <span className={styles.eyebrow}>waits on</span>
          {gates.map((id) => (
            <GateChip id={id} key={id} model={model} />
          ))}
        </div>
      )}
    </aside>
  );
}
