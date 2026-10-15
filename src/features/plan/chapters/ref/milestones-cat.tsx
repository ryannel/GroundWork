import type { Model } from '@/application/plan/derive';
import { teamIndex } from '@/application/plan-viz-teams';
import { DimByLens } from '@/features/plan/lens.client';
import { MilestoneBoard } from '@/features/plan/viz/board/milestone-board';

import { type CatProps, Pages, Stack } from './catalogue-bits';

function Boards({ model }: { readonly model: Model }) {
  return (
    <Stack>
      {(model.plan.milestones ?? []).map((m) => (
        <MilestoneBoard key={m.id} model={model} msId={m.id} />
      ))}
    </Stack>
  );
}

/** What works when each milestone is done, and the work that gets it there. */
export function MilestonesCat({ model, teams }: CatProps) {
  const ids = model.plan.teams.map((t) => t.id);
  return (
    <Pages
      empty="This plan has no milestones."
      model={model}
      modes={false}
      noun="milestones"
      render={() =>
        (model.plan.milestones ?? []).length === 0
          ? []
          : [
              <DimByLens
                key="boards"
                slots={Object.fromEntries(ids.map((id) => [id, teamIndex(model, id)]))}
              >
                <Boards model={model} />
              </DimByLens>,
            ]
      }
      teams={teams}
    />
  );
}
