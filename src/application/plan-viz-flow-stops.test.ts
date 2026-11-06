import { describe, expect, it } from 'vitest';

import { derive } from '@/application/plan/derive';
import type { Plan, Step } from '@/domain/plan/plan.generated';

import { defaultMode, stepStops, stopOfStep } from './plan-viz-flow-stops';

function model(steps: Step[], changes: Plan['changes'] = []) {
  return derive({
    meta: { id: 'stops', title: 'Follow work' },
    teams: [],
    problem: { summary: 'Group related work without hiding boundaries.' },
    services: [
      { id: 'svc:a', name: 'A', kind: 'service' },
      { id: 'svc:b', name: 'B', kind: 'service' },
      { id: 'svc:c', name: 'C', kind: 'service' },
    ],
    stores: [
      { id: 'st:data', name: 'Data', kind: 'database', owner: 'svc:b' },
      { id: 'st:topic', name: 'Events', kind: 'topic' },
    ],
    flows: [{ id: 'flow:work', name: 'Work', steps }],
    changes,
  });
}
const call = (id: string, from: string, to: string, extra: Partial<Step> = {}): Step => ({
  id: `flow:work#${id}`,
  from,
  to,
  via: 'api:call',
  action: id,
  ...extra,
});

describe('flow stops preserve the reader’s boundaries', () => {
  it('groups a call, its internal work and its publication, then starts another actor', () => {
    const value = model([
      call('call', 'svc:a', 'svc:b'),
      call('write', 'svc:b', 'st:data', { via: 'internal' }),
      call('publish', 'svc:b', 'st:topic'),
      call('other', 'svc:a', 'svc:c'),
    ]);
    expect(stepStops(value, 'flow:work')).toEqual([
      {
        title: 'call → write → publish',
        short: 'call +2',
        stepIds: ['flow:work#call', 'flow:work#write', 'flow:work#publish'],
        indices: [0, 1, 2],
        actor: 'svc:b',
        beat: null,
        fan: null,
      },
      {
        title: 'other',
        short: 'other',
        stepIds: ['flow:work#other'],
        indices: [3],
        actor: 'svc:c',
        beat: null,
        fan: null,
      },
    ]);
    expect(stepStops(value, 'flow:work', { singleSteps: true }).map((s) => s.indices)).toEqual([
      [0],
      [1],
      [2],
      [3],
    ]);
  });
  it('groups consumers of the same topic and ends the fan before other work', () => {
    const value = model([
      call('first', 'st:topic', 'svc:b'),
      call('second', 'st:topic', 'svc:c'),
      call('internal', 'svc:c', 'svc:c'),
      call('unknown', 'unknown', 'nowhere'),
    ]);
    expect(stepStops(value, 'flow:work')).toEqual([
      {
        title: 'Read by 2 consumers',
        short: 'Read by 2 consumers',
        stepIds: ['flow:work#first', 'flow:work#second'],
        indices: [0, 1],
        actor: null,
        beat: null,
        fan: 'st:topic',
      },
      {
        title: 'internal → unknown',
        short: 'internal +1',
        stepIds: ['flow:work#internal', 'flow:work#unknown'],
        indices: [2, 3],
        actor: 'svc:c',
        beat: null,
        fan: null,
      },
    ]);
  });
  it('only groups equal explicit beats and never folds screen interactions', () => {
    const steps = [
      call('one', 'svc:a', 'svc:b', { beat: 'Prepare' }),
      call('two', 'svc:c', 'svc:a', { beat: 'Prepare' }),
      call('three', 'svc:a', 'svc:a'),
      call('four', 'svc:a', 'svc:a', { beat: 'Finish' }),
    ];
    const value = model(steps);
    expect(
      stepStops(value, 'flow:work').map(({ title, short, beat, indices }) => ({
        title,
        short,
        beat,
        indices,
      })),
    ).toEqual([
      { title: 'Prepare', short: 'Prepare', beat: 'Prepare', indices: [0, 1] },
      { title: 'three', short: 'three', beat: null, indices: [2] },
      { title: 'four', short: 'four', beat: null, indices: [3] },
    ]);
    steps[0]!.screen = 'scr:control';
    expect(stepStops(model(steps), 'flow:work').map((s) => s.indices)).toEqual([
      [0],
      [1],
      [2],
      [3],
    ]);
  });
  it('selects the requested state, preserves blank-action identity and handles missing steps', () => {
    const value = model(
      [call('one', 'svc:a', 'svc:a', { action: '' })],
      [
        {
          id: 'chg:step',
          title: 'Change wording',
          ops: [{ modify: 'flow:work#one', set: { action: 'Changed' } }],
        },
      ],
    );
    expect(stepStops(value, 'flow:work', { mode: 'asIs' })[0]?.title).toBe('flow:work#one');
    expect(stepStops(value, 'flow:work')[0]?.title).toBe('Changed');
    expect(stepStops(value, 'missing')).toEqual([]);
    expect(defaultMode(value, 'flow:work')).toBe('asIs');
    expect(defaultMode(value, 'missing')).toBe('toBe');
    const stops = stepStops(
      model([call('one', 'svc:a', 'svc:b'), call('two', 'svc:a', 'svc:c')]),
      'flow:work',
    );
    expect(stopOfStep(stops, 1)).toBe(1);
    expect(stopOfStep(stops, 42)).toBe(0);
    expect(stopOfStep([], 0)).toBe(0);
  });
  it('keeps local empty-interface and database work with the same actor but separates other actors', () => {
    const value = model([
      call('one', 'svc:a', 'svc:a'),
      call('two', 'svc:a', 'svc:b', { via: '' }),
      call('three', 'svc:a', 'st:data'),
      call('four', 'svc:c', 'svc:c'),
    ]);
    expect(stepStops(value, 'flow:work').map((s) => s.indices)).toEqual([[0, 1, 2], [3]]);
  });
});
