import type { Model } from '@/application/plan/derive';
import { groupBy, graphOf, poolOf, type Show } from '@/application/plan-story-ref';
import { teamIndex, teamOf } from '@/application/plan-viz-teams';
import type {
  InterfaceNode,
  MessageNode,
  SchemaNode,
  ServiceNode,
  StoreNode,
} from '@/domain/plan/plan-graph';

// The system catalogues' rows: who owns, offers, publishes and listens to what, in the mode the reader picked.

const sortedKeys = (
  model: Model,
  groups: ReadonlyMap<string, unknown>,
  teamOfKey: (k: string) => string,
): string[] =>
  [...groups.keys()].toSorted(
    (a, b) => teamIndex(model, teamOfKey(a)) - teamIndex(model, teamOfKey(b)),
  );

/** Services of the mode, grouped by the team that owns them, in team order. */
export function servicesByTeam(
  model: Model,
  show: Show,
): { readonly team: string; readonly services: readonly ServiceNode[] }[] {
  const groups = groupBy(poolOf(model.asIs.services, model.toBe.services, show), (s) => s.team);
  return sortedKeys(model, groups, (t) => t).map((team) => ({
    team,
    services: groups.get(team) ?? [],
  }));
}

export interface ServiceFacts {
  readonly owns: readonly string[];
  readonly interfaces: readonly InterfaceNode[];
  readonly publishes: readonly string[];
  readonly listensTo: readonly string[];
}

/** What one service owns, offers, publishes and consumes. */
export function serviceFacts(model: Model, show: Show, id: string): ServiceFacts {
  const stores = poolOf(model.asIs.stores, model.toBe.stores, show);
  const interfaces = poolOf(model.asIs.interfaces, model.toBe.interfaces, show);
  const messages = poolOf(model.asIs.messages, model.toBe.messages, show);
  const consumes = (m: MessageNode): boolean =>
    show === 'asis'
      ? (m.consumers ?? []).includes(id)
      : model.consumersEffective(m.id).some((c) => c.svc === id);
  return {
    owns: stores.filter((s) => s.owner === id).map((s) => s.id),
    interfaces: interfaces.filter((i) => i.service === id),
    publishes: messages.filter((m) => m.producer === id).map((m) => m.id),
    listensTo: messages.filter(consumes).map((m) => m.id),
  };
}

export interface StoreGroup {
  readonly title: string;
  readonly note: string;
  readonly stores: readonly StoreNode[];
}

const DATA = new Set(['database', 'warehouse', 'bucket']);
const isPipe = (s: StoreNode): boolean => s.kind === 'topic' || s.kind === 'queue';

/** Stores in the groups the page shows: databases, caches, anything else, then the topics and queues that only carry events. */
export function storeGroups(stores: readonly StoreNode[]): StoreGroup[] {
  const groups: StoreGroup[] = [
    { title: 'Databases & warehouses', note: '', stores: stores.filter((s) => DATA.has(s.kind)) },
    { title: 'Caches', note: '', stores: stores.filter((s) => s.kind === 'cache') },
    {
      title: 'Other stores',
      note: '',
      stores: stores.filter((s) => !DATA.has(s.kind) && s.kind !== 'cache' && !isPipe(s)),
    },
    {
      title: 'Topics and queues',
      note: 'not data stores: they carry events between services and hold no records',
      stores: stores.filter(isPipe),
    },
  ];
  return groups.filter((g) => g.stores.length > 0);
}

export interface StoreFacts {
  readonly records: readonly string[];
  readonly events: readonly string[];
}

/** The records a store holds and the events on it. */
export function storeFacts(model: Model, show: Show, id: string): StoreFacts {
  const schemas = poolOf(model.asIs.schemas, model.toBe.schemas, show);
  const messages = poolOf(model.asIs.messages, model.toBe.messages, show);
  return {
    records: schemas.filter((s) => s.store === id).map((s) => s.id),
    events: messages.filter((m) => m.topic === id).map((m) => m.id),
  };
}

/** Screens of the mode, grouped by the app that serves them, apps in team order. */
export function screensByApp(
  model: Model,
  show: Show,
): { readonly app: string; readonly screens: readonly string[] }[] {
  const groups = groupBy(poolOf(model.asIs.screens, model.toBe.screens, show), (s) => s.service);
  return sortedKeys(model, groups, (app) => teamOf(model, app) ?? '').map((app) => ({
    app,
    screens: (groups.get(app) ?? []).map((s) => s.id),
  }));
}

export interface SchemaGroups {
  readonly records: readonly { readonly store: string; readonly schemas: readonly SchemaNode[] }[];
  readonly bodies: readonly SchemaNode[];
  readonly graphTypes: readonly SchemaNode[];
}

/** Schemas of the mode: records by the store that holds them, request and event bodies, and the graph's types. */
export function schemaGroups(model: Model, show: Show): SchemaGroups {
  const all = poolOf(model.asIs.schemas, model.toBe.schemas, show);
  const records = groupBy(
    all.filter((s) => s.kind === 'record'),
    (s) => s.store ?? '',
  );
  return {
    records: [...records].map(([store, schemas]) => ({ store, schemas })),
    bodies: all.filter((s) => s.kind === 'dto' || s.kind === 'payload'),
    graphTypes: all.filter((s) => s.kind === 'graph-type'),
  };
}

export interface SchemaFacts {
  readonly fields: number;
  /** The events and endpoints whose body this is. */
  readonly carriedBy: readonly string[];
}

/** How big a schema is and what carries it. */
export function schemaFacts(model: Model, show: Show, s: SchemaNode): SchemaFacts {
  const messages = poolOf(model.asIs.messages, model.toBe.messages, show);
  const endpoints = poolOf(model.asIs.interfaces, model.toBe.interfaces, show).flatMap(
    (i) => i.endpoints,
  );
  return {
    fields: s.fields.length,
    carriedBy: [
      ...messages.filter((m) => m.payload === s.id).map((m) => m.id),
      ...endpoints.filter((e) => e.request === s.id || e.response === s.id).map((e) => e.id),
    ],
  };
}

/** Who owns a graph type's fields, the keys others look it up by, and the operations that select from it. */
export function graphTypeFacts(
  model: Model,
  show: Show,
  id: string,
): {
  readonly contributors: ReturnType<Model['fieldOwners']>['contributors'];
  readonly keys: readonly string[];
  readonly operations: ReturnType<Model['operationsSelecting']>;
} {
  const mode = graphOf(show);
  const owners = model.fieldOwners(id, mode);
  return {
    contributors: owners.contributors,
    keys: owners.keys.map((k) => k.fields.join(', ')),
    operations: model.operationsSelecting(id, mode),
  };
}
