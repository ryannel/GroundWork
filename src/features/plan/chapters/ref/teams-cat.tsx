import { teamIndex } from '@/application/plan-viz-teams';
import { DimByLens } from '@/features/plan/lens.client';
import { OwnershipTable } from '@/features/plan/viz/owners/ownership-table';

import { type CatProps, Pages } from './catalogue-bits';

/** Who owns what, in one table: the team's name opens the team. */
export function TeamsCat({ model, teams }: CatProps) {
  const ids = model.plan.teams.map((t) => t.id);
  return (
    <Pages
      empty="This plan names no teams."
      model={model}
      modes={false}
      noun="teams"
      render={() =>
        ids.length === 0
          ? []
          : [
              <DimByLens
                key="owners"
                slots={Object.fromEntries(ids.map((id) => [id, teamIndex(model, id)]))}
              >
                <OwnershipTable model={model} teamIds={ids} />
              </DimByLens>,
            ]
      }
      teams={teams}
    />
  );
}
