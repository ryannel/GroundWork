import type { Model } from '@/application/plan/derive';
import { type Show, fadesIn, inCut, searchText, teamsWhere } from '@/application/plan-story-ref';
import { servicesByTeam, serviceFacts } from '@/application/plan-story-ref-system';
import { teamName } from '@/application/plan-viz-teams';
import type { ServiceNode } from '@/domain/plan/plan-graph';
import { ModelInline } from '@/features/plan/common/model-text';

import {
  Card,
  Cards,
  type CatProps,
  Facts,
  Group,
  Pages,
  RefChip,
  RefChips,
} from './catalogue-bits';
import { StatusCell } from './status-cell';

function ServiceCard({
  model,
  show,
  s,
}: {
  readonly model: Model;
  readonly show: Show;
  readonly s: ServiceNode;
}) {
  const f = serviceFacts(model, show, s.id);
  const quiet = show !== 'diff';
  const interfaces = f.interfaces.map((i) => i.id);
  return (
    <Card
      faded={fadesIn(model, show, s.id)}
      search={searchText(s.name, s.id, s.kind, s.tech, teamName(model, s.team), s.summary, s.does)}
      teams={teamsWhere(model, (cut) => inCut(model, cut, s.id))}
    >
      <div>
        <RefChip id={s.id} model={model} quiet={quiet} />{' '}
        <StatusCell id={s.id} model={model} show={show} />
      </div>
      <small>{[s.kind, s.tech].filter((x) => x !== undefined).join(' · ')}</small>
      {s.summary === undefined ? null : <ModelInline model={model} text={s.summary} />}
      <Facts
        rows={[
          ['Owns', f.owns.length > 0 && <RefChips ids={f.owns} model={model} quiet={quiet} />],
          [
            'Interfaces',
            interfaces.length > 0 && <RefChips ids={interfaces} model={model} quiet={quiet} />,
          ],
          [
            'Publishes',
            f.publishes.length > 0 && <RefChips ids={f.publishes} model={model} quiet={quiet} />,
          ],
          [
            'Consumes',
            f.listensTo.length > 0 && <RefChips ids={f.listensTo} model={model} quiet={quiet} />,
          ],
        ]}
      />
    </Card>
  );
}

/** Every service, grouped by the team that owns it. */
export function ServicesCat({ model, teams }: CatProps) {
  return (
    <Pages
      model={model}
      modes
      empty="No components."
      noun="services"
      render={(show) =>
        servicesByTeam(model, show).map(({ team, services }) => (
          <Group
            count={services.length}
            key={team}
            team={{ model, id: team }}
            title={teamName(model, team)}
          >
            <Cards>
              {services.map((s) => (
                <ServiceCard key={s.id} model={model} s={s} show={show} />
              ))}
            </Cards>
          </Group>
        ))
      }
      teams={teams}
    />
  );
}
