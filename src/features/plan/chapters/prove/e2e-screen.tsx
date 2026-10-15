import { e2eHeadline, e2eLede } from '@/application/plan-story-prove';
import { e2eFlows, e2eTests } from '@/application/plan-story-prove-flows';
import { DeliveryHead } from '@/features/plan/chapters/delivery/delivery-head';
import { NamedChips } from '@/features/plan/common/named-chip';
import type { BodyProps } from '@/features/plan/screen-bodies';

import { E2eBody } from './e2e-body';
import styles from './e2e-screen.module.css';

// 6.1: the flows the plan changes, and how much of each an end-to-end test walks.
export function E2eScreen({ model, outline, page }: BodyProps) {
  const tests = e2eTests(model);
  const flows = e2eFlows(model);
  if (tests.length === 0) {
    return (
      <>
        <DeliveryHead
          chapter="prove"
          headline="No test covers a whole flow yet."
          model={model}
          outline={outline}
          page={page}
        />
        <p className={styles.empty}>
          For the plan’s author: add a test with <code>level: e2e</code> and the flow under{' '}
          <code>walks:</code>.
        </p>
      </>
    );
  }
  const head = e2eHeadline(model);
  return (
    <>
      <DeliveryHead
        chapter="prove"
        headline={head.headline}
        model={model}
        outline={outline}
        page={page}
      >
        <p>{e2eLede(tests.length, flows.length, head.rest)}</p>
      </DeliveryHead>
      {head.reach.none.length === 0 ? null : (
        <div className={styles.unwalked}>
          <span className={styles.kicker}>Not covered end to end</span>
          <NamedChips ids={head.reach.none.map((f) => f.id)} model={model} />
        </div>
      )}
      <E2eBody flows={flows} model={model} tests={tests} />
    </>
  );
}
