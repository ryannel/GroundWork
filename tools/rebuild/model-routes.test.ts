import { cp, mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, expect, it, vi } from 'vitest';

import { readModelIndex } from '@/infrastructure/model-index';
import { readModelPlanEntries } from '@/infrastructure/model-plans';

import { captureFacts } from './facts';
import { selectedModelRoutes } from './model-routes';
import { selectedRoutes } from './routes';
import { readSnapshot } from './snapshots';

vi.mock(import('server-only'), () => ({}));
afterEach(() => vi.unstubAllEnvs());

it('discovers native routes and captures facts without entering the legacy origin-requiring reader', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'groundwork-native-routes-'));
  const folder = path.join(root, 'model');
  await cp(path.resolve('test/fixtures/model'), folder, { recursive: true });
  vi.stubEnv('GROUNDWORK_WORKSPACES', folder);
  const routes = await selectedRoutes('model-fixture');
  expect(routes).toContain('/model-fixture/orders/map/');
  expect(routes).toContain('/model-fixture/areas/orders/map.json');
  expect(routes).toContain('/model-fixture/plans/confirm/plan.json');
  expect(routes).toContain('/model-fixture/model.json');
  expect(routes.some((route) => route.includes('version=before'))).toBe(true);
  expect(routes.some((route) => route.includes('version=after'))).toBe(true);
  const out = path.join(root, 'facts');
  const files = await captureFacts('model-fixture', out);
  expect(files).toContain('facts.json.gz');
  const facts = await readSnapshot(out, 'facts.json.gz');
  expect(facts).toHaveProperty('format', 2);
  expect(facts).toHaveProperty('plans.0.slug', 'confirm');
  const current = await readModelIndex('model-fixture');
  if (current === null) throw new Error('Missing fixture.');
  const plans = await readModelPlanEntries('model-fixture');
  const withRevision = selectedModelRoutes(current, plans, new Map([['confirm', ['1.0']]]));
  expect(withRevision).toContain('/model-fixture/plans/confirm/revisions/1.0/plan.json');
});
