// Transitional legacy queries use recorded containment and execution references, never resource ownership.
import type { Core } from '@/application/plan/derive-core';
import { actingService } from '@/application/plan/graph-queries';
import { prop } from '@/application/plan/ids';
import { rootId } from '@/domain/ids';
import type { ModelPlace } from '@/domain/workspace-model';

export type LegacyPlace = Omit<ModelPlace, 'workspace'>;
export type LegacyPlacements = Readonly<Record<string, LegacyPlace | undefined>>;
type GraphNode = NonNullable<ReturnType<Core['asIs']['get']>>;
const CONTAINING_REFERENCE: Readonly<Record<string, string | undefined>> = {
  interface: 'service',
  schema: 'store',
  screen: 'service',
  subgraph: 'service',
  operation: 'component',
  handler: 'component',
  message: 'topic',
  graph: 'gateway',
};
function navigationComponent(core: Core, node: GraphNode): string | undefined {
  if (node.$type !== 'interaction') return undefined;
  const services = node.from.map((source) =>
    prop(core.toBe.get(rootId(source)) ?? core.asIs.get(rootId(source)), 'service'),
  );
  const unique = new Set(services);
  const [service] = unique;
  return unique.size === 1 && typeof service === 'string' ? service : undefined;
}
function referenceOf(core: Core, node: GraphNode): string | undefined {
  if (node.$type === 'step') {
    return actingService(core.toBe.has(node.id) ? core.toBe : core.asIs, node) ?? undefined;
  }
  const key = CONTAINING_REFERENCE[node.$type];
  const reference = key === undefined ? undefined : prop(node, key);
  if (typeof reference === 'string') return reference;
  const navigation = navigationComponent(core, node);
  if (navigation !== undefined) return navigation;
  const parent = prop(node, '$parent');
  const service = prop(node, '$service');
  const component = typeof service === 'string' ? service : undefined;
  return typeof parent === 'string' ? parent : component;
}
function directPlace(node: GraphNode): LegacyPlace | null {
  if (node.$type === 'system') return { domain: null, system: node.id, component: null };
  if (node.$type === 'service' && node.system !== undefined) {
    return { domain: null, system: node.system, component: node.id };
  }
  return null;
}
export function placementOf(
  core: Core,
  declared: LegacyPlacements,
): (id: string) => LegacyPlace | null {
  return (id) => {
    const visited = new Set<string>();
    let current: string | undefined = id;
    while (current !== undefined && !visited.has(current)) {
      visited.add(current);
      const place = declared[current];
      if (place !== undefined) return place;
      const node: GraphNode | undefined = core.toBe.get(current) ?? core.asIs.get(current);
      if (node === undefined) return null;
      const direct = directPlace(node);
      if (direct !== null) return direct;
      current = referenceOf(core, node);
    }
    return null;
  };
}
/** Only root placements cross the legacy wire boundary; children follow their parent in the graph. */
export function placementDataOf(
  graph: Core['asIs'],
  place: (id: string) => LegacyPlace | null,
): LegacyPlacements {
  return Object.fromEntries(
    [...graph.byId.values()].flatMap((node) => {
      if (node.$parent !== undefined) return [];
      const known = place(node.id);
      return known === null ? [] : [[node.id, known] as const];
    }),
  );
}
