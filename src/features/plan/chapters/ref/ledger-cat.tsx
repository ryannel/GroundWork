import { ByLens } from '@/features/plan/lens.client';
import { HealthStrip } from '@/features/plan/viz/ledger/health-strip';
import { Ledger } from '@/features/plan/viz/ledger/ledger';

import { type CatProps, Group, Pages } from './catalogue-bits';

/** Every change, in order, with the plan's own health checks above. */
export function LedgerCat({ model, teams }: CatProps) {
  const ids = model.plan.teams.map((t) => t.id);
  return (
    <Pages
      empty="This plan records no changes."
      model={model}
      modes={false}
      noun="changes"
      render={() => [
        <Group
          key="health"
          note="checks on the plan file itself: things nothing uses, and rules it breaks"
          title="Plan health"
        >
          <HealthStrip keys={['orphans', 'errors', 'untested', 'questions']} model={model} />
        </Group>,
        <ByLens
          everyone={<Ledger groupBy="service" model={model} />}
          key="ledger"
          teams={Object.fromEntries(
            ids.map((id) => [id, <Ledger groupBy="service" key={id} lens={id} model={model} />]),
          )}
        />,
      ]}
      teams={teams}
    />
  );
}
