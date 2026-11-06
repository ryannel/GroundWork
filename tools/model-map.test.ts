import path from 'node:path';

import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { indexOf, type ModelIndex } from '@/application/model-index';
import { readModel } from '@/infrastructure/read-model';

import { modelMapOf } from './model-map';

vi.mock(import('server-only'), () => ({}));

let index: ModelIndex;
let map: ReturnType<typeof modelMapOf>;
beforeAll(async () => {
  vi.stubEnv('GROUNDWORK_WORKSPACES', path.resolve('test/fixtures/model'));
  const model = await readModel('model-fixture');
  if (model === null) throw new Error('Missing canonical fixture');
  index = indexOf(model);
  map = modelMapOf(index);
});
afterAll(() => vi.unstubAllEnvs());

describe('ordinary canonical map inspection', () => {
  it('resolves every indexed identity once in process, including evidence and nested facts', () => {
    const shown = index.entities.map((node) => map.show(node.id)?.fact.id);
    expect(shown).toEqual(index.entities.map((node) => node.id));
    expect(new Set(shown).size).toBe(index.entities.length);
    for (const node of index.entities) expect(map.show(node.id)?.gaps).toEqual(index.gaps(node.id));
    expect(map.show('ev:effect')?.fact.kind).toBe('evidence');
  });
  it('returns exact execution sites, reverse calls, citations and visible gaps', () => {
    const endpoint = map.show('api:confirm');
    expect(endpoint?.handlers).toContain('h:confirm');
    expect(endpoint?.out).toContainEqual(
      expect.objectContaining({ site: 'h:confirm#tx/save', kind: 'write' }),
    );
    expect(endpoint?.in).toContainEqual(
      expect.objectContaining({ via: 'api:confirm', from: 'app:shop' }),
    );
    const step = map.show('h:confirm#tx/save');
    expect(step?.fact.data.id).toBe('save');
    expect(step?.out).toEqual([expect.objectContaining({ kind: 'write', to: 'st:orders' })]);
    expect(step?.sources).not.toHaveLength(0);
    expect(step?.href).toContain('step=h%3Aconfirm%23tx%2Fsave');
    expect(map.show('sys:ordering')?.gaps).toContainEqual(
      expect.objectContaining({ kind: 'unbacked_connection' }),
    );
  });
  it('resolves aliases through the index and keeps missing identities absent', () => {
    expect(map.show('svc:old-ordering')?.fact.id).toBe('svc:ordering');
    expect(map.show('absent')).toBeUndefined();
    expect(map.show('api:retired')).toBeUndefined();
  });
});
