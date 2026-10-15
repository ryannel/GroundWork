import type { Model } from '@/application/plan/derive';
import { contractEvidence, evidenceLine } from '@/application/plan-story-prove';
import { e2eFlows, e2eTests } from '@/application/plan-story-prove-flows';
import { changedLinksWithoutTest } from '@/application/plan-viz-contracts';
import { ContractGaps } from '@/features/plan/viz/matrix/contract-gaps';

import { E2eBody } from './e2e-body';
import styles from './small-plan-extras.module.css';

/** A small plan proves itself on one screen: after the matrix, the end-to-end tests, then what is checked between services. */
export function SmallPlanExtras({ model }: { readonly model: Model }) {
  const tests = e2eTests(model);
  const evidence = contractEvidence(model);
  const missing = changedLinksWithoutTest(model).length;
  const counted = evidenceLine(evidence);
  return (
    <>
      {tests.length === 0 ? null : (
        <section className={styles.section}>
          <h3 className={styles.title}>End to end</h3>
          <E2eBody flows={e2eFlows(model)} model={model} tests={tests} />
        </section>
      )}
      {evidence.providers === 0 && missing === 0 ? null : (
        <section className={styles.section}>
          <h3 className={styles.title}>Between services</h3>
          {counted === '' ? null : (
            <p className={styles.line}>
              {missing === 0
                ? `${counted} Every new or re-routed call has a contract test.`
                : counted}
            </p>
          )}
          <ContractGaps model={model} />
        </section>
      )}
    </>
  );
}
