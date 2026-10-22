// A domain's target architecture drawn as a system map: one column per stage, holding one card for each system or
// component that should own it, and a line from each stage's owners to the owners of every stage made from it.
// Today's calls are left out, so the map reads as the flow the domain aims for, not the one it runs.

import type { Model } from '@/application/plan/derive';
import { systemMapInput } from '@/application/plan-viz-system-map-input';
import type { MapScope } from '@/application/plan-viz-system-map-scope';
import type {
  MapEdgeIn,
  MapServiceIn,
  SystemMapInput,
} from '@/application/plan-viz-system-map-types';
import { plainLine } from '@/application/plan-viz-text';
import type { TargetArchitecture } from '@/domain/workspace-model';

/** One card for an owner: a system stands as one card, not as its parts. Another domain's says where it lives. */
function cardOf(today: SystemMapInput, owner: string, scope: MapScope): MapServiceIn | null {
  const system = today.systems.find((s) => s.id === owner);
  const service = today.services.find((s) => s.id === owner);
  const card = system === undefined ? service : { ...system, system: null };
  if (card === undefined) return null;
  const place = scope.places[system?.id ?? service?.system ?? ''];
  const outside = scope.focus !== null && !scope.focus.includes(owner);
  if (place === undefined || !outside) return { ...card, system: null };
  return { ...card, system: null, does: card.does === '' ? place : `${place} · ${card.does}` };
}

function flowEdges(target: TargetArchitecture, held: ReadonlySet<string>): MapEdgeIn[] {
  const owners = new Map(
    target.stages.map((stage) => [stage.id, stage.owners.filter((id) => held.has(id))]),
  );
  const seen = new Set<string>();
  return target.stages.flatMap((stage) =>
    stage.from.flatMap((from) =>
      (owners.get(from) ?? []).flatMap((a) =>
        (owners.get(stage.id) ?? []).flatMap((b): MapEdgeIn[] => {
          const key = `${a}>${b}`;
          if (a === b || seen.has(key)) return [];
          seen.add(key);
          return [{ kind: 'api', from: a, to: b, via: null, steps: [], read: false, write: false }];
        }),
      ),
    ),
  );
}

/** The map of a domain's target: every owner in the column of the first stage it owns. */
export function targetMapInput(
  model: Model,
  target: TargetArchitecture,
  scope: MapScope,
): SystemMapInput {
  const today = systemMapInput(model);
  const stageOf: Record<string, number> = {};
  const services: MapServiceIn[] = [];
  for (const [i, stage] of target.stages.entries()) {
    for (const owner of stage.owners) {
      const card = owner in stageOf ? null : cardOf(today, owner, scope);
      if (card === null) continue;
      stageOf[owner] = i;
      services.push(card);
    }
  }
  return {
    ...today,
    services,
    systems: [],
    stores: [],
    edges: flowEdges(target, new Set(Object.keys(stageOf))),
    steps: [],
    stages: target.stages.map((stage, i) => ({
      id: stage.id,
      name: stage.name,
      summary: plainLine(stage.summary),
      entries: services.filter((s) => stageOf[s.id] === i).map((s) => ({ svc: s.id, reads: [] })),
    })),
    stageOf,
    focus: scope.focus,
  };
}
