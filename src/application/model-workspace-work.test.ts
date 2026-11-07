import { beforeAll, expect, it, vi } from 'vitest';

import { queryModel } from '@/../test/fixtures/model-queries';
import type { ModelPlan } from '@/domain/workspace-model';
import { modelValidator } from '@/infrastructure/model-schema';

import { indexOf } from './model-index';
import { modelPlanProgressOf } from './model-progress';
import {
  modelPartnerOf,
  modelPartnerRowsOf,
  modelProgrammeOf,
  modelProgrammeRowsOf,
  modelWorkLabelsOf,
} from './model-workspace-work';

vi.mock(import('server-only'), () => ({}));
let validate: ((value: unknown) => value is ModelPlan) & { errors?: unknown };
beforeAll(async () => {
  validate = await modelValidator('plan', 'document');
});
function entry() {
  const value: unknown = {
    meta: { id: 'plan:first', title: 'A proposal', programme: 'prog:sales' },
    problem: { summary: 'A change' },
    builds_on: ['plan:base'],
    decisions: [
      {
        id: 'dec:pending',
        title: 'Choose the rollout',
        status: 'proposed',
        decision: 'Choose the recorded rollout.',
      },
    ],
    changes: [
      {
        id: 'chg:change',
        title: 'Change',
        ops: [{ modify: 'st:remote', set: { name: 'Future store' } }],
      },
    ],
    milestones: [
      { id: 'ms:one', name: 'First delivery', due: '2026-12-01', serves: 'sales/ms:release' },
    ],
    work_items: [
      {
        id: 'wi:second',
        title: 'Second task',
        team: 'team:b',
        milestone: 'ms:one',
        depends_on: ['wi:first'],
        body: 'Full body. A second sentence.',
        blocked_by: ['dec:pending'],
      },
      {
        id: 'wi:first',
        title: 'First task',
        team: 'team:b',
        milestone: 'ms:one',
        repo: 'fixture/b',
        github_issue: 42,
      },
    ],
  };
  if (!validate(value)) throw new Error(JSON.stringify(validate.errors));
  return {
    slug: 'actual-folder',
    plan: value,
    landed: false,
    progress: modelPlanProgressOf({
      progress: {
        events: [
          {
            kind: 'work',
            subject: 'wi:first',
            at: '2026-11-01',
            state: 'done',
            note: 'Exact note',
            source: { kind: 'github', repo: 'fixture/b', issue: 42 },
          },
          {
            kind: 'commitment',
            subject: 'ms:one',
            at: '2026-11-02',
            state: 'accepted',
            promised_for: '2026-12-05',
            said_by: 'Pat',
          },
        ],
      },
      errors: [{ path: 'progress.yaml', message: 'Keep this warning' }],
    }),
  };
}
it('retains exact programme, assigned work, milestone dates/serves and independent events without promoting unknown state', () => {
  const base = queryModel();
  const programme = {
    id: 'prog:sales',
    title: 'Sales change',
    outcome: 'Full outcome',
    questions: [{ id: 'q:one', question: 'Who decides?', status: 'open' as const }],
    milestones: [{ id: 'ms:release', name: 'Release', due: '2026-12-02' }],
  };
  const index = indexOf({
    ...base,
    teams: [
      { id: 'team:b', name: 'Partner B', partner: true, contacts: [{ name: 'Pat', role: 'Lead' }] },
    ],
    programmes: [programme],
  });
  const first = entry();
  const basePlan: ModelPlan = {
    meta: { id: 'plan:base', title: 'Existing base' },
    problem: { summary: 'Base' },
    changes: [],
  };
  const entries = [first, { slug: 'base-folder', plan: basePlan }];
  const partner = modelPartnerOf(index, 'b', entries);
  expect(partner?.team.contacts).toEqual([{ name: 'Pat', role: 'Lead' }]);
  expect(partner?.plans[0]?.work.map((item) => item.source.id)).toEqual(['wi:first', 'wi:second']);
  expect(partner?.plans[0]?.work[1]).toMatchObject({
    state: 'No work state recorded',
    source: { body: 'Full body. A second sentence.', blocked_by: ['dec:pending'] },
  });
  expect(partner?.plans[0]?.milestones).toEqual(entries[0]?.plan.milestones);
  expect(partner?.plans[0]?.milestoneStanding[0]).toMatchObject({
    dates: { neededBy: '2026-12-01', promisedFor: '2026-12-05', gapDays: 4 },
    rollup: 'proposed',
  });
  expect(partner?.plans[0]?.work[0]?.card).toMatchObject({ done: true, issue: null });
  expect(partner?.plans[0]?.events).toEqual(first.progress.events);
  expect(modelPartnerRowsOf(index, entries, '2026-11-03')[0]).toMatchObject({
    systems: [{ id: 'sys:b' }],
    unknownProgress: '1 work item has no recorded state.',
    lastHeard: { at: '2026-11-02' },
  });
  const page = modelProgrammeOf(index, 'sales', entries);
  expect(page?.programme).toBe(programme);
  expect(page?.plans[0]?.references['base-folder/plan:base']).toMatchObject({
    label: 'Existing base',
    href: '/queries/plans/base-folder/things/?id=plan-base',
  });
  expect(page?.plans[0]).toMatchObject({
    href: '/queries/plans/actual-folder/',
    landed: false,
    buildsOn: [{ id: 'plan:base', href: '/queries/plans/base-folder/' }],
    errors: [{ message: 'Keep this warning' }],
  });
  expect(page?.landing).toEqual([
    { id: 'dom:queries', name: 'Queries', href: '/queries/queries/', plans: 1 },
  ]);
  expect(page?.partnerDependencies).toHaveLength(2);
  const row = modelProgrammeRowsOf(index, entries)[0];
  expect(row?.plans).toBe(1);
  expect(row?.blocked).toBe(1);
  expect(row?.nextBlocked?.href).toBe('/queries/plans/actual-folder/');
  expect(row?.unknownProgress).toContain('not been evaluated');
  expect(modelWorkLabelsOf(index, entries, page)['wi:first']).toBe('First task');
  expect(entries[0]?.plan.work_items?.[0]?.id).toBe('wi:second');
  expect(modelPartnerOf(index, 'unknown', entries)).toBeNull();
});
