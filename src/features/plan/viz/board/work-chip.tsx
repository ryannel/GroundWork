import type { Model } from '@/application/plan/derive';
import { short } from '@/application/plan-viz-text';
import { workById, wiState } from '@/application/plan-viz-work';

import styles from './work-chip.module.css';

interface WorkChipProps {
  readonly model: Model;
  readonly id: string;
  /** The whole title, not a clipped one. */
  readonly full?: boolean;
}

const CLIPPED = 34;

/** A work item as a small chip: the title clipped, a tick once it is done. */
export function WorkChip({ model, id, full = false }: WorkChipProps) {
  const w = workById(model, id);
  if (w === undefined) return null;
  const done = wiState(model, id) === 'done';
  return (
    <button
      className={styles.chip}
      data-done={done ? '' : undefined}
      data-inspect={id}
      title={done ? `${w.title} (done)` : w.title}
      type="button"
    >
      {done ? <span aria-hidden="true">✓</span> : null}
      <span>{full ? w.title : short(w.title, CLIPPED)}</span>
      {done ? <span className={styles.hidden}> (done)</span> : null}
    </button>
  );
}
