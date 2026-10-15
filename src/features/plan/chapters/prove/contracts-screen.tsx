import { contractEvidence, contractHeadline, evidenceLine } from '@/application/plan-story-prove';
import { DeliveryHead } from '@/features/plan/chapters/delivery/delivery-head';
import type { BodyProps } from '@/features/plan/screen-bodies';
import { ContractGaps } from '@/features/plan/viz/matrix/contract-gaps';
import { ContractMatrix } from '@/features/plan/viz/matrix/contract-matrix';

const MEANING =
  'A contract test writes down what one service reads from another. If a later change would break that, the other service’s build fails.';

// 6.2: whether every new or re-routed call between services has a contract test, and the pairs that do.
export function ContractsScreen({ model, outline, page }: BodyProps) {
  const evidence = contractEvidence(model);
  const counted = evidenceLine(evidence);
  return (
    <>
      <DeliveryHead
        chapter="prove"
        headline={contractHeadline(model, evidence)}
        model={model}
        outline={outline}
        page={page}
      >
        <p>{counted === '' ? MEANING : `${counted} ${MEANING}`}</p>
      </DeliveryHead>
      <ContractGaps model={model} />
      <ContractMatrix model={model} />
    </>
  );
}
