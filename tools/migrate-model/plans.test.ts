import { describe, expect, it, vi } from 'vitest';

import { modelList, modelRecord } from '@/domain/workspace-model';
import { modelProblems } from '@/infrastructure/model-schema';

import { migrationCitations } from './citations';
import { migratePlan } from './plans';
import { migrationReview } from './review';

vi.mock(import('server-only'), () => ({}));

describe('plan migration', () => {
  it('converts nested handler steps and field ids while preserving after anchors', async () => {
    const review = migrationReview();
    const result = migratePlan(
      {
        meta: { id: 'care', title: 'Care', programme: 'care' },
        problem: { summary: 'A customer needs a car.' },
        changes: [
          {
            id: 'chg:reserve',
            title: 'Reserve a car',
            ops: [
              {
                modify: 'h:reserve',
                set: {
                  steps: [{ each: 'car', do: [{ call: 'api:reserve', origin: 'extracted' }] }],
                },
              },
              { add: 'field', into: 'sch:order', value: { name: 'reservationId', type: 'string' } },
              {
                add: 'step',
                into: 'flow:reserve',
                after: 'flow:reserve#request',
                value: {
                  id: 'flow:reserve#confirm',
                  from: 'svc:shop',
                  to: 'svc:shop',
                  via: 'internal',
                  action: 'Confirm',
                },
              },
            ],
          },
        ],
      },
      {
        path: 'plans/care/plan.yaml',
        review,
        citations: migrationCitations([], review, 'plan:care'),
        placements: new Map(),
      },
    );
    await expect(modelProblems('plan', 'document', result)).resolves.toEqual([]);
    const ops = modelList(modelRecord(modelList(result.changes)[0])?.ops);
    expect(ops[0]).toEqual({
      modify: 'h:reserve',
      set: {
        steps: [{ id: 'car', each: 'car', steps: [{ id: 'call-reserve', call: 'api:reserve' }] }],
      },
    });
    expect(ops[1]).toMatchObject({ value: { id: 'reservationId', name: 'reservationId' } });
    expect(ops[2]).toMatchObject({
      after: 'flow:reserve#request',
      value: { id: 'confirm', transport: 'internal' },
    });
    expect(result.meta).toMatchObject({ id: 'plan:care', programme: 'prog:care' });
  });
  it('declares a subscription in the handler’s known containing system without guessing placement', () => {
    const review = migrationReview();
    const result = migratePlan(
      {
        meta: { id: 'care', title: 'Care' },
        changes: [
          {
            id: 'chg:care',
            ops: [
              {
                add: 'handler',
                value: { id: 'h:care', component: 'svc:shop', on: 'msg:ordered', steps: [] },
              },
            ],
          },
        ],
      },
      {
        path: 'plans/care/plan.yaml',
        review,
        citations: migrationCitations([], review, 'plan:care'),
        placements: new Map([['svc:shop', 'sys:shop']]),
      },
    );
    expect(modelRecord(modelList(result.changes)[0])?.ops).toEqual([
      {
        add: 'subscription',
        into: 'sys:shop',
        value: { id: 'sub:shop-ordered', component: 'svc:shop', message: 'msg:ordered' },
      },
      {
        add: 'handler',
        into: 'sys:shop',
        value: { id: 'h:care', component: 'svc:shop', on: 'sub:shop-ordered', steps: [] },
      },
    ]);
    expect(review.pending('placements')).toBe(0);
  });
});

it('retains noncanonical plan context for explicit reconciliation and applies only the reviewed replacement', () => {
  const review = migrationReview();
  const original = {
    meta: { id: 'care', title: 'Care' },
    problem: { summary: 'A need' },
    domain: { summary: 'An authored baseline explanation' },
    context: ['svc:shop'],
    changes: [],
  };
  const context = {
    path: 'plans/care/plan.yaml',
    review,
    citations: migrationCitations([], review, 'plan:care'),
    placements: new Map<string, string>(),
  };
  const initial = migratePlan(original, context);
  expect(initial.domain).toEqual(original.domain);
  expect(review.pending('documents')).toBe(1);
  expect(review.rows().documents?.[0]?.original).toEqual(original);
  const accepted =
    review.rows().documents?.map((row) => ({
      ...row,
      status: 'accepted',
      plan: { meta: original.meta, problem: original.problem, changes: [] },
    })) ?? [];
  const reviewed = migrationReview([accepted]);
  const result = migratePlan(original, { ...context, review: reviewed });
  expect(result).toEqual({
    meta: { id: 'plan:care', title: 'Care' },
    problem: original.problem,
    changes: [],
  });
  expect(reviewed.pending('documents')).toBe(0);
});

it('retains a proposed component summary and job classification without inventing a trigger', async () => {
  const review = migrationReview();
  const result = migratePlan(
    {
      meta: { id: 'coverage', title: 'Coverage' },
      problem: { summary: 'Coverage is unknown.' },
      changes: [
        {
          id: 'chg:coverage',
          title: 'Report coverage',
          ops: [
            {
              add: 'service',
              into: 'sys:price',
              value: {
                id: 'svc:coverage',
                name: 'Coverage',
                kind: 'job',
                summary: 'Reports the products and prices in each market.',
              },
            },
          ],
        },
      ],
    },
    {
      path: 'plans/coverage/plan.yaml',
      review,
      citations: migrationCitations([], review, 'plan:coverage'),
      placements: new Map(),
    },
  );
  const op = modelRecord(modelList(modelRecord(modelList(result.changes)[0])?.ops)[0]);
  expect(op).toEqual({
    add: 'component',
    into: 'sys:price',
    value: {
      id: 'svc:coverage',
      name: 'Coverage',
      kind: 'service',
      does: 'Reports the products and prices in each market.\n\nProposed classification: job.',
    },
  });
  await expect(modelProblems('plan', 'document', result)).resolves.toEqual([]);
});
