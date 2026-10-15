import type { Model } from '@/application/plan/derive';
import { flowSteps } from '@/application/plan/flow-steps';
import { coversWhole, type WalkedFlow } from '@/application/plan-story-prove-flows';
import { andList } from '@/application/plan-viz-ladder-order';
import { countOf } from '@/application/plan-viz-text';
import { Sequence } from '@/features/plan/viz/sequence/sequence';
import { Glyph } from '@/ui/icon';

import styles from './flow-folds.module.css';

/** What covers the flow, and how far: whole, or only the part the bracket spans. */
function coverLine(model: Model, walked: WalkedFlow): string {
  const { flow, spans } = walked;
  const whole = spans.filter((s) => coversWhole(model, flow.id, [s]));
  const by = andList([
    ...new Set((whole.length > 0 ? whole : spans).map((s) => model.label(s.test))),
  ]);
  return whole.length > 0 ? `covered end to end by ${by}` : `only partly covered, by ${by}`;
}

interface FoldProps {
  readonly model: Model;
  readonly walked: WalkedFlow;
  /** Draw the bracketed steps. A summary line each keeps a page that repeats flows light. */
  readonly steps: boolean;
}

function Name({ model, walked }: Omit<FoldProps, 'steps'>) {
  const { flow, spans } = walked;
  const count = flowSteps(model, flow.id, 'toBe').length;
  return (
    <>
      <button className={styles.name} data-inspect={flow.id} type="button">
        <span aria-hidden="true" className={styles.glyph}>
          <Glyph glyph="➜" />
        </span>
        {model.label(flow.id)}
      </button>
      <span className={styles.says}>
        {countOf(count, 'step')} · {coverLine(model, { flow, spans })}
      </span>
    </>
  );
}

function Fold({ model, walked, steps }: FoldProps) {
  const { flow, spans } = walked;
  if (!steps) {
    return (
      <div className={styles.flow}>
        <div className={styles.head}>
          <Name model={model} walked={walked} />
        </div>
      </div>
    );
  }
  return (
    <details className={styles.flow} open={!coversWhole(model, flow.id, spans)}>
      <summary className={styles.head}>
        <Name model={model} walked={walked} />
        <span className={styles.toggle}>Show steps</span>
      </summary>
      <Sequence flowId={flow.id} model={model} spans />
    </details>
  );
}

/** One fold per flow: its header line, the bracketed sequence behind "Show steps", open only when no test covers it whole. */
export function FlowFolds({
  model,
  flows,
  steps = true,
}: {
  readonly model: Model;
  readonly flows: readonly WalkedFlow[];
  readonly steps?: boolean;
}) {
  return (
    <div className={styles.folds}>
      {flows.map((walked) => (
        <Fold key={walked.flow.id} model={model} steps={steps} walked={walked} />
      ))}
    </div>
  );
}
