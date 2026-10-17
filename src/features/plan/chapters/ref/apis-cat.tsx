import type { Model } from '@/application/plan/derive';
import {
  type Show,
  poolOf,
  inCut,
  searchText,
  teamsWhere,
  viewOf,
} from '@/application/plan-story-ref';
import { interfaceEndpoints } from '@/application/plan-viz-endpoint';
import { teamName, teamOf } from '@/application/plan-viz-teams';
import { InterfaceGroup } from '@/features/plan/viz/endpoint/interface-group';

import { type CatProps, Pages, rowAttrs } from './catalogue-bits';

function Interface({
  model,
  show,
  id,
  src,
}: {
  readonly model: Model;
  readonly show: Show;
  readonly id: string;
  readonly src: string;
}) {
  const ifc = poolOf(model.asIs.interfaces, model.toBe.interfaces, show).find((i) => i.id === id);
  if (ifc === undefined) return null;
  const eps = interfaceEndpoints(model, id, viewOf(show));
  const team = teamOf(model, ifc.service);
  const search = searchText(
    id,
    ifc.protocol,
    model.label(ifc.service),
    team === null ? '' : teamName(model, team),
    eps.map((e) => [e.id, e.sig, e.summary]),
  );
  return (
    <div
      {...rowAttrs(
        search,
        teamsWhere(
          model,
          (cut) => inCut(model, cut, ifc.service) || eps.some((e) => cut.has(e.id)),
        ),
      )}
    >
      <InterfaceGroup ifc={ifc} mode={viewOf(show)} model={model} src={src} />
    </div>
  );
}

/** Every endpoint, grouped by the interface that serves it. */
export function ApisCat({ model, teams, today, src }: CatProps) {
  return (
    <Pages
      today={today}
      model={model}
      modes
      empty="No APIs."
      noun="interfaces"
      render={(show) =>
        poolOf(model.asIs.interfaces, model.toBe.interfaces, show).map((i) => (
          <Interface id={i.id} key={i.id} model={model} show={show} src={src} />
        ))
      }
      teams={teams}
    />
  );
}
