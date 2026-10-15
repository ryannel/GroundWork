import { coverageHeadline } from '@/application/plan-story-prove';
import { e2eReach } from '@/application/plan-story-prove-flows';
import { numWord } from '@/application/plan-viz-text';
import { DeliveryHead } from '@/features/plan/chapters/delivery/delivery-head';
import { NamedChip } from '@/features/plan/common/named-chip';
import type { BodyProps } from '@/features/plan/screen-bodies';
import { CoverageMatrix } from '@/features/plan/viz/matrix/coverage-matrix';
import { Honesty } from '@/features/plan/viz/matrix/honesty';

import { coverageDetail } from './coverage-detail';
import styles from './coverage-screen.module.css';
import { SmallPlanExtras } from './small-plan-extras';

const KEY = 'One row per change, one column per kind of test.';

// 6.3: one row per change, one column per kind of test, and the change that is least proven said first.
// A small plan has no chapter of its own screens for end-to-end and contract tests, so they follow on this one.
export function CoverageScreen({ model, outline, page }: BodyProps) {
  const small = (outline.chapters.find((c) => c.key === 'prove')?.pages.length ?? 0) === 1;
  const head = coverageHeadline(model, small ? { reach: e2eReach(model) } : {});
  const { weakest } = head;
  return (
    <>
      <DeliveryHead
        chapter="prove"
        headline={head.headline}
        model={model}
        outline={outline}
        page={page}
      >
        {weakest === null ? null : (
          <p className={styles.weak}>
            <b>{weakest.kind}:</b>{' '}
            {weakest.ids.map((id) => (
              <NamedChip id={id} key={id} model={model} />
            ))}
            {weakest.more > 0 ? ` and ${numWord(weakest.more)} more.` : null}
          </p>
        )}
        <p>{head.rest === '' ? KEY : `${head.rest} ${KEY}`}</p>
      </DeliveryHead>
      <Honesty model={model} />
      <CoverageMatrix detail={coverageDetail(model)} model={model} />
      {small ? <SmallPlanExtras model={model} /> : null}
    </>
  );
}
