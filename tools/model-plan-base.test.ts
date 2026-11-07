import { execFile } from 'node:child_process';
import { cp, mkdir, mkdtemp, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, expect, it, vi } from 'vitest';
import { parse, stringify } from 'yaml';

import type { FlowNode } from '@/application/entry-flow';
import { readEntryFlowPage } from '@/infrastructure/entry-flow-page';
import { readModelIndex } from '@/infrastructure/model-index';
import { readModelFrozenBases, readModelPlanBase } from '@/infrastructure/model-plan-base';
import {
  readSelectedPlanContext,
  readSelectedRevisionContext,
} from '@/infrastructure/model-plan-context';
import { readModelPlanBaseInfo } from '@/infrastructure/model-plan-lock';
import { readModelPlanRows } from '@/infrastructure/model-plan-rows';
import { readModelPlans } from '@/infrastructure/model-plans';
import { modelValidator } from '@/infrastructure/model-schema';
import { NATIVE_PLAN_LOCK_FORMAT, readPlanLock } from '@/infrastructure/plan-lock';
import { validateModel, validatePlanProjections } from '@/infrastructure/validate-model';

import { runModelPlanBase } from './model-plan-base';

vi.mock(import('server-only'), () => ({}));
const repository = process.cwd();
const roots: string[] = [];
afterEach(async () =>
  Promise.all(roots.splice(0).map(async (root) => rm(root, { recursive: true }))),
);

async function fixture(): Promise<{ readonly root: string; readonly folder: string }> {
  const root = await mkdtemp(path.join(tmpdir(), 'groundwork-plan-base-'));
  roots.push(root);
  const folder = path.join(root, 'model');
  await cp(path.resolve('test/fixtures/model'), folder, { recursive: true });
  return { root, folder };
}
async function command(folder: string, action: string, slug = 'confirm'): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(
      process.execPath,
      [
        '--import',
        './tools/register.ts',
        '--conditions=react-server',
        'tools/plan-base.ts',
        action,
        slug,
        '--workspace',
        'model-fixture',
      ],
      { cwd: repository, env: { ...process.env, GROUNDWORK_WORKSPACES: folder }, encoding: 'utf8' },
      (error, stdout) => {
        if (error !== null) {
          reject(new Error(error.message, { cause: error }));
          return;
        }
        resolve(stdout);
      },
    );
  });
}
async function storyScope(folder: string): Promise<void> {
  const file = path.join(folder, 'plans/confirm/plan.yaml');
  const raw: unknown = parse(await readFile(file, 'utf8'));
  const check = await modelValidator('plan', 'document');
  if (!check(raw)) throw new Error('Invalid native plan fixture');
  await writeFile(
    file,
    stringify({
      ...raw,
      story: { summary: 'The component is important context.', scope: ['svc:ordering'] },
    }),
  );
}

it('the public native check writes child ids and story-only facts into its drift lock', async () => {
  const { root, folder } = await fixture();
  await storyScope(folder);
  await expect(command(folder, 'check')).resolves.toContain('fits its native base');
  const lock = await readPlanLock('model-fixture', 'confirm', root);
  expect(lock?.entities['h:confirm#tx/save']).toMatch(/^[a-f0-9]{64}$/u);
  expect(lock?.entities['svc:ordering']).toMatch(/^[a-f0-9]{64}$/u);
  expect(lock?.programme?.id).toBe('prog:orders');
  const clean = await readModelPlanBaseInfo('model-fixture', 'confirm', root);
  expect(clean?.edited).toBe(false);
  expect(clean?.drift).toEqual([]);
  const system = path.join(folder, 'domains/orders/systems/ordering/system.yaml');
  const text = await readFile(system, 'utf8');
  await writeFile(system, text.replace('name: Ordering API', 'name: Changed Ordering API'));
  const changed = await readModelPlanBaseInfo('model-fixture', 'confirm', root);
  expect(changed?.drift).toContain('svc:ordering');
  expect(changed?.edited).toBe(false);
});

it('keeps a previous-format check as history until the plan has a comparable native check', async () => {
  const { root, folder } = await fixture();
  const original =
    '{"checked_on":"2026-11-05","entities":{"h:confirm#tx/save":"fe80f912"},"plan":"a0cde765"}\n';
  const planFolder = path.join(folder, 'plans/confirm');
  const active = path.join(planFolder, 'base.lock.json');
  await writeFile(active, original);

  const index = await readModelIndex('model-fixture', root);
  if (index === null) throw new Error('Missing native fixture');
  const previous = await readModelPlanRows(index, root);
  expect(previous.rows[0]).toMatchObject({ check: 'recheck', previousCheckedOn: '2026-11-05' });
  await expect(readModelPlanBaseInfo('model-fixture', 'confirm', root)).resolves.toMatchObject({
    previousCheckedOn: '2026-11-05',
    checkedOn: null,
    edited: false,
    drift: [],
    stale: false,
  });
  await expect(readFile(active, 'utf8')).resolves.toBe(original);

  await expect(runModelPlanBase('check', 'model-fixture', 'confirm', root)).resolves.toContain(
    'fits its native base',
  );
  await expect(readFile(path.join(planFolder, 'base.previous.lock.json'), 'utf8')).resolves.toBe(
    original,
  );
  await expect(readPlanLock('model-fixture', 'confirm', root)).resolves.toMatchObject({
    format: NATIVE_PLAN_LOCK_FORMAT,
  });
  const comparable = await readModelPlanRows(index, root);
  expect(comparable.rows[0]?.check).toBeNull();
  await expect(readModelPlanBaseInfo('model-fixture', 'confirm', root)).resolves.toMatchObject({
    edited: false,
    drift: [],
    stale: false,
  });
});

it('the public native land freezes canonical before facts, pins and revision context without copying caches', async () => {
  const { root, folder } = await fixture();
  const actualSlug = 'confirmation-folder';
  await rename(path.join(folder, 'plans/confirm'), path.join(folder, 'plans', actualSlug));
  const before = await readModelIndex('model-fixture', root);
  if (before === null) throw new Error('Missing current fixture');
  const revision = path.join(folder, 'plans/confirmation-folder/revisions');
  await mkdir(revision);
  await cp(
    path.join(folder, 'plans/confirmation-folder/plan.yaml'),
    path.join(revision, '1.0.yaml'),
  );
  for (const directory of ['.groundwork', 'explorer']) {
    await mkdir(path.join(folder, directory));
    await writeFile(path.join(folder, directory, 'keep.txt'), 'Original cache remains');
  }
  await command(folder, 'check', actualSlug);
  await expect(command(folder, 'land', actualSlug)).resolves.toContain(
    'canonical before model retained',
  );
  const frozen = await readModelPlanBase('model-fixture', actualSlug, root);
  expect(frozen?.model).toEqual(before.model);
  expect(frozen?.index.get('h:confirm#tx/audit')).toBeNull();
  await expect(
    readFile(path.join(folder, 'plans/confirmation-folder/base.lock.json')),
  ).rejects.toThrow(/ENOENT/u);
  for (const directory of ['.groundwork', 'explorer']) {
    await expect(readFile(path.join(folder, directory, 'keep.txt'), 'utf8')).resolves.toBe(
      'Original cache remains',
    );
    await expect(
      readFile(path.join(folder, 'plans/confirmation-folder/base', directory, 'keep.txt')),
    ).rejects.toThrow(/ENOENT/u);
  }
  const system = path.join(folder, 'domains/orders/systems/ordering/system.yaml');
  const text = await readFile(system, 'utf8');
  await writeFile(system, text.replace('name: Ordering API', 'name: Current renamed ordering API'));
  const pin = path.join(folder, 'evidence/example/orders/repository.json');
  const evidence = await readFile(pin, 'utf8');
  await writeFile(pin, evidence.replace('a'.repeat(40), 'c'.repeat(40)));
  const handler = path.join(folder, 'domains/orders/systems/ordering/handlers/ordering.yaml');
  const handlers = await readFile(handler, 'utf8');
  await writeFile(
    handler,
    handlers.replace('id: save, write:', 'id: save, say: Current changed save, write:'),
  );
  const selected = await readSelectedPlanContext('model-fixture', actualSlug, root);
  const historical = await readSelectedRevisionContext('model-fixture', actualSlug, '1.0', root);
  expect(selected?.beforeIndex.get('svc:ordering')?.data.name).toBe('Ordering API');
  expect(historical?.beforeIndex.get('svc:ordering')?.data.name).toBe('Ordering API');
  expect(selected?.afterIndex.get('h:confirm#tx/audit')).not.toBeNull();
  const entryBefore = await readEntryFlowPage(
    'model-fixture',
    { id: 'api-confirm', plan: 'plan-confirm', version: 'before' },
    root,
  );
  const entryAfter = await readEntryFlowPage(
    'model-fixture',
    { id: 'api:confirm', plan: 'plan:confirm', version: 'after' },
    root,
  );
  const entryCurrent = await readEntryFlowPage('model-fixture', { id: 'api-confirm' }, root);
  const flatten = (nodes: readonly FlowNode[]): readonly FlowNode[] =>
    nodes.flatMap((node) => [node, ...node.branches.flatMap((branch) => flatten(branch.nodes))]);
  const save = (page: typeof entryBefore): FlowNode | undefined =>
    page?.flow?.handlers
      .flatMap((flow) => flatten(flow.nodes))
      .find((node) => node.id === 'h:confirm#tx/save');
  expect(entryBefore?.flow?.component).toBe('Ordering API');
  expect(entryAfter?.flow?.component).toBe('Ordering API');
  expect(entryCurrent?.flow?.component).toBe('Current renamed ordering API');
  expect(save(entryBefore)?.title).toBe('write · status');
  expect(save(entryAfter)?.title).toBe('Save the confirmed order');
  expect(save(entryCurrent)?.title).toBe('Current changed save');
  expect(
    save(entryBefore)?.citations.some((cite) => cite.href?.includes('a'.repeat(40)) === true),
  ).toBe(true);
  expect(
    save(entryAfter)?.citations.some((cite) => cite.href?.includes('a'.repeat(40)) === true),
  ).toBe(true);
  expect(
    save(entryCurrent)?.citations.some((cite) => cite.href?.includes('c'.repeat(40)) === true),
  ).toBe(true);

  expect(selected?.beforeIndex.cites('h:confirm#tx/save')).toContainEqual(
    expect.objectContaining({ commit: 'a'.repeat(40) }),
  );
  if (selected === null) throw new Error('Missing landed projection');
  await expect(validateModel(selected.before)).resolves.toEqual([]);
  await expect(validateModel(selected.after)).resolves.toContainEqual(
    expect.objectContaining({
      message:
        'Proposed behaviour requires implementation evidence before it can become current facts.',
    }),
  );
});

it('requires open ancestors to land first, then checks descendants without replaying implemented ancestors', async () => {
  const { root, folder } = await fixture();
  for (const [slug, value] of [
    [
      'parent',
      {
        meta: { id: 'plan:parent', title: 'Add the tool' },
        problem: { summary: 'Synthetic parent.' },
        changes: [
          {
            id: 'chg:parent',
            title: 'Add the tool',
            ops: [
              {
                add: 'component',
                into: 'sys:ordering',
                value: { id: 'app:retail', name: 'Retail tool', kind: 'app', form: 'admin' },
              },
            ],
          },
        ],
      },
    ],
    [
      'child',
      {
        meta: { id: 'plan:child', title: 'Name the tool' },
        problem: { summary: 'Synthetic child.' },
        builds_on: ['plan:parent'],
        changes: [
          {
            id: 'chg:child',
            title: 'Name the tool',
            ops: [{ modify: 'app:retail', set: { name: 'Retail sales tool' } }],
          },
        ],
      },
    ],
  ] as const) {
    await mkdir(path.join(folder, 'plans', slug));
    await writeFile(path.join(folder, 'plans', slug, 'plan.yaml'), stringify(value));
  }
  await expect(runModelPlanBase('check', 'model-fixture', 'child', root)).resolves.toContain(
    'fits its native base',
  );
  await expect(runModelPlanBase('land', 'model-fixture', 'child', root)).rejects.toThrow(
    'land them first',
  );
  await runModelPlanBase('land', 'model-fixture', 'parent', root);
  const system = path.join(folder, 'domains/orders/systems/ordering/system.yaml');
  const raw: unknown = parse(await readFile(system, 'utf8'));
  const check = await modelValidator('workspace', 'SystemFile');
  if (!check(raw)) throw new Error('Invalid system fixture');
  await writeFile(
    system,
    stringify({
      ...raw,
      components: [
        ...(raw.components ?? []),
        {
          id: 'app:retail',
          name: 'Implemented retail tool',
          kind: 'app',
          form: 'admin',
        },
      ],
    }),
  );
  await expect(runModelPlanBase('check', 'model-fixture', 'child', root)).resolves.toContain(
    'fits its native base',
  );
  const current = await readModelIndex('model-fixture', root);
  if (current === null) throw new Error('Missing current fixture');
  const batch = await validatePlanProjections(
    await readModelPlans('model-fixture', root),
    current.model,
    {
      frozenBases: await readModelFrozenBases('model-fixture', root),
    },
  );
  expect(batch.problems).toEqual([]);
  const child = await readSelectedPlanContext('model-fixture', 'child', root);
  expect(child?.beforeIndex.get('app:retail')?.data.name).toBe('Implemented retail tool');
  expect(child?.afterIndex.get('app:retail')?.data.name).toBe('Retail sales tool');
});
