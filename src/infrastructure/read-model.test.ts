import { cp, mkdtemp, readFile, rename, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { entitiesIn } from '@/domain/workspace-model';

import { readModel } from './read-model';

vi.mock(import('server-only'), () => ({}));

let root: string;
let folder: string;
beforeEach(async () => {
  root = await mkdtemp(path.join(tmpdir(), 'groundwork-model-'));
  folder = path.join(root, 'model');
  await cp(path.resolve('test/fixtures/model'), folder, { recursive: true });
});

describe('the consolidated workspace reader', () => {
  it('loads every authored facet and evidence family into serialisable data', async () => {
    const model = await readModel('model-fixture', root);
    expect(model).not.toBeNull();
    expect(model?.problems).toEqual([]);
    expect(model?.evidence[0]?.records).toHaveLength(23);
    expect(model?.domains[0]?.systems[0]?.handlers).toHaveLength(4);
    expect(model?.domains[0]?.target?.shifts?.[0]?.cites).toEqual(['sys:ordering']);
    const text = JSON.stringify(model);
    const parsed: unknown = JSON.parse(text);
    expect(parsed).toEqual(model);
    const system = model?.domains[0]?.systems[0];
    expect(
      system?.components.find((component) => component.id === 'st:unknown-owner'),
    ).not.toHaveProperty('owner');
    expect(system?.jobs.find((job) => job.id === 'job:unknown')).not.toHaveProperty('every');
    expect(system?.handlers[0]?.steps[0]?.cites).toEqual([
      {
        kind: 'code',
        repo: 'example/orders',
        commit: 'a'.repeat(40),
        path: 'apps/ordering/src/Confirm.ts',
        lines: [5, 7],
      },
    ]);
  });
  it('indexes declared nested identities without deriving them from labels or positions', async () => {
    const model = await readModel('model-fixture', root);
    if (model === null) throw new Error('Missing registered fixture');
    const entities = entitiesIn(model);
    const nested = entities.find((entity) => entity.id === 'h:confirm#tx/save');
    expect(nested).toMatchObject({
      parent: 'h:confirm#tx',
      place: { domain: 'dom:orders', system: 'sys:ordering', component: 'svc:ordering' },
    });
    expect(entities.find((entity) => entity.id === 'h:confirm#!db-down')?.kind).toBe('failure');
    expect(entities.find((entity) => entity.id === 'sch:order#status')?.place).toMatchObject({
      system: 'sys:ordering',
      component: 'st:orders',
    });
    expect(entities.find((entity) => entity.id === 'scr:checkout#confirm')?.kind).toBe('region');
    expect(entities.find((entity) => entity.id === 'api:confirm')?.parent).toBe('if:orders');
    expect(new Set(entities.map((entity) => entity.id)).size).toBe(entities.length);
  });
  it('retains the same object until authored data or evidence changes', async () => {
    const first = await readModel('model-fixture', root);
    await expect(readModel('model-fixture', root)).resolves.toBe(first);
    const file = path.join(folder, 'evidence/example/orders/repository.json');
    const before = await readFile(file, 'utf8');
    await writeFile(file, before.replace('a'.repeat(40), 'c'.repeat(40)));
    const after = await readModel('model-fixture', root);
    expect(after).not.toBe(first);
    expect(after?.domains[0]?.systems[0]?.handlers[0]?.steps[0]?.cites).toEqual([
      expect.objectContaining({ commit: 'c'.repeat(40) }),
    ]);
  });
  it('keeps an unresolved home as a visible gap and reports relative source paths', async () => {
    const file = path.join(folder, 'domains/orders/systems/ordering/handlers/ordering.yaml');
    const before = await readFile(file, 'utf8');
    await writeFile(file, before.replace('orders:src/Confirm.ts', 'missing:src/Confirm.ts'));
    const model = await readModel('model-fixture', root);
    expect(model?.problems).toContainEqual(
      expect.objectContaining({
        id: 'h:confirm',
        kind: 'unresolved_cite',
        reference: 'missing:src/Confirm.ts#L1-80',
      }),
    );
    const gap = model?.problems.find((problem) => problem.id === 'h:confirm');
    expect(gap?.at).toContain('domains/orders/systems/ordering/handlers/ordering.yaml:');
    expect(JSON.stringify(model?.problems)).not.toContain(root);
  });
  it('rejects duplicate evidence before it can select an arbitrary record or pin', async () => {
    const file = path.join(folder, 'evidence/example/orders/bindings.jsonl');
    const text = await readFile(file, 'utf8');
    await writeFile(file, text.replace('ev:document', 'ev:source'));
    await expect(readModel('model-fixture', root)).rejects.toThrow(
      'Duplicate evidence id: ev:source',
    );
  });
  it('refuses evidence records with no repository metadata rather than guessing their pin', async () => {
    const file = path.join(folder, 'evidence/example/orders/repository.json');
    await rename(file, `${file}.unavailable`);
    await expect(readModel('model-fixture', root)).rejects.toThrow(
      'evidence records need repository.json',
    );
  });
  it('returns null only for an unregistered id and rejects invalid authored facts', async () => {
    await expect(readModel('absent', root)).resolves.toBeNull();
    const file = path.join(folder, 'domains/orders/systems/ordering/system.yaml');
    const before = await readFile(file, 'utf8');
    await writeFile(file, before.replace('kind: service', 'kind: job'));
    await expect(readModel('model-fixture', root)).rejects.toThrow('system.yaml');
  });
});
