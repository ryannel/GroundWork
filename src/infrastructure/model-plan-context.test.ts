import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, expect, it, vi } from 'vitest';
import { stringify } from 'yaml';

import { selectedPlanPayload } from '@/application/model-reader';

import { readModelIndex } from './model-index';
import {
  readModelPlanProgress,
  readSelectedPlanContext,
  readSelectedRevisionContext,
} from './model-plan-context';
import { readModelPlanEntries, readModelPlanEntry, readModelPlans } from './model-plans';

vi.mock(import('server-only'), () => ({}));
const roots: string[] = [];
afterEach(async () =>
  Promise.all(roots.splice(0).map(async (root) => rm(root, { recursive: true }))),
);

async function fixture(): Promise<{ readonly root: string; readonly folder: string }> {
  const root = await mkdtemp(path.join(tmpdir(), 'groundwork-plan-context-'));
  roots.push(root);
  const folder = path.join(root, 'model');
  await cp(path.resolve('test/fixtures/model'), folder, { recursive: true });
  return { root, folder };
}

async function writePlan(
  folder: string,
  slug: string,
  id: string,
  ops: readonly unknown[],
  buildsOn: readonly string[] = [],
): Promise<void> {
  const directory = path.join(folder, 'plans', slug);
  await mkdir(directory, { recursive: true });
  await writeFile(
    path.join(directory, 'plan.yaml'),
    stringify({
      meta: {
        id,
        title: id,
        revisions: [{ version: '1.0', status: 'approved', date: '2026-11-07' }],
      },
      problem: { summary: 'Native selection proof.' },
      story: { summary: 'Keep this authored reasoning.', scope: ['sys:ordering'] },
      builds_on: buildsOn,
      changes: [{ id: 'chg:fixture', title: 'Change the fixture', ops }],
    }),
  );
}

it('resolves actual folder slugs and shares the current index and cached selection', async () => {
  const { root } = await fixture();
  const current = await readModelIndex('model-fixture', root);
  const selected = await readSelectedPlanContext('model-fixture', 'confirm', root);
  expect(selected?.plan.meta.id).toBe('plan:confirm');
  expect(selected?.beforeIndex).toBe(current);
  expect(selected?.before).toBe(current?.model);
  expect(selected?.afterIndex.get('h:confirm#tx/audit')).not.toBeNull();
  await expect(readSelectedPlanContext('model-fixture', 'confirm', root)).resolves.toBe(selected);
  const entries = await readModelPlanEntries('model-fixture', root);
  await expect(readModelPlanEntries('model-fixture', root)).resolves.toBe(entries);
  await expect(readModelPlanEntry('model-fixture', 'confirm', root)).resolves.toBe(entries[0]);
  await expect(readModelPlans('model-fixture', root)).resolves.toEqual(
    entries.map((entry) => entry.plan),
  );
});

it('leaves unknown workspaces and slugs absent without interpreting paths or plan ids', async () => {
  const { root } = await fixture();
  for (const slug of ['absent', 'plan:confirm', '../confirm', 'confirm/../confirm', '..']) {
    await expect(readSelectedPlanContext('model-fixture', slug, root)).resolves.toBeNull();
    await expect(readModelPlanEntry('model-fixture', slug, root)).resolves.toBeNull();
  }
  await expect(readSelectedPlanContext('absent', 'confirm', root)).resolves.toBeNull();
});

it('composes a diamond once, excludes unrelated plans and transports authored context as JSON', async () => {
  const { root, folder } = await fixture();
  await writePlan(folder, 'financing-folder', 'plan:financing', [
    {
      add: 'component',
      into: 'sys:ordering',
      value: { id: 'app:retail', name: 'Retail tool', kind: 'app', form: 'admin' },
    },
  ]);
  await writePlan(
    folder,
    'sales-folder',
    'plan:sales',
    [
      {
        modify: 'app:retail',
        set: { name: 'Retail sales tool' },
      },
    ],
    ['plan:financing'],
  );
  await writePlan(
    folder,
    'rates-folder',
    'plan:rates',
    [
      {
        modify: 'api:confirm',
        set: { summary: 'Check financing rates' },
      },
    ],
    ['plan:financing'],
  );
  await writePlan(
    folder,
    'selected-folder',
    'plan:child',
    [
      {
        modify: 'app:retail',
        set: { name: 'Retail order changes' },
      },
    ],
    ['plan:sales', 'plan:rates'],
  );
  await writePlan(folder, 'unrelated-folder', 'plan:unrelated', [
    {
      modify: 'app:retail',
      set: { name: 'Unrelated choice' },
    },
  ]);
  const selected = await readSelectedPlanContext('model-fixture', 'selected-folder', root);
  if (selected === null) throw new Error('Missing fixture selection');
  expect(selected.beforeIndex.get('app:retail')?.data.name).toBe('Retail sales tool');
  expect(selected.beforeIndex.get('api:confirm')?.data.summary).toBe('Check financing rates');
  expect(selected.afterIndex.get('app:retail')?.data.name).toBe('Retail order changes');
  expect(selected.beforeIndex.entities.filter((entry) => entry.id === 'app:retail')).toHaveLength(
    1,
  );
  const payload = selectedPlanPayload(selected);
  const json = JSON.stringify(payload);
  const transported: unknown = JSON.parse(json);
  expect(transported).toEqual(payload);
  expect(Object.keys(payload)).toEqual(['plan', 'before', 'after', 'profile']);
  expect(payload.plan.story?.summary).toBe('Keep this authored reasoning.');
  expect(payload.plan.meta.revisions?.[0]?.status).toBe('approved');
});

it('refreshes selection after plan edits and after cited evidence changes', async () => {
  const { root, folder } = await fixture();
  const first = await readSelectedPlanContext('model-fixture', 'confirm', root);
  const file = path.join(folder, 'plans/confirm/plan.yaml');
  const text = await readFile(file, 'utf8');
  await writeFile(file, text.replace('Explain confirmation', 'Explain the changed confirmation'));
  const edited = await readSelectedPlanContext('model-fixture', 'confirm', root);
  expect(edited).not.toBe(first);
  expect(edited?.plan.meta.title).toBe('Explain the changed confirmation');
  const pin = path.join(folder, 'evidence/example/orders/repository.json');
  const evidence = await readFile(pin, 'utf8');
  await writeFile(pin, evidence.replace('a'.repeat(40), 'd'.repeat(40)));
  const refreshed = await readSelectedPlanContext('model-fixture', 'confirm', root);
  expect(refreshed?.beforeIndex).not.toBe(edited?.beforeIndex);
  expect(refreshed?.afterIndex.cites('h:confirm#tx/save')).toContainEqual(
    expect.objectContaining({ commit: 'd'.repeat(40) }),
  );
});

it('reads real native revisions using their own ancestors rather than the head plan', async () => {
  const { root, folder } = await fixture();
  await writePlan(folder, 'ancestor', 'plan:ancestor', [
    {
      add: 'component',
      into: 'sys:ordering',
      value: { id: 'app:retail', name: 'Retail tool', kind: 'app', form: 'admin' },
    },
  ]);
  const revisions = path.join(folder, 'plans/confirm/revisions');
  await mkdir(revisions);
  await writeFile(
    path.join(revisions, '1.0.yaml'),
    stringify({
      meta: { id: 'plan:confirm', title: 'Historical confirmation', version: '1.0' },
      problem: { summary: 'The revision keeps its own proposed dependency context.' },
      builds_on: ['plan:ancestor'],
      changes: [
        {
          id: 'chg:revision',
          title: 'Revise the retail tool',
          ops: [
            {
              modify: 'app:retail',
              set: { name: 'Revision retail tool' },
            },
          ],
        },
      ],
    }),
  );
  const revision = await readSelectedRevisionContext('model-fixture', 'confirm', '1.0', root);
  expect(revision?.plan.meta.title).toBe('Historical confirmation');
  expect(revision?.beforeIndex.get('app:retail')?.data.name).toBe('Retail tool');
  expect(revision?.afterIndex.get('app:retail')?.data.name).toBe('Revision retail tool');
  expect(revision?.afterIndex.get('h:confirm#tx/audit')).toBeNull();
  await expect(readSelectedRevisionContext('model-fixture', 'confirm', '1.0', root)).resolves.toBe(
    revision,
  );
  for (const version of ['absent', '../1.0', '1.0.yaml']) {
    await expect(
      readSelectedRevisionContext('model-fixture', 'confirm', version, root),
    ).resolves.toBeNull();
  }
  const head = await readSelectedPlanContext('model-fixture', 'confirm', root);
  expect(head?.beforeIndex.get('app:retail')).toBeNull();
  expect(head?.afterIndex.get('h:confirm#tx/audit')).not.toBeNull();
  await writeFile(path.join(folder, 'plans/confirm/base.yaml'), 'landed_on: 2026-11-07\n');
  await expect(
    readSelectedRevisionContext('model-fixture', 'confirm', '1.0', root),
  ).rejects.toThrow('base.yaml');
  await expect(readSelectedPlanContext('model-fixture', 'confirm', root)).rejects.toThrow(
    'base.yaml',
  );
});

it('rejects a malformed canonical revision rather than reading it as legacy plan data', async () => {
  const { root, folder } = await fixture();
  const revisions = path.join(folder, 'plans/confirm/revisions');
  await mkdir(revisions);
  await writeFile(
    path.join(revisions, '1.0.yaml'),
    'meta: { id: "plan:confirm", title: Invalid }\ncontext: {}\n',
  );
  await expect(
    readSelectedRevisionContext('model-fixture', 'confirm', '1.0', root),
  ).rejects.toThrow('1.0.yaml');
});

it('preserves progress events and read errors under the independent metadata contract', async () => {
  const { root, folder } = await fixture();
  await expect(readModelPlanProgress('model-fixture', 'confirm', root)).resolves.toEqual({
    progress: { events: [] },
    errors: [],
  });
  const progress = path.join(folder, 'plans/confirm/progress.yaml');
  await writeFile(
    progress,
    'events:\n  - { at: "2026-11-07", kind: note, subject: "wi:confirm", note: "Keep this recorded note" }\n',
  );
  const recorded = await readModelPlanProgress('model-fixture', 'confirm', root);
  expect(recorded?.errors).toEqual([]);
  expect(recorded?.progress.events[0]?.note).toBe('Keep this recorded note');
  await writeFile(progress, 'events:\n  - { at: soon, kind: rumour, subject: "wi:confirm" }\n');
  const invalid = await readModelPlanProgress('model-fixture', 'confirm', root);
  expect(invalid?.progress.events).toEqual([]);
  expect(invalid?.errors.map((error) => error.message).join(' ')).toContain('kind');
  await expect(readModelPlanProgress('model-fixture', '../confirm', root)).resolves.toBeNull();
});
