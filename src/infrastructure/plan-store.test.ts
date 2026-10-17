import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { afterAll, describe, expect, it, vi } from 'vitest';
import { parse } from 'yaml';

import { pauseOrdersOverlay } from '@/../test/fixtures/acme/plans/pause-orders';
import {
  pauseOrdersAt,
  pauseOrdersStatus,
  productGraphOverlay,
} from '@/../test/fixtures/acme/plans/store-plans';
import { acmeFiles, tempDir, writeWorkspace } from '@/../test/workspace-kit';

vi.mock(import('server-only'), () => ({}));

const { listPlans, listRevisions, readPlan, readRevision, readStatus } =
  await import('./plan-store');
const { checkPlanData } = await import('./plan-validator');

const miniText = await readFile(
  path.resolve(import.meta.dirname, '../../test/fixtures/mini.yaml'),
  'utf8',
);

const root = await tempDir('plan-store-');
afterAll(async () => rm(root, { recursive: true, force: true }));
await writeWorkspace(path.join(root, 'acme'), {
  ...acmeFiles(),
  'plans/pause-orders/plan.yaml': pauseOrdersOverlay(),
  'plans/pause-orders/revisions/0.1.yaml': pauseOrdersAt('0.1'),
  'plans/pause-orders/revisions/0.2.yaml': pauseOrdersAt('0.2'),
  'plans/pause-orders/status.json': pauseOrdersStatus(),
  'plans/product-graph/plan.yaml': productGraphOverlay(),
});

type Edit = readonly [path: readonly (string | number)[], value: unknown];

/** The mini fixture as loose data, with each edit applied; an undefined value deletes the key. */
function edited(...edits: Edit[]): unknown {
  const data: unknown = parse(miniText);
  for (const [where, value] of edits) {
    const parent = where.slice(0, -1).reduce<unknown>((v, k) => Reflect.get(v as object, k), data);
    const key = where.at(-1) ?? '';
    if (value === undefined) Reflect.deleteProperty(parent as object, key);
    else Reflect.set(parent as object, key, value);
  }
  return data;
}

async function errorsOf(...edits: Edit[]) {
  const { errors, plan } = await checkPlanData(edited(...edits));
  expect(plan).toBeNull();
  return errors;
}

async function expectError(edits: Edit[], at: string, message: RegExp) {
  const errors = await errorsOf(...edits);
  expect(
    errors.some((e) => e.path === at && message.test(e.message)),
    `expected ${at}; got ${JSON.stringify(errors)}`,
  ).toBe(true);
}

describe('reading the plans of a workspace', () => {
  it('lists the plans of a workspace, and none for an unknown one', async () => {
    await expect(listPlans('acme', root)).resolves.toEqual(['pause-orders', 'product-graph']);
    await expect(listPlans('nowhere', root)).resolves.toEqual([]);
  });

  it('reads every plan without errors', async () => {
    for (const slug of await listPlans('acme', root)) {
      const { plan, errors } = await readPlan('acme', slug, { root });
      expect(errors, slug).toEqual([]);
      expect(plan?.meta.id, slug).toBe(slug);
    }
  });

  it('lists and reads revisions', async () => {
    await expect(listRevisions('acme', 'pause-orders', root)).resolves.toEqual(['0.1', '0.2']);
    await expect(listRevisions('acme', 'product-graph', root)).resolves.toEqual([]);
    const { plan, errors } = await readRevision(
      { workspace: 'acme', slug: 'pause-orders', version: '0.1' },
      { root },
    );
    expect(errors).toEqual([]);
    expect(plan?.meta.version).toBe('0.1');
    const current = await readPlan('acme', 'pause-orders', { root });
    expect(current.plan?.meta.version).toBe('1.0');
  });

  it('reads status.json, or an empty status when there is none', async () => {
    const status = await readStatus('acme', 'pause-orders', root);
    expect(status['wi:pause-api']?.state).toBe('closed');
    expect(status['wi:desk-button']?.state).toBe('open');
    await expect(readStatus('acme', 'product-graph', root)).resolves.toEqual({});
  });
});

describe('files that do not read', () => {
  const scratch = path.join(process.cwd(), 'node_modules', '.cache');
  const made: string[] = [];
  const folder = async (): Promise<string> => {
    await mkdir(scratch, { recursive: true });
    const dir = await mkdtemp(path.join(scratch, 'plan-store-'));
    made.push(dir);
    await mkdir(path.join(dir, 'ws', 'plans', 'p'), { recursive: true });
    await writeFile(path.join(dir, 'ws', 'workspace.yaml'), 'id: ws\nname: WS\n');
    return dir;
  };
  afterAll(async () => {
    await Promise.all(made.map(async (dir) => rm(dir, { recursive: true, force: true })));
  });

  it('reports a YAML syntax error as an error at the root', async () => {
    const dir = await folder();
    await writeFile(path.join(dir, 'ws', 'plans', 'p', 'plan.yaml'), 'meta: [unclosed\n');
    const { plan, errors } = await readPlan('ws', 'p', { root: dir });
    expect(plan).toBeNull();
    expect(errors[0]?.path).toBe('(root)');
  });

  it('reports a missing plan.yaml as an error', async () => {
    const dir = await folder();
    const { plan, errors } = await readPlan('ws', 'absent', { root: dir });
    expect(plan).toBeNull();
    expect(errors).toHaveLength(1);
  });

  it('rejects a status.json of the wrong shape', async () => {
    const dir = await folder();
    await writeFile(
      path.join(dir, 'ws', 'plans', 'p', 'status.json'),
      '{"wi:a": {"state": "maybe"}}',
    );
    await expect(readStatus('ws', 'p', dir)).rejects.toThrow(/status\.json/u);
  });
});

describe('schema errors read as a fix', () => {
  it('a plan must be a mapping', async () => {
    const { plan, errors } = await checkPlanData(['a']);
    expect(plan).toBeNull();
    expect(errors).toEqual([{ path: '(root)', message: 'plan must be a YAML mapping' }]);
  });
  it('the fixture itself passes', async () => {
    const { plan, errors } = await checkPlanData(edited());
    expect(errors).toEqual([]);
    expect(plan?.meta.id).toBe('mini');
  });
  it('unknown property lists the allowed keys', async () =>
    expectError(
      [[['services', 0, 'teem'], 'x']],
      'services[0].teem',
      /unknown property.*allowed: id, name, team.*rename it to an allowed key or delete it/u,
    ));
  it('missing required property', async () =>
    expectError([[['services', 0, 'kind'], undefined]], 'services[0].kind', /is required/u));
  it('id prefix', async () =>
    expectError(
      [[['teams', 0, 'id'], 'svc:web']],
      'teams[0].id',
      /must look like team:<kebab-slug>/u,
    ));
  it('wrong target prefix', async () =>
    expectError(
      [[['messages', 0, 'topic'], 'svc:subs']],
      'messages[0].topic',
      /must look like st:/u,
    ));
  it('enum', async () =>
    expectError([[['stores', 0, 'kind'], 'table']], 'stores[0].kind', /must be one of: database/u));
  it('date format', async () =>
    expectError([[['meta', 'date'], '1 Oct']], 'meta.date', /must be a date \(YYYY-MM-DD\)/u));
  it('an unquoted YAML date gets a quoting hint', async () =>
    expectError([[['meta', 'date'], new Date('2026-10-01')]], 'meta.date', /quoted strings/u));
  it('wrong type, with the list hint', async () =>
    expectError(
      [[['problem', 'goals'], 'one']],
      'problem.goals',
      /must be array \(got string\); wrap it in a list/u,
    ));
  it('an empty list that needs an item', async () => {
    const errors = await errorsOf([['changes', 0, 'ops'], []]);
    expect(errors.some((e) => e.message.includes('at least 1 item'))).toBe(true);
  });
  it('op: modify branch errors name the modify shape only', async () =>
    expectError(
      [[['changes', 2, 'ops', 0, 'sett'], {}]],
      'changes[2].ops[0].sett',
      /unknown property \(allowed: modify, set, append, drop\)/u,
    ));
  it('op: modify needs set, append or drop', async () =>
    expectError(
      [[['changes', 2, 'ops', 0], { modify: 'flow:cancel#to-analytics' }]],
      'changes[2].ops[0]',
      /needs one of: set \| append \| drop/u,
    ));
  it('op: no kind key', async () =>
    expectError(
      [[['changes', 4, 'ops', 0], { delete: 'flow:cancel#legacy-email' }]],
      'changes[4].ops[0]',
      /exactly one of add \| modify/u,
    ));
  it('op: two kind keys', async () =>
    expectError(
      [[['changes', 4, 'ops', 0, 'add'], 'step']],
      'changes[4].ops[0]',
      /op has add \+ remove; use exactly one of/u,
    ));
  it('op: add value is checked against the entity', async () =>
    expectError(
      [[['changes', 3, 'ops', 0, 'value', 'acton'], 'x']],
      'changes[3].ops[0].value.acton',
      /unknown property/u,
    ));
  it('op: unknown add type', async () =>
    expectError(
      [[['changes', 3, 'ops', 0, 'add'], 'stepp']],
      'changes[3].ops[0].add',
      /must be one of: service \| system \| store/u,
    ));
  it('op: add field needs into', async () =>
    expectError(
      [[['changes', 0, 'ops', 3, 'into'], undefined]],
      'changes[0].ops[3].into',
      /is required/u,
    ));
  it('sources need a url, and take no unknown keys', async () => {
    await expectError(
      [[['services', 0, 'sources'], [{ label: 'x' }]]],
      'services[0].sources[0].url',
      /is required/u,
    );
    await expectError(
      [[['services', 0, 'sources'], [{ url: 'https://a.b/c', href: 'x' }]]],
      'services[0].sources[0].href',
      /unknown property/u,
    );
  });
  it('meta.repos must be org/name', async () =>
    expectError([[['meta', 'repos'], ['not a repo']]], 'meta.repos[0]', /look like/u));
  it('a modify that leaves its target off the schema is blamed on the op', async () => {
    const edits: Edit[] = [[['changes', 3, 'ops', 1, 'set'], { logik: 'x' }]];
    const { plan, errors } = await checkPlanData(edited(...edits));
    expect(plan).not.toBeNull();
    expect(
      errors.some(
        (e) =>
          e.path === 'changes[3].ops[1].set.logik' &&
          e.message.includes('not a property of a step'),
      ),
    ).toBe(true);
  });
  it('a modify with a bad value type is blamed on the op', async () => {
    const { errors } = await checkPlanData(
      edited([['changes', 0, 'ops', 2, 'set'], { required: 'yes' }]),
    );
    expect(
      errors.some(
        (e) => e.path === 'changes[0].ops[2].set.required' && e.message.includes('must be boolean'),
      ),
    ).toBe(true);
  });
});
