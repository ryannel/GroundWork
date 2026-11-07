import { describe, expect, it } from 'vitest';

import { modelOp } from '@/../test/fixtures/model-op';
import { queryModel } from '@/../test/fixtures/model-queries';
import type { ModelPlan, WorkspaceModel } from '@/domain/workspace-model';

import {
  modelAheadStop,
  modelPlanBar,
  modelPlanFocus,
  modelPlanOutline,
  modelPlanScreen,
} from './model-plan-pages';
import { modelContextOf } from './model-reader';
import { findPage, type Page } from './plan-navigation';

const at = { workspace: 'queries', slug: 'reviewed-plan' };
const plan: ModelPlan = {
  meta: {
    id: 'plan:reviewed',
    title: 'Explain the reviewed change',
    version: '2.0',
    status: 'review',
    authors: ['A reviewer'],
    revisions: [
      {
        version: '1.0',
        status: 'approved',
        date: '2026-10-01',
        approved_by: '@reader',
        reason: 'Known scope',
      },
      {
        version: '2.0',
        status: 'proposed',
        date: '2026-11-01',
        summary: 'Keep [[api:a]] visible',
        why: 'Retain the whole explanation',
        pr: 72,
        work: [{ item: 'wi:work', action: 'keep', note: 'Still needed' }],
      },
    ],
  },
  problem: {
    summary: 'The **full** problem links [[api:a]].',
    why: 'Keep [the source](https://example.test/source).',
    goals: ['Preserve facts'],
    non_goals: ['Invent ownership'],
    metrics: [{ name: 'Known operations', today: '1', target: '2' }],
    scenarios: [
      {
        id: 'sc:normal',
        title: 'A normal journey',
        story: 'Read [[api:a]].',
        flows: ['flow:declared'],
      },
    ],
  },
  story: {
    summary: 'The full authored story.',
    scope: ['api:a'],
    concepts: ['con:known'],
    stages: [
      {
        id: 'stage:local',
        name: 'Local stage',
        summary: 'An ordered explanation, not execution.',
        components: [{ component: 'svc:a', from: ['api:a'] }],
        flows: ['flow:declared'],
      },
    ],
    chapters: {
      why: { headline: 'Why this matters', recap: ['The recorded qualification remains.'] },
      runs: { headline: 'How people use it', recap: ['An authored sequence.'] },
    },
  },
  changes: [
    {
      id: 'chg:behaviour',
      title: 'Qualify the handler',
      requires: [{ id: 'req:retained', text: 'Keep the cited conditions.' }],
      ops: [{ modify: 'h:a' }],
    },
  ],
  work_items: [
    {
      id: 'wi:work',
      title: 'Implement the qualification',
      team: 'team:a',
      implements: ['chg:behaviour'],
    },
  ],
  tests: [
    { id: 'tst:condition', name: 'Recorded condition', level: 'e2e', proves: ['chg:behaviour'] },
  ],
  decisions: [
    {
      id: 'dec:choice',
      title: 'Keep the boundary',
      status: 'accepted',
      decision: 'The cited boundary is known.',
    },
  ],
  risks: [
    { id: 'risk:gap', statement: 'Unknown implementation', likelihood: 'low', impact: 'high' },
  ],
  questions: [{ id: 'q:open', question: 'Who owns implementation?', status: 'open' }],
};
function context() {
  const source = queryModel();
  const before: WorkspaceModel = {
    ...source,
    flows: [
      { id: 'flow:declared', name: 'Declared flow', steps: [] },
      { id: 'flow:unrelated', name: 'Unrelated workspace flow', steps: [] },
    ],
    domains: source.domains.map((domain) => ({
      ...domain,
      purpose: 'The recorded domain purpose.',
      language: {
        concepts: [{ id: 'con:known', name: 'Known concept', means: 'The live meaning.' }],
      },
    })),
  };
  return modelContextOf({ plan, before, after: before });
}
function page(chapter: string, screen: string): Page {
  const result = findPage(modelPlanOutline(context(), at), chapter, screen);
  if (result === null) throw new Error(`Missing synthetic page ${chapter}/${screen}`);
  return result;
}

describe('native plan presentation', () => {
  it('keeps the existing chapter frame and actual dynamic screen names', () => {
    const outline = modelPlanOutline(context(), at);
    expect(outline.title).toBe(plan.meta.title);
    expect(outline.chapters.map((chapter) => chapter.key)).toEqual([
      'cover',
      'why',
      'today',
      'journey',
      'changes',
      'prove',
      'build',
      'commit',
      'ref',
      'versions',
    ]);
    expect(findPage(outline, 'changes', 'chg-behaviour')?.href).toBe(
      '/queries/plans/reviewed-plan/changes/chg-behaviour/',
    );
    expect(findPage(outline, 'journey', 'sc-normal')?.title).toBe(
      'Planned scenario: A normal journey',
    );
    expect(findPage(outline, 'journey', 'stage-local')?.title).toBe('Local stage');
    expect(outline.pages.some((entry) => entry.screen === 'flow-unrelated')).toBe(false);
  });
  it('retains rich story headings, recap, concepts, scope and local stage fields', () => {
    const ctx = context();
    const why = modelPlanScreen(ctx, page('why', 'problem'));
    expect(why.headline).toBe('Why this matters');
    expect(why.recap).toEqual(['The recorded qualification remains.']);
    expect(why.blocks[0]?.records[0]?.data).toBe(plan.problem);
    expect(modelPlanScreen(ctx, page('journey', 'story')).blocks[0]?.records[0]?.data).toBe(
      plan.story,
    );
    const stage = modelPlanScreen(ctx, page('journey', 'stage-local'));
    expect(stage.blocks[0]?.records[0]?.data).toBe(plan.story?.stages?.[0]);
    expect(stage.flowIds).toEqual(['flow:declared']);
  });
  it('keeps concepts live in the supplied before/after model rather than copying story definitions', () => {
    const ctx = context();
    const today = modelPlanScreen(ctx, page('today', 'domain'));
    expect(
      today.blocks
        .find((block) => block.title === 'Concepts')
        ?.records.map((record) => record.data),
    ).toContainEqual({
      id: 'con:known',
      name: 'Known concept',
      means: 'The live meaning.',
    });
    expect(plan.story?.concepts).toEqual(['con:known']);
    expect(today.blocks.find((block) => block.title === 'Domains')?.records[0]?.data).toEqual({
      id: 'dom:queries',
      name: 'Queries',
      purpose: 'The recorded domain purpose.',
    });
  });
  it('links pins only through explicit operation targets and keeps an unrelated pin at the ledger', () => {
    const ctx = context();
    expect(modelAheadStop(ctx, at, 'h:a#call')).toEqual({
      href: '/queries/plans/reviewed-plan/changes/chg-behaviour/',
      title: 'Qualify the handler',
      position: '4.2',
    });
    expect(modelAheadStop(ctx, at, 'api:supplier')?.href).toBe(
      '/queries/plans/reviewed-plan/changes/ledger/',
    );
  });
  it('retains the complete selected change and requirement while the cover uses bounded links', () => {
    const ctx = context();
    expect(modelPlanScreen(ctx, page('changes', 'chg-behaviour')).blocks[0]?.records[0]?.data).toBe(
      plan.changes[0],
    );
    expect(modelPlanScreen(ctx, page('changes', 'chg-behaviour')).blocks[0]?.summary).toBe(false);
    expect(modelPlanScreen(ctx, page('changes', 'ledger')).blocks[0]?.summary).toBe(true);
    expect(
      modelPlanScreen(ctx, page('cover', 'cover')).blocks.find(
        (block) => block.title === 'What this plan changes',
      )?.summary,
    ).toBe(true);
  });
  it('focuses maps by recorded placement without treating resource ownership as containment', () => {
    expect(modelPlanFocus(context())).toEqual(['sys:a']);
    const ctx = context();
    const resourcePlan: ModelPlan = {
      meta: plan.meta,
      problem: plan.problem,
      changes: [
        { id: 'chg:resource', title: 'Change the remote resource', ops: [{ modify: 'st:remote' }] },
      ],
    };
    expect(modelPlanFocus({ ...ctx, plan: resourcePlan })).toEqual(['sys:b']);
  });
  it('preserves actual work, proof, decisions, risk and unresolved-question records', () => {
    const ctx = context();
    expect(modelPlanScreen(ctx, page('build', 'build-order')).blocks[0]?.records[0]?.data).toBe(
      plan.work_items?.[0],
    );
    expect(modelPlanScreen(ctx, page('prove', 'coverage')).blocks[0]?.records[0]?.data).toBe(
      plan.tests?.[0],
    );
    expect(modelPlanScreen(ctx, page('commit', 'choices')).blocks[0]?.records[0]?.data).toBe(
      plan.decisions?.[0],
    );
    expect(modelPlanScreen(ctx, page('commit', 'risks')).blocks[0]?.records[0]?.data).toBe(
      plan.risks?.[0],
    );
    expect(modelPlanScreen(ctx, page('commit', 'ask')).blocks[0]?.records[0]?.data).toBe(
      plan.questions?.[0],
    );
  });
  it('retains every ledger field and uses the actual snapshot filename independently of meta.version', () => {
    const ctx = context();
    const snapshot: ModelPlan = {
      meta: { id: plan.meta.id, title: 'Actual saved snapshot' },
      problem: { summary: 'The saved version' },
      changes: [],
    };
    const version = modelPlanScreen(ctx, page('versions', 'v2.0'), {
      snapshots: [{ version: '2.0', plan: snapshot }],
    });
    expect(version.blocks[0]?.records[0]?.data).toBe(plan.meta.revisions?.[1]);
    expect(version.blocks[1]?.records[0]?.data).toBe(snapshot);
    expect(modelPlanBar(ctx, modelPlanOutline(ctx, at)).versions?.label).toBe('v2.0 proposed');
    expect(modelPlanBar(ctx, modelPlanOutline(ctx, at)).versions?.items[0]?.state).toBe('proposed');
  });
  it('retains removed records and native component kinds in the reference catalogue', () => {
    const ctx = context();
    const removed = {
      ...ctx,
      afterIndex: modelContextOf({ model: { ...ctx.afterIndex.model, externals: [] } }).afterIndex,
    };
    const all = modelPlanScreen(removed, page('ref', 'all')).catalogue;
    expect(all.map((record) => record.id)).toEqual(
      expect.arrayContaining(['ext:supplier', 'sub:b', 'job:b', 'stage:local', 'req:retained']),
    );
  });
});

it('labels only actual unmapped systems and external parties as boundary records', () => {
  const view = modelPlanScreen(context(), page('ref', 'boundaries'));
  expect(view.catalogue.map((record) => record.id)).toEqual(['ext:supplier', 'sys:unmapped']);
  const all = modelPlanScreen(context(), page('ref', 'all')).catalogue.map((record) => record.id);
  expect(all).toContain('sys:a');
  expect(all).toContain('sys:b');
});

it('retains the recorded contracts, empty journey and end-to-end proof addresses', () => {
  const source = queryModel();
  const legacyAddresses: ModelPlan = {
    meta: plan.meta,
    problem: { summary: 'A recorded problem' },
    changes: [
      {
        id: 'chg:api',
        title: 'Rename the endpoint',
        ops: [modelOp({ modify: 'api:a', set: { name: 'A changed endpoint' } })],
      },
      { id: 'chg:first', title: 'First change' },
      { id: 'chg:second', title: 'Second change' },
      { id: 'chg:third', title: 'Third change' },
    ],
    tests: [
      { id: 'tst:e2e', name: 'Actual end-to-end proof', level: 'e2e', proves: ['chg:api'] },
      { id: 'tst:contract', name: 'Actual contract proof', level: 'contract', proves: ['chg:api'] },
    ],
  };
  const ctx = modelContextOf({ plan: legacyAddresses, before: source, after: source });
  const outline = modelPlanOutline(ctx, at);
  const contracts = findPage(outline, 'changes', 'contracts');
  const empty = findPage(outline, 'journey', 'empty');
  const e2e = findPage(outline, 'prove', 'e2e');
  if (contracts === null || empty === null || e2e === null) {
    throw new Error('A recorded address was lost.');
  }
  const view = modelPlanScreen(ctx, contracts);
  expect(view.blocks[0]?.records.map((record) => record.data)).toEqual([
    ctx.afterIndex.get('api:a')?.data,
  ]);
  expect(view.blocks[1]?.records.map((record) => record.data)).toEqual([
    legacyAddresses.changes[0],
  ]);
  expect(modelPlanScreen(ctx, empty).flowIds).toEqual([]);
  expect(modelPlanScreen(ctx, e2e).blocks[0]?.records.map((record) => record.data)).toEqual([
    legacyAddresses.tests?.[0],
  ]);
});
