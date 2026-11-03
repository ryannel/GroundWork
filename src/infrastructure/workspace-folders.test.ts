import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { afterAll, afterEach, describe, expect, it, vi } from 'vitest';

vi.mock(import('server-only'), () => ({}));

const {
  cloneFolder,
  folderOf,
  readLocal,
  registeredAt,
  registrationsAt,
  workspaceFolders,
  workspaceRegistrations,
  selectedWorkspace,
  localWorkspaceDetails,
} = await import('./workspace-folders');

const scratch = path.join(process.cwd(), 'node_modules', '.cache');
const made: string[] = [];

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});
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

async function localCheckout(): Promise<{ home: string; repo: string }> {
  const setup = await checkout();
  vi.spyOn(process, 'cwd').mockReturnValue(setup.home);
  vi.stubEnv('VITEST', globalThis.undefined);
  vi.stubEnv('GROUNDWORK_WORKSPACES', globalThis.undefined);
  return setup;
}

describe('workspaceFolders', () => {
  it('finds the bundled examples by the id in their workspace.yaml', async () => {
    const bundled = path.join(await scratchDir(), 'workspaces');
    const acme = await workspaceAt(path.join(bundled, 'acme-example'), 'acme');
    const personal = await workspaceAt(path.join(bundled, 'personal'), 'personal');
    const found = await workspaceFolders(bundled);
    expect(Object.fromEntries(found)).toEqual({ acme, personal });
  });
});

describe('registeredAt', () => {
  it('exposes names, ids, paths and provenance from the same resolver as the app', async () => {
    const { home, repo } = await checkout();
    await writeFile(
      path.join(repo, 'workspace.yaml'),
      'id: acme\nname: acme\nprivate: true\nteams: [{id: team:shop, name: Shop}]\n',
    );
    await writeFile(path.join(home, 'groundwork.local.yaml'), 'workspaces: [../acme-groundwork]\n');
    await expect(registrationsAt(home, { local: true })).resolves.toEqual([
      {
        id: 'example',
        name: 'example',
        folder: path.join(home, 'workspaces', 'example'),
        source: 'example',
        isExample: true,
        repo: null,
      },
      { id: 'acme', name: 'acme', folder: repo, source: 'local', isExample: false, repo: null },
    ]);
    await expect(registrationsAt(home, { env: repo, local: true })).resolves.toEqual([
      {
        id: 'acme',
        name: 'acme',
        folder: repo,
        source: 'environment',
        isExample: false,
        repo: null,
      },
    ]);
  });
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

  it('keeps examples labelled when selected through an environment override', async () => {
    const { home } = await checkout();
    const folder = path.join(home, 'workspaces/example');
    await expect(registrationsAt(home, { env: folder, local: true })).resolves.toEqual([
      {
        id: 'example',
        name: 'example',
        folder,
        source: 'environment',
        isExample: true,
        repo: null,
      },
    ]);
  });

  it('refuses a listed folder that holds no workspace', async () => {
    const { home } = await checkout();
    await writeFile(path.join(home, 'groundwork.local.yaml'), 'workspaces: [../nowhere]\n');
    await expect(registeredAt(home, { local: true })).rejects.toThrow(/holds no workspace\.yaml/u);
  });

  it('refuses two folders with the same workspace id', async () => {
    const { home } = await checkout();
    await workspaceAt(path.join(home, '..', 'copy'), 'acme');
    await writeFile(
      path.join(home, 'groundwork.local.yaml'),
      'workspaces: [../acme-groundwork, ../copy]\n',
    );
    await expect(registeredAt(home, { local: true })).rejects.toThrow(
      /workspace acme: found in both/u,
    );
  });

  it('refuses a local file it does not understand', async () => {
    const { home } = await checkout();
    await writeFile(path.join(home, 'groundwork.local.yaml'), 'workspace: [../acme-groundwork]\n');
    await expect(registeredAt(home, { local: true })).rejects.toThrow(/groundwork\.local\.yaml/u);
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
    const registrations = await registrationsAt(home, { local: true });
    expect(registrations.find((entry) => entry.id === 'beta')?.repo).toBe(
      'git@github.com:beta/beta-groundwork.git',
    );
  });

  describe('live registration and command selection', () => {
    it('finds a link added, relocated and removed in one running process', async () => {
      const { home, repo } = await localCheckout();
      const before = await workspaceFolders();
      expect([...before.keys()]).toEqual(['example']);
      await writeFile(
        path.join(home, 'groundwork.local.yaml'),
        'workspaces: [../acme-groundwork]\n',
      );
      const added = await workspaceFolders();
      expect(added.get('acme')).toBe(repo);
      const relocated = await workspaceAt(path.join(home, '..', 'relocated'), 'acme');
      await writeFile(path.join(home, 'groundwork.local.yaml'), 'workspaces: [../relocated]\n');
      const moved = await workspaceFolders();
      expect(moved.get('acme')).toBe(relocated);
      await writeFile(path.join(home, 'groundwork.local.yaml'), 'workspaces: []\n');
      const removed = await workspaceFolders();
      expect(removed.has('acme')).toBe(false);
    });

    it('recovers from a broken link once the local file is fixed', async () => {
      const { home, repo } = await localCheckout();
      await writeFile(path.join(home, 'groundwork.local.yaml'), 'workspaces: [../missing]\n');
      await expect(workspaceFolders()).rejects.toThrow(/correct the link/u);
      await writeFile(
        path.join(home, 'groundwork.local.yaml'),
        'workspaces: [../acme-groundwork]\n',
      );
      const found = await workspaceFolders();
      expect(found.get('acme')).toBe(repo);
    });

    it('requires explicit selection when an example and a company workspace are registered', async () => {
      const { home, repo } = await localCheckout();
      await writeFile(
        path.join(home, 'groundwork.local.yaml'),
        'workspaces: [../acme-groundwork]\n',
      );
      await expect(selectedWorkspace()).rejects.toThrow(
        /Choose a workspace.*--workspace.*example.*acme/u,
      );
      await expect(selectedWorkspace('acme')).resolves.toMatchObject({ id: 'acme', folder: repo });
      await expect(selectedWorkspace('unknown')).rejects.toThrow(
        /No workspace unknown.*workspace -- list/u,
      );
    });

    it('selects a sole workspace and honours an environment override on every read', async () => {
      const { repo } = await localCheckout();
      vi.stubEnv('GROUNDWORK_WORKSPACES', repo);
      await expect(selectedWorkspace()).resolves.toMatchObject({
        id: 'acme',
        source: 'environment',
      });
      vi.stubEnv('GROUNDWORK_WORKSPACES', globalThis.undefined);
      await expect(selectedWorkspace()).resolves.toMatchObject({
        id: 'example',
        source: 'example',
      });
    });

    it('keeps local settings out of test reads', async () => {
      const { home } = await localCheckout();
      await writeFile(path.join(home, 'groundwork.local.yaml'), 'workspaces: [../missing]\n');
      vi.stubEnv('VITEST', 'true');
      const found = await workspaceRegistrations();
      expect(found.map((entry) => entry.id)).toEqual(['example']);
    });

    it('shows local details only in development', () => {
      vi.stubEnv('NODE_ENV', 'production');
      expect(localWorkspaceDetails()).toBe(false);
      vi.stubEnv('NODE_ENV', 'development');
      expect(localWorkspaceDetails()).toBe(true);
    });
  });

  it('says to pull a linked repo that is not cloned yet', async () => {
    const { home } = await checkout();
    await writeFile(
      path.join(home, 'groundwork.local.yaml'),
      'workspaces:\n  - repo: https://github.com/beta/beta-groundwork\n',
    );
    await expect(registeredAt(home, { local: true })).rejects.toThrow(/not cloned.*pull/u);
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
    expect(() => cloneFolder('https://x.test/..')).toThrow(/give it a folder/u);
  });
});
