import { cp, mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { beforeAll, describe, expect, it, vi } from 'vitest';

import { systemProviderModel } from '@/../test/fixtures/model-queries';
import {
  entitiesIn,
  modelList,
  type ModelSystem,
  type WorkspaceModel,
} from '@/domain/workspace-model';
import { readModel } from '@/infrastructure/read-model';

import { indexOf } from './model-index';
import { modelCounts, modelMarkdownOf } from './model-map';

vi.mock(import('server-only'), () => ({}));

let root: string;
beforeAll(async () => {
  root = await mkdtemp(path.join(tmpdir(), 'groundwork-index-'));
  await cp(path.resolve('test/fixtures/model'), path.join(root, 'model'), { recursive: true });
});

async function fixture(): Promise<WorkspaceModel> {
  const model = await readModel('model-fixture', root);
  if (model === null) throw new Error('Missing fixture');
  return model;
}

describe('the consolidated model index', () => {
  it('separates placement, cited ownership, team and code homes', async () => {
    const index = indexOf(await fixture());
    expect(index.place('st:unknown-owner')).toEqual({
      workspace: 'model-fixture',
      domain: 'dom:orders',
      system: 'sys:ordering',
      component: 'st:unknown-owner',
    });
    expect(index.resourceOwner('st:unknown-owner')).toBeNull();
    expect(index.resourceOwner('st:orders')).toBe('svc:ordering');
    expect(index.resourceOwner('svc:ordering')).toBeNull();
    expect(index.owningTeam('st:unknown-owner')).toBe('team:orders');
    expect(index.codeHomes('h:confirm#tx/save')).toEqual([
      { key: 'orders', repo: 'example/orders', path: 'apps/ordering' },
    ]);
    expect(index.codeHomes('st:unknown-owner')).toEqual(index.codeHomes('svc:ordering'));
    expect(index.get('svc:old-ordering')?.id).toBe('svc:ordering');
    expect(index.get('api:retired')).toBeNull();
    expect(index.place('absent')).toBeNull();
    expect(index.owningTeam('absent')).toBeNull();
    expect(index.codeHomes('absent')).toEqual([]);
  });
  it('derives execution edges and their reverse queries from actual sites', async () => {
    const index = indexOf(await fixture());
    expect(index.edges('svc:ordering', { direction: 'out', kinds: ['write'] })).toEqual([
      expect.objectContaining({
        to: 'st:orders',
        via: 'sch:order#status',
        site: 'h:confirm#tx/save',
        entry: 'api:confirm',
      }),
    ]);
    expect(index.callers('api:confirm')).toEqual([
      expect.objectContaining({ from: 'app:shop', site: 'h:click#submit' }),
    ]);
    expect(index.producers('msg:confirmed')).toEqual(['svc:ordering']);
    expect(index.consumers('msg:confirmed')).toEqual(['svc:ordering']);
    expect(index.producers('absent')).toEqual([]);
    expect(index.storeAccess('st:orders').map((edge) => edge.kind)).toEqual([
      'read',
      'write',
      'read',
    ]);
    expect(index.edges(undefined, { kinds: ['causes'] })).toEqual([
      expect.objectContaining({
        site: 'h:confirm#deliver/send',
        via: 'h:on-confirmed',
        to: 'svc:ordering',
      }),
    ]);
    expect(index.edges('svc:ordering', { direction: 'in', kinds: ['consume'] })).toEqual([
      expect.objectContaining({ from: 'top:confirmed', via: 'msg:confirmed' }),
    ]);
    expect(index.edges(undefined, { level: 'system' }).every((edge) => edge.from !== edge.to)).toBe(
      true,
    );
    expect(index.edges('sys:ordering', { level: 'system', kinds: ['call'] })).toContainEqual(
      expect.objectContaining({ to: 'ext:payments' }),
    );
  });
  it('derives GraphQL fields through explicit graph composition and handles document aliases', async () => {
    const index = indexOf(await fixture());
    expect(index.fieldsReached('gql:order')).toEqual([
      { field: 'sch:graph-query#order', subgraph: 'sg:orders', component: 'svc:ordering' },
      { field: 'sch:graph-order#id', subgraph: 'sg:orders', component: 'svc:ordering' },
    ]);
    expect(index.fieldsReached('api:confirm')).toEqual([]);
    expect(index.callers('api:order-query')).toEqual([
      expect.objectContaining({ from: 'app:shop', via: 'gql:order' }),
    ]);
    expect(index.flowOf('sub:on-confirmed')?.callers).toEqual([
      expect.objectContaining({ site: 'h:confirm#deliver/send', kind: 'publish' }),
    ]);
    expect(index.edges('app:shop', { kinds: ['call'] })).toContainEqual(
      expect.objectContaining({ to: 'svc:ordering', via: 'gql:order', source: 'operation' }),
    );
  });
  it('retains a source-backed GraphQL document without inventing its client', async () => {
    const original = await fixture();
    const known = indexOf(original);
    const model: WorkspaceModel = {
      ...original,
      domains: original.domains.map((domain) => ({
        ...domain,
        systems: domain.systems.map((system) => ({
          ...system,
          operations: system.operations.map((operation): ModelSystem['operations'][number] => {
            const document = Object.assign({}, operation);
            Reflect.deleteProperty(document, 'component');
            return document;
          }),
        })),
      })),
    };
    const index = indexOf(model);
    expect(index.place('gql:order')?.component).toBeNull();
    expect(index.get('gql:order')?.data.document).toBe('ev:document');
    expect(index.get('ev:document')?.data).toEqual(known.get('ev:document')?.data);
    expect(index.fieldsReached('gql:order')).toEqual(known.fieldsReached('gql:order'));
    expect(index.gaps('gql:order')).toContainEqual({
      id: 'gql:order',
      kind: 'no_client',
      message:
        'The client component is unknown; the cited document does not establish an invocation.',
    });
    expect(index.edges().filter((record) => record.source === 'operation')).toEqual([]);
    expect(index.callers('api:order-query')).toEqual([]);
  });
  it('derives entry roles, flow detail, visible gaps and repository freshness', async () => {
    const index = indexOf(await fixture());
    expect(index.roles('svc:ordering')).toEqual(['api', 'worker', 'job']);
    expect(index.roles('st:orders')).toEqual([]);
    expect(index.entries('app:shop').map((entry) => entry.id)).toEqual(['ui:confirm']);
    expect(index.flowOf('api:confirm')?.handlers.map((handler) => handler.id)).toEqual([
      'h:confirm',
    ]);
    expect(index.flowOf('api:confirm')?.reaches).toContainEqual(
      expect.objectContaining({ site: 'h:confirm#tx/save' }),
    );
    expect(index.flowOf('st:orders')).toBeNull();
    expect(index.gaps('job:unknown')).toContainEqual(
      expect.objectContaining({ kind: 'no_schedule' }),
    );
    expect(index.gaps('st:unknown-owner')).toContainEqual(
      expect.objectContaining({ kind: 'no_owner' }),
    );
    expect(index.gaps('sch:confirm')).toContainEqual(
      expect.objectContaining({ id: 'sch:confirm#unknown', kind: 'no_schema' }),
    );
    expect(index.gaps('api:legacy')).toContainEqual(expect.objectContaining({ kind: 'no_caller' }));
    expect(index.gaps('sys:ordering')).toContainEqual(
      expect.objectContaining({ kind: 'unbacked_connection' }),
    );
    expect(index.freshness('svc:ordering')).toEqual([
      expect.objectContaining({
        repo: 'example/orders',
        commit: 'a'.repeat(40),
        scannedAt: '2026-11-06T00:00:00Z',
      }),
    ]);
    expect(index.freshness('absent')).toEqual([]);
    expect(index.href('h:confirm#tx/save')).toBe(
      '/model-fixture/entries/?id=api%3Aconfirm&step=h%3Aconfirm%23tx%2Fsave',
    );
    expect(index.label('svc:ordering')).toBe('Ordering API');
    expect(index.label('absent')).toBe('absent');
  });
  it('derives counts and MAP.md from the same facts and repository pins', async () => {
    const index = indexOf(await fixture());
    expect(modelCounts(index)).toMatchObject({
      domains: 1,
      systems: 1,
      components: 5,
      handlers: 4,
      evidence: 23,
      edges: 11,
      gaps: 14,
    });
    const markdown = modelMarkdownOf(index);
    expect(markdown).toContain('## Orders (`dom:orders`)');
    expect(markdown).toContain('Confirm orders and arrange delivery.\n\n');
    expect(markdown).toContain('`svc:ordering` Ordering API');
    expect(markdown).toContain(`read at \`${'a'.repeat(40)}\` on 2026-11-06T00:00:00Z`);
    expect(markdown).toContain('No cited resource owner is recorded.');
    expect(markdown).toContain('`h:confirm#tx/save`');
  });

  it('keeps incomplete effects, message shapes and graph composition as gaps', async () => {
    const original = structuredClone(await fixture());
    const field = entitiesIn(original).find((entity) => entity.id === 'sch:graph-query#order');
    if (field === undefined) throw new Error('Missing query field');
    Object.assign(field.data, { subgraphs: [] });
    const domains = original.domains.map((domain) => ({
      ...domain,
      systems: domain.systems.map((system) => ({
        ...system,
        messages: [...system.messages, { id: 'msg:orphan', topic: 'top:confirmed' }],
        handlers: system.handlers.map((handler) =>
          handler.id === 'h:click'
            ? { ...handler, steps: [{ id: 'missing', call: 'api:absent', cites: [] }] }
            : handler,
        ),
      })),
    }));
    const index = indexOf({ ...original, domains });
    expect(index.gaps('h:click')).toContainEqual(
      expect.objectContaining({ kind: 'unmapped_target', reference: 'api:absent' }),
    );
    expect(index.edges('app:shop').some((edge) => edge.to === 'api:absent')).toBe(false);
    expect(index.gaps('msg:orphan').map((gap) => gap.kind)).toEqual(['no_consumer', 'no_schema']);
    expect(index.gaps('gql:order')).toContainEqual(
      expect.objectContaining({ kind: 'unmapped_target', reference: 'sch:graph-query#order' }),
    );
  });
  it('keeps ambiguous homes unknown while retaining explicitly selected component homes', async () => {
    const original = await fixture();
    const domains = original.domains.map((domain) => ({
      ...domain,
      systems: domain.systems.map((system) => ({
        ...system,
        homes: { ...system.homes, second: { repo: 'example/other' } },
      })),
    }));
    const index = indexOf({ ...original, domains });
    expect(index.codeHomes('st:unknown-owner')).toEqual([]);
    expect(index.codeHomes('svc:ordering')).toEqual([
      { key: 'orders', repo: 'example/orders', path: 'apps/ordering' },
    ]);
    expect(index.codeHomes('sys:ordering')).toHaveLength(2);
    expect(index.href('dom:orders')).toBe('/model-fixture/orders/');
    expect(index.href('sys:ordering')).toBe('/model-fixture/orders/ordering/');
    expect(index.href('absent')).toBe('/model-fixture/things/?id=absent');
    expect(index.href('model-fixture')).toBe('/model-fixture/');
    expect(index.cites('h:confirm#missing/known')).toEqual([
      expect.objectContaining({ path: 'apps/ordering/src/Confirm.ts' }),
    ]);
  });

  it('resolves aliases in execution references and placement without rewriting authored data', async () => {
    const original = structuredClone(await fixture());
    const handler = entitiesIn(original).find((entity) => entity.id === 'h:click');
    const step = entitiesIn(original).find((entity) => entity.id === 'h:click#submit');
    if (handler === undefined || step === undefined) throw new Error('Missing click handler');
    Object.assign(handler.data, { component: 'app:old-shop' });
    Object.assign(step.data, { call: 'api:old-confirm' });
    const index = indexOf({
      ...original,
      aliases: {
        ...original.aliases,
        'app:old-shop': { to: 'app:shop' },
        'api:old-confirm': { to: 'api:confirm' },
      },
    });
    expect(index.place('h:click#submit')?.component).toBe('app:shop');
    expect(index.callers('api:old-confirm')).toEqual([
      expect.objectContaining({ from: 'app:shop', via: 'api:confirm' }),
    ]);
    expect(index.roles('svc:old-ordering')).toEqual(['api', 'worker', 'job']);
    expect(index.entries('svc:old-ordering').map((entry) => entry.id)).toEqual(
      index.entries('svc:ordering').map((entry) => entry.id),
    );
    expect(step.data.call).toBe('api:old-confirm');
  });
  it('retains both providers during progressive overrides and only the active provider at either end', async () => {
    const original = await fixture();
    for (const [percent, expected] of [
      [0, ['sg:old']],
      [25, ['sg:orders', 'sg:old']],
      [100, ['sg:orders']],
    ] as const) {
      const changed = structuredClone(original);
      const field = entitiesIn(changed).find((entity) => entity.id === 'sch:graph-query#order');
      const graph = changed.graphs[0];
      if (field === undefined || graph === undefined) throw new Error('Missing graph fixture');
      Object.assign(field.data, { override: { from: 'sg:old', percent } });
      Object.assign(graph, {
        subgraphs: [
          ...(graph.subgraphs ?? []),
          { id: 'sg:old', graph: graph.id, component: 'app:shop' },
        ],
      });
      const index = indexOf(changed);
      expect(
        index
          .fieldsReached('gql:order')
          .filter((reach) => reach.field === field.id)
          .map((reach) => reach.subgraph),
      ).toEqual(expected);
    }
  });

  it('follows required fields and avoids an extra resolver when an ancestor provides the selected value', async () => {
    const changed = structuredClone(await fixture());
    const entities = entitiesIn(changed);
    const query = entities.find((entity) => entity.id === 'sch:graph-query#order');
    const id = entities.find((entity) => entity.id === 'sch:graph-order#id');
    const type = entities.find((entity) => entity.id === 'sch:graph-order');
    const graph = changed.graphs[0];
    if (query === undefined || id === undefined || type === undefined || graph === undefined) {
      throw new Error('Missing composition fixture');
    }
    Object.assign(graph, {
      subgraphs: [
        ...(graph.subgraphs ?? []),
        { id: 'sg:details', graph: graph.id, component: 'app:shop' },
      ],
    });
    Object.assign(type.data, {
      fields: [
        ...modelList(type.data.fields),
        { id: 'audit', name: 'audit', type: 'String', subgraphs: ['sg:details'] },
      ],
    });
    Object.assign(id.data, { subgraphs: ['sg:details'], requires: ['sch:graph-order#audit'] });
    const required = indexOf(changed);
    expect(required.fieldsReached('gql:order')).toContainEqual({
      field: 'sch:graph-order#audit',
      subgraph: 'sg:details',
      component: 'app:shop',
    });
    expect(required.edges('svc:ordering', { kinds: ['call'] })).toContainEqual(
      expect.objectContaining({ to: 'app:shop', via: 'gql:order' }),
    );
    Object.assign(query.data, { provides: ['sch:graph-order#id'] });
    const supplied = indexOf(changed);
    expect(supplied.fieldsReached('gql:order')).toEqual([
      { field: 'sch:graph-query#order', subgraph: 'sg:orders', component: 'svc:ordering' },
      { field: 'sch:graph-order#id', subgraph: 'sg:orders', component: 'svc:ordering' },
    ]);
    expect(supplied.fieldsReached('gql:order')).toBe(supplied.fieldsReached('gql:order'));
  });
  it('reports unresolved selected paths, missing requirements and cycles in composition', async () => {
    const changed = structuredClone(await fixture());
    const entities = entitiesIn(changed);
    const field = entities.find((entity) => entity.id === 'sch:graph-order#id');
    const document = entities.find((entity) => entity.id === 'ev:document');
    if (field === undefined || document === undefined) throw new Error('Missing graph fixture');
    Object.assign(field.data, { requires: ['sch:absent#key', 'sch:graph-order#id'] });
    Object.assign(document.data, {
      selections: [
        { path: 'order', field_name: 'order' },
        { path: 'order.id', field_name: 'id' },
        { path: 'order.missing', field_name: 'missing' },
      ],
    });
    const index = indexOf(changed);
    expect(index.gaps('gql:order')).toContainEqual(
      expect.objectContaining({ reference: 'order.missing', kind: 'unmapped_target' }),
    );
    expect(index.gaps('gql:order')).toContainEqual(
      expect.objectContaining({ reference: 'sch:absent#key', kind: 'unmapped_target' }),
    );
    expect(index.gaps('gql:order')).toContainEqual(
      expect.objectContaining({ reference: 'sch:graph-order#id', kind: 'cyclic_composition' }),
    );
    expect(index.fieldsReached('gql:order')).toHaveLength(2);
  });

  it('rejects duplicate identities and relationships that duplicate execution detail', async () => {
    const model = await fixture();
    expect(() =>
      indexOf({
        ...model,
        actors: [...(model.actors ?? []), { id: 'svc:ordering', name: 'Duplicate' }],
      }),
    ).toThrow('Duplicate model id');
    const domains = model.domains.map((domain) => ({
      ...domain,
      systems: domain.systems.map((system) => ({
        ...system,
        relationships: [
          {
            id: 'rel:duplicate',
            from: 'svc:ordering',
            to: 'ext:payments',
            kind: 'call' as const,
            says: 'Duplicate',
            reason: 'Test duplicate',
            cites: [{ kind: 'evidence' as const, id: 'ev:source' }],
          },
        ],
      })),
    }));
    expect(() => indexOf({ ...model, domains })).toThrow(
      'duplicates recorded handler or operation detail',
    );
  });
});

it('keeps a known system-level API boundary separate from an unknown implementing component', () => {
  const model = systemProviderModel();
  const index = indexOf(model);
  expect(index.edges('svc:a', { kinds: ['call'] })).toContainEqual(
    expect.objectContaining({
      to: 'sys:unmapped',
      via: 'api:unmapped-api',
      site: 'h:a#call-unmapped',
    }),
  );
  expect(index.gaps('if:unmapped-api')).toContainEqual(
    expect.objectContaining({
      id: 'api:unmapped-api',
      kind: 'unmapped_target',
      reference: 'sys:unmapped',
    }),
  );
  expect(index.get('if:unmapped-api')?.place).toEqual({
    workspace: 'queries',
    domain: 'dom:queries',
    system: 'sys:a',
    component: null,
  });
  expect(index.get('api:unmapped-api')?.place.component).toBeNull();
  expect(index.roles('sys:unmapped')).toEqual([]);
  expect(index.entries('sys:unmapped')).toEqual([]);
  expect(index.callers('api:unmapped-api')).toHaveLength(1);
  expect(index.edges('sys:unmapped', { direction: 'in', kinds: ['call'] })).toContainEqual(
    expect.objectContaining({ from: 'svc:a', via: 'api:unmapped-api' }),
  );
  expect(index.edges('sys:a', { level: 'system', kinds: ['call'] })).toContainEqual(
    expect.objectContaining({ to: 'sys:unmapped', via: 'api:unmapped-api' }),
  );
  expect(index.cites('api:unmapped-api')).toEqual(
    model.domains[0]?.systems[0]?.interfaces.at(-1)?.cites,
  );
});
