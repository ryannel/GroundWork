import type { Model } from '@/application/plan/derive';
import type { GraphDiff } from '@/application/plan/federation-diff';
import { routeSummary } from '@/application/plan-story-changes-graph-ops';
import { numWord } from '@/application/plan-viz-text';
import { EntityChip } from '@/features/plan/common/entity-chip';
import { Waterfall } from '@/features/plan/viz/waterfall/waterfall';
import { Badge } from '@/ui/badge';

import styles from './graph-waterfalls.module.css';

/** One waterfall for each operation that changes, folded away: the table says what the reader feels, these say why. */
export function Waterfalls({ model, diff }: { readonly model: Model; readonly diff: GraphDiff }) {
  const ops = [
    ...diff.operations.filter((o) => o.before !== null),
    ...diff.operations.filter((o) => o.before === null),
  ];
  if (ops.length === 0) return null;
  return (
    <details className={styles.fold}>
      <summary className={styles.summary}>
        <span>Waterfalls: how each operation is answered</span>
        <span className={styles.muted}>
          {ops.length === 1 ? 'one operation' : `${numWord(ops.length)} operations`}
        </span>
      </summary>
      <div className={styles.waterfalls}>
        {ops.map((o) => (
          <section className={styles.op} key={o.id}>
            <header className={styles.opHead}>
              <EntityChip id={o.id} model={model} />
              {o.before === null ? <Badge tone="added">+ New</Badge> : null}
              <span className={styles.muted}>
                {o.before === null || o.after === null
                  ? 'new operation'
                  : routeSummary(o.before, o.after)}
              </span>
            </header>
            <Waterfall diff id={o.id} kase="cold" mode="toBe" model={model} />
          </section>
        ))}
      </div>
    </details>
  );
}
