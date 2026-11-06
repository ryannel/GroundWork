import { cp, mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { beforeAll, describe, expect, it, vi } from 'vitest';

import { emptyQueryModel, queryModel } from '@/../test/fixtures/model-queries';
import { entitiesIn, type WorkspaceModel } from '@/domain/workspace-model';
import { readModel } from '@/infrastructure/read-model';

import { legacyLosses, legacyViewOf } from './legacy-view';

vi.mock(import('server-only'), () => ({}));
let model: WorkspaceModel;
beforeAll(async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'groundwork-carrier-'));
  await cp(path.resolve('test/fixtures/model'), path.join(root, 'model'), { recursive: true });
  const loaded = await readModel('model-fixture', root);
  if (loaded === null) throw new Error('Missing fixture');
  model = loaded;
});

describe('the named legacy compatibility boundary', () => {
  it('retains every canonical field in its containing workspace, domain or system', () => {
    const { workspace, losses, model: legacy } = legacyViewOf(model);
    expect(losses).toEqual([]);
    expect(workspace).toMatchObject({
      id: 'model-fixture',
      isPrivate: false,
      description: model.description,
    });
    expect(workspace.teams[0]).toMatchObject({
      colour: 4,
      channel: null,
      contacts: [{ name: 'Fixture author', role: null }],
    });
    expect(workspace.actors[0]).toMatchObject({
      customer: true,
      summary: null,
      uses: ['app:shop'],
    });
    const system = workspace.domains[0]?.systems[0];
    expect(system).toMatchObject({
      id: 'ordering',
      modelId: 'sys:ordering',
      team: 'team:orders',
      runsOn: 'platform',
      repos: [{ repo: 'example/orders', path: 'apps/ordering' }],
    });
    expect(system?.handlers).toEqual(model.domains[0]?.systems[0]?.handlers);
    expect(system?.modelNarratives).toEqual(model.domains[0]?.systems[0]?.narratives);
    expect(system?.components.map((component) => component.type)).toEqual([
      'service',
      'website',
      'database',
      'database',
      'queue',
    ]);
    expect(
      legacy.asIs.services.map((service) => [service.id, service.kind, service.system]),
    ).toEqual([
      ['svc:ordering', 'service', 'sys:ordering'],
      ['app:shop', 'ui', 'sys:ordering'],
    ]);
    expect(legacy.asIs.get('st:unknown-owner')).not.toHaveProperty('owner');
    expect(legacy.asIs.get('st:orders')).toMatchObject({
      owner: 'svc:ordering',
      kind: 'database',
      tech: 'PostgreSQL',
    });
    expect(legacy.asIs.get('api:confirm')).toMatchObject({
      sig: 'POST /orders/{id}/confirm',
      request: 'sch:confirm',
      response: 'sch:order',
    });
    expect(legacy.asIs.get('api:grpc-confirm')).toMatchObject({ sig: 'fixture.Ordering/Confirm' });
    expect(legacy.asIs.get('api:order-query')).toMatchObject({ sig: 'order(id: ID!): Order' });
    expect(legacy.asIs.get('api:legacy')).toMatchObject({ sig: 'GET legacy free words' });
    expect(legacy.asIs.get('sch:confirm#unknown')).toMatchObject({ type: 'Unknown' });
    expect(legacy.asIs.get('sch:confirm#lines')).toMatchObject({ type: '{"array":"sch:line"}' });
    expect(legacy.asIs.get('sch:order#status')).toMatchObject({ type: 'string' });
    expect(legacy.place('st:unknown-owner')?.system).toBe('sys:ordering');
    expect(system?.interfaces.find((entry) => entry.id === 'if:payments')?.kind).toBe('sdk');
  });
  it('retains optional metadata and unsupported legacy forms without inventing a database or a service owner', () => {
    const empty = legacyViewOf({
      ...emptyQueryModel(),
      private: true,
      actors: [{ id: 'actor:unknown', name: 'Unknown' }],
    });
    expect(empty.losses).toEqual([]);
    expect(empty.workspace).toMatchObject({
      isPrivate: true,
      description: null,
      teams: [],
      actors: [{ summary: null, uses: [], customer: false }],
    });
    const source = queryModel();
    const store = entitiesIn(source).find((entity) => entity.id === 'st:remote');
    if (store === undefined) throw new Error('Missing store');
    Object.assign(store.data, { form: 'vector', does: 'Stores vectors' });
    const legacy = legacyViewOf(source);
    expect(legacy.losses).toEqual([]);
    expect(legacy.model.asIs.get('st:remote')).toBeUndefined();
    expect(
      legacy.workspace.domains[0]?.systems[1]?.components.find(
        (component) => component.id === 'st:remote',
      ),
    ).toMatchObject({ form: 'vector', does: 'Stores vectors', talksTo: [] });
    expect(legacy.workspace.domains[0]?.systems[0]).toMatchObject({
      runsOn: null,
      repos: [{ repo: 'fixture/a', path: null }],
    });
  });

  it('reports missing, changed and truncated values rather than assuming that spread retained them', () => {
    expect(legacyLosses({ a: { b: true } }, { a: { b: false } })).toEqual([
      { path: '/a/b', message: 'The legacy carrier did not retain this value.' },
    ]);
    expect(legacyLosses({ a: {} }, {})).toEqual([
      { path: '/a', message: 'The legacy carrier did not retain this object.' },
    ]);
    expect(legacyLosses([1], [])).toEqual([
      { path: '', message: 'The legacy carrier changed a collection.' },
    ]);
    expect(legacyLosses([1], null)).toHaveLength(1);
    expect(
      legacyLosses({ id: 'sys:original' }, { id: 'wrong', modelId: 'sys:other' }),
    ).toHaveLength(1);
    expect(legacyLosses(null, null)).toEqual([]);
  });
});
