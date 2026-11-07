import { cp, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { expect, it, vi } from 'vitest';

import { readCanonicalModelIndex, readModelIndex } from './model-index';
import { readModel } from './read-model';

vi.mock(import('server-only'), () => ({}));

it('shares the loaded model and its index, and refreshes both when cited evidence changes', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'groundwork-index-'));
  const folder = path.join(root, 'model');
  await cp(path.resolve('test/fixtures/model'), folder, { recursive: true });
  const first = await readModelIndex('model-fixture', root);
  expect(first).not.toBeNull();
  await expect(readModelIndex('model-fixture', root)).resolves.toBe(first);
  await expect(readCanonicalModelIndex('model-fixture', root)).resolves.toBe(first);
  await expect(readModel('model-fixture', root)).resolves.toBe(first?.model);
  expect(first?.place('h:confirm#tx/save')?.system).toBe('sys:ordering');
  const pin = path.join(folder, 'evidence/example/orders/repository.json');
  const before = await readFile(pin, 'utf8');
  await writeFile(pin, before.replace('a'.repeat(40), 'c'.repeat(40)));
  const changed = await readModelIndex('model-fixture', root);
  expect(changed).not.toBe(first);
  expect(changed?.cites('h:confirm#tx/save')).toContainEqual(
    expect.objectContaining({ commit: 'c'.repeat(40) }),
  );
  await expect(readModelIndex('absent', root)).resolves.toBeNull();
});
