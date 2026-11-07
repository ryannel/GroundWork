import { expect, it, vi } from 'vitest';

import { queryModel } from '@/../test/fixtures/model-queries';
import type { WorkspaceModel } from '@/domain/workspace-model';

import { modelValidator } from './model-schema';
import { validateModel } from './validate-model';

vi.mock(import('server-only'), () => ({}));

const operation = { id: 'gql:document', graph: 'graph:a', document: 'ev:document' };

function withClient(component: string): WorkspaceModel {
  const model = queryModel();
  return {
    ...model,
    domains: model.domains.map((domain) => ({
      ...domain,
      systems: domain.systems.map((system) => ({
        ...system,
        connections: [],
        operations: system.id === 'sys:a' ? [{ ...operation, component }] : [],
      })),
    })),
  };
}

it('permits an unknown client while keeping document, graph and supplied-client syntax strict', async () => {
  const check = await modelValidator('workspace', 'Operation');
  expect(check(operation)).toBe(true);
  expect(check({ ...operation, component: 'svc:a' })).toBe(true);
  expect(check({ ...operation, component: null })).toBe(false);
  expect(check({ ...operation, component: 'sys:a' })).toBe(false);
  expect(check({ ...operation, component: 'ext:supplier' })).toBe(false);
  expect(check({ id: operation.id, graph: operation.graph })).toBe(false);
  expect(check({ id: operation.id, document: operation.document })).toBe(false);
  expect(check({ ...operation, document: 'query Raw { value }' })).toBe(false);
});

it('accepts a supplied declared executable client', async () => {
  const problems = await validateModel(withClient('svc:a'));
  expect(problems).toEqual([]);
});

it('rejects a missing supplied client and an alias to a non-executable entity', async () => {
  const missing = await validateModel(withClient('svc:missing'));
  const wrongKind = await validateModel({
    ...withClient('svc:pretend'),
    aliases: { 'svc:pretend': { to: 'ext:supplier' } },
  });
  const expected = [
    {
      at: 'gql:document/component',
      message: 'A supplied operation client must reference a declared executable component.',
    },
  ];
  expect(missing).toEqual(expected);
  expect(wrongKind).toEqual(expected);
});
