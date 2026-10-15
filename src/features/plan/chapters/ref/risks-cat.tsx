import { RiskMatrix } from '@/features/plan/viz/risks/risk-matrix';
import { RiskRegister } from '@/features/plan/viz/risks/risk-register';

import { type CatProps, Pages } from './catalogue-bits';

/** What could go wrong: the grid places each risk, the register lists them, biggest first. */
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
              <RiskMatrix ids={ids} key="matrix" model={model} />,
              <RiskRegister ids={ids} key="register" model={model} />,
            ]
      }
      teams={teams}
    />
  );
}
