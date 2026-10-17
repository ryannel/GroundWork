import { describe, expect, it, vi } from 'vitest';

import { deliveryOf } from '@/application/plan/delivery';
import { revisionImpact } from '@/application/plan/impact';
import { planDiff } from '@/application/plan/plan-diff';
import type { Plan } from '@/domain/plan/plan.generated';

vi.mock(import('server-only'), () => ({}));

const { loadFixture } = await import('@/infrastructure/plan-fixture');

const mini = async (): Promise<Plan> => loadFixture('mini.yaml');

function byId<T extends { id: string }>(list: T[] | undefined, id: string): T {
  const found = list?.find((x) => x.id === id);
  if (found === undefined) throw new Error(`no ${id} in the fixture`);
  return found;
}

type Entry = NonNullable<Parameters<typeof revisionImpact>[0]['entry']>;
type Status = NonNullable<Parameters<typeof deliveryOf>[1]>;

const run = (from: Plan, to: Plan, o: { status?: Status; entry?: unknown } = {}) =>
  revisionImpact({
    from,
    to,
    diff: planDiff(from, to),
    delivery: o.status === undefined ? null : deliveryOf(to, o.status),
    entry: (o.entry ?? null) as Entry | null,
  });

const step = (p: Plan, id: string) => p.flows!.flatMap((f) => f.steps).find((s) => s.id === id)!;
const stepsOf = (im: ReturnType<typeof run>) => im.journeys.flatMap((f) => f.steps);

describe('revision impact', () => {
  it("a step whose logic changes works differently; its team's finished work is reopened; no test walks it", async () => {
    const a = await mini();
    const b = await mini();
    for (const p of [a, b]) byId(p.work_items, 'wi:skip').github_issue = 5;
    step(b, 'flow:billing-run#charge').logic = 'Charge, and retry once on a soft decline.';
    const im = run(a, b, { status: { 'wi:skip': { state: 'closed' } } as unknown as Status });
    const s = stepsOf(im).find((x) => x.id === 'flow:billing-run#charge')!;
    expect(s.mark).toBe('behaviour');
    expect(s.keys).toEqual(['logic']);
    expect(im.work.find((w) => w.id === 'wi:skip')?.effect).toBe('rework');
    expect(
      im.checks.some((c) => c.kind === 'untested-step' && c.step === 'flow:billing-run#charge'),
    ).toBe(true);
    expect(im.checks.some((c) => c.kind === 'rework')).toBe(true);
    expect(im.tell).toEqual([{ team: 'team:billing', why: 'rework', whys: ['rework'] }]);
    expect(im.tally.behaviour).toBe(1);
    expect(im.teams.find((t) => t.id === 'team:web')?.work).toHaveLength(0);
  });

  it("the proposer's word on a work item wins over the inference", async () => {
    const a = await mini();
    const b = await mini();
    step(b, 'flow:billing-run#charge').logic = 'Charge, and retry once.';
    const im = run(a, b, {
      entry: {
        by: ['team:billing'],
        work: [{ item: 'wi:skip', action: 'keep', note: 'The retry is in the client.' }],
      },
    });
    const w = im.work.find((x) => x.id === 'wi:skip')!;
    expect([w.effect, w.authored, w.note]).toEqual(['keep', true, 'The retry is in the client.']);
  });

  it('a new call between teams is a new dependency, loudest first', async () => {
    const a = await mini();
    const b = await mini();
    byId(b.flows, 'flow:billing-run').steps.push({
      id: 'flow:billing-run#ask-subs',
      from: 'svc:billing',
      to: 'svc:subs',
      via: 'internal',
      action: 'Ask Subscriptions if paused',
    });
    const im = run(a, b);
    expect(im.edges.map((e) => [e.from, e.to, e.kind, e.crossTeam])).toEqual([
      ['svc:billing', 'svc:subs', 'call', true],
    ]);
    expect(im.checks[0]?.kind).toBe('new-edge');
    expect(im.tally.stepsAdded).toBe(1);
  });

  it('a field travels: every step and message carrying its schema carries the new data; optional is not breaking', async () => {
    const a = await mini();
    const b = await mini();
    const payload = () => byId(b.schemas, 'sch:status-changed-v1');
    payload().fields!.push({ name: 'reason_code', type: 'string' });
    const im = run(a, b);
    const carried = stepsOf(im)
      .filter((s) => s.mark === 'data')
      .map((s) => s.id);
    expect(carried).toEqual(['flow:cancel#publish']);
    const c = im.checks.find((x) => x.kind === 'contract')!;
    expect([c.message, c.breaking, c.level]).toEqual(['msg:status-changed-v1', false, 'note']);
    expect(im.checks.some((x) => x.kind === 'who-sets' && x.field === 'reason_code')).toBe(true);
    expect(im.checks.some((x) => x.kind === 'untested-field' && x.field === 'reason_code')).toBe(
      true,
    );
    expect(im.tally.breaking).toBe(0);
    payload().fields!.at(-1)!.required = true;
    expect(
      run(a, b).checks.some((x) => x.kind === 'breaking' && x.field === 'reason_code'),
      'a required field on a payload is safe: consumers only gain a field',
    ).toBe(false);
    const gone = await mini();
    const goneSchema = byId(gone.schemas, 'sch:status-changed-v1');
    goneSchema.fields = goneSchema.fields!.filter((f) => f.name !== 'status');
    expect(run(a, gone).checks.some((x) => x.kind === 'breaking' && x.field === 'status')).toBe(
      true,
    );
  });

  it('a field nested in another schema reaches the steps that move the holder', async () => {
    const a = await mini();
    const b = await mini();
    for (const p of [a, b]) {
      p.schemas!.push({
        id: 'sch:reason',
        name: 'Reason',
        kind: 'dto',
        fields: [{ name: 'text', type: 'string' }],
      } as never);
      byId(p.schemas, 'sch:status-changed-v1').fields!.push({ name: 'why', type: 'Reason' });
    }
    byId(b.schemas, 'sch:reason').fields!.push({ name: 'code', type: 'string' });
    const im = run(a, b);
    expect(im.shape.get('sch:status-changed-v1')?.via).toEqual({ field: 'why', of: 'sch:reason' });
    expect(stepsOf(im).some((s) => s.id === 'flow:cancel#publish' && s.mark === 'data')).toBe(true);
  });

  it('what an inference must not claim: optional data passed on is no work; a screen reading the holder is not showing the field', async () => {
    const a = await mini();
    const b = await mini();
    byId(b.schemas, 'sch:status-changed-v1').fields!.push({ name: 'reason_code', type: 'string' });
    const im = run(a, b, { status: {} });
    expect(stepsOf(im).some((s) => s.mark === 'data')).toBe(true);
    expect(im.work.filter((w) => w.effect === 'check')).toEqual([]);
    for (const p of [a, b]) {
      p.screens = [
        {
          id: 'scr:status',
          name: 'Status',
          service: 'svc:web',
          regions: [
            {
              id: 'scr:status#box',
              name: 'Box',
              shows: 'The status.',
              reads: ['sch:status-changed-v1#status'],
            },
          ],
        },
      ] as never;
    }
    expect(run(a, b).screens).toEqual([]);
    byId(b.screens, 'scr:status').regions![0]!.shows = 'The status and its reason_code.';
    expect(run(a, b).screens[0]?.regions[0]?.mark).toBe('behaviour');
  });

  it('a retitled work item costs nothing and tells nobody', async () => {
    const a = await mini();
    const b = await mini();
    byId(b.work_items, 'wi:skip').title = 'Skip paused subscriptions in the run';
    const im = run(a, b, { status: {} });
    expect(im.work.find((w) => w.id === 'wi:skip')?.effect).toBe('renamed');
    expect(im.tell).toEqual([]);
    expect(im.tally.rework + im.tally.changes).toBe(0);
  });

  it('work added, dropped or reworded by the proposer shows as new, drop and rework', async () => {
    const a = await mini();
    const b = await mini();
    const skip = byId(b.work_items, 'wi:skip');
    b.work_items = b.work_items!.filter((w) => w.id !== 'wi:skip');
    b.work_items.push({ ...skip, id: 'wi:fresh', title: 'Something new' });
    const im = run(a, b, { status: {} });
    expect(im.work.find((w) => w.id === 'wi:skip')).toMatchObject({ effect: 'drop', gone: true });
    expect(im.work.find((w) => w.id === 'wi:fresh')?.effect).toBe('new');
    step(b, 'flow:billing-run#charge').logic = 'Charge twice.';
    const told = run(a, b, {
      entry: {
        by: ['team:billing'],
        work: [{ item: 'wi:v2-event', action: 'rework', note: 'Redo it.' }],
      },
    });
    expect(told.work.find((w) => w.id === 'wi:v2-event')).toMatchObject({
      authored: true,
      inferred: false,
    });
  });
});
