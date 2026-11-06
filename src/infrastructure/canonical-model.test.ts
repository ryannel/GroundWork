import { cp, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterAll, expect, it, vi } from 'vitest';

import { acmeFiles, writeWorkspace } from '@/../test/workspace-kit';
import { legacyLosses } from '@/application/legacy-view';

import { readModelIfCanonical } from './canonical-model';
import { readWorkspaces } from './workspace-store';

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

it('carries the canonical fixture through workspace discovery without losing its authored fields', async () => {
  const model = await readModelIfCanonical('model-fixture', root);
  expect(model).not.toBeNull();
  const workspaces = await readWorkspaces(root);
  const workspace = workspaces.find((entry) => entry.id === 'model-fixture');
  expect(workspace?.domains[0]?.id).toBe('orders');
  expect(legacyLosses(model, workspace)).toEqual([]);
});
