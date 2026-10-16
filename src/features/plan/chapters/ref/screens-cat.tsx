import { inCut, searchText, teamsWhere, graphOf } from '@/application/plan-story-ref';
import { screensByApp } from '@/application/plan-story-ref-system';
import { ScreenCard } from '@/features/plan/viz/screens/screen-card';

import { type CatProps, Group, Shots, teamGroup, Pages, RefChip } from './catalogue-bits';

interface ScreensProps extends CatProps {
  /** Where the plan's pictures are served from. */
  readonly base: string;
}

/** What people see, grouped by the app that serves it. */
export function ScreensCat({ model, teams, base, today }: ScreensProps) {
  return (
    <Pages
      today={today}
      model={model}
      modes
      empty="No screens yet. For the plan’s author: add screens: with a screenshot per page."
      noun="screens"
      render={(show) => {
        const groups = screensByApp(model, show);
        return groups.map(({ app, screens }) => (
          <Group
            count={screens.length}
            key={app}
            team={teamGroup(model, app)}
            title={<RefChip id={app} model={model} quiet={show !== 'diff'} />}
          >
            <Shots>
              {screens.map((id) => (
                <div
                  key={id}
                  data-search={searchText(model.label(id), id, model.label(app))}
                  data-teams={teamsWhere(
                    model,
                    (cut) => inCut(model, cut, id) || inCut(model, cut, app),
                  )}
                >
                  <ScreenCard
                    base={base}
                    id={id}
                    mode={graphOf(show)}
                    model={model}
                    status={show === 'diff'}
                  />
                </div>
              ))}
            </Shots>
          </Group>
        ));
      }}
      teams={teams}
    />
  );
}
