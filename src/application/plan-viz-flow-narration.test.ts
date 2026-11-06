import { describe, expect, it } from 'vitest';

import { derive } from '@/application/plan/derive';
import type { FlowStep } from '@/application/plan/flow-steps';
import type { Stop } from '@/application/plan-viz-flow-stops';
import type { Plan, Step } from '@/domain/plan/plan.generated';

import { caseWords, narrate, stopLabel } from './plan-viz-flow-narration';

function steps(...overrides: readonly Partial<Step>[]): readonly FlowStep[] {
  const value: Plan = {
    meta: { id: 'narration', title: 'Explain a stop' },
    problem: { summary: 'Keep the recorded route and effects.' },
    teams: [],
    services: ['a', 'b', 'c'].map((id) => ({ id: `svc:${id}`, name: id, kind: 'service' })),
    flows: [
      {
        id: 'flow:read',
        name: 'Read',
        steps: overrides.map((extra, index) => ({
          id: `flow:read#${String(index)}`,
          from: 'svc:a',
          to: 'svc:b',
          via: 'api:read',
          action: 'Read',
          ...extra,
        })),
      },
    ],
  };
  return derive(value).asIs.steps;
}
const stop = (indices: readonly number[], extra: Partial<Stop> = {}): Stop => ({
  title: 'Load the records',
  short: 'Load',
  stepIds: [],
  indices,
  beat: null,
  fan: null,
  actor: null,
  ...extra,
});

describe('flow stop narration', () => {
  it('keeps one call’s number, route, authored logic, failure, cache call and screen', () => {
    const list = steps({
      via: 'gql:read',
      case: 'hit',
      logic: 'Use the selected market.',
      fails: 'The order is missing.',
      purges: ['st:cache'],
      screen: 'scr:page#form',
    });
    expect(narrate(list, stop([0]))).toEqual({
      number: '1',
      group: false,
      text: 'Load the records',
      route: { kind: 'pair', from: 'svc:a', to: 'svc:b' },
      vias: ['gql:read'],
      sentence: 'Use the selected market.',
      purges: ['st:cache'],
      rows: [],
      calls: [{ stepId: 'flow:read#0', via: 'gql:read', kase: 'hit' }],
      fails: [{ action: 'Read', text: 'The order is missing.' }],
      openScreen: 'scr:page',
      first: list[0],
    });
  });
  it('keeps internal work on its own component and omits missing calls, failures and screens', () => {
    const list = steps({ from: 'svc:a', to: 'svc:a', via: 'internal', action: '' });
    expect(narrate(list, stop([0]))).toMatchObject({
      route: { kind: 'self', id: 'svc:a' },
      vias: [],
      sentence: '',
      calls: [],
      fails: [],
      purges: [],
      openScreen: null,
    });
    expect(narrate([], stop([]))).toBeNull();
    expect(narrate(list, stop([8]))).toBeNull();
  });
  it('shows the full chain and per-step effects, deduplicating root records and omitting reads already covered by writes', () => {
    const list = steps(
      {
        writes: ['sch:order#id', 'sch:order'],
        reads: ['sch:order#total', 'sch:cart#id', 'sch:cart'],
        purges: ['st:cache'],
        screen: 'scr:page#buy',
      },
      { from: 'svc:b', to: 'svc:c', via: '', action: '', screen: 'scr:page#summary', fails: '' },
    );
    expect(narrate(list, stop([0, 1]))).toMatchObject({
      number: '1–2',
      group: true,
      route: { kind: 'chain', ids: ['svc:a', 'svc:b', 'svc:c'] },
      vias: ['api:read'],
      sentence: '',
      purges: [],
      openScreen: 'scr:page',
      calls: [],
      fails: [],
      rows: [
        {
          n: 1,
          id: 'flow:read#0',
          action: 'Read',
          via: 'api:read',
          writes: ['sch:order'],
          reads: ['sch:cart'],
          purges: ['st:cache'],
        },
        {
          n: 2,
          id: 'flow:read#1',
          action: 'flow:read#1',
          via: null,
          writes: [],
          reads: [],
          purges: [],
        },
      ],
    });
    expect(narrate(list, stop([0, 99, 1]))?.rows).toHaveLength(2);
  });
  it('shows shared-source fan-out without claiming all grouped steps are reactions', () => {
    const list = steps(
      { from: 'st:events', to: 'svc:a', via: 'msg:changed' },
      { from: 'st:events', to: 'svc:b', via: 'msg:changed' },
    );
    expect(narrate(list, stop([0, 1], { fan: 'st:events' }))).toMatchObject({
      route: { kind: 'fan', from: 'st:events', to: ['svc:a', 'svc:b'] },
      vias: ['msg:changed'],
      sentence: 'Two components react, each on its own.',
    });
    expect(narrate(list, stop([0, 1]))).toMatchObject({
      route: { kind: 'fan', from: 'st:events', to: ['svc:a', 'svc:b'] },
      sentence: '',
    });
    expect(narrate(list, stop([0, 1], { fan: 'another-source' }))?.sentence).toBe('');
    const same = steps({ from: 'st:events', to: 'svc:a' }, { from: 'st:events', to: 'svc:a' });
    expect(narrate(same, stop([0, 1], { fan: 'st:events' }))).toMatchObject({
      route: { kind: 'fan', from: 'st:events', to: ['svc:a'] },
      sentence: '',
    });
  });
  it.each([
    [9, 'Nine'],
    [10, '10'],
  ] as const)('counts %s distinct reacting components', (count, word) => {
    const list = steps(
      ...Array.from({ length: count }, (_, index) => ({
        from: 'st:events',
        to: `svc:target-${String(index)}`,
        via: 'msg:changed',
      })),
    );
    expect(
      narrate(
        list,
        stop(
          list.map((_, index) => index),
          { fan: 'st:events' },
        ),
      )?.sentence,
    ).toBe(`${word} components react, each on its own.`);
  });
  it('opens a screen only when all recorded screen references point at the same root and retains each GraphQL cache case', () => {
    const list = steps(
      { via: 'gql:read', screen: 'scr:one', fails: 'Unavailable' },
      { via: 'gql:other', case: 'miss', screen: 'scr:two', action: '', fails: 'Missing' },
    );
    const result = narrate(list, stop([0, 1]));
    expect(result?.openScreen).toBeNull();
    expect(result?.calls).toEqual([
      { stepId: 'flow:read#0', via: 'gql:read', kase: 'cold' },
      { stepId: 'flow:read#1', via: 'gql:other', kase: 'miss' },
    ]);
    expect(result?.fails).toEqual([
      { action: 'Read', text: 'Unavailable' },
      { action: 'flow:read#1', text: 'Missing' },
    ]);
    expect(caseWords('hit')).toBe('all cached');
    expect(caseWords('miss')).toBe('not in the edge cache');
    expect(caseWords('cold')).toBe('nothing cached');
    expect(stopLabel(stop([1]))).toBe('step 2');
    expect(stopLabel(stop([0, 1]))).toBe('steps 1–2');
  });
});
