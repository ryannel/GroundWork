import { spawnSync } from 'node:child_process';
import { cp, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterAll, beforeAll, expect, it } from 'vitest';
import { parseDocument } from 'yaml';

import { modelRecord } from '@/domain/workspace-model';

const home = process.cwd();
let folder: string;
let sourcePlan: string;
beforeAll(async () => {
  folder = await mkdtemp(path.join(tmpdir(), 'groundwork-native-consumers-'));
  await cp(path.join(home, 'test/fixtures/model'), folder, { recursive: true });
  const file = path.join(folder, 'plans/confirm/plan.yaml');
  const document = parseDocument(await readFile(file, 'utf8'));
  document.set('work_items', [
    {
      id: 'wi:known',
      title: 'The recorded work',
      team: 'team:orders',
      needed_by: '2026-11-10',
      milestone: 'ms:delivery',
      blocked_by: ['q:open'],
    },
  ]);
  document.set('milestones', [{ id: 'ms:delivery', name: 'Delivery', due: '2026-11-11' }]);
  document.set('questions', [{ id: 'q:open', question: 'Who accepts this?', status: 'open' }]);
  sourcePlan = String(document);
  await writeFile(file, sourcePlan);
  await writeFile(
    path.join(folder, 'plans/confirm/progress.yaml'),
    '# Keep this original comment.\nevents: []\n',
  );
});
afterAll(async () => rm(folder, { recursive: true, force: true }));
function run(tool: string, args: readonly string[]) {
  const env: NodeJS.ProcessEnv = { ...process.env, GROUNDWORK_WORKSPACES: folder };
  delete env.VITEST;
  return spawnSync(
    process.execPath,
    [
      '--import',
      path.join(home, 'tools/register.ts'),
      '--conditions=react-server',
      path.join(home, 'tools', `${tool}.ts`),
      ...args,
    ],
    { cwd: home, env, encoding: 'utf8' },
  );
}
it('shows native work, dates, blockers and current-model comparison without a legacy plan facade', () => {
  const result = run('progress', ['show', 'model-fixture', 'confirm']);
  expect(result.status, result.stderr).toBe(0);
  expect(result.stdout).toContain('wi:known  The recorded work');
  expect(result.stdout).toContain('needed by 2026-11-10');
  expect(result.stdout).toContain('q:open (Who accepts this?: open)');
  expect(result.stdout).toContain('chg:label');
  expect(result.stderr).not.toContain('origin must be');
});
it('appends validated native progress without changing plan text or original comments, and deduplicates GitHub state', async () => {
  const args = [
    'add',
    folder,
    'confirm',
    '--subject',
    'wi:known',
    '--kind',
    'work',
    '--state',
    'done',
    '--source-kind',
    'github',
    '--repo',
    'example/orders',
    '--issue',
    '3',
    '--note',
    'The sync recorded completion.',
    '--at',
    '2026-11-07',
  ];
  const first = run('progress', args);
  expect(first.status, first.stderr).toBe(0);
  const file = path.join(folder, 'plans/confirm/progress.yaml');
  const before = await readFile(file, 'utf8');
  expect(before).toContain('# Keep this original comment.');
  expect(before).toContain('The sync recorded completion.');
  const second = run('progress', args);
  expect(second.status, second.stderr).toBe(0);
  expect(second.stdout).toContain('nothing to append');
  await expect(readFile(file, 'utf8')).resolves.toBe(before);
  await expect(readFile(path.join(folder, 'plans/confirm/plan.yaml'), 'utf8')).resolves.toBe(
    sourcePlan,
  );
  const shown = run('progress', ['show', 'model-fixture', 'confirm']);
  expect(shown.stdout).toContain('The sync recorded completion.');
  expect(shown.stdout).toContain('https://github.com/example/orders/issues/3');
});
it('rejects an unknown native subject without changing the append-only record', async () => {
  const file = path.join(folder, 'plans/confirm/progress.yaml');
  const before = await readFile(file, 'utf8');
  const result = run('progress', [
    'add',
    'model-fixture',
    'confirm',
    '--subject',
    'wi:missing',
    '--kind',
    'note',
    '--note',
    'Do not append this unknown subject.',
  ]);
  expect(result.status).toBe(1);
  expect(result.stderr).toContain('no work item or milestone');
  await expect(readFile(file, 'utf8')).resolves.toBe(before);
});
it('builds a native narrative packet from actual handler facts and recorded pins, then refuses an unsupported story', () => {
  const result = run('system-narrative', ['packet', 'model-fixture', 'sys:ordering']);
  expect(result.status, result.stderr).toBe(0);
  const packet = modelRecord(JSON.parse(result.stdout));
  const input = modelRecord(packet?.input);
  const system = modelRecord(input?.system);
  expect(system?.id).toBe('sys:ordering');
  expect(Array.isArray(system?.handlers)).toBe(true);
  expect(JSON.stringify(system?.handlers)).toContain('h:confirm');
  expect(JSON.stringify(input?.codeSources)).toContain('example/orders');
  expect(typeof packet?.basis).toBe('string');
  const checked = run('system-narrative', ['check', 'model-fixture', 'sys:ordering']);
  expect(checked.status).toBe(1);
  expect(checked.stderr).toContain('Story needs review');
});
it('checks exact native citations and backings and detects a changed canonical handler input', async () => {
  const packetResult = run('system-narrative', ['packet', 'model-fixture', 'sys:ordering']);
  const packet = modelRecord(JSON.parse(packetResult.stdout));
  if (typeof packet?.basis !== 'string') throw new Error('Synthetic packet basis missing');
  const file = path.join(folder, 'domains/orders/systems/ordering/narratives.yaml');
  const document = parseDocument(await readFile(file, 'utf8'));
  document.set('basis', packet.basis);
  document.setIn(['stories', 0, 'stages', 0, 'backs'], ['api:confirm']);
  document.setIn(['stories', 0, 'stages', 1, 'backs'], ['h:confirm#tx/save']);
  document.setIn(
    ['stories', 0, 'connections'],
    [
      {
        from: 'svc:ordering',
        to: 'st:orders',
        kind: 'data',
        label: 'Saves the order',
        cites: ['ev:source'],
        backs: ['h:confirm#tx/save'],
      },
    ],
  );
  await writeFile(file, String(document));
  const current = run('system-narrative', ['check', 'model-fixture', 'sys:ordering']);
  expect(current.status, current.stderr).toBe(0);
  expect(current.stdout).toContain('citation- and backing-checked stories');
  const handler = path.join(folder, 'domains/orders/systems/ordering/handlers/ordering.yaml');
  const source = await readFile(handler, 'utf8');
  await writeFile(
    handler,
    source.replace('Queue the notification', 'Queue the current notification'),
  );
  const changed = run('system-narrative', ['check', 'model-fixture', 'sys:ordering']);
  expect(changed.status).toBe(1);
  expect(changed.stderr).toContain('native input fingerprint differs');
});
