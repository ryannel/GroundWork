import type { Model } from '@/application/plan/derive';
import { flowSteps } from '@/application/plan/flow-steps';
import { countOf } from '@/application/plan-viz-text';
import { Sequence } from '@/features/plan/viz/sequence/sequence';
import { Glyph } from '@/ui/icon';
import { InlineMarkdown } from '@/ui/markdown';

import styles from './today-flows.module.css';

interface TodayFlowsProps {
  readonly model: Model;
  /** The flows to draw, by id, in the order to read them. */
  readonly flows: readonly string[];
  /** How many to open at first; the rest wait behind "Show steps". */
  readonly open?: number;
}

function Fold({
  model,
  id,
  open,
}: {
  readonly model: Model;
  readonly id: string;
  readonly open: boolean;
}) {
  const node = model.asIs.get(id);
  if (node?.$type !== 'flow') return null;
  const count = flowSteps(model, id, 'asIs').length;
  return (
    <details className={styles.flow} open={open}>
      <summary className={styles.head}>
        <button className={styles.name} data-inspect={id} type="button">
          <span aria-hidden="true" className={styles.glyph}>
            <Glyph glyph="➜" />
          </span>
          {node.name}
        </button>
        <span className={styles.says}>{countOf(count, 'step')}</span>
        <span className={styles.toggle}>Show steps</span>
      </summary>
      {node.trigger === undefined && node.outcome === undefined ? null : (
        <p className={styles.ends}>
          {node.trigger === undefined ? null : (
            <span>
              <strong>Starts when</strong> <InlineMarkdown text={node.trigger} />
            </span>
          )}
          {node.outcome === undefined ? null : (
            <span>
              <strong>Ends with</strong> <InlineMarkdown text={node.outcome} />
            </span>
          )}
        </p>
      )}
      <Sequence flowId={id} mode="asIs" model={model} />
    </details>
  );
}

// The flows that run through a domain or a system, each as a sequence of who calls whom, step by step. The first
// few are open; the rest fold away behind their name.
export function TodayFlows({ model, flows, open = 1 }: TodayFlowsProps) {
  if (flows.length === 0) return null;
  return (
    <div className={styles.folds}>
      {flows.map((id, i) => (
        <Fold id={id} key={id} model={model} open={i < open} />
      ))}
    </div>
  );
}
