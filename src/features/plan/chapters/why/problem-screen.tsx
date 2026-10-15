import { problemHead } from '@/application/plan-story-why';
import { ScreenHead } from '@/features/plan/chapters/screen-head';
import { ModelText } from '@/features/plan/common/model-text';
import type { BodyProps } from '@/features/plan/screen-bodies';

import styles from './problem-screen.module.css';

// The problem in the evidence's own words: the claim as the headline, the evidence under it.
export function ProblemScreen({ model, outline, page }: BodyProps) {
  const { headline, lede } = problemHead(model);
  const evidence = model.plan.problem.why;
  return (
    <>
      <ScreenHead headline={headline} outline={outline} page={page}>
        {lede === '' ? null : <p>{lede}</p>}
      </ScreenHead>
      {evidence === undefined || evidence === '' ? null : (
        <section className={styles.evidence}>
          <h3 className={styles.label}>The evidence</h3>
          <div className={styles.quote}>
            <ModelText model={model} text={evidence} />
          </div>
        </section>
      )}
    </>
  );
}
