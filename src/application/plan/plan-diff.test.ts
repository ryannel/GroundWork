import { describe, expect, it, vi } from 'vitest';

import { prop } from '@/application/plan/ids';
import { planDiff } from '@/application/plan/plan-diff';
import { diffMarkdown } from '@/application/plan/plan-diff-markdown';
import { summariser } from '@/application/plan/plan-diff-ops';
import type { Plan } from '@/domain/plan/plan.generated';

vi.mock('server-only', () => ({}));

const { loadFixture } = await import('@/infrastructure/plan-fixture');

function byId<T extends { id: string }>(items: T[] | undefined, id: string): T {
  const found = items?.find((x) => x.id === id);
  if (found === undefined) throw new Error(`no ${id}`);
  return found;
}

const mini = async (): Promise<Plan> => loadFixture('mini.yaml');

describe('plan diff', () => {
  it('identical plans: no semantic changes', async () => {
    const [a, b] = [await mini(), await mini()];
    const d = planDiff(a, b);
    expect(d.empty).toBe(true);
    expect(diffMarkdown(d, { from: a, to: b })).toMatch(/No semantic changes/);
  });

  it('entities, ops, questions, work items, milestones', async () => {
    const a = await mini();
    const b = await mini();
    b.services.push({ id: 'svc:notify', name: 'Notify', team: 'team:subs', kind: 'service' });
    byId(b.services, 'svc:subs').tech = 'Kotlin 2';
    b.teams = b.teams.filter((t) => t.id !== 'team:platform');
    byId(b.changes, 'chg:analytics-v2').ops.pop();
    byId(b.changes, 'chg:retire-email').ops.push({
      deprecate: 'msg:status-changed-v1',
      replaced_by: 'msg:status-changed-v2',
    });
    byId(b.changes, 'chg:retire-email').title = 'Retire the legacy email';
    const trial = byId(b.questions, 'q:trial-pause');
    trial.status = 'resolved';
    trial.answer = 'No; see [[dec:version-event]].';
    b.questions?.push({
      id: 'q:new',
      question: 'How long?',
      decider: 'team:subs',
      decide_by: '2026-10-20',
      status: 'open',
    });
    byId(b.work_items, 'wi:skip').milestone = 'ms:skeleton';
    b.work_items = (b.work_items ?? []).filter((w) => w.id !== 'wi:retire');
    const [, second] = b.milestones ?? [];
    if (second !== undefined) second.due = '2026-11-01';
    b.milestones?.reverse();

    const d = planDiff(a, b);
    expect(d.entities.services).toEqual({
      added: ['svc:notify'],
      removed: [],
      changed: [{ id: 'svc:subs', keys: ['tech'] }],
    });
    expect(d.entities.teams?.removed).toEqual(['team:platform']);
    expect(d.entities.changes?.changed).toEqual([{ id: 'chg:retire-email', keys: ['title'] }]);
    const ops = Object.fromEntries(d.ops.map((o) => [o.change, o]));
    expect(ops['chg:analytics-v2']?.removed.map((o) => o.summary)).toEqual([
      '− consumers: Analytics',
    ]);
    expect(ops['chg:retire-email']?.added.map((o) => o.summary)).toEqual(['− deprecated v1 → v2']);
    expect(d.questions).toEqual({ opened: ['q:new'], resolved: ['q:trial-pause'], reopened: [] });
    expect(d.workItems).toEqual({
      added: [],
      removed: ['wi:retire'],
      remilestoned: [{ id: 'wi:skip', from: 'ms:migrate', to: 'ms:skeleton' }],
    });
    expect(d.milestones.moved.map((m) => m.id)).toEqual([
      'ms:cleanup',
      'ms:migrate',
      'ms:skeleton',
    ]);

    const md = diffMarkdown(d, { from: a, to: b });
    expect(md).toMatch(/## Milestones moved\n\n- Cleanup \(`ms:cleanup`\): position 3 → 1/);
    expect(md).toMatch(/Consumers migrated \(`ms:migrate`\): due unset → 2026-11-01/);
    expect(md).toMatch(
      /\*\*Resolved:\*\* Can trials pause\? \(`q:trial-pause`\) — No; see `dec:version-event`\./,
    );
    expect(md).toMatch(
      /\*\*Opened:\*\* How long\? \(`q:new`\) — decider `team:subs`, by 2026-10-20/,
    );
    expect(md).toMatch(/\*\*Moved:\*\* Skip paused \(`wi:skip`\): `ms:migrate` → `ms:skeleton`/);
    expect(md).toMatch(
      /### Retire the legacy email \(`chg:retire-email`\)\n\n- added: − deprecated v1 → v2/,
    );
    expect(md).toMatch(/- changed Subscriptions \(`svc:subs`\): tech/);
  });

  it('an op whose target stays the same is edited, not removed and added', async () => {
    const a = await mini();
    const b = await mini();
    const c = byId(b.changes, 'chg:pause-api');
    const op = c.ops.find((o) => 'add' in o && prop(o.value, 'id') !== undefined);
    if (op === undefined || !('add' in op)) throw new Error('no add op with an id');
    Object.assign(op.value, { summary: 'reworded' });
    const d = planDiff(a, b);
    const o = d.ops.find((x) => x.change === 'chg:pause-api');
    expect([o?.added.length, o?.removed.length, o?.edited.length]).toEqual([0, 0, 1]);
    expect(o?.edited[0]?.fields).toEqual(['value.summary']);
    expect(diffMarkdown(d, { from: a, to: b })).toMatch(/- edited: .*\(value\.summary\)/);
  });

  it('reports changes dropped and new, and falls back to raw op text', async () => {
    const a = await mini();
    const b = await mini();
    b.changes = (b.changes ?? []).filter((c) => c.id !== 'chg:skip-paused');
    b.changes.push({ id: 'chg:fresh', title: 'Fresh', ops: [{ remove: 'msg:nothing-here' }] });
    const d = planDiff(a, b);
    const by = Object.fromEntries(d.ops.map((o) => [o.change, o.status]));
    expect(by).toMatchObject({ 'chg:fresh': 'added', 'chg:skip-paused': 'removed' });
    const fresh = d.ops.find((o) => o.change === 'chg:fresh');
    expect(fresh?.added[0]?.summary).toBe('× remove msg:nothing-here');
    const md = diffMarkdown(d, { from: a, to: b });
    expect(md).toMatch(/\(new change\)/);
    expect(md).toMatch(/\(change dropped\)/);
  });

  it('describes an op in plain words when no model can', () => {
    const raw = summariser(null);
    expect(raw('c', 0, { add: 'svc', value: { id: 'svc:x' }, into: 'plan' })).toBe(
      '+ svc svc:x into plan',
    );
    expect(raw('c', 0, { modify: 'svc:x', set: { tech: 'Go' }, drop: { owner: null } })).toBe(
      '~ svc:x (set tech; drop owner)',
    );
    expect(raw('c', 0, { deprecate: 'msg:a', replaced_by: 'msg:b' })).toBe(
      '− deprecate msg:a → msg:b',
    );
    expect(raw('c', 0, { deprecate: 'msg:a' })).toBe('− deprecate msg:a');
    expect(raw('c', 0, { remove: 'msg:a' })).toBe('× remove msg:a');
    expect(raw('c', 0, { other: 1 })).toBe('{"other":1}');
    expect(raw('c', 0, 'text')).toBe('"text"');
  });
});
