import { cp, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterAll, expect, it, vi } from 'vitest';

import { acmeFiles, writeWorkspace } from '@/../test/workspace-kit';

import { readModelIfCanonical } from './canonical-model';
import { readLegacyWorkspace, readWorkspaces } from './workspace-store';

vi.mock(import('server-only'), () => ({}));

const root = await mkdtemp(path.join(tmpdir(), 'entry-model-'));
await cp(path.resolve('test/fixtures/model'), path.join(root, 'model'), { recursive: true });
await writeWorkspace(path.join(root, 'acme'), acmeFiles());
afterAll(async () => rm(root, { recursive: true, force: true }));

it('keeps legacy workspaces on their existing reader', async () => {
  await expect(readModelIfCanonical('acme', root)).resolves.toBeNull();
  const workspaces = await readWorkspaces(root);
  const workspace = workspaces.find((entry) => entry.id === 'acme');
  expect(workspace?.name).toBe('Acme');
  expect(workspace?.domains.map((domain) => domain.id)).toContain('orders');
});

it('keeps canonical facts available without a legacy workspace projection', async () => {
  const model = await readModelIfCanonical('model-fixture', root);
  expect(model?.domains[0]?.id).toBe('dom:orders');
  expect(model?.flows[0]?.steps[0]?.action).toBeDefined();
  await expect(readLegacyWorkspace('model-fixture', root)).resolves.toBeNull();
  const workspaces = await readWorkspaces(root);
  expect(workspaces.map((workspace) => workspace.id)).toEqual(['acme']);
});
