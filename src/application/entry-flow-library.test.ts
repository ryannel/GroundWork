import { expect, it } from 'vitest';

import { queryModel } from '@/../test/fixtures/model-queries';

import { modelWorkspaceCardOf } from './entry-flow-library';
import { indexOf } from './model-index';
import type { PlanRow, PlanStage } from './plan-list';

function row(id: string, stage: PlanStage, workItems = 0, done = 0): PlanRow {
  return {
    id,
    title: id,
    href: `/queries/plans/${id}/`,
    summary: `Authored summary for ${id}`,
    stage,
    date: null,
    domains: [],
    workItems,
    done,
    programme: null,
    check: null,
  };
}

it('keeps canonical workspace addresses and shows observed work state in lifecycle order', () => {
  const index = indexOf({ ...queryModel(), description: 'A recorded workspace', private: true });
  const card = modelWorkspaceCardOf(
    index,
    [
      row('finished', 'done', 2, 2),
      row('first-draft', 'draft'),
      row('delivery', 'delivery', 3, 1),
      row('approved', 'approved'),
      { ...row('review', 'review', 6), progressUnknown: 6 },
      row('second-draft', 'draft'),
      row('third-draft', 'draft'),
    ],
    { id: 'queries', folder: 'fixture', isExample: true, source: 'example', repo: null },
    true,
  );
  expect(card.plans.map(({ id, groupLabel, note }) => [id, groupLabel, note])).toEqual([
    [
      'review',
      'In review',
      '0 of 6 work items recorded closed; 6 items without a recorded issue state',
    ],
    ['delivery', 'In delivery', '1 of 3 work items recorded closed'],
    ['approved', 'Approved', 'Authored summary for approved'],
    ['first-draft', 'Draft', 'Authored summary for first-draft'],
    ['second-draft', 'Draft', 'Authored summary for second-draft'],
    ['third-draft', 'Draft', 'Authored summary for third-draft'],
  ]);
  expect(card.morePlans).toBe(1);
  expect(card).toMatchSnapshot('workspace counts, canonical destinations and bounded plan preview');
  expect(modelWorkspaceCardOf(index, []).location).toBeNull();
});
