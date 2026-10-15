import type { Model } from '@/application/plan/derive';
import { type RevisionTag, wiState } from '@/application/plan-viz-work';
import type { WorkItem } from '@/domain/plan/plan.generated';

import { WorkItemCard } from './work-item-card';
import styles from './work-item-rows.module.css';

interface WorkItemRowsProps {
  readonly model: Model;
  readonly items: readonly WorkItem[];
  /** A team id: other teams' rows dim. */
  readonly lens?: string | undefined;
  /** False leaves the waits-on chips out. */
  readonly waits?: boolean;
  /** Column heads, hidden when the rows reflow to cards. */
  readonly head?: boolean;
  /** What a proposal does to a work item, by id. */
  readonly revision?: ((id: string) => RevisionTag | undefined) | undefined;
}

const HEADS = ['State', '#', 'Work item', 'Size', 'Milestone', 'Needs', 'Blocks'];

/** A list of work items, one line each, in the same fields and order as the cards. Draws nothing for an empty list. */
export function WorkItemRows({
  model,
  items,
  lens,
  waits = true,
  head = false,
  revision,
}: WorkItemRowsProps) {
  if (items.length === 0) return null;
  const hasState = items.some((w) => wiState(model, w.id) !== null);
  return (
    <div className={styles.rows} data-no-state={hasState ? undefined : ''}>
      {head ? (
        <div aria-hidden="true" className={styles.head}>
          {HEADS.map((h) => (
            <span key={h}>{h}</span>
          ))}
        </div>
      ) : null}
      {items.map((w) => (
        <WorkItemCard
          density="row"
          key={w.id}
          lens={lens}
          model={model}
          revision={revision?.(w.id)}
          w={w}
          waits={waits}
        />
      ))}
    </div>
  );
}
