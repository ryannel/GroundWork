import type { Model } from '@/application/plan/derive';
import { waterfallView } from '@/application/plan-viz-waterfall-body';
import type { WaterfallOptions } from '@/application/plan-viz-waterfall-view';

import { CaseSwitch } from './case-switch.client';
import { WaterfallBody } from './waterfall-body';
import styles from './waterfall.module.css';

type WaterfallProps = Readonly<
  WaterfallOptions & {
    readonly model: Model;
    /** The operation, by id. */
    readonly id: string;
  }
>;

// What happens to one operation as it runs: each cache layer it meets, then each round trip to a subgraph, and the
// caches filling on the way back. It picks the case the plan or the flow step lands on, and offers the others.
// Draws nothing when the id is not an operation with a query plan.
export function Waterfall({ model, id, ...options }: WaterfallProps) {
  const view = waterfallView(model, id, options);
  if (view === null) return null;
  return (
    <CaseSwitch
      choices={view.cases}
      compact={view.compact}
      head={
        <>
          <span className={styles.title}>{view.title}</span>
          {view.note === null ? null : <span className={styles.note}>{view.note}</span>}
          {view.times === null ? null : (
            <span className={styles.note} title={view.times.title}>
              {view.times.text}
            </span>
          )}
        </>
      }
      landing={view.landing}
      withControl={view.withControl}
    >
      {view.bodies.map((body) => (
        <WaterfallBody body={body} id={id} key={body.kase} mode={options.mode} model={model} />
      ))}
    </CaseSwitch>
  );
}
