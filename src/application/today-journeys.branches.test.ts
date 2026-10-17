// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';

import { derive } from '@/application/plan/derive';
import type { Plan } from '@/domain/plan/plan.generated';

import { flowsByStage, journeyClaim, journeysHeadline, todayJourneysOf } from './today-journeys';

vi.mock(import('server-only'), () => ({}));

const { loadFixture } = await import('@/infrastructure/plan-fixture');

/**
 * mini.yaml with Subscriptions in a system and user journeys that go astray: one whose last move is not recorded,
 * one that relies on no flow, one that starts on a move that is not recorded.
 */
async function withJourneys(): Promise<Plan> {
  const p = await loadFixture('mini.yaml');
  p.services = p.services.map((s) => (s.id === 'svc:subs' ? { ...s, system: 'sys:subs' } : s));
  p.interactions = [
    {
      id: 'ia:cancel',
      name: 'Press cancel',
      from: ['svc:web'],
      to: 'svc:web',
      trigger: 'click',
      effect: 'update',
      supporting_steps: ['flow:cancel#request', 'flow:cancel#publish', 'flow:ghost#step'],
    },
    {
      id: 'ia:look',
      name: 'Look around',
      from: ['svc:web'],
      to: 'svc:web',
      trigger: 'scroll',
      effect: 'navigate',
      result: 'Sees the page',
    },
  ];
  p.user_journeys = [
    {
      id: 'uj:leave',
      name: 'Leave',
      actor: 'Member',
      interactions: ['ia:cancel', 'ia:missing'],
    },
    { id: 'uj:browse', name: 'Browse', interactions: ['ia:look'] },
    { id: 'uj:lost', name: 'Lost', interactions: ['ia:missing', 'ia:cancel'] },
  ];
  return p;
}

describe('the journeys of today, when things are missing', () => {
  it('walks a user journey across the flows its moves rely on, and drops one that relies on none', async () => {
    const journeys = todayJourneysOf(derive(await withJourneys()));
    const users = journeys.filter((j) => j.kind === 'journey');
    expect(users.map((j) => j.id)).toEqual(['uj:leave', 'uj:lost']);
    expect(users[0]).toMatchObject({
      actor: 'Member',
      trigger: 'Press cancel',
      outcome: '',
      flows: ['flow:cancel'],
      systems: ['sys:subs'],
      steps: 5,
    });
    expect(users[1]).toMatchObject({ actor: '', trigger: '', outcome: 'Press cancel' });
    expect(users.map((j) => journeyClaim(j))).toEqual([
      'One flow, five steps across one system.',
      'One flow, five steps across one system.',
    ]);
  });

  it('keeps a planned scenario whose flow is not in today, under its own key', async () => {
    const journeys = todayJourneysOf(derive(await withJourneys()));
    const trip = journeys.find((j) => j.kind === 'flow' && j.flows.includes('flow:pause'));
    expect(trip).toMatchObject({ actor: '', trigger: '', outcome: '', steps: 0, systems: [] });
    expect(trip?.title).toBe(trip?.key);
  });

  it('files every flow as other flows when the plan has no stages', async () => {
    const model = derive(await withJourneys());
    const journeys = todayJourneysOf(model);
    const groups = flowsByStage(model, journeys);
    expect(groups.map((g) => [g.stage, g.title])).toEqual([['', 'Other flows']]);
    expect(groups[0]?.journeys).toHaveLength(journeys.filter((j) => j.kind === 'flow').length);
    expect(journeysHeadline(journeys)).toBe(
      'Two user journeys and three flows carry work across one system.',
    );
  });

  it('says a headline without user journeys', async () => {
    const p = await loadFixture('mini.yaml');
    const journeys = todayJourneysOf(derive(p));
    expect(journeysHeadline(journeys)).toBe('Three flows carry work across no systems.');
  });
});
