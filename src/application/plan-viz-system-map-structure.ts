import { layoutAreaSystems } from '@/application/area-system-layout';
import { CW } from '@/application/plan-viz-system-map-boxes';
import type { SystemMapInput } from '@/application/plan-viz-system-map-types';

/** Change the arrangement while retaining the same identities, relationships, scope and evidence. */
export function structureMapInput(input: SystemMapInput): SystemMapInput {
  const systems = new Set(input.systems.map((system) => system.id));
  const home = new Map(
    input.services.map((service) => [
      service.id,
      service.system !== null && systems.has(service.system) ? service.system : service.id,
    ]),
  );
  const owner = new Map(input.stores.map((resource) => [resource.id, resource.owner]));
  const unitOf = (id: string): string =>
    input.placement?.[id] ?? home.get(id) ?? home.get(owner.get(id) ?? '') ?? id;
  const units = [
    ...new Set([
      ...home.values(),
      ...(input.placement === undefined ? [] : input.systems.map((system) => system.id)),
    ]),
  ];
  const relationships = input.edges.map((edge, index) => ({
    id: `structure:${String(index)}`,
    from: unitOf(edge.from),
    to: unitOf(edge.to),
  }));
  const positions = new Map(
    layoutAreaSystems(
      units.map((id) => ({ id, width: CW, height: CW })),
      relationships,
    ).map((box) => [box.id, box.rank]),
  );
  return {
    ...input,
    arrangement: 'structure',
    stages: [],
    stageOf: Object.fromEntries(
      [...input.services, ...(input.placement === undefined ? [] : input.systems)].map((node) => [
        node.id,
        positions.get(unitOf(node.id)) ?? 0,
      ]),
    ),
  };
}
