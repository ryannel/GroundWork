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

type Origins = ReadonlyMap<string, PathSegment[]> | undefined;

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
  };
}

function flat<T extends { id: string }, K extends EntityType>(
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
  byId: Map<string, PlanNode>;
  duplicates: PlanNode[];
}

function register<N extends PlanNode>(ix: Index, list: N[], node: N): void {
  if (ix.byId.has(node.id)) ix.duplicates.push(node);
  else ix.byId.set(node.id, node);
  list.push(node);
}

function emptyLists(): Lists {
  return {
    teams: [],
    systems: [],
    services: [],
    stores: [],
    schemas: [],
    fields: [],
    interfaces: [],
    endpoints: [],
    messages: [],
    flows: [],
    steps: [],
    screens: [],
    regions: [],
    interactions: [],
    userJourneys: [],
    graphs: [],
    subgraphs: [],
    operations: [],
  };
}

interface Build {
  ix: Index;
  lists: Lists;
  origins: Origins;
}

function fillPlain(b: Build, system: Partial<SystemSource>): void {
  const add = (list: PlanNode[], nodes: PlanNode[]): void => {
    for (const n of nodes) register(b.ix, list, n);
  };
  const { lists, origins: o } = b;
  add(lists.teams, flat(system.teams, ['team', 'teams'], o));
  add(lists.systems, flat(system.systems, ['system', 'systems'], o));
  add(lists.services, flat(system.services, ['service', 'services'], o));
  add(lists.stores, flat(system.stores, ['store', 'stores'], o));
  add(lists.messages, flat(system.messages, ['message', 'messages'], o));
  add(lists.interactions, flat(system.interactions, ['interaction', 'interactions'], o));
  add(lists.userJourneys, flat(system.user_journeys, ['userJourney', 'user_journeys'], o));
  add(lists.graphs, flat(system.graphs, ['graph', 'graphs'], o));
  add(lists.subgraphs, flat(system.subgraphs, ['subgraph', 'subgraphs'], o));
  add(lists.operations, flat(system.operations, ['operation', 'operations'], o));
}

function fillSchemas(b: Build, system: Partial<SystemSource>): void {
  for (const [i, e] of (system.schemas ?? []).entries()) {
    const node: SchemaNode = {
      ...e,
      fields: fieldNodes(e, i, b.origins),
      $type: 'schema',
      $path: b.origins?.get(e.id) ?? ['schemas', i],
    };
    register(b.ix, b.lists.schemas, node);
    for (const f of node.fields) register(b.ix, b.lists.fields, f);
  }
}

function fillInterfaces(b: Build, system: Partial<SystemSource>): void {
  for (const [i, e] of (system.interfaces ?? []).entries()) {
    const node: InterfaceNode = {
      ...e,
      endpoints: endpointNodes(e, i, b.origins),
      $type: 'interface',
      $path: b.origins?.get(e.id) ?? ['interfaces', i],
    };
    register(b.ix, b.lists.interfaces, node);
    for (const c of node.endpoints) register(b.ix, b.lists.endpoints, c);
  }
}

function fillFlows(b: Build, system: Partial<SystemSource>): void {
  for (const [i, e] of (system.flows ?? []).entries()) {
    const node: FlowNode = {
      ...e,
      steps: stepNodes(e, i, b.origins),
      $type: 'flow',
      $path: b.origins?.get(e.id) ?? ['flows', i],
    };
    register(b.ix, b.lists.flows, node);
    for (const c of node.steps) register(b.ix, b.lists.steps, c);
  }
}

function fillScreens(b: Build, system: Partial<SystemSource>): void {
  for (const [i, e] of (system.screens ?? []).entries()) {
    const node: ScreenNode = {
      ...e,
      regions: regionNodes(e, i, b.origins),
      $type: 'screen',
      $path: b.origins?.get(e.id) ?? ['screens', i],
    };
    register(b.ix, b.lists.screens, node);
    for (const c of node.regions) register(b.ix, b.lists.regions, c);
  }
}

/**
 * Build an indexed graph from a system ({teams, services, …}). Nodes are shallow copies of entities
 * plus `$type`, `$path` (source path), `$parent`, `$index`, `$seq` (steps, 1-based) and `$service`
 * (endpoints). The children arrays (fields, steps, endpoints, regions) hold the child nodes.
 * `origins` maps an id to its source path (default: where it sits in the base arrays).
 */
export function buildGraph(system: Partial<SystemSource>, origins?: Origins): SystemGraph {
  const ix: Index = { byId: new Map(), duplicates: [] };
  const lists = emptyLists();
  const build: Build = { ix, lists, origins };
  fillPlain(build, system);
  fillSchemas(build, system);
  fillInterfaces(build, system);
  fillFlows(build, system);
  fillScreens(build, system);
  return {
    ...lists,
    ...ix,
    get: (id) => (id === null || id === undefined ? undefined : ix.byId.get(id)),
    has: (id) => ix.byId.has(id),
  };
}
