import { cp, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, expect, it, vi } from 'vitest';

import { GET } from './route';

vi.mock(import('server-only'), () => ({}));
afterEach(() => vi.unstubAllEnvs());

it('serves the selected native before and after facts with independent progress', async () => {
  const folder = await mkdtemp(path.join(tmpdir(), 'groundwork-native-plan-http-'));
  try {
    await cp('test/fixtures/model', folder, { recursive: true });
    const selected = path.join(folder, 'plans/confirm');
    const file = path.join(selected, 'plan.yaml');
    const original = await readFile(file, 'utf8');
    await writeFile(
      file,
      `${original}
work_items:
  - { id: 'wi:confirm', team: 'team:orders', title: Check confirmation }
`,
    );
    await writeFile(
      path.join(selected, 'progress.yaml'),
      'events:\n  - { subject: "wi:confirm", kind: note, at: "2026-11-07", note: A retained observation }\n',
    );
    vi.stubEnv('GROUNDWORK_WORKSPACES', folder);
    const workspace = 'model-fixture';
    const plan = 'confirm';
    const request = new Request('https://example.test/model-fixture/plans/confirm/plan.json');
    const proposed = await GET(request, { params: Promise.resolve({ workspace, plan }) });
    expect(proposed.status).toBe(200);
    await expect(proposed.json()).resolves.toMatchObject({
      plan: { meta: { title: 'Explain confirmation' } },
      before: { id: workspace },
      after: { id: workspace },
      profile: { lookup: '../../evidence.json?plan=confirm' },
      progress: { events: [{ note: 'A retained observation' }] },
    });
    const missing = await GET(request, { params: Promise.resolve({ workspace, plan: 'missing' }) });
    expect(missing.status).toBe(404);
  } finally {
    await rm(folder, { recursive: true, force: true });
  }
});
