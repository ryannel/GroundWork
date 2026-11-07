import { cp, mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { beforeAll, expect, it, vi } from 'vitest';

import { queryModel } from '@/../test/fixtures/model-queries';
import { indexOf, type ModelIndex } from '@/application/model-index';
import type { ModelSystem } from '@/domain/workspace-model';
import { readModel } from '@/infrastructure/read-model';

import { modelMapQueries } from './model-map-query';

vi.mock(import('server-only'), () => ({}));
let index: ModelIndex;
let queries: ReturnType<typeof modelMapQueries>;
beforeAll(async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'groundwork-map-query-'));
  await cp(path.resolve('test/fixtures/model'), path.join(root, 'model'), { recursive: true });
  const model = await readModel('model-fixture', root);
  if (model === null) throw new Error('Missing fixture.');
  index = indexOf(model);
  queries = modelMapQueries(index);
});
it('finds recorded identities and exact cited files, including persisted evidence locations', () => {
  expect(queries.find('confirm')).toContainEqual(index.get('api:confirm'));
  expect(queries.find('not-recorded-anywhere')).toEqual([]);
  expect(queries.owns('Confirm.ts', 'example/orders')).toContainEqual(index.get('h:confirm'));
  expect(queries.owns('Confirm.ts', 'other/repo')).toEqual([]);
});
it('walks only recorded exchanges with bounded depth and preserves the exact sites and citations', () => {
  const calls = queries.calls('api:confirm', 1);
  expect(calls).toEqual(index.edges().filter((edge) => edge.entry === 'api:confirm'));
  expect(calls).toContainEqual(
    expect.objectContaining({ site: 'h:confirm#tx/save', to: 'st:orders' }),
  );
  expect(queries.callers('api:confirm', 1)).toEqual(index.callers('api:confirm'));
  expect(queries.calls('absent')).toEqual([]);
  expect(queries.callers('absent')).toEqual([]);
  expect(queries.calls('api:confirm', 0)).toEqual([]);
});
it('reports authored homes, repository pins, exchanges and explicit gaps', () => {
  expect(queries.repos().homes).toContainEqual(expect.objectContaining({ id: 'svc:ordering' }));
  expect(queries.repos().repositories).toEqual(
    index.model.evidence.map(({ repository }) => repository),
  );
  expect(queries.markdown()).toContain('sys:ordering');
  expect(queries.markdown()).toContain(index.model.evidence[0]?.repository.commit);
  expect(queries.markdown()).toContain('## Gaps');
});

it('follows the recorded calling entry without joining an unrelated entry in the same component', () => {
  const base = queryModel();
  const model = {
    ...base,
    domains: base.domains.map((domain) => ({
      ...domain,
      systems: domain.systems.map((system): ModelSystem => {
        if (system.id === 'sys:a') {
          return {
            ...system,
            interfaces: [
              ...system.interfaces,
              {
                id: 'if:a-two',
                kind: 'rest' as const,
                component: 'svc:a',
                entries: [{ id: 'api:a-two', method: 'GET', path: '/two' }],
              },
            ],
          };
        }
        if (system.id !== 'sys:b') return system;
        return {
          ...system,
          handlers: [
            {
              id: 'h:b',
              component: 'svc:b',
              on: 'job:b',
              steps: [
                {
                  id: 'other',
                  call: 'api:a-two',
                  cites: base.domains[0]?.systems[0]?.handlers[0]?.cites ?? [],
                },
              ],
            },
          ],
        };
      }),
    })),
  };
  const selectedQueries = modelMapQueries(indexOf(model));
  expect(selectedQueries.callers('api:supplier', 2).map((edge) => edge.site)).toEqual(['h:a#call']);
  expect(selectedQueries.callers('svc:a', 1).some((edge) => edge.site === 'h:b#other')).toBe(true);
});
