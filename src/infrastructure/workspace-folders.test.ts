import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { afterAll, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const { cloneFolder, folderOf, readLocal, registeredAt, workspaceFolders } =
  await import('./workspace-folders');

const scratch = path.join(process.cwd(), 'node_modules', '.cache');
const made: string[] = [];

afterAll(async () => {
  await Promise.all(made.map(async (dir) => rm(dir, { recursive: true, force: true })));
});

async function scratchDir(): Promise<string> {
  await mkdir(scratch, { recursive: true });
  const dir = await mkdtemp(path.join(scratch, 'workspace-folders-'));
  made.push(dir);
  return dir;
}

async function workspaceAt(folder: string, id: string): Promise<string> {
  await mkdir(folder, { recursive: true });
  await writeFile(path.join(folder, 'workspace.yaml'), `id: ${id}\nname: ${id}\n`);
  return folder;
}

/** A Groundwork checkout with one bundled example and one workspace repo beside it. */
async function checkout(): Promise<{ home: string; repo: string }> {
  const dir = await scratchDir();
  const home = path.join(dir, 'groundwork');
  await workspaceAt(path.join(home, 'workspaces', 'example'), 'example');
  const repo = await workspaceAt(path.join(dir, 'acme-groundwork'), 'acme');
  return { home, repo };
}

describe('workspaceFolders', () => {
  it('finds the bundled examples by the id in their workspace.yaml', async () => {
    const found = await workspaceFolders(path.join(process.cwd(), 'workspaces'));
    expect([...found.keys()]).toEqual(expect.arrayContaining(['alder-finch', 'personal']));
  });
});

describe('registeredAt', () => {
  it('reads the examples and the workspace repos the local file lists', async () => {
    const { home, repo } = await checkout();
    await writeFile(
      path.join(home, 'groundwork.local.yaml'),
      'workspaces:\n  - ../acme-groundwork\n',
    );
    const found = await registeredAt(home, { local: true });
    expect(Object.fromEntries(found)).toEqual({
      example: path.join(home, 'workspaces', 'example'),
      acme: repo,
    });
  });

  it('leaves the examples out when the local file says so', async () => {
    const { home } = await checkout();
    await writeFile(
      path.join(home, 'groundwork.local.yaml'),
      'bundled: false\nworkspaces: [../acme-groundwork]\n',
    );
    const found = await registeredAt(home, { local: true });
    expect([...found.keys()]).toEqual(['acme']);
  });

  it('reads only the folders GROUNDWORK_WORKSPACES names when it is set', async () => {
    const { home, repo } = await checkout();
    await writeFile(path.join(home, 'groundwork.local.yaml'), 'workspaces: [../nowhere]\n');
    const found = await registeredAt(home, { env: repo, local: true });
    expect(Object.fromEntries(found)).toEqual({ acme: repo });
  });

  it('refuses a listed folder that holds no workspace', async () => {
    const { home } = await checkout();
    await writeFile(path.join(home, 'groundwork.local.yaml'), 'workspaces: [../nowhere]\n');
    await expect(registeredAt(home, { local: true })).rejects.toThrow(/holds no workspace\.yaml/);
  });

  it('refuses two folders with the same workspace id', async () => {
    const { home } = await checkout();
    await workspaceAt(path.join(home, '..', 'copy'), 'acme');
    await writeFile(
      path.join(home, 'groundwork.local.yaml'),
      'workspaces: [../acme-groundwork, ../copy]\n',
    );
    await expect(registeredAt(home, { local: true })).rejects.toThrow(
      /workspace acme: found in both/,
    );
  });

  it('refuses a local file it does not understand', async () => {
    const { home } = await checkout();
    await writeFile(path.join(home, 'groundwork.local.yaml'), 'workspace: [../acme-groundwork]\n');
    await expect(registeredAt(home, { local: true })).rejects.toThrow(/groundwork\.local\.yaml/);
  });

  it('reads a linked repo from its clone in .workspaces/', async () => {
    const { home } = await checkout();
    const clone = await workspaceAt(path.join(home, '.workspaces', 'beta-groundwork'), 'beta');
    await writeFile(
      path.join(home, 'groundwork.local.yaml'),
      'workspaces:\n  - repo: git@github.com:beta/beta-groundwork.git\n',
    );
    const found = await registeredAt(home, { local: true });
    expect(found.get('beta')).toBe(clone);
  });

  it('says to pull a linked repo that is not cloned yet', async () => {
    const { home } = await checkout();
    await writeFile(
      path.join(home, 'groundwork.local.yaml'),
      'workspaces:\n  - repo: https://github.com/beta/beta-groundwork\n',
    );
    await expect(registeredAt(home, { local: true })).rejects.toThrow(/not cloned.*pull/);
  });

  it('keeps folders and repos as written', async () => {
    const { home } = await checkout();
    await writeFile(
      path.join(home, 'groundwork.local.yaml'),
      'workspaces:\n  - ../acme-groundwork\n  - repo: https://x.test/beta.git\n    folder: ../beta\n',
    );
    const { workspaces, bundled } = await readLocal(home);
    expect(bundled).toBe(true);
    expect(workspaces.map(folderOf)).toEqual(['../acme-groundwork', '../beta']);
  });
});

describe('cloneFolder', () => {
  it('names the clone after the repo', () => {
    expect(cloneFolder('git@github.com:acme/acme-groundwork.git')).toBe(
      path.join('.workspaces', 'acme-groundwork'),
    );
    expect(cloneFolder('https://github.com/acme/acme-groundwork/')).toBe(
      path.join('.workspaces', 'acme-groundwork'),
    );
  });

  it('refuses a repo it cannot name', () => {
    expect(() => cloneFolder('https://x.test/..')).toThrow(/give it a folder/);
  });
});
