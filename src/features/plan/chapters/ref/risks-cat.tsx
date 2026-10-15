import { RiskMatrix } from '@/features/plan/viz/risks/risk-matrix';
import { RiskPicker } from '@/features/plan/viz/risks/risk-picker.client';
import { RiskRegister } from '@/features/plan/viz/risks/risk-register';

import { type CatProps, Pages } from './catalogue-bits';

/**
 * What could go wrong: the grid places each risk, the register lists them, biggest first. A cell of the grid filters
 * the register to its risks.
 */
export function RisksCat({ model, teams }: CatProps) {
  const ids = (model.plan.risks ?? []).map((r) => r.id);
  return (
    <Pages
      empty="This plan records no risks."
      model={model}
      modes={false}
      noun="risks"
      render={() =>
        ids.length === 0
          ? []
          : [
              <RiskPicker
                grid={<RiskMatrix ids={ids} model={model} pick />}
                key="risks"
                register={<RiskRegister ids={ids} model={model} />}
              />,
            ]
      }
      teams={teams}
    />
  );
}
