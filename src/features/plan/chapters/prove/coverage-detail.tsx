import type { Model } from '@/application/plan/derive';
import { e2eFlows } from '@/application/plan-story-prove-flows';
import { TestButton } from '@/features/plan/common/test-button';
import type { CoverageDetail } from '@/features/plan/viz/matrix/coverage-row';

import styles from './coverage-detail.module.css';
import { FlowFolds } from './flow-folds';

interface TestsDetailProps {
  readonly model: Model;
  readonly level: string;
  readonly ids: readonly string[];
}

/** What a count opens: the tests, and for end-to-end tests the flows they walk with the brackets drawn. */
function TestsDetail({ model, level, ids }: TestsDetailProps) {
  const flows =
    level === 'e2e' ? e2eFlows(model).filter((w) => w.spans.some((s) => ids.includes(s.test))) : [];
  return (
    <div className={styles.detail}>
      <div className={styles.tests}>
        {ids.map((t) => (
          <TestButton id={t} key={t} model={model} />
        ))}
      </div>
      {flows.length === 0 ? null : <FlowFolds flows={flows} model={model} steps={false} />}
    </div>
  );
}

export function coverageDetail(model: Model): CoverageDetail {
  function detail(_change: string, level: string, ids: readonly string[]) {
    return <TestsDetail ids={ids} level={level} model={model} />;
  }
  return detail;
}
