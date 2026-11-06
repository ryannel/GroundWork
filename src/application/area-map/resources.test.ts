import { describe, expect, it } from 'vitest';

import { acme } from '@/../test/workspace-kit';
import { derive as derivePlan, type Model } from '@/application/plan/derive';
import type { AreaComponentView, AreaSystemView } from '@/application/workspace-area';
import { areaTechnicalRelationships } from '@/application/workspace-area-relationships';
import type { Plan } from '@/domain/plan/plan.generated';

import { resourceSummary } from './component-summary';
import { resourcesOf, withAreaResources } from './resources';

// These synthetic resources are declared here, independently of ownership and access.
function derive(plan: Plan): Model {
  const offers = { domain: null, system: 'sys:offers', component: null };
  const search = { domain: null, system: 'sys:search', component: null };
  const placements = Object.fromEntries([
    ...[
      'svc:offers',
      'st:cache',
      'st:records',
      'st:changes',
      'st:owner-only',
      'st:private-bus',
      'st:read-only',
      'st:shared-bus',
      'st:no-access',
    ].map((id) => [id, { ...offers, component: id }] as const),
    ...['svc:search', 'st:unknown'].map((id) => [id, { ...search, component: id }] as const),
  ]);
  return derivePlan(plan, { placements });
}

function fixture() {
  const { today } = acme();
  const model = derive({
    ...today.plan,
    stores: [
      {
        id: 'st:cache',
        name: 'Offer cache',
        kind: 'cache',
        tech: 'Redis',
        owner: 'svc:offers',
        access: [
          { svc: 'svc:offers', mode: 'readwrite' },
          { svc: 'svc:search', mode: 'read' },
        ],
      },
      {
        id: 'st:records',
        name: 'Offer records',
        kind: 'database',
        tech: 'PostgreSQL',
        owner: 'svc:offers',
        access: [{ svc: 'svc:offers', mode: 'write' }],
      },
      {
        id: 'st:changes',
        name: 'Offer changes',
        kind: 'topic',
        tech: 'Kafka',
        owner: 'svc:offers',
      },
      { id: 'st:owner-only', name: 'Owner only', kind: 'database', owner: 'svc:offers' },
    ],
    messages: [
      {
        id: 'msg:changed',
        name: 'Offer changed',
        producer: 'svc:offers',
        topic: 'st:changes',
        consumers: ['svc:search'],
      },
    ],
    handlers: [
      { id: 'h:consume', component: 'svc:handler-consumer', on: 'msg:changed', steps: [] },
    ],
  });
  const component = (id: string): AreaComponentView => ({
    id,
    name: id,
    kind: 'service',
    summary: 'Service',
    explorer: null,
    repository: null,
    endpoints: [],
    dependencies: [],
    resources: resourcesOf(id, model),
  });
  const systems: readonly AreaSystemView[] = ['offers', 'search'].map((id) => ({
    id,
    name: id,
    purpose: id,
    href: `/${id}`,
    resources: [],
    components: [component(`svc:${id}`)],
  }));
  return { model, systems };
}

describe('area resource overview', () => {
  it('keeps a resource in its declared system when its owner is elsewhere, and leaves unknown placement visible', () => {
    const { model, systems } = fixture();
    const plan = {
      ...model.plan,
      stores: (model.plan.stores ?? []).map((store) => ({ ...store, owner: 'svc:search' })),
    };
    const placed = withAreaResources(systems, derive(plan));
    expect(
      placed
        .find((system) => system.id === 'offers')
        ?.components.some((component) => component.id === 'st:records'),
    ).toBe(true);
    expect(
      placed
        .flatMap((system) => system.components)
        .find((component) => component.id === 'st:records')?.parentComponent,
    ).toBeUndefined();
    const unknown = withAreaResources(systems, derivePlan(plan));
    expect(
      unknown
        .flatMap((system) => system.components)
        .some((component) => component.id === 'st:records'),
    ).toBe(false);
    expect(resourcesOf('svc:offers', derivePlan(plan))).toContainEqual(
      expect.objectContaining({ id: 'st:records' }),
    );
  });

  it('uses a captured publisher without filling in the omitted message producer', () => {
    const { model, systems } = fixture();
    const captured = derive({
      ...model.plan,
      messages: [{ id: 'msg:captured', name: 'Captured changes', topic: 'st:changes' }],
      handlers: [
        {
          id: 'h:publish',
          component: 'svc:offers',
          on: 'timer:refresh',
          steps: [{ publish: 'msg:captured' }],
        },
      ],
    });
    expect(resourcesOf('svc:offers', captured)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'st:changes', use: 'Publishes Captured changes' }),
      ]),
    );
    expect(
      withAreaResources(systems, captured)
        .flatMap((system) => system.components)
        .find((component) => component.id === 'st:changes'),
    ).toMatchObject({ parentComponent: 'svc:offers' });
    expect(captured.asIs.messages[0]?.producer).toBeUndefined();
  });

  it('keeps a topic shared when another captured publisher is outside this area', () => {
    const { model, systems } = fixture();
    const captured = derive({
      ...model.plan,
      messages: [{ id: 'msg:captured', name: 'Captured changes', topic: 'st:changes' }],
      handlers: ['offers', 'search'].map((name) => ({
        id: `h:${name}`,
        component: `svc:${name}`,
        on: 'timer:refresh',
        steps: [{ publish: 'msg:captured' }],
      })),
    });
    for (const name of ['offers', 'search']) {
      expect(resourcesOf(`svc:${name}`, captured)).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ id: 'st:changes', use: 'Publishes Captured changes' }),
        ]),
      );
    }
    const onlyOffers = systems.filter((system) => system.id === 'offers');
    const topic = withAreaResources(onlyOffers, captured)
      .flatMap((system) => system.components)
      .find((component) => component.id === 'st:changes');
    expect(topic).toBeDefined();
    expect(topic?.parentComponent).toBeUndefined();
  });

  it('does not treat sole-owner access as a publisher when a message has no identified publisher', () => {
    const { model, systems } = fixture();
    const unknown = derive({
      ...model.plan,
      stores: [
        {
          id: 'st:changes',
          name: 'Changes',
          kind: 'topic',
          owner: 'svc:offers',
          access: [{ svc: 'svc:offers', mode: 'readwrite' }],
        },
      ],
      messages: [
        {
          id: 'msg:unknown',
          name: 'Unknown publication',
          topic: 'st:changes',
          consumers: ['svc:offers'],
        },
      ],
      handlers: [],
    });
    const topic = withAreaResources(systems, unknown)
      .flatMap((system) => system.components)
      .find((component) => component.id === 'st:changes');
    expect(topic?.parentComponent).toBeUndefined();
    expect(
      resourcesOf('svc:offers', unknown).some((resource) => resource.use.startsWith('Publishes')),
    ).toBe(false);
  });

  it('does not turn a sole recorded reader into the owner of an unidentified database', () => {
    const { model, systems } = fixture();
    const unknown = derive({
      ...model.plan,
      stores: [
        {
          id: 'st:unknown',
          name: 'Unidentified owner',
          kind: 'database',
          access: [{ svc: 'svc:search', mode: 'read' }],
        },
      ],
      messages: [],
    });
    const current = systems.map((system) => ({
      ...system,
      components: system.components.map((component) => ({
        ...component,
        resources: resourcesOf(component.id, unknown),
      })),
    }));
    const store = withAreaResources(current, unknown)
      .flatMap((system) => system.components)
      .find((component) => component.id === 'st:unknown');
    expect(store).toBeDefined();
    expect(store?.parentComponent).toBeUndefined();
    expect(areaTechnicalRelationships(withAreaResources(current, unknown), unknown)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ from: 'svc:search', to: 'st:unknown', kind: 'data' }),
      ]),
    );
  });

  it('keeps a consumed topic independent when its publisher and owner are unidentified', () => {
    const { model, systems } = fixture();
    const unknown = derive({
      ...model.plan,
      stores: (model.plan.stores ?? []).map((store) => {
        if (store.id !== 'st:changes') return store;
        const record = { ...store };
        delete record.owner;
        return record;
      }),
      messages: (model.plan.messages ?? []).map(({ producer: _producer, ...message }) => message),
    });
    const current = systems.map((system) => ({
      ...system,
      components: system.components.map((component) => ({
        ...component,
        resources: resourcesOf(component.id, unknown),
      })),
    }));
    const topic = withAreaResources(current, unknown)
      .flatMap((system) => system.components)
      .find((component) => component.id === 'st:changes');
    expect(topic).toBeDefined();
    expect(topic?.parentComponent).toBeUndefined();
    expect(resourcesOf('svc:search', unknown)).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: 'st:changes' })]),
    );
  });

  it('keeps captured retry-queue access in the topic resource row without inventing a message', () => {
    const { today } = acme();
    const model = derive({
      ...today.plan,
      stores: [
        {
          id: 'st:retry',
          name: 'Retry queue',
          kind: 'queue',
          owner: 'svc:products',
          access: [{ svc: 'svc:products', mode: 'readwrite' }],
        },
      ],
      messages: [],
      handlers: [
        {
          id: 'h:retry',
          component: 'svc:products',
          on: 'timer:retry',
          steps: [
            { read: 'sch:job', from: 'st:retry' },
            { write: 'sch:job', to: 'st:retry' },
          ],
        },
      ],
    });
    expect(resourcesOf('svc:products', model)).toEqual([
      expect.objectContaining({
        id: 'st:retry',
        kind: 'topic',
        category: 'queue',
        use: 'Reads and writes',
      }),
    ]);
    expect(model.asIs.messages).toEqual([]);
  });

  it('places an owned topic with its publisher even when a consumer system recorded it first', () => {
    const { model, systems } = fixture();
    const withResource = withAreaResources(systems, model);
    const topic = withResource
      .flatMap((system) => system.components)
      .find((component) => component.id === 'st:changes')!;
    const misplaced = systems.map((system) => ({
      ...system,
      components: system.id === 'search' ? [...system.components, topic] : system.components,
    }));
    const placed = withAreaResources(misplaced, model);
    expect(placed.find((system) => system.id === 'offers')?.components).toContainEqual(
      expect.objectContaining({ id: 'st:changes', parentComponent: 'svc:offers' }),
    );
    expect(
      placed
        .find((system) => system.id === 'search')
        ?.components.some((component) => component.id === 'st:changes'),
    ).toBe(false);
    expect(withAreaResources(misplaced.slice(1), model)[0]?.components).toContainEqual(
      expect.objectContaining({ id: 'st:changes' }),
    );
  });
  it('exposes actual technology, shared stores once, and both publishing and consumption', () => {
    const { model, systems } = fixture();
    const expanded = withAreaResources(systems, model);
    const components = expanded.flatMap((system) => system.components);
    expect(components.filter((component) => component.id === 'st:cache')).toHaveLength(1);
    expect(components.find((component) => component.id === 'st:changes')).toMatchObject({
      technology: 'Kafka',
      kind: 'queue',
    });
    expect(resourcesOf('svc:search', model)).toContainEqual(
      expect.objectContaining({
        id: 'st:changes',
        use: 'Consumes Offer changed',
        technology: 'Kafka',
      }),
    );
    expect(resourceSummary(systems[0]!.components[0]!)).toBe(
      '1 Redis cache · 1 PostgreSQL database · 1 Kafka topic',
    );
  });

  it('connects access to stores and publishing through the topic, including within a system', () => {
    const { model, systems } = fixture();
    const edges = areaTechnicalRelationships(withAreaResources(systems, model), model);
    expect(edges).toContainEqual(
      expect.objectContaining({ from: 'svc:offers', to: 'st:cache', kind: 'data' }),
    );
    expect(edges).toContainEqual(
      expect.objectContaining({ from: 'svc:offers', to: 'st:changes', kind: 'message' }),
    );
    expect(edges).toContainEqual(
      expect.objectContaining({
        from: 'st:changes',
        to: 'svc:search',
        kind: 'message',
        usageFrom: 'svc:search',
        usageTo: 'st:changes',
      }),
    );
    expect(edges.some((edge) => edge.to === 'st:owner-only')).toBe(false);
    expect(
      edges.some(
        (edge) => edge.from === 'svc:offers' && edge.to === 'svc:search' && edge.kind === 'message',
      ),
    ).toBe(false);
  });

  it('keeps missing technology explicit and does not invent resources without a model', () => {
    const { model, systems } = fixture();
    const nodes = withAreaResources(systems, model).flatMap((system) => system.components);
    expect(resourceSummary(nodes.find((node) => node.id === 'st:owner-only')!)).toBe(
      'Technology not recorded',
    );
    expect(withAreaResources(systems)).toBe(systems);
    expect(resourcesOf('svc:offers')).toEqual([]);
  });

  it('includes a captured message handler even when no subscription is declared', () => {
    const { model } = fixture();
    expect(resourcesOf('svc:handler-consumer', model)).toContainEqual(
      expect.objectContaining({ id: 'st:changes', use: 'Consumes Offer changed' }),
    );
  });

  it('embeds private stores and the topics one service publishes, never a shared store', () => {
    const { model, systems } = fixture();
    const nodes = withAreaResources(systems, model).flatMap((system) => system.components);
    expect(nodes.find((node) => node.id === 'st:records')?.parentComponent).toBe('svc:offers');
    expect(nodes.find((node) => node.id === 'st:cache')?.parentComponent).toBeUndefined();
    expect(nodes.find((node) => node.id === 'st:changes')?.parentComponent).toBe('svc:offers');
    const privateTopic = derive({
      ...model.plan,
      messages: [
        { id: 'msg:private', name: 'Internal jobs', producer: 'svc:offers', topic: 'st:changes' },
      ],
      handlers: [],
    });

    const privateNodes = withAreaResources(systems, privateTopic).flatMap(
      (system) => system.components,
    );
    expect(privateNodes.find((node) => node.id === 'st:changes')?.parentComponent).toBe(
      'svc:offers',
    );
  });

  it('checks users outside the visible area and never folds a topic into a service that does not own it', () => {
    const { model, systems } = fixture();
    const nodes = withAreaResources(systems.slice(0, 1), model).flatMap(
      (system) => system.components,
    );
    expect(nodes.find((node) => node.id === 'st:cache')?.parentComponent).toBeUndefined();
    expect(nodes.find((node) => node.id === 'st:owner-only')?.parentComponent).toBeUndefined();
    const differentOwner = derive({
      ...model.plan,
      messages: [
        { id: 'msg:other', name: 'Search jobs', producer: 'svc:search', topic: 'st:changes' },
      ],
      handlers: [],
    });
    const topic = withAreaResources(systems, differentOwner)
      .flatMap((system) => system.components)
      .find((node) => node.id === 'st:changes');
    expect(topic?.parentComponent).toBeUndefined();
  });

  it('folds a library-managed topic only with sole-owner writing access, retaining it in the resource list', () => {
    const { model, systems } = fixture();
    const stores = [
      {
        id: 'st:private-bus',
        name: 'Backplane',
        kind: 'topic' as const,
        owner: 'svc:offers',
        access: [{ svc: 'svc:offers', mode: 'readwrite' as const }],
      },
      {
        id: 'st:read-only',
        name: 'External feed',
        kind: 'topic' as const,
        owner: 'svc:offers',
        access: [{ svc: 'svc:offers', mode: 'read' as const }],
      },
      {
        id: 'st:shared-bus',
        name: 'Shared backplane',
        kind: 'topic' as const,
        owner: 'svc:offers',
        access: [
          { svc: 'svc:offers', mode: 'readwrite' as const },
          { svc: 'svc:outside', mode: 'read' as const },
        ],
      },
      { id: 'st:no-access', name: 'Untraced topic', kind: 'topic' as const, owner: 'svc:offers' },
    ];
    const privateModel = derive({ ...model.plan, stores, messages: [], handlers: [] });
    const nodes = withAreaResources(systems, privateModel).flatMap((system) => system.components);
    expect(nodes.find((node) => node.id === 'st:private-bus')?.parentComponent).toBe('svc:offers');
    expect(nodes.find((node) => node.id === 'st:read-only')?.parentComponent).toBeUndefined();
    expect(nodes.find((node) => node.id === 'st:shared-bus')?.parentComponent).toBeUndefined();
    expect(nodes.find((node) => node.id === 'st:no-access')?.parentComponent).toBeUndefined();
    expect(resourcesOf('svc:offers', privateModel)).toContainEqual(
      expect.objectContaining({ id: 'st:private-bus', use: 'Reads and writes' }),
    );
  });
});
