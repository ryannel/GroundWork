import { mkdir, rm, symlink, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { afterAll, describe, expect, it, vi } from 'vitest';

import { tempDir } from '@/../test/workspace-kit';

import { readPlanFile, readWorkspaceAsset } from './plan-files';
import { workspaceFolder } from './workspace-folders';

vi.mock(import('server-only'), () => ({}));
vi.mock(import('./workspace-folders'));

const root = await tempDir('served-files-');
afterAll(async () => rm(root, { recursive: true, force: true }));
const workspace = path.join(root, 'workspace');
const assets = path.join(workspace, 'assets');
const planAssets = path.join(workspace, 'plans', 'first', 'assets');
await mkdir(assets, { recursive: true });
await mkdir(planAssets, { recursive: true });
await writeFile(path.join(assets, 'drawing.svg'), 'drawing');
await writeFile(path.join(planAssets, 'screen.png'), 'screen');
await writeFile(path.join(root, 'outside.txt'), 'private');
vi.mocked(workspaceFolder).mockResolvedValue(workspace);

const plan = { workspace: 'acme', slug: 'first', kind: 'assets' } as const;

describe('served workspace files', () => {
  it('reads assets within their own folder and returns null for missing files', async () => {
    await expect(readWorkspaceAsset('acme', ['drawing.svg'])).resolves.toEqual(
      Buffer.from('drawing'),
    );
    await expect(readPlanFile(plan, ['screen.png'])).resolves.toEqual(Buffer.from('screen'));
    await expect(readWorkspaceAsset('acme', ['missing.png'])).resolves.toBeNull();
  });

  it('does not let segments or a plan slug escape the designated folder', async () => {
    await expect(readWorkspaceAsset('acme', ['..', '..', 'outside.txt'])).resolves.toBeNull();
    for (const slug of ['..', '.', '', '../first', String.raw`..\first`, 'first/../first']) {
      await expect(readPlanFile({ ...plan, slug }, ['screen.png'])).resolves.toBeNull();
    }
  });

  it('rejects file and directory links that point outside the asset folder', async () => {
    await symlink(path.join(root, 'outside.txt'), path.join(assets, 'linked.txt'));
    await symlink(root, path.join(assets, 'linked-folder'));
    await symlink(root, path.join(workspace, 'plans', 'linked'));
    await mkdir(path.join(root, 'assets'), { recursive: true });
    await writeFile(path.join(root, 'assets', 'outside.txt'), 'private');
    await expect(readWorkspaceAsset('acme', ['linked.txt'])).resolves.toBeNull();
    await expect(readWorkspaceAsset('acme', ['linked-folder', 'outside.txt'])).resolves.toBeNull();
    await expect(readPlanFile({ ...plan, slug: 'linked' }, ['outside.txt'])).resolves.toBeNull();
  });

  it('allows links whose targets stay inside the asset folder', async () => {
    await symlink(path.join(assets, 'drawing.svg'), path.join(assets, 'alias.svg'));
    await expect(readWorkspaceAsset('acme', ['alias.svg'])).resolves.toEqual(
      Buffer.from('drawing'),
    );
  });
});
