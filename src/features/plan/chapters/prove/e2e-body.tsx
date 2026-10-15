import type { Model } from '@/application/plan/derive';
import type { WalkedFlow } from '@/application/plan-story-prove-flows';
import type { Test } from '@/domain/plan/plan.generated';
import { Legend } from '@/ui/legend';

import styles from './e2e-body.module.css';
import { FlowFolds } from './flow-folds';
import { TestCard } from './test-card';

const KEY = [
  { label: 'this test’s steps', swatch: 'cur' },
  { label: 'other tests on the same steps', swatch: 'dim' },
] as const;

interface E2eBodyProps {
  readonly model: Model;
  readonly tests: readonly Test[];
  readonly flows: readonly WalkedFlow[];
}

/** The end-to-end tests: their cards, the key to the brackets, and the flows with their brackets folded. */
export function E2eBody({ model, tests, flows }: E2eBodyProps) {
  return (
    <div className={styles.body}>
      <div className={styles.cards}>
        {tests.map((t) => (
          <TestCard key={t.id} model={model} test={t} />
        ))}
      </div>
      <Legend items={KEY} />
      <FlowFolds flows={flows} model={model} />
    </div>
  );
}
