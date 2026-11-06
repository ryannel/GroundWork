import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import path from 'node:path';

import { afterAll, describe, expect, it, vi } from 'vitest';

import { pauseOrdersOverlay } from '@/../test/fixtures/acme/plans/pause-orders';
import { pausingFiles } from '@/../test/fixtures/acme/plans/pausing-programme';
import { acme, acmeFiles, filesOf, writeWorkspace } from '@/../test/workspace-kit';
import { impactRowsOf, impactVM } from '@/application/workspace-work/impact';
import { partnerPageVM } from '@/application/workspace-work/partner-page';
import { partnersVM } from '@/application/workspace-work/partners';
import { programmePageVM, programmeRowsOf } from '@/application/workspace-work/programme-page';

vi.mock(import('server-only'), () => ({}));

const { readPlanState } = await import('./workspace-plans');

const { readWorkspacePlanIndex } = await import('./workspace-plan-index');

const scratch = path.join(process.cwd(), 'node_modules', '.cache');
const made: string[] = [];
afterAll(async () => {
  await Promise.all(made.map(async (dir) => rm(dir, { recursive: true, force: true })));
});

const PAUSE_REASONS = {
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
};

describe('readWorkspacePlanIndex', () => {
  it('indexes a plan touching an ownerless store by its containing system', async () => {
    await mkdir(scratch, { recursive: true });
    const root = await mkdtemp(path.join(scratch, 'plan-placement-'));
    made.push(root);
    const { workspace, model } = acme();
    const contracts = model.contracts.map((contract) => ({
      ...contract,
      stores: contract.stores.map(({ owner: _owner, ...store }) => store),
    }));
    await writeWorkspace(path.join(root, 'acme'), {
      ...filesOf(workspace, { ...model, contracts }),
      'plans/resource/plan.yaml': {
        meta: { ...PAUSE_REASONS.meta, id: 'resource', title: 'Explain the database' },
        problem: { summary: 'The database needs a description.' },
        changes: [
          {
            id: 'chg:resource',
            title: 'Describe the database',
            ops: [{ modify: 'st:orders-db', set: { does: 'Keeps orders' } }],
          },
        ],
      },
    });
    const state = await readPlanState('acme', 'resource', root);
    expect(state?.broken).toBeNull();
    const index = await readWorkspacePlanIndex('acme', root);
    expect(index?.changes.get('resource/chg:resource')?.systems).toEqual(['sys:ordering']);
  });

  it('indexes a global flow against all of its recorded participating systems', async () => {
    await mkdir(scratch, { recursive: true });
    const root = await mkdtemp(path.join(scratch, 'plan-flow-systems-'));
    made.push(root);
    await writeWorkspace(path.join(root, 'acme'), {
      ...acmeFiles(),
      'plans/flow/plan.yaml': {
        meta: { ...PAUSE_REASONS.meta, id: 'flow', title: 'Explain the checkout flow' },
        problem: { summary: 'The checkout outcome needs a description.' },
        changes: [
          {
            id: 'chg:flow',
            title: 'Describe checkout',
            ops: [{ modify: 'flow:place-order', set: { outcome: 'The order is confirmed.' } }],
          },
        ],
      },
    });
    const state = await readPlanState('acme', 'flow', root);
    expect(state?.broken).toBeNull();
    const index = await readWorkspacePlanIndex('acme', root);
    expect(index?.changes.get('flow/chg:flow')?.systems).toEqual([
      'sys:ordering',
      'sys:payments',
      'sys:shop',
    ]);
  });

  it('reads every plan of the workspace once into one index', async () => {
    await mkdir(scratch, { recursive: true });
    const root = await mkdtemp(path.join(scratch, 'plan-index-'));
    made.push(root);
    await writeWorkspace(path.join(root, 'acme'), {
      ...acmeFiles(),
      'programmes/care/programme.yaml': { id: 'care', title: 'Care', outcome: 'One deal.' },
      'plans/pause-orders/plan.yaml': pauseOrdersOverlay(),
      'plans/pause-reasons/plan.yaml': PAUSE_REASONS,
      'plans/pause-orders/progress.yaml': {
        events: [{ at: '2026-05-01', subject: 'wi:pause-api', kind: 'work', state: 'in_progress' }],
      },
    });
    const index = await readWorkspacePlanIndex('acme', root);
    expect([...(index?.plans.keys() ?? [])]).toEqual(['pause-orders', 'pause-reasons']);
    expect(index?.programmes.get('care')?.plans).toEqual(['pause-reasons']);
    expect(index?.dependencies).toEqual([
      {
        from: 'pause-reasons',
        to: 'pause-orders',
        through: ['pause-orders/chg:pause-endpoint'],
        health: 'waiting',
      },
    ]);
    expect(index?.work.get('pause-orders/wi:pause-api')?.card.progress?.state).toBe('in progress');
    expect(index?.plans.get('pause-orders')?.events).toHaveLength(1);
    expect(index?.changes.get('pause-orders/chg:pause-endpoint')?.systems.length).toBeGreaterThan(
      0,
    );
    await expect(readWorkspacePlanIndex('nowhere', root)).resolves.toBeNull();
  });
});

describe('the pages about work across plans, read from a workspace on disk', () => {
  it('shows a partner, a programme of two stacked plans and the work pending on a system', async () => {
    await mkdir(scratch, { recursive: true });
    const root = await mkdtemp(path.join(scratch, 'work-pages-'));
    made.push(root);
    await writeWorkspace(path.join(root, 'acme'), pausingFiles());
    const index = await readWorkspacePlanIndex('acme', root);
    if (index === null) throw new Error('no index');
    expect([...index.plans.keys()]).toEqual(['pause-orders', 'pause-reasons']);

    const partner = partnerPageVM(index, 'team:payments');
    expect(partner?.team).toEqual({ id: 'team:payments', name: 'Payments', partner: true });
    expect(partner?.contacts).toEqual([{ name: 'Priya Natarajan', role: 'product' }]);
    expect(partner?.lastHeard).toMatchObject({ at: '2026-06-10', source: 'partner update' });
    expect(partner?.milestones.map((g) => [g.milestone?.name, g.milestone?.gapText])).toEqual([
      ['Pauses say why', '5 days after we need'],
    ]);
    expect(partner?.milestones[0]?.items[0]).toMatchObject({
      key: 'pause-reasons/wi:hold-codes',
      issue: null,
      commitment: { state: 'accepted', promisedFor: '2026-07-20' },
      dates: { neededBy: '2026-07-01', gapText: '19 days after we need' },
    });
    expect(partner?.evidence.map((e) => e.url)).toEqual(['https://notes.example/payments-pause']);
    expect(partner?.history.map((e) => e.what)).toEqual([
      'work in progress',
      'commitment accepted',
    ]);

    const systems = [
      { id: 'payments', name: 'Payments', href: '/acme/orders/payments/', team: 'team:payments' },
    ];
    expect(partnersVM(index, systems, '2026-06-20')).toEqual([
      {
        id: 'team:payments',
        name: 'Payments',
        href: '/acme/partners/payments/',
        systems: [{ id: 'payments', name: 'Payments', href: '/acme/orders/payments/' }],
        work: { total: 1, open: 1, blocked: 0, plans: 1 },
        lastHeard: { at: '2026-06-10', age: '10 days ago' },
      },
    ]);

    const programme = programmePageVM(index, 'pausing');
    expect(programme?.standing.text).toBe('0 of 2 plans landed; nothing is held up.');
    expect(programme?.plans.map((p) => [p.slug, p.buildsOn.map((b) => b.slug)])).toEqual([
      ['pause-orders', []],
      ['pause-reasons', ['pause-orders']],
    ]);
    expect(programme?.milestones[0]?.servedBy.map((m) => m.name)).toEqual(['Pauses say why']);
    expect(programme?.decisions.map((d) => d.id)).toEqual(['dec:reason-codes']);
    expect(programme?.questions.map((q) => q.text)).toEqual([
      'Does a paused order hold the payment?',
    ]);
    expect(programme?.partnerDependencies.map((d) => [d.item.key, d.blocksFirst.slug])).toEqual([
      ['pause-reasons/wi:hold-codes', 'pause-reasons'],
    ]);
    expect(programmeRowsOf(index).map((r) => [r.id, r.plans, r.blocked])).toEqual([
      ['pausing', 2, 0],
    ]);

    const ordering = impactVM(index, { kind: 'system', id: 'sys:ordering', name: 'Ordering' });
    const groups = ordering === null ? [] : impactRowsOf(index, ordering);
    expect(groups.map((g) => [g.state, g.rows.map((r) => r.key)])).toEqual([
      ['now', ['pause-orders/wi:pause-api']],
      // The email step is placed with the ordering mailer, independently of the flow's first caller.
      ['next', ['pause-orders/wi:desk-button', 'pause-orders/wi:mailer-skip']],
      // it changes the endpoint pause-orders adds, and waits on the partner's work
      ['then', ['pause-reasons/wi:reason-api']],
    ]);
    expect(partnerPageVM(index, 'team:orders')?.team.partner).toBe(false);
  });
});
