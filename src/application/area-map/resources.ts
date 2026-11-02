import type { Model } from '@/application/plan/derive';
import type { Edge } from '@/application/plan/derive-edge-types';
import type {
  AreaComponentView,
  AreaResourceView,
  AreaSystemView,
} from '@/application/workspace-area';

interface ResourceIndex {
  readonly access: readonly Edge[];
  readonly publishers: ReadonlyMap<string, readonly Edge[]>;
}

// A model is kept until a workspace file changes, so its index outlives the request that built it. Without
// it every component rescanned every edge, message and handler: seconds for one area page.
const indexes = new WeakMap<Model, ResourceIndex>();
const consumersByModel = new WeakMap<Model, Map<string, readonly string[]>>();

function indexOf(model: Model): ResourceIndex {
  const known = indexes.get(model);
  if (known !== undefined) return known;
  const access = model.edges('asIs', 'data').flatMap((edge): readonly Edge[] => {
    const store = model.asIs.get(edge.to);
    if (store?.$type !== 'store') return [];
    const recorded = store.access?.find((entry) => entry.svc === edge.from);
    if (edge.steps.length > 0 || (edge.handlers?.length ?? 0) > 0) return [edge];
    return recorded === undefined ? [] : [{ ...edge, mode: recorded.mode }];
  });
  const publishers = new Map<string, Edge[]>();
  for (const edge of model.edges('asIs', 'msg')) {
    const message = model.asIs.get(edge.via);
    if (message?.$type !== 'message' || edge.to !== message.topic) continue;
    publishers.set(message.id, [...(publishers.get(message.id) ?? []), edge]);
  }
  const index = { access, publishers };
  indexes.set(model, index);
  return index;
}

/** Ownership is placement evidence, not proof that the owner reads and writes a store. */
export function recordedDataAccess(model: Model): readonly Edge[] {
  return indexOf(model).access;
}

/** Declared and captured publishers retain their handler/flow identities, without filling unknown ownership. */
export function resourcePublishers(model: Model, message: string): readonly Edge[] {
  return indexOf(model).publishers.get(message) ?? [];
}

export function resourceConsumers(model: Model, message: string): readonly string[] {
  let consumers = consumersByModel.get(model);
  if (consumers === undefined) {
    consumers = new Map();
    consumersByModel.set(model, consumers);
  }
  const known = consumers.get(message);
  if (known !== undefined) return known;
  const found = [
    ...new Set([
      ...model.consumersEffective(message, 'asIs').map((consumer) => consumer.svc),
      ...model.asIs.handlers
        .filter((handler) => handler.on === message)
        .map((handler) => handler.component),
    ]),
  ];
  consumers.set(message, found);
  return found;
}

export function resourcesOf(component: string, model?: Model): readonly AreaResourceView[] {
  if (model === undefined) return [];
  const graph = model.asIs;
  const stores = recordedDataAccess(model)
    .filter((edge) => edge.from === component)
    .flatMap((edge): readonly AreaResourceView[] => {
      const store = graph.get(edge.to);
      if (store?.$type !== 'store') return [];
      return [
        {
          id: store.id,
          name: store.name,
          kind: store.kind === 'topic' || store.kind === 'queue' ? 'topic' : 'store',
          technology: store.tech ?? null,
          use:
            edge.mode === null
              ? 'Data access'
              : { read: 'Reads', write: 'Writes', readwrite: 'Reads and writes' }[edge.mode],
          category: store.kind,
        },
      ];
    });
  const topics = graph.messages.flatMap((message): readonly AreaResourceView[] => {
    const uses: string[] = [];
    if (resourcePublishers(model, message.id).some((edge) => edge.from === component)) {
      uses.push('Publishes');
    }
    if (resourceConsumers(model, message.id).includes(component)) {
      uses.push('Consumes');
    }
    const topic = graph.get(message.topic);
    return uses.map((use) => ({
      id: message.topic,
      name: topic?.$type === 'store' ? topic.name : model.label(message.topic),
      kind: 'topic',
      category: topic?.$type === 'store' ? topic.kind : 'topic',
      technology: topic?.$type === 'store' ? (topic.tech ?? null) : null,
      use: `${use} ${message.name}`,
    }));
  });
  const libraryTopics = graph.stores.flatMap((store): readonly AreaResourceView[] => {
    const access = store.access?.find((entry) => entry.svc === component);
    if (access === undefined || (store.kind !== 'topic' && store.kind !== 'queue')) return [];
    if ([...stores, ...topics].some((resource) => resource.id === store.id)) return [];
    return [
      {
        id: store.id,
        name: store.name,
        kind: 'topic',
        category: store.kind,
        technology: store.tech ?? null,
        use: { read: 'Reads', write: 'Writes', readwrite: 'Reads and writes' }[access.mode],
      },
    ];
  });
  return [...stores, ...topics, ...libraryTopics];
}

function resourceComponent(store: Model['asIs']['stores'][number]): AreaComponentView {
  return {
    id: store.id,
    name: store.name,
    kind: store.kind === 'topic' || store.kind === 'queue' ? 'queue' : 'database',
    category: store.kind,
    technology: store.tech ?? null,
    summary: store.does ?? 'Purpose not recorded.',
    explorer: null,
    repository: null,
    endpoints: [],
    resources: [],
    dependencies: [],
  };
}

/** A topic or queue only one service publishes belongs to it; consumers are drawn as lines from that service. */
function producingParent(model: Model, store: Model['asIs']['stores'][number]): string | undefined {
  const messages = model.asIs.messages.filter((message) => message.topic === store.id);
  const publishers = messages.map((message) => resourcePublishers(model, message.id));
  // An unresolved publisher is not evidence that this topic is private to a known publisher or reader.
  if (publishers.some((edges) => edges.length === 0)) return undefined;
  const producers = new Set(publishers.flatMap((edges) => edges.map((edge) => edge.from)));
  // Library-managed backplanes can have recorded access without an application message contract.
  // Only fold that case when the owner is also its sole recorded reader/writer across the workspace.
  if (messages.length === 0) {
    const users = store.access ?? [];
    const soleOwner = users.length > 0 && users.every((entry) => entry.svc === store.owner);
    const writes = users.some((edge) => edge.mode === 'write' || edge.mode === 'readwrite');
    return soleOwner && writes ? store.owner : undefined;
  }
  if (producers.size !== 1) return undefined;
  const producer = [...producers][0];
  return store.owner === producer ? producer : undefined;
}

/** A store only one component uses belongs to it; a shared store stays a card of its own. */
function privateParent(model: Model, store: Model['asIs']['stores'][number]): string | undefined {
  if (store.kind === 'topic' || store.kind === 'queue') return producingParent(model, store);
  const users = new Set(
    recordedDataAccess(model)
      .filter((edge) => edge.to === store.id)
      .map((edge) => edge.from),
  );
  const onlyUser = users.size === 1 ? [...users][0] : undefined;
  return onlyUser !== undefined && store.owner === onlyUser ? onlyUser : undefined;
}

/** Place a shared store/topic once, with its owner when known, otherwise its first recorded user. */
export function withAreaResources(
  systems: readonly AreaSystemView[],
  model?: Model,
): readonly AreaSystemView[] {
  if (model === undefined) return systems;
  const known = new Set(
    systems.flatMap((system) => system.components.map((component) => component.id)),
  );
  const additions = new Map<string, AreaComponentView[]>();
  for (const store of model.asIs.stores) {
    if (known.has(store.id)) continue;
    const owner = systems.find(
      (system) =>
        system.id === store.owner?.replace(/^sys:/u, '') ||
        system.components.some((component) => component.id === store.owner),
    );
    const user = systems.find((system) =>
      system.components.some((component) =>
        component.resources.some((resource) => resource.id === store.id),
      ),
    );
    const system = owner ?? user;
    if (system !== undefined) {
      additions.set(system.id, [...(additions.get(system.id) ?? []), resourceComponent(store)]);
    }
  }
  const prepared = systems.map((system) => ({
    ...system,
    components: [...system.components, ...(additions.get(system.id) ?? [])].map((component) => {
      const store = model.asIs.get(component.id);
      const parent = store?.$type === 'store' ? privateParent(model, store) : undefined;
      return store?.$type === 'store'
        ? {
            ...component,
            category: store.kind,
            technology: store.tech ?? component.technology ?? null,
            ...(parent === undefined ? {} : { parentComponent: parent }),
          }
        : component;
    }),
  }));
  const systemByComponent = new Map(
    prepared.flatMap((system) => system.components.map((component) => [component.id, system.id])),
  );
  const placed = prepared.flatMap((system) =>
    system.components.map((component) => ({
      component,
      system: systemByComponent.get(component.parentComponent ?? component.id) ?? system.id,
    })),
  );
  return prepared.map((system) => ({
    ...system,
    components: placed
      .filter((entry) => entry.system === system.id)
      .map((entry) => entry.component),
  }));
}
