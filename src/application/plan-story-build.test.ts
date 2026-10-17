import { describe, expect, it } from 'vitest';

import {
  ORDER_NOTES_DONE,
  ORDER_NOTES_UNDER_WAY,
  orderNotes,
} from '@/../test/fixtures/acme/plans/chapters-order-notes';
import { sameDay } from '@/../test/fixtures/acme/plans/chapters-same-day';
import { modelOf } from '@/../test/plan-kit';
import { buildSummary } from '@/application/plan-viz-milestone';
import type { IssueStatus } from '@/domain/plan/plan-status';
import type { Plan } from '@/domain/plan/plan.generated';

import { orderHeadline, waveViews, workHeadline } from './plan-story-build';

function read(plan: Plan, status: IssueStatus = {}) {
  const model = modelOf(plan, { status });
  return { model, sum: buildSummary(model, model.today) };
}

const CASES: readonly (readonly [string, Plan, IssueStatus, readonly [string, string]])[] = [
  [
    'a draft',
    sameDay(),
    {},
    [
      'M1 waits on Catalogue’s Index the same-day flag; the critical path then runs through Web.',
      'Catalogue carries the critical path: 2 of 7 work items, one XL.',
    ],
  ],
  [
    'an approved plan not started',
    orderNotes(),
    {},
    [
      'Orders and Web have work left for M1 (due 12 Jun); 0 of 5 done. The critical path runs through Orders and Web.',
      'Orders and Web have the 5 work items still to do.',
    ],
  ],
  [
    'a plan in delivery',
    orderNotes(),
    ORDER_NOTES_UNDER_WAY,
    [
      'Web has work left for M1 (due 12 Jun); 2 of 5 done. The critical path runs through Web.',
      'Web and Orders have the 3 work items still to do.',
    ],
  ],
  [
    'a delivered plan',
    orderNotes(),
    ORDER_NOTES_DONE,
    [
      'Delivered: all 5 work items done; the last milestone closed 27 May.',
      'Orders built most of it: 3 of 5 work items.',
    ],
  ],
];

describe('build headlines', () => {
  it.each(CASES)(
    'says one claim for the order and one for the work in %s',
    (_, plan, status, want) => {
      const { model, sum } = read(plan, status);
      expect([orderHeadline(model, sum, model.waves()), workHeadline(model, sum)]).toEqual(want);
    },
  );

  it('puts every work item in one wave and completes each milestone once before delivery', () => {
    for (const [, plan, status] of CASES) {
      const { model, sum } = read(plan, status);
      const views = waveViews(model, sum, false);
      expect(views.flatMap((v) => v.ids).toSorted((a, b) => a.localeCompare(b))).toEqual(
        sum.items.map((w) => w.id).toSorted((a, b) => a.localeCompare(b)),
      );
      expect(views.flatMap((v) => v.checkpoints)).toHaveLength(
        sum.delivered ? 0 : sum.milestones.length,
      );
      expect(views[0]?.hint).toBe('First, once approved');
    }
  });

  it('says a wave can start now once the plan is approved', () => {
    const { model, sum } = read(sameDay());
    expect(waveViews(model, sum, true)[0]?.hint).toBe('Can start now');
    expect(waveViews(model, sum, true)[1]?.hint).toBe('Starts when wave 1 is done');
  });

  it('folds a finished wave', () => {
    const { model, sum } = read(orderNotes(), ORDER_NOTES_DONE);
    expect(waveViews(model, sum, true).every((v) => v.finished)).toBe(true);
    expect(waveViews(model, sum, true)[0]?.label).toBe('Wave 1 · done');
  });
});
