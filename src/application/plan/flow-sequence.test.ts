import { describe, expect, it, vi } from 'vitest';

import { derive, type Model } from '@/application/plan/derive';
import { type SequenceRow, sequenceModel, sequenceRows } from '@/application/plan/flow-sequence';
import { flowSteps, isJob, isNewLink, knownPath, stepKind } from '@/application/plan/flow-steps';

vi.mock('server-only', () => ({}));

const { readPlan, listPlans } = await import('@/infrastructure/plan-store');
const { loadFixture } = await import('@/infrastructure/plan-fixture');

const WORKSPACE = 'alder-finch';
const modelOf = async (slug: string): Promise<Model> => {
  const { plan } = await readPlan(WORKSPACE, slug);
  if (plan === null) throw new Error(`no plan ${slug}`);
  return derive(plan);
};

const slugs = await listPlans(WORKSPACE);
const models = await Promise.all(slugs.map(async (slug) => modelOf(slug)));
const dp = await modelOf('delivery-promise');
const mini = derive(await loadFixture('mini.yaml'));

const MODES = ['toBe', 'asIs', 'diff'] as const;

/** The frames left open, and in a close that does not match the frame it closes, a mismatch marker. */
function unclosed(rows: SequenceRow[]): string[] {
  const stack: string[] = [];
  for (const r of rows) {
    if (r.kind === 'open') stack.push(r.frame);
    if (r.kind === 'close' && stack.pop() !== r.frame) stack.push(`mismatch ${r.frame}`);
  }
  return stack;
}

/** For each group frame with a shared source, the steps' origins until the group closes. */
function groupSources(rows: SequenceRow[]): { shared: string; froms: string[] }[] {
  const out: { shared: string; froms: string[] }[] = [];
  for (const [i, r] of rows.entries()) {
    if (r.kind !== 'open' || r.frame !== 'group' || r.sharedSource === null) continue;
    const end = rows.findIndex((x, j) => j > i && x.kind === 'close' && x.frame === 'group');
    const froms = rows
      .slice(i + 1, end === -1 ? rows.length : end)
      .flatMap((x) => (x.kind === 'step' ? [x.step.from] : []));
    out.push({ shared: r.sharedSource, froms: [...new Set(froms)] });
  }
  return out;
}

const step = (id: string) => {
  const s = mini.toBe.steps.find((x) => x.id === id);
  if (s === undefined) throw new Error(`no ${id}`);
  return s;
};
const at = <T>(rows: T[], test: (r: T) => boolean): number => rows.findIndex(test);

describe('sequenceRows: replies', () => {
  const rows = sequenceRows(dp, 'flow:checkout', 'toBe');
  const stepRow = (i: number) => at(rows, (r) => r.kind === 'step' && r.i === i);
  const replyRow = (i: number) => at(rows, (r) => r.kind === 'reply' && r.of === i);

  it('answers a call back to its caller, naming what it returns', () => {
    const r = rows[replyRow(2)];
    expect(r).toMatchObject({
      kind: 'reply',
      from: 'svc:promise',
      to: 'svc:checkout',
      label: 'DeliveryPromise',
    });
    expect(replyRow(2)).toBeGreaterThan(stepRow(2));
  });

  it('unwinds innermost first: nested calls answer before the call that made them', () => {
    expect(replyRow(2)).toBeLessThan(replyRow(1));
    expect(replyRow(3)).toBeLessThan(replyRow(1));
    expect(replyRow(1)).toBeLessThan(replyRow(0));
  });

  it('gives an internal step, or a call with no response, no reply', () => {
    expect(replyRow(4)).toBe(-1);
    const replies = rows.filter((x) => x.kind === 'reply');
    expect(replies.every((r) => r.label !== '')).toBe(true);
    expect(new Set(replies.map((x) => x.of)).size).toBe(replies.length);
  });

  it('answers a publisher before its event consumers run', () => {
    const r = sequenceRows(dp, 'flow:create-product', 'toBe');
    const pub = at(r, (x) => x.kind === 'step' && x.step.action === 'Announce the product');
    const reply = at(r, (x) => x.kind === 'reply' && x.of === 0);
    const consumer = at(r, (x) => x.kind === 'step' && x.step.action === 'Update the read copy');
    expect(pub).toBeLessThan(reply);
    expect(reply).toBeLessThan(consumer);
  });
});

describe('sequenceRows: frames', () => {
  it('wraps a step that fails in a frame that holds its reply and the calls inside it', () => {
    const rows = sequenceRows(dp, 'flow:checkout', 'toBe');
    const open = at(rows, (r) => r.kind === 'open' && r.frame === 'fails' && r.at === 2);
    const close = at(rows, (r) => r.kind === 'close' && r.frame === 'fails' && r.at === 2);
    expect(open).toBeGreaterThanOrEqual(0);
    expect(close).toBeGreaterThan(open);
    expect(JSON.stringify(rows[open])).toMatch(/Delivery date on request/);
    expect(open).toBeLessThan(at(rows, (r) => r.kind === 'step' && r.i === 2));
    expect(close).toBeGreaterThan(at(rows, (r) => r.kind === 'reply' && r.of === 2));
  });

  it('closes every frame it opens, in order, for every flow of every plan', () => {
    for (const m of models) {
      for (const flow of m.toBe.flows) {
        for (const mode of MODES) expect(unclosed(sequenceRows(m, flow.id, mode))).toEqual([]);
      }
    }
  });

  it('groups steps from one event source and names the source without inferring timing', () => {
    const rows = sequenceRows(dp, 'flow:create-product', 'toBe');
    const open = rows.find((r) => r.kind === 'open' && r.frame === 'group');
    expect(open).toMatchObject({ sharedSource: 'st:catalog-events' });
  });

  it('groups steps that share a beat, with no shared source when they leave several', () => {
    const rows = sequenceRows(mini, 'flow:cancel', 'toBe');
    expect(rows.find((r) => r.kind === 'open' && r.frame === 'group')).toEqual({
      kind: 'open',
      frame: 'group',
      beat: 'Fan out',
      sharedSource: 'st:sub-events',
    });
  });

  it('records a shared source only when every grouped step leaves that topic', () => {
    for (const m of models) {
      for (const flow of m.toBe.flows) {
        for (const { shared, froms } of groupSources(sequenceModel(m, flow.id, 'toBe').rows)) {
          expect(froms).toEqual([shared]);
        }
      }
    }
  });
});

describe('sequenceModel: the person', () => {
  it('starts a flow someone triggers with an enter row and the person as actor', () => {
    const sm = sequenceModel(dp, 'flow:checkout', 'toBe');
    expect(sm.actor).toBe('Shopper');
    expect(sm.rows[0]).toMatchObject({ kind: 'enter', to: 'svc:storefront-web' });
    const trigger = sm.flow?.trigger;
    expect(sm.rows.some((r) => r.kind === 'note' && r.on === 'first' && r.text === trigger)).toBe(
      true,
    );
  });

  it('gives a job no person row', () => {
    let seen = 0;
    for (const m of models) {
      for (const flow of m.toBe.flows) {
        if (!isJob(m, flow)) continue;
        seen++;
        const sm = sequenceModel(m, flow.id, 'toBe');
        expect(sm.rows.some((r) => r.kind === 'enter')).toBe(false);
        expect(sm.actor).toBeNull();
      }
    }
    expect(seen).toBeGreaterThan(0);
  });

  it('never gives a System actor a person lifeline', () => {
    let seen = 0;
    for (const m of models) {
      for (const mode of ['asIs', 'toBe'] as const) {
        for (const flow of m.graphOf(mode).flows) {
          if (!/^system$/i.test(flow.actor ?? '')) continue;
          seen++;
          const sm = sequenceModel(m, flow.id, mode);
          expect(sm.actor).toBeNull();
          expect(sm.automated).toBe(true);
          expect(
            sm.rows.some((r) => r.kind === 'enter' || (r.kind === 'note' && r.on === 'person')),
          ).toBe(false);
        }
      }
    }
    expect(seen).toBeGreaterThan(0);
  });

  it('keeps a human role that contains System a person', async () => {
    const plan = await loadFixture('mini.yaml');
    const flow = plan.flows?.find((f) => f.id === 'flow:cancel');
    if (flow === undefined) throw new Error('no flow:cancel');
    flow.actor = 'System administrator';
    flow.trigger = 'The administrator submits the form.';
    const sm = sequenceModel(derive(plan), 'flow:cancel');
    expect(sm.actor).toBe('System administrator');
    expect(sm.rows[0]?.kind).toBe('enter');
  });

  it('notes the screen the person sees when it changes, not on every step', () => {
    const notes = sequenceRows(dp, 'flow:checkout', 'toBe').flatMap((r) =>
      r.kind === 'note' && r.on === 'person' ? [r.screen.split('#')[0]] : [],
    );
    expect(notes.length).toBeGreaterThanOrEqual(1);
    for (const [i, n] of notes.entries()) if (i > 0) expect(n).not.toBe(notes[i - 1]);
  });

  it('is pure: the same flow gives the same rows', () => {
    expect(sequenceRows(dp, 'flow:checkout', 'toBe')).toEqual(
      sequenceRows(dp, 'flow:checkout', 'toBe'),
    );
  });

  it('draws a flow the plan removes from the as-is steps, and one it adds from the to-be', () => {
    const p = models.find((m) => m.asIs.flows.some((f) => !m.toBe.has(f.id)));
    const gone = p?.asIs.flows.find((f) => !p.toBe.has(f.id));
    if (p === undefined || gone === undefined) return;
    expect(sequenceModel(p, gone.id, 'toBe').steps).toHaveLength(gone.steps.length);
    expect(sequenceModel(p, 'flow:missing', 'toBe')).toMatchObject({ steps: [], rows: [] });
  });
});

describe('flowSteps', () => {
  it('strikes a removed step into the diff, after the step it followed', () => {
    const diff = flowSteps(mini, 'flow:cancel', 'diff');
    const ids = diff.map((s) => s.id);
    expect(ids.indexOf('flow:cancel#legacy-email')).toBeGreaterThan(0);
    const before = mini.asIs.get('flow:cancel');
    const index =
      before?.$type === 'flow'
        ? before.steps.findIndex((s) => s.id === 'flow:cancel#legacy-email')
        : -1;
    const previous = before?.$type === 'flow' ? before.steps[index - 1]?.id : undefined;
    expect(ids.indexOf('flow:cancel#legacy-email')).toBe(ids.indexOf(previous ?? '') + 1);
    expect(diff.find((s) => s.id === 'flow:cancel#legacy-email')?.$removed).toBe(true);
    expect(flowSteps(mini, 'flow:cancel', 'toBe').map((s) => s.id)).not.toContain(
      'flow:cancel#legacy-email',
    );
    expect(flowSteps(mini, 'flow:cancel', 'asIs').map((s) => s.id)).toContain(
      'flow:cancel#legacy-email',
    );
  });

  it('reads a flow only the plan adds, or only today has, from the graph that has it', () => {
    expect(flowSteps(mini, 'flow:pause', 'asIs').length).toBeGreaterThan(0);
    expect(flowSteps(mini, 'flow:missing', 'diff')).toEqual([]);
  });
});

describe('what a step is', () => {
  it('is an api call, an event, data or internal', () => {
    expect(stepKind(mini, step('flow:cancel#request'))).toBe('api');
    expect(stepKind(mini, step('flow:cancel#publish'))).toBe('msg');
    expect(stepKind(mini, { via: 'internal', from: 'svc:subs', to: 'st:subs-db' })).toBe('data');
    expect(stepKind(mini, { via: 'internal', from: 'svc:subs', to: 'svc:subs' })).toBe('internal');
  });

  it('knows a path today already joins, and one that stays inside a service', () => {
    expect(knownPath(mini, step('flow:cancel#request'))).toBe(true);
    expect(knownPath(mini, { from: 'svc:subs', to: 'svc:subs' })).toBe(true);
    expect(knownPath(mini, { from: 'svc:web', to: 'svc:analytics' })).toBe(false);
    expect(knownPath(mini, { from: 'svc:web', to: 'svc:nowhere' })).toBe(false);
    expect(knownPath(mini, { from: '', to: 'svc:web' })).toBe(false);
  });

  it('finds a new link where no step goes today, never inside one service or in a removed step', () => {
    expect(isNewLink(mini, { ...step('flow:cancel#request'), via: 'api:subs-pause' })).toBe(true);
    expect(
      isNewLink(mini, {
        ...step('flow:cancel#request'),
        from: 'svc:web',
        to: 'svc:analytics',
        via: 'internal',
      }),
    ).toBe(true);
    expect(
      isNewLink(mini, {
        ...step('flow:cancel#request'),
        from: 'svc:web',
        to: 'svc:web',
        via: 'internal',
      }),
    ).toBe(false);
    expect(
      isNewLink(mini, { ...step('flow:cancel#request'), $removed: true, via: 'api:subs-pause' }),
    ).toBe(false);
    expect(isNewLink(mini, step('flow:cancel#request'))).toBe(false);
  });
});
