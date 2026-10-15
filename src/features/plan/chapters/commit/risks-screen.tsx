import { risksBySeverity, risksHeadline, risksLede } from '@/application/plan-story-commit';
import { DeliveryHead } from '@/features/plan/chapters/delivery/delivery-head';
import { EmptyState } from '@/features/plan/chapters/delivery/empty-state';
import type { BodyProps } from '@/features/plan/screen-bodies';
import { RiskMatrix } from '@/features/plan/viz/risks/risk-matrix';

import { RiskCards } from './risk-cards';

// 8.2: the risks, placed by likelihood and impact, then one card each.
export function RisksScreen({ model, outline, page }: BodyProps) {
  const risks = risksBySeverity(model);
  const lede = risksLede(risks);
  return (
    <>
      <DeliveryHead
        chapter="commit"
        headline={risksHeadline(model, risks)}
        model={model}
        outline={outline}
        page={page}
      >
        {lede === '' ? null : <p>{lede}</p>}
      </DeliveryHead>
      {risks.length === 0 ? (
        <EmptyState>
          For the plan’s author: add them under <code>risks:</code>, each with its likelihood and
          impact.
        </EmptyState>
      ) : (
        <>
          <RiskMatrix ids={risks.map((r) => r.id)} model={model} />
          <RiskCards model={model} risks={risks} />
        </>
      )}
    </>
  );
}
