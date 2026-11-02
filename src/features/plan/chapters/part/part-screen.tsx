import { lensTeam } from '@/application/plan-pages-team';
import { teamPart } from '@/application/plan-story-part';
import { headlineOf, ledeOf } from '@/application/plan-story-part-words';
import { ScreenHead } from '@/features/plan/chapters/screen-head';
import type { BodyProps } from '@/features/plan/screen-bodies';

import { EveryonePage } from './everyone-page';
import { TeamPage } from './team-page';

// What the plan asks of one team: the address picks the team (`?team=`), and with none the page lists every team,
// one line each.
export function PartScreen({ model, outline, page, lens = null }: BodyProps) {
  const team = lensTeam(model, lens);
  if (team === null) return <EveryonePage model={model} outline={outline} page={page} />;
  const part = teamPart(model, team);
  const lede = ledeOf(model, team, part);
  return (
    <div data-lens={team}>
      <ScreenHead headline={headlineOf(model, team, part)} outline={outline} page={page}>
        {lede === '' ? null : <p>{lede}</p>}
      </ScreenHead>
      <TeamPage model={model} part={part} team={team} />
    </div>
  );
}
