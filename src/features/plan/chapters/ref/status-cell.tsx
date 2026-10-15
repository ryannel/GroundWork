import type { Model } from '@/application/plan/derive';
import { type Show, inPlanWords } from '@/application/plan-story-ref';
import { StatusBadge } from '@/features/plan/common/status-badge';
import { CompatBadge } from '@/features/plan/viz/compat/compat';
import { Badge } from '@/ui/badge';

import styles from './status-cell.module.css';

/** What the plan does to a thing, who it breaks and what it asks of it, in the diff only. */
export function StatusCell({
  model,
  id,
  show,
}: {
  readonly model: Model;
  readonly id: string;
  readonly show: Show;
}) {
  if (show !== 'diff') return null;
  const asks = inPlanWords(model, id);
  return (
    <span className={styles.cell}>
      <StatusBadge status={model.status(id)} />
      <CompatBadge id={id} model={model} quiet />
      {asks === '' ? null : <Badge tone="neutral">{asks}</Badge>}
    </span>
  );
}
