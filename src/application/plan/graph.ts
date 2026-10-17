import { fieldId } from '@/application/plan/ids';
import type {
  EndpointNode,
  FieldNode,
  FlowNode,
  InterfaceNode,
  PlanNode,
  RegionNode,
  SchemaNode,
  ScreenNode,
  StepNode,
  SystemGraph,
  SystemSource,
} from '@/domain/plan/plan-graph';
import type { EntityType, PathSegment } from '@/domain/plan/plan-ids';
import type { Flow, Interface, Schema, Screen } from '@/domain/plan/plan.generated';

type Origins = ReadonlyMap<string, readonly PathSegment[]> | undefined;

/** The system half of a plan (base arrays only), deep-cloned. */
export function systemOf(plan: Partial<SystemSource>): SystemSource {
  return structuredClone({
    teams: plan.teams ?? [],
    systems: plan.systems ?? [],
    services: plan.services ?? [],
    stores: plan.stores ?? [],
    schemas: plan.schemas ?? [],
    interfaces: plan.interfaces ?? [],
    messages: plan.messages ?? [],
    ...systemOfScreens(plan),
  });
}

function systemOfScreens(plan: Partial<SystemSource>) {
  return {
    flows: plan.flows ?? [],
    screens: plan.screens ?? [],
    interactions: plan.interactions ?? [],
    user_journeys: plan.user_journeys ?? [],
    graphs: plan.graphs ?? [],
    subgraphs: plan.subgraphs ?? [],
    operations: plan.operations ?? [],
    handlers: plan.handlers ?? [],
  };
}

function flat<T extends { readonly id: string }, K extends EntityType>(
  list: readonly T[] | undefined,
  [type, key]: readonly [K, string],
  origins: Origins,
) {
  return (list ?? []).map((e, i) => ({
    ...e,
    $type: type,
    $path: origins?.get(e.id) ?? [key, i],
  }));
}

function fieldNodes(schema: Schema, i: number, origins: Origins): FieldNode[] {
  return (schema.fields ?? []).map((f, j) => {
    const id = fieldId(schema.id, f.name);
    return {
      ...f,
      id,
      $type: 'field',
      $parent: schema.id,
      $index: j,
      $path: origins?.get(id) ?? ['schemas', i, 'fields', j],
    };
  });
}

function endpointNodes(iface: Interface, i: number, origins: Origins): EndpointNode[] {
  return (iface.endpoints ?? []).map((e, j) => ({
    ...e,
    $type: 'endpoint',
    $parent: iface.id,
    $index: j,
    $service: iface.service,
    $path: origins?.get(e.id) ?? ['interfaces', i, 'endpoints', j],
  }));
}

function stepNodes(flow: Flow, i: number, origins: Origins): StepNode[] {
  return flow.steps.map((s, j) => ({
    ...s,
    $type: 'step',
    $parent: flow.id,
    $index: j,
    $seq: j + 1,
    $path: origins?.get(s.id) ?? ['flows', i, 'steps', j],
  }));
}

function regionNodes(screen: Screen, i: number, origins: Origins): RegionNode[] {
  return (screen.regions ?? []).map((r, j) => ({
    ...r,
    $type: 'region',
    $parent: screen.id,
    $index: j,
    $path: origins?.get(r.id) ?? ['screens', i, 'regions', j],
  }));
}

type Lists = Omit<SystemGraph, 'byId' | 'duplicates' | 'get' | 'has'>;

interface Index {
  readonly byId: ReadonlyMap<string, PlanNode>;
  readonly duplicates: readonly PlanNode[];
}

/** Ids are unique: the first node with an id is the one found by it, the later ones are duplicates. */
function indexOf(nodes: readonly PlanNode[]): Index {
  const byId = new Map<string, PlanNode>();
  const duplicates: PlanNode[] = [];
  for (const n of nodes) {
    if (byId.has(n.id)) duplicates.push(n);
    else byId.set(n.id, n);
  }
  return { byId, duplicates };
}

type PlainKey =
  | 'teams'
  | 'systems'
  | 'services'
  | 'stores'
  | 'messages'
  | 'interactions'
  | 'userJourneys'
  | 'graphs'
  | 'subgraphs'
  | 'operations'
  | 'handlers';

function plainLists(system: Partial<SystemSource>, o: Origins): Pick<Lists, PlainKey> {
  return {
    teams: flat(system.teams, ['team', 'teams'], o),
    systems: flat(system.systems, ['system', 'systems'], o),
    services: flat(system.services, ['service', 'services'], o),
    stores: flat(system.stores, ['store', 'stores'], o),
    messages: flat(system.messages, ['message', 'messages'], o),
    interactions: flat(system.interactions, ['interaction', 'interactions'], o),
    userJourneys: flat(system.user_journeys, ['userJourney', 'user_journeys'], o),
    graphs: flat(system.graphs, ['graph', 'graphs'], o),
    subgraphs: flat(system.subgraphs, ['subgraph', 'subgraphs'], o),
    operations: flat(system.operations, ['operation', 'operations'], o),
    handlers: flat(system.handlers, ['handler', 'handlers'], o),
  };
}

const schemaNodes = (system: Partial<SystemSource>, o: Origins): readonly SchemaNode[] =>
  (system.schemas ?? []).map((e, i) => ({
    ...e,
    fields: fieldNodes(e, i, o),
    $type: 'schema',
    $path: o?.get(e.id) ?? ['schemas', i],
  }));

const interfaceNodes = (system: Partial<SystemSource>, o: Origins): readonly InterfaceNode[] =>
  (system.interfaces ?? []).map((e, i) => ({
    ...e,
    endpoints: endpointNodes(e, i, o),
    $type: 'interface',
    $path: o?.get(e.id) ?? ['interfaces', i],
  }));

const flowNodes = (system: Partial<SystemSource>, o: Origins): readonly FlowNode[] =>
  (system.flows ?? []).map((e, i) => ({
    ...e,
    steps: stepNodes(e, i, o),
    $type: 'flow',
    $path: o?.get(e.id) ?? ['flows', i],
  }));

const screenNodes = (system: Partial<SystemSource>, o: Origins): readonly ScreenNode[] =>
  (system.screens ?? []).map((e, i) => ({
    ...e,
    regions: regionNodes(e, i, o),
    $type: 'screen',
    $path: o?.get(e.id) ?? ['screens', i],
  }));

/**
 * Build an indexed graph from a system ({teams, services, …}). Nodes are shallow copies of entities
 * plus `$type`, `$path` (source path), `$parent`, `$index`, `$seq` (steps, 1-based) and `$service`
 * (endpoints). The children arrays (fields, steps, endpoints, regions) hold the child nodes.
 * `origins` maps an id to its source path (default: where it sits in the base arrays).
 */
export function buildGraph(system: Partial<SystemSource>, origins?: Origins): SystemGraph {
  const plain = plainLists(system, origins);
  const schemas = schemaNodes(system, origins);
  const interfaces = interfaceNodes(system, origins);
  const flows = flowNodes(system, origins);
  const screens = screenNodes(system, origins);
  const lists: Lists = {
    ...plain,
    schemas,
    fields: schemas.flatMap((n) => n.fields),
    interfaces,
    endpoints: interfaces.flatMap((n) => n.endpoints),
    flows,
    steps: flows.flatMap((n) => n.steps),
    screens,
    regions: screens.flatMap((n) => n.regions),
  };
  const ix = indexOf([
    ...Object.values(plain).flat(),
    ...schemas.flatMap((n) => [n, ...n.fields]),
    ...interfaces.flatMap((n) => [n, ...n.endpoints]),
    ...flows.flatMap((n) => [n, ...n.steps]),
    ...screens.flatMap((n) => [n, ...n.regions]),
  ]);
  return {
    ...lists,
    ...ix,
    get: (id) => (id === null || id === undefined ? undefined : ix.byId.get(id)),
    has: (id) => ix.byId.has(id),
  };
}
