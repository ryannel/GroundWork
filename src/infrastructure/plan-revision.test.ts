import { rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { afterAll, describe, expect, it, vi } from 'vitest';

import { tempDir } from '@/../test/workspace-kit';

import { planRevision } from './plan-revision';
import { workspaceFolders } from './workspace-folders';
import { readLoadedPlan } from './workspace-plans';

vi.mock(import('server-only'), () => ({}));
vi.mock(import('./workspace-folders'), () => ({
  workspaceFolders: vi.fn<typeof workspaceFolders>(),
}));
vi.mock(import('./workspace-plans'), () => ({ readLoadedPlan: vi.fn<typeof readLoadedPlan>() }));

const root = await tempDir('plan-revision-');
afterAll(async () => rm(root, { recursive: true, force: true }));
vi.mocked(workspaceFolders).mockResolvedValue(new Map([['acme', root]]));

describe('revision freshness', () => {
  it('checks again after an edit, including plans that had no ledger', async () => {
    vi.mocked(readLoadedPlan).mockResolvedValue(null);
    await expect(planRevision('acme', 'new-ledger')).resolves.toBeNull();
    await expect(planRevision('acme', 'new-ledger')).resolves.toBeNull();
    expect(readLoadedPlan).toHaveBeenCalledTimes(1);
    await writeFile(path.join(root, 'plan.yaml'), 'updated ledger');
    await expect(planRevision('acme', 'new-ledger')).resolves.toBeNull();
    expect(readLoadedPlan).toHaveBeenCalledTimes(2);
  });

  it('recovers from a failed read without needing a file edit', async () => {
    vi.mocked(readLoadedPlan).mockRejectedValueOnce(new Error('temporary read failure'));
    await expect(planRevision('acme', 'retry')).rejects.toThrow('temporary read failure');
    await expect(planRevision('acme', 'retry')).resolves.toBeNull();
  });
});
