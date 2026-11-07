import { expect, it, vi } from 'vitest';

import { modelList, modelRecord } from '@/domain/workspace-model';
import { modelValidator } from '@/infrastructure/model-schema';

import { migrationCitations } from './citations';
import { migratePlan } from './plans';
import { fingerprint, migrationReview } from './review';

vi.mock(import('server-only'), () => ({}));

function convert(ops: readonly unknown[], accepted: readonly unknown[] = []) {
  const review = migrationReview(accepted);
  const original = { meta: { id: 'care', title: 'Care' }, changes: [{ id: 'chg:care', ops }] };
  const result = migratePlan(original, {
    path: 'plans/care/plan.yaml',
    review,
    citations: migrationCitations([], review, 'plan:care'),
    placements: new Map([['svc:shop', 'sys:shop']]),
  });
  return {
    original,
    result,
    review,
    ops: modelList(modelRecord(modelList(result.changes)[0])?.ops),
  };
}

it('converts endpoint set and append errors while retaining every code and condition', async () => {
  const errors = [
    { status: 404, code: 'not_found', when: 'No current view.' },
    { status: 400, code: 'bad_as_of', when: 'The instant is in the future.' },
    { status: 500, code: 'cache_error', when: 'Cache or Blob read fails.' },
  ];
  const sig = 'GET /api/v{version}/variants/{id}?asOf={instant}';
  const input = [
    { modify: 'api:variant', set: { sig, errors } },
    { modify: 'api:variant', append: { errors: [{ status: 409, code: 'conflict' }] } },
  ];
  const source = fingerprint(input);
  const converted = convert(input);
  const expected = errors.map(({ status, code, when }) => ({
    status,
    when: `${when} · Code: ${JSON.stringify(code)}`,
  }));
  expect(converted.ops).toEqual([
    {
      modify: 'api:variant',
      set: {
        sig,
        method: 'GET',
        path: '/api/v{version}/variants/{id}?asOf={instant}',
        errors: expected,
      },
    },
    {
      modify: 'api:variant',
      append: { errors: [{ status: 409, when: 'Code: "conflict"' }] },
    },
  ]);
  const check = await modelValidator('workspace', 'RestEntry');
  expect(
    check({ id: 'api:variant', sig, method: 'GET', path: '/variants', errors: expected }),
  ).toBe(true);
  expect(fingerprint(input)).toBe(source);
});

it('keeps non-HTTP endpoint signature patches without guessing a method or path', () => {
  const input = [{ modify: 'api:variant', set: { sig: 'GetVariant(request): Variant' } }];
  expect(convert(input).ops).toEqual(input);
});

it('replaces consumer appends only with exact placed subscription and handler bindings', () => {
  const input = ['update', 'reject'].flatMap((name) => [
    { modify: `msg:${name}`, append: { consumers: ['svc:shop'] } },
    {
      add: 'handler',
      value: { id: `h:${name}`, component: 'svc:shop', on: `msg:${name}`, steps: [] },
    },
  ]);
  const converted = convert(input);
  expect(converted.ops).toEqual(
    ['update', 'reject'].flatMap((name) => [
      {
        add: 'subscription',
        into: 'sys:shop',
        value: { id: `sub:shop-${name}`, component: 'svc:shop', message: `msg:${name}` },
      },
      {
        add: 'handler',
        into: 'sys:shop',
        value: { id: `h:${name}`, component: 'svc:shop', on: `sub:shop-${name}`, steps: [] },
      },
    ]),
  );
  expect(converted.review.pending('plan-consumers')).toBe(0);
});

it('retains and reviews a consumer append unless every consumer has a placed handler binding', () => {
  const declaration = { modify: 'msg:update', append: { consumers: ['svc:shop', 'svc:unknown'] } };
  const converted = convert([
    declaration,
    {
      add: 'subscription',
      into: 'sys:shop',
      value: { id: 'sub:unbound', component: 'svc:unknown', message: 'msg:update' },
    },
    {
      add: 'handler',
      value: { id: 'h:update', component: 'svc:shop', on: 'msg:update', steps: [] },
    },
  ]);
  expect(converted.ops[0]).toEqual(declaration);
  expect(converted.review.rows()['plan-consumers']).toEqual([
    expect.objectContaining({
      uncovered: [declaration],
      fingerprint: fingerprint(converted.ops),
      status: 'pending',
    }),
  ]);
});

it('accepts only a current reviewed whole-change replacement, including companion access', () => {
  const access = { modify: 'top:updates', append: { access: [{ svc: 'svc:shop', mode: 'read' }] } };
  const input = [
    access,
    { modify: 'msg:updates', append: { consumers: ['svc:shop'] } },
    { modify: 'flow:refresh', set: { outcome: 'The original outcome remains.' } },
  ];
  const initial = convert(input);
  expect(initial.ops).toEqual(input);
  const row = initial.review.rows()['plan-consumers']?.[0];
  expect(row).toMatchObject({ fingerprint: fingerprint(input), operations: input });
  const operations = [
    {
      add: 'subscription',
      into: 'sys:shop',
      value: { id: 'sub:shop-updates', component: 'svc:shop', message: 'msg:updates' },
    },
    input[2],
  ];
  const approval = [{ ...row, status: 'accepted', operations }];
  const reviewed = convert(input, [approval]);
  expect(reviewed.ops).toEqual(operations);
  expect(reviewed.review.pending('plan-consumers')).toBe(0);
  const changed = [
    { ...access, append: { access: [{ svc: 'svc:other', mode: 'read' }] } },
    ...input.slice(1),
  ];
  expect(() => convert(changed, [approval])).toThrow('Stale acceptance:');
});
