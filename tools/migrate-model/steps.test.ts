import { describe, expect, it, vi } from 'vitest';
import { parse } from 'yaml';

import { modelRecord } from '@/domain/workspace-model';
import { modelValidator } from '@/infrastructure/model-schema';

import { migrationReview } from './review';
import { migrateFailures, migrateSteps, type StepContext } from './steps';

vi.mock(import('server-only'), () => ({}));

function context(review = migrationReview()): StepContext {
  return {
    path: 'h:example',
    assigned: null,
    review,
    cites: ['repo:src/file.ts#L1-99'],
    cite: (_step, inherited) => inherited,
  };
}
describe('migration of handler steps', () => {
  it('retains nested execution, effect modifiers and explicit ids', async () => {
    const steps = migrateSteps(
      [
        {
          id: 'given',
          transaction: true,
          do: [
            {
              each: 'item',
              do: [
                {
                  write: 'sch:result',
                  to: 'st:db',
                  when: 'enabled',
                  async: true,
                  causes: 'h:next',
                  origin: 'extracted',
                },
              ],
            },
            {
              retry: 'until the call succeeds',
              times: 3,
              do: [{ call: 'api:next' }, { wait: '2s' }],
            },
          ],
        },
        { do: [], origin: 'extracted' },
      ],
      context(),
    );
    expect(steps).toHaveLength(1);
    expect(JSON.stringify(steps)).not.toContain('origin');
    expect(steps[0]).toMatchObject({
      id: 'given',
      transaction: true,
      steps: [
        {
          id: 'item',
          each: 'item',
          steps: [
            {
              id: 'write-result',
              write: 'sch:result',
              to: 'st:db',
              when: 'enabled',
              async: true,
              causes: 'h:next',
            },
          ],
        },
        {
          retry: { description: 'until the call succeeds', times: 3 },
          steps: [{ id: 'call-next' }, { id: 'wait-2s' }],
        },
      ],
    });
    const validate = await modelValidator('workspace', 'Steps');
    expect(validate(steps), JSON.stringify(validate.errors)).toBe(true);
  });
  it('assigns location-sorted fallbacks independently of sibling order', () => {
    const a = { sources: [{ repo: 'example/repo', path: 'a.ts', lines: [9, 10] }], async: true };
    const b = { sources: [{ repo: 'example/repo', path: 'a.ts', lines: [2, 3] }], async: false };
    const first = migrateSteps([a, b], context());
    const reordered = migrateSteps([b, a], context());
    expect(first.map((step) => step.id)).toEqual(['step-2', 'step-1']);
    expect(reordered).toEqual(first.toReversed());
  });
  it('writes collisions for review without traversal-order numbering', () => {
    const review = migrationReview();
    const steps = migrateSteps(
      [{ call: 'api:next', does: 'First' }, { call: 'api:next', does: 'Second' }, {}],
      context(review),
    );
    expect(steps.map((step) => step.id)).toEqual(['', '', '']);
    expect(review.pending('step-ids')).toBe(3);
    expect(review.rows()['step-ids']).toHaveLength(3);
  });
  it('applies only accepted, current headline and identity rows', () => {
    const does =
      'This original detail is longer than the allowed headline and must remain available in full.';
    const source = [
      { call: 'api:next', does },
      { call: 'api:next', does: 'Other' },
    ];
    const review = migrationReview();
    migrateSteps(source, context(review));
    const accepted = (review.rows()['step-ids'] ?? []).map((row, index) => ({
      ...row,
      status: 'accepted',
      id: index === 0 ? 'next-a' : 'next-b',
    }));
    const nextReview = migrationReview([accepted]);
    const steps = migrateSteps(source, context(nextReview));
    const headline = nextReview.rows().headlines?.[0];
    expect(headline).toBeDefined();
    const finalReview = migrationReview([
      accepted,
      [{ ...headline, status: 'accepted', say: 'Call the next service' }],
    ]);
    expect(migrateSteps(source, context(finalReview))[0]).toMatchObject({
      does,
      say: 'Call the next service',
    });
    const changedReview = migrationReview([accepted]);
    const changed = migrateSteps(
      [{ ...source[0], does: `${does} Changed.` }, source[1]],
      context(changedReview),
    );
    expect(changedReview.pending('step-ids')).toBeGreaterThan(0);
    expect(changed[0]).not.toHaveProperty('say');
    expect(modelRecord(steps[0])?.say).toBeUndefined();
  });
  it('preserves failure results and citations with addressable ids', () => {
    expect(migrateFailures([{ when: 'database down', result: 503 }], context())).toEqual([
      {
        id: 'database-down',
        when: 'database down',
        return: 503,
        cites: ['repo:src/file.ts#L1-99'],
      },
    ]);
  });
});

it('reviews child-id collisions across branches of the same parent', () => {
  const review = migrationReview();
  const steps = migrateSteps(
    [parse('if: allowed\nthen: [{ return: 400 }]\nelse: [{ return: 400 }]')],
    context(review),
  );
  expect(review.pending('step-ids')).toBe(2);
  expect(steps[0]?.then).toMatchObject([{ id: '' }]);
  expect(steps[0]?.else).toMatchObject([{ id: '' }]);
});

it('preserves parallel lanes written as lists without merging their order', () => {
  const steps = migrateSteps(
    [
      {
        parallel: [[{ call: 'api:a' }, { call: 'api:b' }], [{ call: 'api:c' }]],
        sources: [{ repo: 'example/repo', path: 'a.ts', lines: [1, 10] }],
      },
    ],
    context(),
  );
  expect(steps[0]?.parallel).toMatchObject([
    { steps: [{ call: 'api:a' }, { call: 'api:b' }] },
    { steps: [{ call: 'api:c' }] },
  ]);
});

it('names the store when equal schema effects address different stores', () => {
  const review = migrationReview();
  const values = [
    { read: 'sch:plan', from: 'st:cache' },
    { read: 'sch:plan', from: 'st:database' },
  ];
  const first = migrateSteps(values, context(review));
  expect(first.map((step) => step.id)).toEqual(['read-plan-cache', 'read-plan-database']);
  expect(migrateSteps(values.toReversed(), context()).map((step) => step.id)).toEqual([
    'read-plan-database',
    'read-plan-cache',
  ]);
  expect(review.pending('step-ids')).toBe(0);
});
