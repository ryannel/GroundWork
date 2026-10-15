import { describe, expect, it } from 'vitest';

import { sequencePlan } from '@/../test/sequence-kit';
import { derive } from '@/application/plan/derive';
import { type Moment, flowExperience } from '@/application/plan/flow-experience';
import { flowSteps } from '@/application/plan/flow-steps';
import {
  MOMENT_WORDS,
  experienceOf,
  linkedScreen,
  momentOf,
  stopNumber,
  systemNav,
} from '@/application/plan-viz-experience';
import { stepStops } from '@/application/plan-viz-flow-stops';

const model = derive(sequencePlan());
const flow = 'flow:rich';
const steps = flowSteps(model, flow, 'toBe');
const stops = stepStops(model, flow);
const moments = flowExperience(model, flow, 'toBe');

describe('moments', () => {
  it('numbers the stop that holds a step from 1, and 0 for none', () => {
    expect(stopNumber(stops, 0)).toBe(1);
    expect(stopNumber(stops, 3)).toBe(4);
    expect(stopNumber(stops, 99)).toBe(0);
  });

  it('finds the moment a step belongs to', () => {
    expect(momentOf(moments, 0)).toBe(0);
    expect(momentOf(moments, 99)).toBe(-1);
  });
});

describe('experienceOf', () => {
  const at = { current: 0, steps, stops, selected: [0], mode: 'toBe' } as const;

  it('says what the moment is and what it shows', () => {
    const data = experienceOf(model, moments, at);
    expect(data?.topline).toBe('The planned experience');
    expect(data?.word).toBe(MOMENT_WORDS[moments[0]?.kind ?? 'action']);
    expect(data?.tabs).toHaveLength(moments.length);
    expect(data?.tabs[0]?.current).toBe(true);
    expect(data?.key).toBe(`toBe:${steps[moments[0]?.anchor ?? 0]?.id ?? ''}`);
    expect(data?.screen).toMatchObject({ kind: 'figure', id: 'scr:pdp' });
  });

  it('lists the system steps of the moment, the current one marked', () => {
    const data = experienceOf(model, moments, at);
    expect(data?.systems.map((s) => s.n)).toEqual((moments[0]?.indices ?? []).map((i) => i + 1));
    expect(data?.systems[0]).toMatchObject({ current: true, stop: 1, event: false });
    expect(data?.systems[0]?.fails).toContain('unknown');
  });

  it('points on to the next moment, and says today for the as-is', () => {
    const data = experienceOf(model, moments, { ...at, mode: 'asIs' });
    expect(data?.topline).toBe('The experience today');
    expect(data?.next?.title).toBe(moments[1]?.title);
    const last = experienceOf(model, moments, { ...at, current: moments.length - 1 });
    expect(last?.next).toBeNull();
  });

  it('says a moment that is not linked has no screen, and a missing moment is nothing', () => {
    const loose: Moment = {
      kind: 'linked',
      title: 'x',
      screen: null,
      region: null,
      anchor: 0,
      indices: [0],
    };
    const data = experienceOf(model, [loose], at);
    expect(data?.screen).toEqual({ kind: 'none' });
    expect(data?.linked).toBe(true);
    expect(experienceOf(model, moments, { ...at, current: 99 })).toBeNull();
  });

  it('knows a screen the view does not have', () => {
    const gone: Moment = {
      kind: 'action',
      title: 't',
      screen: 'scr:nowhere',
      region: null,
      anchor: 0,
      indices: [0],
    };
    expect(experienceOf(model, [gone], at)?.screen).toEqual({ kind: 'missing' });
  });
});

describe('the screen beside a stop, and the steps around it', () => {
  it('names the linked screen and its focus', () => {
    const first = moments[0];
    const linked = first === undefined ? null : linkedScreen(model, first, 'toBe');
    expect(linked?.present).toBe(true);
    expect(linked?.focus).toEqual(first?.region === null ? [] : [first?.region]);
    const loose: Moment = {
      kind: 'linked',
      title: 'x',
      screen: null,
      region: null,
      anchor: 0,
      indices: [0],
    };
    expect(linkedScreen(model, loose, 'toBe')).toBeNull();
  });

  it('offers the previous and next stop within the moment', () => {
    const moment: Moment = {
      kind: 'action',
      title: 'x',
      screen: null,
      region: null,
      anchor: 0,
      indices: [0, 1, 2],
    };
    const nav = systemNav(moment, stops, 1);
    expect(nav.prev?.stop).toBe(1);
    expect(nav.next?.stop).toBe(3);
    expect(systemNav(moment, stops, 0).prev).toBeNull();
  });
});
