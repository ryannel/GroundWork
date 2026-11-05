import { rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { afterAll, afterEach, describe, expect, it, vi } from 'vitest';

import { acmeFiles, tempDir, writeWorkspace } from '@/../test/workspace-kit';
import { componentsOf, systemsOf } from '@/domain/workspace';

import { readWorkspaces } from './workspace-store';

vi.mock(import('server-only'), () => ({}));

const root = await tempDir('workspace-store-');
afterEach(() => {
  vi.unstubAllEnvs();
});
afterAll(async () => rm(root, { recursive: true, force: true }));
await writeWorkspace(path.join(root, 'acme'), acmeFiles());
await writeWorkspace(path.join(root, 'notes'), {
  'workspace.yaml': { format: 1, id: 'notes', name: 'Notes', private: true },
});

await writeWorkspace(path.join(root, 'mono'), {
  'workspace.yaml': {
    format: 1,
    id: 'mono',
    name: 'Mono',
    teams: [{ id: 'team:a', name: 'A' }],
  },
  'domains/d/domain.yaml': { id: 'd', name: 'D' },
  'domains/d/systems/graph/system.yaml': {
    id: 'graph',
    name: 'Graph',
    team: 'team:a',
    repos: ['org/mono'],
  },
  'domains/d/systems/price/system.yaml': {
    id: 'price',
    name: 'Price',
    team: 'team:a',
    repos: ['org/price', { repo: 'org/mono', path: 'dgs/pricing' }],
  },
});

await writeWorkspace(path.join(root, 'partners'), {
  'workspace.yaml': {
    id: 'partners',
    name: 'Partners',
    teams: [
      { id: 'team:leads', name: 'Leads', handles: ['leads-sg', '@org/leads'] },
      {
        id: 'team:ziklo',
        name: 'Ziklo',
        partner: true,
        contacts: [{ name: 'Louise', role: 'product' }, { name: 'Henrik' }],
      },
    ],
  },
  'domains/d/domain.yaml': { id: 'd', name: 'D' },
  'domains/d/systems/shell/system.yaml': { id: 'shell', name: 'Shell', team: 'team:leads' },
  'domains/d/systems/tool/system.yaml': {
    id: 'tool',
    name: 'Tool',
    runs_on: 'shell',
    repos: [{ repo: 'org/connect', path: 'apps/tool' }],
  },
});

describe('readWorkspaces', () => {
  it('reads what evidence calls a team, partners and their contacts, and systems no team owns', async () => {
    const workspaces = await readWorkspaces(root);
    const partners = workspaces.find((workspace) => workspace.id === 'partners')!;
    expect(partners.teams).toEqual([
      {
        id: 'team:leads',
        name: 'Leads',
        colour: null,
        channel: null,
        handles: ['leads-sg', '@org/leads'],
      },
      {
        id: 'team:ziklo',
        name: 'Ziklo',
        colour: null,
        channel: null,
        partner: true,
        contacts: [
          { name: 'Louise', role: 'product' },
          { name: 'Henrik', role: null },
        ],
      },
    ]);
    expect(systemsOf(partners).map(({ id, team, runsOn }) => [id, team, runsOn])).toEqual([
      ['shell', 'team:leads', undefined],
      ['tool', null, 'shell'],
    ]);
  });

  it('reads every workspace in the folder and its whole tree', async () => {
    const workspaces = await readWorkspaces(root);
    expect(workspaces.map(({ id }) => id).toSorted((a, b) => a.localeCompare(b))).toEqual([
      'acme',
      'mono',
      'notes',
      'partners',
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

  it('reads a repo that systems share, one folder each', async () => {
    const workspaces = await readWorkspaces(root);
    const mono = workspaces.find((workspace) => workspace.id === 'mono');
    expect(systemsOf(mono!).map(({ id, repos }) => [id, repos])).toEqual([
      ['graph', [{ repo: 'org/mono', path: null }]],
      [
        'price',
        [
          { repo: 'org/price', path: null },
          { repo: 'org/mono', path: 'dgs/pricing' },
        ],
      ],
    ]);
  });

  it('refreshes cached workspace readers when the registered folders change in a running process', async () => {
    const first = path.join(root, 'live-a');
    const second = path.join(root, 'live-b');
    await Promise.all([
      writeWorkspace(first, { 'workspace.yaml': { id: 'first', name: 'First' } }),
      writeWorkspace(second, { 'workspace.yaml': { id: 'second', name: 'Second' } }),
    ]);
    vi.stubEnv('GROUNDWORK_WORKSPACES', first);
    const before = await readWorkspaces();
    expect(before.map((workspace) => workspace.id)).toEqual(['first']);
    vi.stubEnv('GROUNDWORK_WORKSPACES', [first, second].join(path.delimiter));
    const linked = await readWorkspaces();
    expect(linked.map((workspace) => workspace.id)).toEqual(['first', 'second']);
    vi.stubEnv('GROUNDWORK_WORKSPACES', second);
    const removed = await readWorkspaces();
    expect(removed.map((workspace) => workspace.id)).toEqual(['second']);
    await writeFile(path.join(second, 'workspace.yaml'), 'id: second\nname: Updated company\n');
    const updated = await readWorkspaces();
    expect(updated[0]?.name).toBe('Updated company');
  });
});
