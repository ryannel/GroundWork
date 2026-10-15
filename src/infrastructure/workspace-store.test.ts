import path from 'node:path';

import { describe, expect, it, vi } from 'vitest';

import { componentsOf, systemsOf } from '@/domain/workspace';

import { readWorkspaces } from './workspace-store';

vi.mock('server-only', () => ({}));

const root = path.resolve(import.meta.dirname, '../../workspaces');

describe('readWorkspaces', () => {
  it('reads every workspace in the repo and its whole tree', async () => {
    const workspaces = await readWorkspaces(root);
    const alder = workspaces.find((workspace) => workspace.id === 'alder-finch');
    expect(alder?.domains.map((domain) => domain.id)).toEqual([
      'commercial-backbone',
      'order-to-delivery',
      'website',
    ]);
    expect(systemsOf(alder!)).toHaveLength(14);
    expect(componentsOf(alder!).length).toBeGreaterThan(14);
  });

  it('marks a private workspace', async () => {
    const workspaces = await readWorkspaces(root);
    expect(workspaces.find((workspace) => workspace.id === 'personal')?.isPrivate).toBe(true);
  });
});
