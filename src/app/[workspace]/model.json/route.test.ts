import path from 'node:path';

import { afterEach, expect, it, vi } from 'vitest';

import { GET } from './route';

vi.mock(import('server-only'), () => ({}));
afterEach(() => vi.unstubAllEnvs());

it('serves the current native facts and their evidence lookup', async () => {
  vi.stubEnv('GROUNDWORK_WORKSPACES', path.resolve('test/fixtures/model'));
  const workspace = 'model-fixture';
  const request = new Request('https://example.test/model-fixture/model.json');
  const current = await GET(request, { params: Promise.resolve({ workspace }) });
  expect(current.status).toBe(200);
  await expect(current.json()).resolves.toMatchObject({
    model: { id: workspace },
    profile: { kind: 'authored-evidence-closure', lookup: 'evidence.json' },
  });
});
