import { describe, expect, it, vi } from 'vitest';

import { derive } from '@/application/plan/derive';
import { buildGraph } from '@/application/plan/graph';
import { layoutOf } from '@/application/plan/layout';

vi.mock('server-only', () => ({}));

const { loadFixture } = await import('@/infrastructure/plan-fixture');

const plan = await loadFixture('mini.yaml');
const m = derive(plan);

describe('layout', () => {
  it('puts lanes in first-appearance order, with events after the topic owner', () => {
    const l = m.layout();
    expect(l.lanes.map((x) => x.id)).toEqual([
      'team:web',
      'team:subs',
      'events',
      'team:billing',
      'team:platform',
    ]);
    expect(l.byId.get('st:sub-events')).toEqual({
      id: 'st:sub-events',
      type: 'store',
      lane: 2,
      col: 0,
      row: 0,
      under: null,
    });
    expect(l.byId.get('st:subs-db')?.under).toBe('svc:subs');
    expect(l.byId.get('st:subs-db')?.row).toBe(1);
  });

  it('is worked out once', () => {
    expect(m.layout()).toBe(m.layout());
  });

  it('gives each service one column of its lane and labels a lane with its team', () => {
    const l = m.layout();
    const services = l.nodes.filter((n) => n.type === 'service');
    expect(new Set(services.map((n) => `${String(n.lane)}:${String(n.col)}`)).size).toBe(
      services.length,
    );
    expect(l.lanes[0]?.label).toBe(plan.teams.find((t) => t.id === 'team:web')?.name);
  });

  it('adds an events lane at the end when no team owns the first topic', () => {
    const noTeams = layoutOf({
      asIs: buildGraph({}),
      toBe: buildGraph({}),
      sys: (id) => m.asIs.get(id),
      unionIds: ['st:sub-events'],
      teams: [],
    });
    expect(noTeams.lanes.map((x) => x.id)).toEqual(['events']);
    expect(noTeams.nodes.filter((n) => n.type === 'service')).toEqual([]);
  });
});
