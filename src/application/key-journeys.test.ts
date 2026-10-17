import { describe, expect, it } from 'vitest';

import type { TodayJourney } from '@/application/today-journeys';
import type { Workspace } from '@/domain/workspace';

import { MOST_KEY_JOURNEYS, suggestedJourneys } from './key-journeys';

const system = (id: string) => ({ id, name: id, components: [] }) as never;
const workspace = {
  id: 'w',
  name: 'W',
  description: null,
  isPrivate: false,
  teams: [],
  actors: [{ id: 'actor:shopper', name: 'Shopper', summary: null, uses: [], customer: true }],
  domains: [
    { id: 'shop', name: 'Shop', systems: ['a', 'b', 'c'].map(system) },
    { id: 'back', name: 'Back', systems: ['d', 'e'].map(system) },
  ],
} as unknown as Workspace;

const journey = (
  key: string,
  systems: string[],
  more: Partial<TodayJourney> = {},
): TodayJourney => ({
  key,
  kind: 'flow',
  id: `flow:${key}`,
  title: key,
  actor: '',
  trigger: '',
  outcome: '',
  flows: [`flow:${key}`],
  systems: systems.map((s) => `sys:${s}`),
  steps: systems.length,
  ...more,
});

describe('suggestedJourneys', () => {
  it('picks the journeys that reach the most systems not yet reached, and stops when none reaches further', () => {
    const picked = suggestedJourneys(workspace, [
      journey('small', ['a']),
      journey('wide', ['a', 'b', 'd']),
      journey('rest', ['c', 'e']),
      journey('again', ['a', 'd']),
    ]);
    expect(picked.map((p) => p.journey.key)).toEqual(['wide', 'rest']);
    expect(picked[0]?.why).toBe('Runs on its own, across 2 domains.');
  });

  it('prefers what a person starts, and skips a flow already walked in a user journey', () => {
    const picked = suggestedJourneys(workspace, [
      journey('job', ['a', 'b'], { actor: 'Scheduler' }),
      journey('buy', ['a', 'b'], { actor: 'Shopper' }),
      journey('uj-buy', ['a', 'b', 'd'], {
        kind: 'journey',
        flows: ['flow:inner'],
        actor: 'Shopper',
      }),
      journey('inner', ['e'], { id: 'flow:inner' }),
    ]);
    expect(picked.map((p) => p.journey.key)).toEqual(['uj-buy']);
    expect(picked[0]?.why).toBe('Started by a shopper, across 2 domains.');
    const people = suggestedJourneys(workspace, [
      journey('job', ['a', 'b'], { actor: 'Scheduler' }),
      journey('buy', ['a', 'b'], { actor: 'Shopper' }),
    ]);
    expect(people.map((p) => p.journey.key)).toEqual(['buy']);
    const machine = suggestedJourneys(workspace, [journey('job', ['a'], { actor: 'Scheduler' })]);
    expect(machine[0]?.why).toBe('Started by the scheduler, across 1 domain.');
  });

  it(`never picks more than ${String(MOST_KEY_JOURNEYS)}`, () => {
    const many = Array.from({ length: 20 }, (_, i) => journey(`j${String(i)}`, [`s${String(i)}`]));
    expect(suggestedJourneys(workspace, many)).toHaveLength(MOST_KEY_JOURNEYS);
  });
});
