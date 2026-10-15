import type { Model } from '@/application/plan/derive';
import { milestoneShort, workByMilestone } from '@/application/plan-story-ref-rows';
import { teamIndex } from '@/application/plan-viz-teams';
import { msTitle } from '@/application/plan-viz-work';
import { DimByLens } from '@/features/plan/lens.client';
import { WorkItemRows } from '@/features/plan/viz/board/work-item-rows';

import { type CatProps, Group, Pages, Stack } from './catalogue-bits';

function Groups({ model }: { readonly model: Model }) {
  return (
    <Stack>
      {workByMilestone(model).map((g, i) => (
        <Group
          count={g.items.length}
          key={g.milestone?.id ?? 'none'}
          note={msTitle(g.milestone ?? undefined)}
          title={g.milestone === null ? 'No milestone' : milestoneShort(g.milestone)}
        >
          <WorkItemRows head={i === 0} items={g.items} model={model} />
        </Group>
      ))}
    </Stack>
  );
}

/** Everything to build, by milestone, in build order; a team's lens dims the rest. */
export function WorkCat({ model, teams }: CatProps) {
  const ids = model.plan.teams.map((t) => t.id);
  return (
    <Pages
      empty="This plan has no work items yet."
      model={model}
      modes={false}
      noun="work items"
      render={() =>
        workByMilestone(model).length === 0
          ? []
          : [
              <DimByLens
                key="work"
                slots={Object.fromEntries(ids.map((id) => [id, teamIndex(model, id)]))}
              >
                <Groups model={model} />
              </DimByLens>,
            ]
      }
      teams={teams}
    />
  );
}
