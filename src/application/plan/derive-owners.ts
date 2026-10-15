import type { Core } from '@/application/plan/derive-core';
import { memo, objects, str, uniq } from '@/application/plan/derive-values';
import { actingService } from '@/application/plan/graph-queries';
import { parentOf, prop, strings } from '@/application/plan/ids';
import type { PlanNode } from '@/domain/plan/plan-graph';

export interface Rollup {
  added: number;
  modified: number;
  deprecated: number;
  removed: number;
  total: number;
}

type Graph = Core['asIs'];
type Lookup = (id: string) => string | null;

interface Ctx {
  core: Core;
  navigation: (id: string) => string[];
  owner: Lookup;
}

function interactionsOf(g: Graph, node: PlanNode | undefined): (PlanNode | undefined)[] {
  if (node?.$type === 'userJourney') return node.interactions.map((ref) => g.get(ref));
  return node?.$type === 'interaction' ? [node] : [];
}

// Navigation belongs to the screens with the controls. A shared control can involve several apps;
// retain every source owner across both system states.
function navigationServicesOf({ asIs, toBe }: Core, id: string): string[] {
  return uniq(
    [asIs, toBe].flatMap((g) =>
      interactionsOf(g, g.get(id)).flatMap((i) =>
        i?.$type === 'interaction'
          ? i.from.map((ref) => str(prop(g.get(ref.split('#')[0]), 'service')))
          : [],
      ),
    ),
  );
}

/** The only owner of a navigation entity, or none when its sources span several. */
const soleOf = (list: readonly (string | undefined)[]): string | null =>
  list.length === 1 ? (list[0] ?? null) : null;

function ownerOfSchema({ core, owner }: Ctx, n: PlanNode & { $type: 'schema' }): string | null {
  if (n.store !== undefined) return owner(n.store);
  // a graph type is composed by the gateway; its fields have their own owners
  if (n.graph !== undefined) return owner(n.graph);
  for (const g of [core.toBe, core.asIs]) {
    const ep = g.endpoints.find((e) => e.request === n.id || e.response === n.id);
    if (ep !== undefined) return ep.$service ?? null;
    const m = g.messages.find((x) => x.payload === n.id);
    if (m !== undefined) return m.producer;
  }
  return null;
}

/** Entities that name their owning service themselves. */
function namedOwner(n: PlanNode): string | null {
  switch (n.$type) {
    case 'service': {
      return n.id;
    }
    case 'interface':
    case 'screen':
    case 'subgraph': {
      return n.service;
    }
    case 'endpoint': {
      return n.$service ?? null;
    }
    case 'store': {
      return n.owner;
    }
    case 'message': {
      return n.producer;
    }
    case 'graph': {
      return n.gateway;
    }
    default: {
      return null;
    }
  }
}

const ownerOfParent = ({ owner }: Ctx, n: { $parent?: string | undefined }): string | null =>
  n.$parent === undefined ? null : owner(n.$parent);

/** A graph field belongs to the (first) subgraph that resolves it; a key field without subgraphs to its type. */
function ownerOfField(ctx: Ctx, n: PlanNode & { $type: 'field' }): string | null {
  const sg = (n.subgraphs ?? []).find((x) => ctx.core.sys(x) !== undefined);
  return sg === undefined ? ownerOfParent(ctx, n) : ctx.owner(sg);
}

function ownerOfOperation({ owner }: Ctx, n: PlanNode & { $type: 'operation' }): string | null {
  if (n.client !== undefined) return n.client;
  const scr = (n.screens ?? [])[0];
  return scr === undefined ? null : owner(parentOf(scr) ?? scr);
}

/** Entities that belong to the service of what they sit in or point at. */
function derivedOwner(ctx: Ctx, n: PlanNode): string | null {
  switch (n.$type) {
    case 'field': {
      return ownerOfField(ctx, n);
    }
    case 'region': {
      return ownerOfParent(ctx, n);
    }
    case 'interaction':
    case 'userJourney': {
      return soleOf(ctx.navigation(n.id));
    }
    case 'operation': {
      return ownerOfOperation(ctx, n);
    }
    case 'schema': {
      return ownerOfSchema(ctx, n);
    }
    case 'step': {
      return actingService(ctx.core.toBe.has(n.id) ? ctx.core.toBe : ctx.core.asIs, n);
    }
    case 'flow': {
      const first = n.steps[0];
      return first === undefined ? null : ctx.owner(first.id);
    }
    default: {
      return null;
    }
  }
}

const TEAM_KEY: Partial<Record<string, string>> = {
  service: 'team',
  workItem: 'team',
  test: 'owner',
  risk: 'owner',
  question: 'decider',
};

const kids = (x: PlanNode | undefined): string[] =>
  objects(
    prop(x, 'fields') ?? prop(x, 'endpoints') ?? prop(x, 'steps') ?? prop(x, 'regions'),
  ).flatMap((c) => str(c.id) ?? []);

const both = ({ asIs, toBe }: Core, id: string): string[] =>
  uniq([...kids(asIs.get(id)), ...kids(toBe.get(id))]);

/** What a graph holds: its subgraphs, its types (with their fields) and its operations. */
function graphParts(core: Core, id: string): string[] {
  const parts = core.unionIds.filter((x) => {
    const p = core.sys(x);
    return (
      (p?.$type === 'subgraph' || p?.$type === 'schema' || p?.$type === 'operation') &&
      p.graph === id
    );
  });
  return uniq(
    parts.flatMap((x) => (core.sys(x)?.$type === 'schema' ? [x, ...both(core, x)] : [x])),
  );
}

function storeParts(core: Core, id: string): string[] {
  const schemas = core.unionIds.filter((x) => {
    const n = core.sys(x);
    return n?.$type === 'schema' && prop(n, 'store') === id;
  });
  return uniq(schemas.flatMap((s) => [s, ...both(core, s)]));
}

function subgraphFields({ unionIds, sys, asIs, toBe }: Core, id: string): string[] {
  return unionIds.filter(
    (x) =>
      sys(x)?.$type === 'field' &&
      [asIs.get(x), toBe.get(x)].some((f) => strings(prop(f, 'subgraphs')).includes(id)),
  );
}

/** Everything a service or team is behind, leaving out flows and steps (they cross owners) and, for a team, other teams. */
function containedBy(core: Core, id: string, [owner, skip]: [Lookup, readonly string[]]): string[] {
  return core.unionIds.filter((x) => {
    const t = core.sys(x)?.$type ?? '';
    return x !== id && t !== 'flow' && t !== 'step' && !skip.includes(t) && owner(x) === id;
  });
}

/** Counts of changed things among a container's descendants. */
function rollupOf(ids: readonly string[], status: Core['status']): Rollup {
  const out: Rollup = { added: 0, modified: 0, deprecated: 0, removed: 0, total: 0 };
  for (const d of ids) {
    const s = status(d);
    if (s !== null && s !== 'existing') {
      out[s]++;
      out.total++;
    }
  }
  return out;
}

/** Who owns what: the owning service and team of any entity, what sits inside a container, and what changed in it. */
export function createOwners(core: Core) {
  const { sys, get, status } = core;
  const navigationServices = memo((id: string): string[] => navigationServicesOf(core, id));
  const navigationTeams = memo((id: string): string[] =>
    uniq(navigationServices(id).map((service) => str(prop(sys(service), 'team')))),
  );
  const ctx: Ctx = { core, navigation: navigationServices, owner: (id) => ownerService(id) };

  const ownerService = memo((id: string): string | null => {
    const n = sys(id);
    return n === undefined ? null : (namedOwner(n) ?? derivedOwner(ctx, n));
  });

  const ownerTeam = memo((id: string): string | null => {
    const n = get(id);
    if (n === undefined) return null;
    if (n.$type === 'team') return n.id;
    const key = TEAM_KEY[n.$type];
    if (key !== undefined) return str(prop(n, key)) ?? null;
    if (n.$type === 'interaction' || n.$type === 'userJourney') return soleOf(navigationTeams(id));
    const svc = ownerService(id);
    return svc === null ? null : (str(prop(sys(svc), 'team')) ?? null);
  });

  const descendants = memo((id: string): string[] => {
    const n = sys(id);
    switch (n?.$type) {
      case 'schema':
      case 'interface':
      case 'flow':
      case 'screen': {
        return both(core, id);
      }
      case 'store': {
        return storeParts(core, id);
      }
      case 'graph': {
        return graphParts(core, id);
      }
      case 'subgraph': {
        return subgraphFields(core, id);
      }
      case 'service': {
        return containedBy(core, id, [ownerService, []]);
      }
      case 'team': {
        return containedBy(core, id, [ownerTeam, ['team']]);
      }
      default: {
        return [];
      }
    }
  });

  const rollup = memo((id: string): Rollup => rollupOf(descendants(id), status));

  return { navigationTeams, ownerService, ownerTeam, descendants, rollup };
}

export type Owners = ReturnType<typeof createOwners>;
