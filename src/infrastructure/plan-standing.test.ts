import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import path from 'node:path';

import { afterAll, describe, expect, it, vi } from 'vitest';

import { pauseOrdersOverlay } from '@/../test/fixtures/acme/plans/pause-orders';
import type { PlanOverlay } from '@/../test/plan-kit';
import { acmeFiles, writeWorkspace } from '@/../test/workspace-kit';

vi.mock(import('server-only'), () => ({}));

const { readPlanState } = await import('./workspace-plans');

const scratch = path.join(process.cwd(), 'node_modules', '.cache');
const made: string[] = [];
afterAll(async () => {
  await Promise.all(made.map(async (dir) => rm(dir, { recursive: true, force: true })));
});

/** A plan of its own whose work waits on pause-orders' endpoint and milestone. */
function desk(): PlanOverlay {
  return {
    meta: { id: 'desk', title: 'The desk shows pauses', status: 'draft' },
    problem: { summary: 'The desk cannot see a pause.' },
    changes: [
      {
        id: 'chg:checkout-kept',
        title: 'Checkout stays as it is',
        ops: [{ modify: 'sch:order#status', set: { required: true } }],
      },
    ],
    milestones: [{ id: 'ms:desk', name: 'Desk shows pauses', after: ['pause-orders/ms:pause'] }],
    work_items: [
      {
        id: 'wi:desk-badge',
        title: 'Badge paused orders',
        team: 'team:web',
        milestone: 'ms:desk',
        needed_by: '2026-12-01',
        depends_on: ['pause-orders/wi:pause-api'],
      },
    ],
  };
}

const PAUSE_DECLINED = {
  events: [
    {
      at: '2026-11-01',
      subject: 'wi:pause-api',
      kind: 'commitment',
      state: 'declined',
      said_by: 'Ops',
    },
  ],
};

const DESK_PROGRESS = {
  events: [
    {
      at: '2026-11-02',
      subject: 'wi:desk-badge',
      kind: 'commitment',
      state: 'accepted',
      promised_for: '2026-12-11',
    },
  ],
};

async function workspace(): Promise<string> {
  await mkdir(scratch, { recursive: true });
  const root = await mkdtemp(path.join(scratch, 'plan-standing-'));
  made.push(root);
  await writeWorkspace(path.join(root, 'acme'), {
    ...acmeFiles(),
    'plans/pause-orders/plan.yaml': pauseOrdersOverlay(),
    'plans/pause-orders/progress.yaml': PAUSE_DECLINED,
    'plans/desk/plan.yaml': desk(),
    'plans/desk/progress.yaml': DESK_PROGRESS,
  });
  return root;
}

describe('a loaded plan’s standing', () => {
  it('blocks work that waits on a declined commitment in another plan, and keeps the dates apart', async () => {
    const root = await workspace();
    const state = await readPlanState('acme', 'desk', root);
    expect(state?.broken).toBeNull();
    const standing = state?.loaded?.standing;
    const [badge] = standing?.work ?? [];
    expect(badge?.team).toEqual({ id: 'team:web', name: 'Web', partner: false });
    expect(badge?.dates).toEqual({
      neededBy: '2026-12-01',
      promisedFor: '2026-12-11',
      gapDays: 10,
    });
    expect(badge?.blockers).toEqual([
      {
        kind: 'depends-on',
        id: 'pause-orders/wi:pause-api',
        label: 'Pause endpoint',
        state: 'declined',
      },
    ]);
    expect(standing?.milestones[0]?.blockers).toEqual([
      { kind: 'after', id: 'pause-orders/ms:pause', label: 'Clerks can pause', state: 'declined' },
    ]);
  });

  it('compares the changes with today, not with the plans beside it', async () => {
    const root = await workspace();
    const own = await readPlanState('acme', 'desk', root);
    expect(own?.loaded?.standing.changes).toEqual([
      {
        change: 'chg:checkout-kept',
        state: 'matches',
        ops: [
          { op: 0, target: 'sch:order#status', state: 'matches', detail: 'today says all 1 of 1' },
        ],
      },
    ]);
    const pause = await readPlanState('acme', 'pause-orders', root);
    const changes = pause?.loaded?.standing.changes ?? [];
    expect(changes.map((change) => [change.change, change.state])).toEqual([
      ['chg:pause-endpoint', 'missing'],
      ['chg:mailer-skips-paused', 'missing'],
    ]);
  });
});
