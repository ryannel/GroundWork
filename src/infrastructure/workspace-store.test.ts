import { rm } from 'node:fs/promises';
import path from 'node:path';

import { afterAll, describe, expect, it, vi } from 'vitest';

import { acmeFiles, tempDir, writeWorkspace } from '@/../test/workspace-kit';
import { componentsOf, systemsOf } from '@/domain/workspace';

import { readWorkspaces } from './workspace-store';

vi.mock(import('server-only'), () => ({}));

const root = await tempDir('workspace-store-');
afterAll(async () => rm(root, { recursive: true, force: true }));
await writeWorkspace(path.join(root, 'acme'), acmeFiles());
await writeWorkspace(path.join(root, 'notes'), {
  'workspace.yaml': { format: 1, id: 'notes', name: 'Notes', private: true },
});

describe('readWorkspaces', () => {
  it('reads every workspace in the folder and its whole tree', async () => {
    const workspaces = await readWorkspaces(root);
    expect(workspaces.map(({ id }) => id).toSorted((a, b) => a.localeCompare(b))).toEqual([
      'acme',
      'notes',
    ]);
    const acme = workspaces.find((workspace) => workspace.id === 'acme');
    expect(acme?.domains.map((domain) => domain.id)).toEqual(['catalogue', 'orders', 'storefront']);
    expect(systemsOf(acme!).map(({ id }) => id)).toEqual([
      'products',
      'search',
      'ordering',
      'payments',
      'accounts',
      'shop',
    ]);
    expect(componentsOf(acme!).length).toBeGreaterThan(6);
  });

  it('marks a private workspace', async () => {
    const workspaces = await readWorkspaces(root);
    expect(workspaces.find((workspace) => workspace.id === 'notes')?.isPrivate).toBe(true);
    expect(workspaces.find((workspace) => workspace.id === 'acme')?.isPrivate).toBe(false);
  });
});
