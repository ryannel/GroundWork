import type { Model } from '@/application/plan/derive';
import { type RevisionTag, workOrdered } from '@/application/plan-viz-work';

import styles from './milestone-board.module.css';
import { MilestoneCard } from './milestone-card';
import { WorkItemRows } from './work-item-rows';

interface MilestoneBoardProps {
  readonly model: Model;
  readonly msId: string;
  /** A team id: other teams' rows dim. */
  readonly lens?: string | undefined;
  readonly revision?: ((id: string) => RevisionTag | undefined) | undefined;
}

/** A milestone card, then the work that makes it: the milestone's page. */
export function MilestoneBoard({ model, msId, lens, revision }: MilestoneBoardProps) {
  const items = workOrdered(model, (w) => w.milestone === msId);
  return (
    <div className={styles.board} data-group>
      <MilestoneCard model={model} msId={msId} />
      {items.length === 0 ? (
        <p className={styles.empty}>No work items in this milestone.</p>
      ) : (
        <WorkItemRows items={items} lens={lens} model={model} revision={revision} />
      )}
    </div>
  );
}
