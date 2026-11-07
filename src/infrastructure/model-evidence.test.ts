import { cp, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { expect, it, vi } from 'vitest';

import { runModelPlanBase } from '@/../tools/model-plan-base';

import { readModelEvidence } from './model-evidence';

vi.mock(import('server-only'), () => ({}));

it('resolves current evidence and keeps unknown requested plan/revision scopes absent', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'groundwork-evidence-scope-'));
  const folder = path.join(root, 'model');
  await cp(path.resolve('test/fixtures/model'), folder, { recursive: true });
  const current = await readModelEvidence('model-fixture', 'ev:effect', undefined, root);
  expect(current?.view.sources[0]?.href).toContain('a'.repeat(40));
  await expect(
    readModelEvidence('model-fixture', 'ev:missing', undefined, root),
  ).resolves.toBeNull();
  await expect(
    readModelEvidence('model-fixture', 'ev:effect', { plan: 'missing' }, root),
  ).resolves.toBeNull();
  await expect(
    readModelEvidence('model-fixture', 'ev:effect', { plan: 'confirm', version: 'missing' }, root),
  ).resolves.toBeNull();
  await runModelPlanBase('land', 'model-fixture', 'confirm', root);
  const pin = path.join(folder, 'evidence/example/orders/repository.json');
  const text = await readFile(pin, 'utf8');
  await writeFile(pin, text.replace('a'.repeat(40), 'c'.repeat(40)));
  const now = await readModelEvidence('model-fixture', 'ev:effect', undefined, root);
  const frozen = await readModelEvidence('model-fixture', 'ev:effect', { plan: 'confirm' }, root);
  expect(now?.view.sources[0]?.href).toContain('c'.repeat(40));
  expect(frozen?.view.sources[0]?.href).toContain('a'.repeat(40));
  expect(frozen?.raw).toEqual(current?.raw);
});
