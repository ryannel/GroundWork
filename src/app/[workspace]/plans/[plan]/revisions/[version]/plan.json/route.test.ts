import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, expect, it, vi } from 'vitest';

import { GET } from './route';

vi.mock(import('server-only'), () => ({}));
afterEach(() => vi.unstubAllEnvs());

it('serves the saved native before and after facts with their versioned evidence lookup', async () => {
  const folder = await mkdtemp(path.join(tmpdir(), 'groundwork-native-revision-http-'));
  try {
    await cp('test/fixtures/model', folder, { recursive: true });
    const selected = path.join(folder, 'plans/confirm');
    await mkdir(path.join(selected, 'revisions'));
    const original = await readFile(path.join(selected, 'plan.yaml'), 'utf8');
    await writeFile(
      path.join(selected, 'revisions/1.0.yaml'),
      original.replace('title: Explain confirmation', 'title: Archived confirmation'),
    );
    vi.stubEnv('GROUNDWORK_WORKSPACES', folder);
    const workspace = 'model-fixture';
    const plan = 'confirm';
    const request = new Request(
      'https://example.test/model-fixture/plans/confirm/revisions/1.0/plan.json',
    );
    const saved = await GET(request, {
      params: Promise.resolve({ workspace, plan, version: '1.0' }),
    });
    expect(saved.status).toBe(200);
    await expect(saved.json()).resolves.toMatchObject({
      plan: { meta: { title: 'Archived confirmation' } },
      before: { id: workspace },
      after: { id: workspace },
      profile: { lookup: '../../../../evidence.json?plan=confirm&version=1.0' },
    });
    const missing = await GET(request, {
      params: Promise.resolve({ workspace, plan, version: 'missing' }),
    });
    expect(missing.status).toBe(404);
  } finally {
    await rm(folder, { recursive: true, force: true });
  }
});
