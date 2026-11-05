import { spawnSync } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { afterAll, describe, expect, it } from 'vitest';
import { parse } from 'yaml';

import { pauseOrdersOverlay } from '@/../test/fixtures/acme/plans/pause-orders';
import { acmeFiles, writeWorkspace } from '@/../test/workspace-kit';

const home = process.cwd();
const scratch = path.join(home, 'node_modules', '.cache');
await mkdir(scratch, { recursive: true });
const root = await mkdtemp(path.join(scratch, 'progress-command-'));
afterAll(async () => rm(root, { recursive: true, force: true }));

function progress(args: readonly string[]) {
  const environment: NodeJS.ProcessEnv = { ...process.env, GROUNDWORK_WORKSPACES: '' };
  delete environment.VITEST;
  return spawnSync(
    process.execPath,
    [
      '--import',
      path.join(home, 'tools/register.ts'),
      '--conditions=react-server',
      path.join(home, 'tools', 'progress.ts'),
      ...args,
    ],
    { cwd: home, encoding: 'utf8', env: environment },
  );
}

async function workspace(name: string): Promise<string> {
  const folder = path.join(root, name, 'acme');
  await writeWorkspace(folder, {
    ...acmeFiles(),
    'plans/pause-orders/plan.yaml': pauseOrdersOverlay(),
  });
  return folder;
}

const fileOf = (folder: string): string => path.join(folder, 'plans/pause-orders/progress.yaml');

async function eventsIn(folder: string): Promise<unknown[]> {
  const read: unknown = parse(await readFile(fileOf(folder), 'utf8'));
  const events = typeof read === 'object' && read !== null && 'events' in read ? read.events : [];
  return Array.isArray(events) ? events : [];
}

const github = (state: string, at: string): string[] => [
  '--subject',
  'wi:pause-api',
  '--kind',
  'work',
  '--state',
  state,
  '--source-kind',
  'github',
  '--repo',
  'acme/orders',
  '--issue',
  '12',
  '--at',
  at,
];

describe('npm run progress -- add', () => {
  it('creates progress.yaml with a checked commitment event', async () => {
    const folder = await workspace('create');
    const result = progress([
      'add',
      folder,
      'pause-orders',
      '--subject',
      'wi:pause-api',
      '--kind',
      'commitment',
      '--state',
      'accepted',
      '--promised-for',
      '2027-03-01',
      '--confidence',
      'medium',
      '--said-by',
      'Louise A. Zieme',
      '--source-kind',
      'meeting',
      '--url',
      'https://notion.test/order-change',
      '--note',
      'Agreed in the weekly.',
      '--at',
      '2026-11-04',
    ]);
    expect(result.stderr).not.toContain('Error');
    expect(result.status).toBe(0);
    await expect(eventsIn(folder)).resolves.toEqual([
      {
        at: '2026-11-04',
        subject: 'wi:pause-api',
        kind: 'commitment',
        state: 'accepted',
        promised_for: '2027-03-01',
        confidence: 'medium',
        said_by: 'Louise A. Zieme',
        source: { kind: 'meeting', url: 'https://notion.test/order-change' },
        note: 'Agreed in the weekly.',
      },
    ]);
  });

  it('appends after what is there, keeping its comments', async () => {
    const folder = await workspace('append');
    await writeFile(
      fileOf(folder),
      "# what has happened\nevents:\n  - { at: '2026-10-20', subject: ms:pause, kind: note, note: Kicked off. }\n",
    );
    const result = progress([
      'add',
      folder,
      'pause-orders',
      ...github('in_progress', '2026-11-01'),
    ]);
    expect(result.status).toBe(0);
    const text = await readFile(fileOf(folder), 'utf8');
    expect(text).toContain('# what has happened');
    await expect(eventsIn(folder)).resolves.toEqual([
      { at: '2026-10-20', subject: 'ms:pause', kind: 'note', note: 'Kicked off.' },
      {
        at: '2026-11-01',
        subject: 'wi:pause-api',
        kind: 'work',
        state: 'in_progress',
        source: { kind: 'github', repo: 'acme/orders', issue: 12 },
      },
    ]);
  });

  it('refuses an event that does not check, and writes nothing', async () => {
    const folder = await workspace('refuse');
    const unknown = progress([
      'add',
      folder,
      'pause-orders',
      '--subject',
      'wi:gone',
      '--kind',
      'note',
    ]);
    expect(unknown.status).toBe(1);
    expect(unknown.stderr).toContain('wi:gone is no work item or milestone of this plan');
    const wrongState = progress([
      'add',
      folder,
      'pause-orders',
      '--subject',
      'wi:pause-api',
      '--kind',
      'commitment',
      '--state',
      'done',
    ]);
    expect(wrongState.status).toBe(1);
    expect(wrongState.stderr).toContain('a commitment event cannot be done');
    const noKind = progress(['add', folder, 'pause-orders', '--subject', 'wi:pause-api']);
    expect(noKind.status).toBe(1);
    expect(noKind.stderr).toContain('does not fit progress.yaml');
    await expect(readFile(fileOf(folder), 'utf8')).rejects.toThrow('ENOENT');
  });

  it('appends a GitHub state only when it changed, so the sync can run again', async () => {
    const folder = await workspace('sync');
    expect(
      progress(['add', folder, 'pause-orders', ...github('in_progress', '2026-11-01')]).status,
    ).toBe(0);
    const again = progress(['add', folder, 'pause-orders', ...github('in_progress', '2026-11-02')]);
    expect(again.status).toBe(0);
    expect(again.stdout).toContain('nothing to append');
    await expect(eventsIn(folder)).resolves.toHaveLength(1);
    expect(progress(['add', folder, 'pause-orders', ...github('done', '2026-11-03')]).status).toBe(
      0,
    );
    await expect(eventsIn(folder)).resolves.toHaveLength(2);
  });
});

describe('npm run progress -- show', () => {
  it('prints where each work item stands', async () => {
    const folder = await workspace('show');
    progress(['add', folder, 'pause-orders', ...github('done', '2026-11-03')]);
    const result = progress(['show', folder, 'pause-orders']);
    expect(result.stderr).not.toContain('Error');
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('wi:pause-api');
    expect(result.stdout).toContain('progress: done on 2026-11-03 via github');
    expect(result.stdout).toContain('chg:');
  });
});
