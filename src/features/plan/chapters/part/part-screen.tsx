import { teamPart } from '@/application/plan-story-part';
import { headlineOf, ledeOf } from '@/application/plan-story-part-words';
import { ScreenHead } from '@/features/plan/chapters/screen-head';
import { ByLens } from '@/features/plan/lens.client';
import type { BodyProps } from '@/features/plan/screen-bodies';

import { EveryonePage } from './everyone-page';
import { TeamPage } from './team-page';

// What the plan asks of one team. Every team's page is built into the one static page; the address picks the
// team (`?team=`), and with none the page lists every team, one line each.
export function PartScreen({ model, outline, page }: BodyProps) {
  const teams = Object.fromEntries(
    model.plan.teams.map((team) => {
      const part = teamPart(model, team.id);
      const lede = ledeOf(model, team.id, part);
      return [
        team.id,
        <div key={team.id}>
          <ScreenHead headline={headlineOf(model, team.id, part)} outline={outline} page={page}>
            {lede === '' ? null : <p>{lede}</p>}
          </ScreenHead>
          <TeamPage model={model} part={part} team={team.id} />
        </div>,
      ];
    }),
  );
  return (
    <ByLens everyone={<EveryonePage model={model} outline={outline} page={page} />} teams={teams} />
  );
}
