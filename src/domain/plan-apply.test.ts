import { cp, mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { beforeAll, describe, expect, it, vi } from 'vitest';
import { parse } from 'yaml';

import { indexOf } from '@/application/model-index';
import { plansIndex } from '@/application/plans-index';
import { modelValidator } from '@/infrastructure/model-schema';
import { readModel } from '@/infrastructure/read-model';
import { validateModel } from '@/infrastructure/validate-model';

import { apply, type ModelOp } from './plan-apply';
import type { ModelPlan, WorkspaceModel } from './workspace-model';

vi.mock(import('server-only'), () => ({}));
let model: WorkspaceModel;
let plan: ModelPlan;
let checkOp: (value: unknown) => value is ModelOp;
function opsOf(values: readonly unknown[]): readonly ModelOp[] {
  return values.map((value) => {
    if (!checkOp(value)) throw new Error('Invalid test operation');
    return value;
  });
}
beforeAll(async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'groundwork-apply-'));
  await cp(path.resolve('test/fixtures/model'), path.join(root, 'model'), { recursive: true });
  const loaded = await readModel('model-fixture', root);
  if (loaded === null) throw new Error('Missing fixture');
  model = loaded;
  const value: unknown = parse(
    await readFile(path.join(root, 'model/plans/confirm/plan.yaml'), 'utf8'),
  );
  const check = await modelValidator('plan', 'document');
  if (!check(value)) throw new Error(JSON.stringify(check.errors));
  plan = value;
  checkOp = await modelValidator('plan', 'op');
});

describe('canonical plan overlays', () => {
  it('applies every fixture op without changing today or losing nested identities', async () => {
    const before = JSON.stringify(model);
    const after = apply(
      plan.changes.flatMap((change) => change.ops ?? []),
      model,
    );
    expect(JSON.stringify(model)).toBe(before);
    expect(after).not.toBe(model);
    await expect(validateModel(after)).resolves.toEqual([]);
    const index = indexOf(after);
    expect(index.get('h:confirm#tx/save')?.data.say).toBe('Save the confirmed order');
    expect(index.get('sch:order#status')?.data.note).toBe('The confirmed state');
    expect(index.get('scr:checkout#confirm')?.data.name).toBe('Confirm order');
    expect(index.get('h:confirm#!db-down')?.data.return).toBe(502);
    expect(index.get('h:confirm#tx/audit')?.data.cites).toEqual([
      { kind: 'evidence', id: 'ev:source' },
    ]);
    expect(index.get('h:confirm#tx/audit')?.parent).toBe('h:confirm#tx');
    expect(index.get('api:legacy')?.data.deprecated).toBe(true);
    expect(index.get('api:confirm')?.data.supersedes).toBe('api:legacy');
    expect(index.get('job:manual')).toBeNull();
    const steps = after.domains[0]?.systems[0]?.handlers[0]?.steps.find(
      (step) => step.id === 'tx',
    )?.steps;
    expect(steps?.map((step) => step.id)).toEqual(['save', 'audit', 'queue']);
  });
  it('resolves new shorthand spans from the declared handler without guessing a file', async () => {
    const after = apply(
      opsOf([
        {
          add: 'step',
          into: 'h:confirm',
          value: { id: 'audit', does: 'Audit', cites: ['#L73-75'] },
        },
      ]),
      model,
    );
    expect(indexOf(after).cites('h:confirm#audit')).toEqual([
      {
        kind: 'code',
        repo: 'example/orders',
        commit: 'a'.repeat(40),
        path: 'apps/ordering/src/Confirm.ts',
        lines: [73, 75],
      },
    ]);
    await expect(validateModel(after)).resolves.toEqual([]);
  });
  it('supports set, append and drop while preserving resolved existing citations', async () => {
    const after = apply(
      opsOf([
        { modify: 'svc:ordering', append: { uses: ['lib:other'] } },
        { modify: 'svc:ordering', drop: { uses: ['lib:messaging'] } },
        {
          modify: 'h:confirm',
          append: { steps: [{ id: 'last', does: 'Finish', cites: ['#L76-77'] }] },
        },
      ]),
      model,
    );
    expect(indexOf(after).get('svc:ordering')?.data.uses).toEqual(['lib:other']);
    expect(indexOf(after).get('h:confirm#last')?.data.cites).toEqual([
      expect.objectContaining({ lines: [76, 77] }),
    ]);
    await expect(validateModel(after)).resolves.toEqual([]);
  });
  it('initialises absent optional error lists without changing the base or its facts', async () => {
    const before = JSON.stringify(model);
    const entry = indexOf(model).get('api:legacy')?.data;
    expect(entry?.errors).toBeUndefined();
    const after = apply(
      opsOf([
        {
          modify: 'api:legacy',
          append: {
            errors: [{ status: 409, when: 'The account is not approved', cites: ['ev:source'] }],
          },
        },
      ]),
      model,
    );
    expect(indexOf(after).get('api:legacy')?.data).toEqual({
      ...entry,
      errors: [
        {
          status: 409,
          when: 'The account is not approved',
          cites: [{ kind: 'evidence', id: 'ev:source' }],
        },
      ],
    });
    await expect(validateModel(after)).resolves.toEqual([]);
    expect(JSON.stringify(model)).toBe(before);
  });
  it('still rejects present non-array targets and dropping an absent collection', () => {
    const before = JSON.stringify(model);
    expect(() =>
      apply(
        opsOf([
          {
            modify: 'api:legacy',
            set: { errors: 'Not a list' },
            append: { errors: [{ status: 409, when: 'The account is not approved' }] },
          },
        ]),
        model,
      ),
    ).toThrow('append requires an existing array');
    expect(() => apply(opsOf([{ modify: 'api:legacy', drop: { errors: [] } }]), model)).toThrow(
      'drop requires an existing array',
    );
    expect(JSON.stringify(model)).toBe(before);
  });
  it('retains misspelt appended properties for authoritative schema rejection', async () => {
    const before = JSON.stringify(model);
    const after = apply(
      opsOf([
        {
          modify: 'api:legacy',
          append: { erorrs: [{ status: 409, when: 'The account is not approved' }] },
        },
      ]),
      model,
    );
    expect(indexOf(after).get('api:legacy')?.data.erorrs).toEqual([
      { status: 409, when: 'The account is not approved' },
    ]);
    await expect(validateModel(after)).resolves.not.toEqual([]);
    expect(JSON.stringify(model)).toBe(before);
  });
  it('replaces citation gaps only where the plan supplies a new citation and drops gaps for removed entities', () => {
    const missing = apply(
      opsOf([{ modify: 'h:confirm#done', set: { cites: ['missing:Absent.ts'] } }]),
      model,
    );
    expect(missing.problems).toContainEqual(
      expect.objectContaining({
        id: 'h:confirm#done',
        property: 'cites',
        reference: 'missing:Absent.ts',
      }),
    );
    const fixed = apply(
      opsOf([{ modify: 'h:confirm#done', set: { cites: ['ev:source'] } }]),
      missing,
    );
    expect(fixed.problems).toEqual([]);
    expect(missing.problems).toHaveLength(1);
    const removed = apply(opsOf([{ remove: 'h:confirm#done' }]), missing);
    expect(removed.problems).toEqual([]);
    const owner = apply(
      opsOf([
        { modify: 'st:orders', set: { owner: { id: 'svc:ordering', cites: ['ev:absent'] } } },
      ]),
      model,
    );
    const different = apply(opsOf([{ modify: 'st:orders', set: { cites: ['ev:source'] } }]), owner);
    expect(different.problems).toContainEqual(
      expect.objectContaining({ id: 'st:orders', property: 'owner/cites' }),
    );
  });
  it('resolves a new system using its own declared homes and a known repository pin', async () => {
    const after = apply(
      opsOf([
        {
          add: 'system',
          into: 'dom:orders',
          value: {
            id: 'sys:other',
            name: 'Other',
            homes: { other: { repo: 'example/orders', path: 'other' } },
            components: [
              { id: 'svc:other', kind: 'service', name: 'Other', cites: ['other:Start.ts#L1-2'] },
            ],
          },
        },
      ]),
      model,
    );
    expect(indexOf(after).cites('svc:other')).toEqual([
      {
        kind: 'code',
        repo: 'example/orders',
        commit: 'a'.repeat(40),
        path: 'other/Start.ts',
        lines: [1, 2],
      },
    ]);
    await expect(validateModel(after)).resolves.toEqual([]);
  });

  it('edits a declared alias target and rejects a retired alias', () => {
    const after = apply(
      opsOf([{ modify: 'svc:old-ordering', set: { does: 'Confirms orders' } }]),
      model,
    );
    expect(indexOf(after).get('svc:ordering')?.data.does).toBe('Confirms orders');
    expect(() =>
      apply(
        opsOf([{ modify: 'api:retired', set: { summary: 'Cannot restore a retired identity' } }]),
        model,
      ),
    ).toThrow('expected exactly one declared model entity');
  });

  it('rejects identity changes, missing parents, invalid sibling placement and duplicate ids', () => {
    const invalid: readonly (readonly unknown[])[] = [
      [{ modify: 'svc:ordering', set: { id: 'svc:renamed' } }],
      [{ modify: 'svc:absent', set: { does: 'Missing' } }],
      [
        {
          add: 'component',
          into: 'dom:orders',
          value: { id: 'svc:new', name: 'New', kind: 'service' },
        },
      ],
      [
        {
          add: 'step',
          into: 'h:confirm#tx',
          after: 'h:confirm#done',
          value: { id: 'new', does: 'New' },
        },
      ],
      [{ add: 'step', into: 'h:confirm#tx', value: { id: 'save', does: 'Duplicate' } }],
      [{ modify: 'svc:ordering', set: { cites: [] } }],
      [{ modify: 'svc:ordering', set: { cites: [{ kind: 'evidence', id: 'ev:source' }] } }],
      [{ modify: 'svc:ordering', append: { name: ['Wrong'] } }],
      [{ modify: 'svc:ordering', drop: { name: ['Wrong'] } }],
    ];
    for (const ops of invalid) {
      expect(() => apply(opsOf(ops), model)).toThrow(
        /identity|expected exactly|cannot add|not a sibling|Duplicate|requires an existing array|authored citation|authored strings/u,
      );
    }
    expect(indexOf(model).get('h:confirm#tx/save')?.data.say).toBeUndefined();
  });
  it('uses the authoritative contract to reject invalid values after generic set ops', async () => {
    await expect(
      validateModel(apply(opsOf([{ modify: 'job:unknown', set: { cron: 42 } }]), model)),
    ).resolves.toContainEqual(expect.objectContaining({ at: 'sys:ordering/jobs/3/cron' }));
    await expect(
      validateModel(apply(opsOf([{ modify: 'svc:ordering', set: { invented: true } }]), model)),
    ).resolves.not.toEqual([]);
  });
  it('retains an unknown prototype-named patch property so the contract can reject it', async () => {
    const value: unknown = JSON.parse(
      '{"modify":"st:unknown-owner","set":{"__proto__":{"owner":{"id":"svc:ordering","cites":[{"kind":"evidence","id":"ev:source"}]}}}}',
    );
    const after = apply(opsOf([value]), model);
    expect(indexOf(after).resourceOwner('st:unknown-owner')).toBeNull();
    await expect(validateModel(after)).resolves.not.toEqual([]);
  });

  it('indexes independent before and after models without a model-to-plan dependency', () => {
    const index = plansIndex([plan], model);
    expect(index.plansTouching('h:confirm#tx/save')).toHaveLength(1);
    expect(index.plansTouching('job:absent')).toEqual([]);
    expect(index.plansTouching('sys:ordering')).toHaveLength(1);
    expect(index.plansTouching('svc:ordering')).toHaveLength(1);
    expect(index.plansTouching('model-fixture')).toHaveLength(1);
    expect(index.plans[0]?.before).toBe(model);
    expect(index.plans[0]?.beforeIndex.get('h:confirm#tx/save')?.data.say).toBeUndefined();
    expect(index.plans[0]?.afterIndex.get('h:confirm#tx/save')?.data.say).toBe(
      'Save the confirmed order',
    );
  });
});
