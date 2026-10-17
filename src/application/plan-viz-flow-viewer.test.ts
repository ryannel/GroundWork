import { describe, expect, it } from 'vitest';

import { shop } from '@/../test/federation-kit';
import { derive } from '@/application/plan/derive';
import { flowSteps } from '@/application/plan/flow-steps';
import { changeMarkers, decisionsOf, stepChanges } from '@/application/plan-viz-flow-changes';
import { flowKey } from '@/application/plan-viz-flow-key';
import { caseWords, narrate, stopLabel } from '@/application/plan-viz-flow-narration';
import { defaultMode, stepStops, stopOfStep } from '@/application/plan-viz-flow-stops';

const model = derive(shop());
const purge = 'flow:price-purge';

describe('stops', () => {
  it('groups a beat or a fan-out, and keeps unrelated steps apart', () => {
    const stops = stepStops(model, purge);
    expect(stops.map((s) => s.indices)).toEqual([[0], [1], [2]]);
    expect(stops[0]?.title).toBe('Publish the price');
  });

  it('keeps one stop for each step on a journey that has screens', () => {
    const stops = stepStops(model, 'flow:browse');
    expect(stops).toHaveLength(1);
    expect(stops[0]?.short).toBe('Ask for the product');
  });

  it('groups steps that share a beat, and names the stop for it', () => {
    const plan = shop();
    const flow = plan.flows?.find((f) => f.id === purge);
    for (const s of flow?.steps ?? []) s.beat = 'On a price change';
    const grouped = stepStops(derive(plan), purge);
    expect(grouped).toHaveLength(1);
    expect(grouped[0]?.title).toBe('On a price change');
    expect(grouped[0]?.short).toBe('On a price change');
    expect(stepStops(derive(plan), purge, { singleSteps: true })).toHaveLength(3);
  });

  it('opens on today when the flow exists today, and finds the stop of a step', () => {
    expect(defaultMode(model, purge)).toBe('asIs');
    expect(defaultMode(model, 'flow:nowhere')).toBe('toBe');
    const stops = stepStops(model, purge);
    expect(stopOfStep(stops, 2)).toBe(2);
    expect(stopOfStep(stops, 9)).toBe(0);
  });
});

describe('what a stop says', () => {
  const steps = flowSteps(model, purge, 'toBe');
  const stops = stepStops(model, purge);

  it('says who talks to whom, and through what', () => {
    const one = stops[0] && narrate(steps, stops[0]);
    expect(one?.number).toBe('1');
    expect(one?.route).toEqual({ kind: 'pair', from: 'svc:pricing-api', to: 'st:price-topic' });
    expect(one?.vias).toEqual(['msg:price-published']);
  });

  it('says a step on its own data works on it, and lists what it purges', () => {
    const own = stops[2] && narrate(steps, stops[2]);
    expect(own?.route).toEqual({ kind: 'pair', from: 'svc:purger', to: 'st:edge-cache' });
    expect(own?.purges).toEqual(['st:edge-cache']);
    expect(own?.vias).toEqual([]);
  });

  it('lists every step of a grouped stop with the records it touches', () => {
    const all = {
      title: 'All',
      short: 'All',
      beat: null,
      fan: null,
      actor: null,
      stepIds: steps.map((s) => s.id),
      indices: [0, 1, 2],
    };
    const group = narrate(steps, all);
    expect(group?.number).toBe('1–3');
    expect(group?.route).toMatchObject({ kind: 'chain' });
    expect(group?.rows.map((r) => r.n)).toEqual([1, 2, 3]);
    expect(group?.rows[2]?.via).toBeNull();
    expect(group?.rows[2]?.purges).toEqual(['st:edge-cache']);
    expect(stopLabel(all)).toBe('steps 1–3');
    expect(stopLabel({ ...all, indices: [1] })).toBe('step 2');
  });

  it('says one service reacts, or many', () => {
    const fan = {
      title: 'Read',
      short: 'Read',
      beat: null,
      fan: 'st:price-topic',
      actor: null,
      stepIds: ['a', 'b'],
      indices: [1, 1],
    };
    const talk = narrate(steps, fan);
    expect(talk?.route).toMatchObject({ kind: 'fan', from: 'st:price-topic' });
    expect(narrate(steps, { ...fan, indices: [] })).toBeNull();
  });

  it('carries a call to an operation with the cache case it narrates', () => {
    const browse = flowSteps(model, 'flow:browse', 'toBe');
    const stop = stepStops(model, 'flow:browse')[0];
    const call = stop && narrate(browse, stop);
    expect(call?.calls).toEqual([
      { stepId: 'flow:browse#open', via: 'gql:product-page', kase: 'cold' },
    ]);
    expect(call?.openScreen).toBe('scr:pdp');
    expect(caseWords('hit')).toBe('all cached');
    expect(caseWords('miss')).toBe('not in the edge cache');
    expect(caseWords('cold')).toBe('nothing cached');
  });
});

describe('changes', () => {
  it('marks nothing on a flow that is new, or that the plan leaves alone', () => {
    expect(changeMarkers(model, 'flow:nowhere').markers).toEqual({});
    const marks = changeMarkers(model, 'flow:browse');
    expect(Object.keys(marks.markers)).toHaveLength(Object.keys(marks.reasons).length);
  });

  it('marks a step that goes through an interface the plan changes, with the reason', () => {
    const marks = changeMarkers(model, 'flow:browse');
    expect(marks.markers['flow:browse#open']).toBe('◇');
    expect(marks.reasons['flow:browse#open']?.length).toBeGreaterThan(0);
    expect(marks.pins['flow:browse#open']).toEqual(['gql:product-page']);
  });

  it('finds the changes behind a step, and the decisions behind them', () => {
    const step = flowSteps(model, 'flow:browse', 'toBe')[0];
    const changes = step === undefined ? [] : stepChanges(model, step);
    expect(changes.length).toBeGreaterThan(0);
    expect(changes.every((c) => c.startsWith('chg:'))).toBe(true);
    expect(Array.isArray(decisionsOf(model, changes))).toBe(true);
  });
});

describe('the key', () => {
  it('keys only what the diagram shows', () => {
    const labels = flowKey(model, purge, {
      mode: 'toBe',
      view: 'diagram',
      marked: true,
      walkable: true,
    }).map((i) => i.label);
    expect(labels).toEqual(
      expect.arrayContaining(['event', 'you are here', 'internal step', 'planned changes']),
    );
    expect(labels).not.toContain('sync call');
  });

  it('keys what the sequence adds, and what a journey shows', () => {
    const labels = flowKey(model, 'flow:browse', {
      mode: 'asIs',
      view: 'sequence',
      marked: false,
      walkable: false,
    }).map((i) => i.label);
    expect(labels).toContain('sync call');
    expect(labels).toContain('screen the person sees');
    expect(labels).not.toContain('new');
  });
});
