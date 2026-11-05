import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import path from 'node:path';

import { afterAll, describe, expect, it, vi } from 'vitest';

import { pauseOrdersOverlay } from '@/../test/fixtures/acme/plans/pause-orders';
import type { PlanOverlay } from '@/../test/plan-kit';
import { acmeFiles, writeWorkspace } from '@/../test/workspace-kit';
import { unlandedBases } from '@/application/plan/plan-stack';

vi.mock(import('server-only'), () => ({}));

const { checkPlan, readNeighbourIndex, readOverlaps, readPlan, readStackedBase } =
  await import('./plan-store');
const { checkPlanState } = await import('./workspace-plans');

const scratch = path.join(process.cwd(), 'node_modules', '.cache');
const made: string[] = [];
afterAll(async () => {
  await Promise.all(made.map(async (dir) => rm(dir, { recursive: true, force: true })));
});

/** A plan that builds on pause-orders: the pause endpoint it adds gains a reason. */
function pauseReasons(over: Partial<PlanOverlay> = {}): PlanOverlay {
  return {
    meta: {
      id: 'pause-reasons',
      title: 'Say why an order is paused',
      version: '0.1',
      date: '2026-06-01',
      status: 'draft',
      authors: ['Orders'],
      appetite: '1 week',
      programme: 'care',
    },
    builds_on: ['pause-orders'],
    problem: {
      summary: 'A paused order does not say why; see [[api:orders-pause]].',
      why: 'The desk cannot tell a late-stock pause from a customer request.',
    },
    changes: [
      {
        id: 'chg:pause-reason',
        title: 'The pause endpoint takes a reason',
        ops: [{ modify: 'api:orders-pause', set: { sig: 'POST /orders/{id}/pause?reason' } }],
      },
    ],
    ...over,
  };
}

const CARE = { id: 'care', title: 'Care', outcome: 'One deal from sale to change.' };

/** Acme with pause-orders, pause-reasons on top, and the care programme; each call is a new workspace. */
async function workspace(files: Readonly<Record<string, unknown>> = {}): Promise<string> {
  await mkdir(scratch, { recursive: true });
  const root = await mkdtemp(path.join(scratch, 'plan-stack-'));
  made.push(root);
  await writeWorkspace(path.join(root, 'acme'), {
    ...acmeFiles(),
    'programmes/care/programme.yaml': CARE,
    'plans/pause-orders/plan.yaml': pauseOrdersOverlay(),
    'plans/pause-reasons/plan.yaml': pauseReasons(),
    ...files,
  });
  return root;
}

describe('a plan read on the plans it builds on', () => {
  it('reads what they added as its as-is, and changes only its own part', async () => {
    const root = await workspace();
    const read = await readPlan('acme', 'pause-reasons', { root });
    expect(read.errors).toEqual([]);
    expect(read.inherited['api:orders-pause']).toEqual({
      plan: 'pause-orders',
      title: 'Let an order clerk pause an order',
      kind: 'added',
    });
    expect(read.inherited['sch:order#status']).toMatchObject({ kind: 'modified' });
    const endpoint = read.plan?.interfaces
      ?.flatMap((each) => each.endpoints ?? [])
      .find((each) => each.id === 'api:orders-pause');
    expect(endpoint?.sig).toBe('POST /orders/{id}/pause');
    expect(read.plan?.flows?.some((flow) => flow.id === 'flow:pause-order')).toBe(true);
    expect(read.base).toMatchObject({
      mode: 'live',
      checkedOn: null,
      builtOn: [
        { slug: 'pause-orders', title: 'Let an order clerk pause an order', changed: false },
      ],
      programme: { id: 'care', changed: false },
      stale: false,
    });
    const base = await readPlan('acme', 'pause-orders', { root });
    expect(base.inherited).toEqual({});
    expect(base.base.builtOn).toEqual([]);
  });

  it('does not check when a plan it builds on has errors', async () => {
    const root = await workspace({
      'plans/pause-orders/plan.yaml': { ...pauseOrdersOverlay(), context: ['svc:nowhere'] },
    });
    const read = await checkPlan('acme', 'pause-reasons', { root });
    expect(read.plan).toBeNull();
    expect(read.errors[0]?.path).toBe('builds_on');
    expect(read.errors[0]?.message).toMatch(/^pause-orders has 1 error\(s\)/u);
  });

  it('is an error to build on two plans when one removes a thing the other changes part of', async () => {
    const root = await workspace({
      'plans/left/plan.yaml': pauseReasons({
        meta: { ...pauseReasons().meta, id: 'left', title: 'Left' },
        changes: [
          { id: 'chg:drop', title: 'Drop the flow', ops: [{ remove: 'flow:pause-order' }] },
        ],
      }),
      'plans/right/plan.yaml': pauseReasons({
        meta: { ...pauseReasons().meta, id: 'right', title: 'Right' },
        changes: [
          {
            id: 'chg:step',
            title: 'Reword the step',
            ops: [{ modify: 'flow:pause-order#pause', set: { action: 'Pause it' } }],
          },
        ],
      }),
      'plans/top/plan.yaml': pauseReasons({
        meta: { ...pauseReasons().meta, id: 'top', title: 'Top' },
        builds_on: ['left', 'right'],
        changes: [
          { id: 'chg:top', title: 'Top', ops: [{ modify: 'sch:order', set: { name: 'order' } }] },
        ],
      }),
    });
    const read = await checkPlan('acme', 'top', { root });
    expect(read.plan).toBeNull();
    expect(read.errors.map((issue) => issue.message)).toEqual([
      expect.stringMatching(
        /^right\/chg:step: .*once the plans it builds on are applied in order$/u,
      ),
      expect.stringMatching(/^builds on left and right, .*flow:pause-order \(remove-change/u),
    ]);
  });

  it('is stale when a plan below or its programme changed since the lock', async () => {
    const checked = await workspace();
    const found = await readStackedBase('acme', 'pause-reasons', checked);
    expect(found?.hashes.bases['pause-orders']).toMatch(/^[0-9a-f]{8}$/u);
    expect(found?.hashes.programme).toMatchObject({ id: 'care' });
    const lock = {
      checked_on: '2026-06-02',
      entities: {},
      bases: found?.hashes.bases,
      programme: found?.hashes.programme,
      composed: 'whatever',
    };
    const fresh = await workspace({ 'plans/pause-reasons/base.lock.json': JSON.stringify(lock) });
    const same = await readPlan('acme', 'pause-reasons', { root: fresh });
    expect(same.base).toMatchObject({ checkedOn: '2026-06-02', stale: false });

    const revised = await workspace({
      'plans/pause-reasons/base.lock.json': JSON.stringify(lock),
      'plans/pause-orders/plan.yaml': {
        ...pauseOrdersOverlay(),
        problem: { ...pauseOrdersOverlay().problem, why: 'Stock is late more often now.' },
      },
      'programmes/care/programme.yaml': { ...CARE, outcome: 'One deal, start to finish.' },
    });
    const moved = await readPlan('acme', 'pause-reasons', { root: revised });
    expect(moved.base).toMatchObject({
      stale: true,
      builtOn: [{ slug: 'pause-orders', changed: true }],
      programme: { id: 'care', changed: true },
    });
  });

  it('says when the plan has been written again since its check', async () => {
    const found = await readStackedBase('acme', 'pause-reasons', await workspace());
    expect(found?.plan).toMatch(/^[0-9a-f]{8}$/u);
    const lock = {
      checked_on: '2026-06-02',
      entities: {},
      bases: found?.hashes.bases,
      programme: found?.hashes.programme,
      composed: 'whatever',
      plan: found?.plan,
    };
    const checked = await workspace({ 'plans/pause-reasons/base.lock.json': JSON.stringify(lock) });
    const same = await readPlan('acme', 'pause-reasons', { root: checked });
    expect(same.base).toMatchObject({ checkedOn: '2026-06-02', edited: false });

    const rewritten = await workspace({
      'plans/pause-reasons/base.lock.json': JSON.stringify(lock),
      'plans/pause-reasons/plan.yaml': pauseReasons({
        problem: { ...pauseReasons().problem, why: 'Nobody can tell why it stopped.' },
      }),
    });
    const edited = await readPlan('acme', 'pause-reasons', { root: rewritten });
    expect(edited.base).toMatchObject({ checkedOn: '2026-06-02', edited: true });

    const older = Object.fromEntries(Object.entries(lock).filter(([key]) => key !== 'plan'));
    const before = await workspace({
      'plans/pause-reasons/base.lock.json': JSON.stringify(older),
    });
    const unknown = await readPlan('acme', 'pause-reasons', { root: before });
    expect(unknown.base).toMatchObject({ edited: true });
  });

  it('cannot land before the plans it builds on, and can once they have', async () => {
    const open = await workspace();
    const index = await readNeighbourIndex('acme', open);
    expect(index.plans.get('pause-orders')?.landed).toBe(false);
    expect(unlandedBases('pause-reasons', index.plans)).toEqual(['pause-orders']);
    const landed = await workspace({ 'plans/pause-orders/base.yaml': 'landed_on: 2026-06-10\n' });
    const after = await readNeighbourIndex('acme', landed);
    expect(after.plans.get('pause-orders')?.landed).toBe(true);
    expect(unlandedBases('pause-reasons', after.plans)).toEqual([]);
  });
});

describe('plans that change the same thing', () => {
  it('warns both plans, and lists the overlap for the workspace', async () => {
    const twin = pauseReasons({
      meta: { ...pauseReasons().meta, id: 'pause-limit', title: 'Limit a pause' },
      changes: [
        {
          id: 'chg:pause-limit',
          title: 'A pause has a limit',
          ops: [{ modify: 'api:orders-pause', set: { sig: 'POST /orders/{id}/pause?days' } }],
        },
      ],
    });
    const root = await workspace({ 'plans/pause-limit/plan.yaml': twin });
    await expect(readOverlaps('acme', root)).resolves.toEqual([
      {
        kind: 'modify-modify',
        target: 'api:orders-pause',
        plans: ['pause-limit', 'pause-reasons'],
        changes: ['pause-limit/chg:pause-limit', 'pause-reasons/chg:pause-reason'],
      },
    ]);
    const state = await checkPlanState('acme', 'pause-reasons', root);
    expect(state?.loaded?.overlaps).toHaveLength(1);
    const warnings = state?.loaded?.warnings.filter((issue) =>
      issue.message.startsWith('overlaps'),
    );
    expect(warnings?.map((issue) => issue.path)).toEqual(['changes[0]']);
    expect(warnings?.[0]?.message).toMatch(/^overlaps pause-limit \(modify-modify\)/u);
    expect(state?.loaded?.inherited['api:orders-pause']).toMatchObject({ plan: 'pause-orders' });
  });

  it('is an error for a plan that builds on both', async () => {
    const twin = pauseReasons({
      meta: { ...pauseReasons().meta, id: 'pause-limit', title: 'Limit a pause' },
    });
    const root = await workspace({
      'plans/pause-limit/plan.yaml': twin,
      'plans/both/plan.yaml': pauseReasons({
        meta: { ...pauseReasons().meta, id: 'both', title: 'Both' },
        builds_on: ['pause-reasons', 'pause-limit'],
        changes: [
          {
            id: 'chg:both',
            title: 'Both',
            ops: [{ modify: 'sch:order', set: { name: 'order' } }],
          },
        ],
      }),
    });
    const read = await checkPlan('acme', 'both', { root });
    expect(read.plan).toBeNull();
    const errors = read.errors.filter((issue) => issue.path === 'builds_on');
    expect(errors.map((issue) => issue.message)).toEqual([
      expect.stringMatching(/^builds on pause-limit and pause-reasons, which neither/u),
    ]);
  });
});
