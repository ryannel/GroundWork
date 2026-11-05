import { describe, expect, it, vi } from 'vitest';

import { derive } from '@/application/plan/derive';
import type { Change, Plan } from '@/domain/plan/plan.generated';

import {
  composedHashOf,
  type Inherited,
  type StackLayer,
  stackedBase,
  stackOnto,
} from './stack-base';

vi.mock(import('server-only'), () => ({}));

const { loadFixture } = await import('@/infrastructure/plan-fixture');

/** mini as today: its collections, and none of its changes. */
const today = async (): Promise<Plan> => ({ ...(await loadFixture('mini.yaml')), changes: [] });

/** A plan of its own on mini's today, with these changes and nothing listed. */
async function layer(slug: string, title: string, changes: Change[]): Promise<StackLayer> {
  const base = await today();
  return { slug, plan: { ...base, meta: { ...base.meta, title }, changes }, listed: new Set() };
}

async function pause(): Promise<StackLayer> {
  const mini = await loadFixture('mini.yaml');
  return layer(
    'pause',
    'Pause',
    (mini.changes ?? []).filter((c) => c.id === 'chg:pause-api'),
  );
}

const notes = async (): Promise<StackLayer> =>
  layer('notes', 'Notes', [
    {
      id: 'chg:notes',
      title: 'Notes on pause and billing',
      ops: [
        { modify: 'api:subs-pause', set: { auth: 'staff SSO' } },
        { modify: 'svc:billing', set: { tech: 'Rust' } },
        { remove: 'flow:cancel#legacy-email' },
      ],
    },
  ]);

describe('stackOnto', () => {
  it('applies the plans below in order and remembers which one added or changed each thing', async () => {
    const stacked = stackOnto(await today(), [await pause(), await notes()]);
    expect(stacked.problems).toEqual([]);
    expect(stacked.inherited['api:subs-pause']).toEqual({
      plan: 'pause',
      title: 'Pause',
      kind: 'added',
    });
    expect(stacked.inherited['flow:pause']).toMatchObject({ plan: 'pause', kind: 'added' });
    expect(stacked.inherited['svc:billing']).toEqual({
      plan: 'notes',
      title: 'Notes',
      kind: 'modified',
    });
    expect(stacked.inherited['flow:cancel#legacy-email']).toBeUndefined();
    expect(stacked.inherited['svc:web']).toBeUndefined();
    const endpoint = stacked.system.interfaces
      .flatMap((each) => each.endpoints ?? [])
      .find((each) => each.id === 'api:subs-pause');
    expect(endpoint?.auth).toBe('staff SSO');
    expect(stacked.system.services.find((s) => s.id === 'svc:billing')?.tech).toBe('Rust');
  });

  it('says which op no longer applies when the order is wrong', async () => {
    const stacked = stackOnto(await today(), [await notes(), await pause()]);
    expect(stacked.problems).toHaveLength(1);
    expect(stacked.problems[0]).toMatch(/^notes\/chg:notes: .*api:subs-pause/u);
  });

  it('adds what a plan lists itself, once, as added by it', async () => {
    const base = await layer('teams', 'Teams', []);
    const listed: StackLayer = {
      ...base,
      plan: { ...base.plan, teams: [...base.plan.teams, { id: 'team:new', name: 'New' }] },
      listed: new Set(['team:new', 'team:web']),
    };
    const stacked = stackOnto(await today(), [listed]);
    expect(stacked.system.teams.filter((t) => t.id === 'team:web')).toHaveLength(1);
    expect(stacked.system.teams.map((t) => t.id)).toContain('team:new');
    expect(stacked.inherited['team:new']).toMatchObject({ plan: 'teams', kind: 'added' });
    expect(stacked.inherited['team:web']).toBeUndefined();
  });

  it('forgets what a later plan removes', async () => {
    const removing = await layer('drop', 'Drop', [
      { id: 'chg:drop', title: 'Drop the pause flow', ops: [{ remove: 'flow:pause' }] },
    ]);
    const stacked = stackOnto(await today(), [await pause(), removing]);
    expect(stacked.inherited['flow:pause']).toBeUndefined();
    expect(stacked.inherited['api:subs-pause']).toMatchObject({ plan: 'pause' });
  });
});

describe('a plan read on its stack', () => {
  it('shows only its own increment, with the plans below it as its as-is', async () => {
    const stacked = stackOnto(await today(), [await pause()]);
    const own: Change = {
      id: 'chg:own',
      title: 'Pause takes a reason',
      ops: [{ modify: 'api:subs-pause', set: { summary: 'Pause, with a reason' } }],
    };
    const mini = await today();
    const onStack = { ...mini, ...stacked.system, changes: [own] } as Plan;
    const model = derive(onStack, { inherited: stacked.inherited });
    expect(model.records.map((r) => r.changeId)).toEqual(['chg:own']);
    expect(model.asIs.get('api:subs-pause')).toBeDefined();
    expect(model.status('flow:pause')).toBe('existing');
    expect(model.status('api:subs-pause')).toBe('modified');
    expect(model.inheritedFrom('flow:pause')).toMatchObject({ plan: 'pause', kind: 'added' });
    expect(model.inheritedFrom('svc:web')).toBeNull();
    expect(model.inheritedFrom(null)).toBeNull();
    expect(derive(mini).inheritedFrom('flow:pause')).toBeNull();
  });
});

describe('composedHashOf', () => {
  it('changes when what the stack made changes, and not for the rest of today', async () => {
    const stacked = stackOnto(await today(), [await pause()]);
    const base = stackedBase(stacked);
    expect(base.mode).toBe('live');
    const hash = composedHashOf(base, stacked.inherited);
    const renamed = stackOnto(await today(), [
      await pause(),
      await layer('rename', 'Rename', [
        {
          id: 'chg:rename',
          title: 'Rename the flow',
          ops: [{ modify: 'flow:pause', set: { name: 'Pause it' } }],
        },
      ]),
    ]);
    expect(composedHashOf(stackedBase(renamed), stacked.inherited)).not.toBe(hash);
    const elsewhere = stackOnto(await today(), [await pause(), await notes()]);
    const flow: Inherited = { 'flow:pause': { plan: 'pause', title: 'Pause', kind: 'added' } };
    expect(composedHashOf(stackedBase(elsewhere), flow)).toBe(composedHashOf(base, flow));
  });
});
