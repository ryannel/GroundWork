// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';

import { derive } from '@/application/plan/derive';
import {
  channelOf,
  nameOf,
  OWNER_COLUMNS,
  ownerFacts,
  ownerLists,
  workText,
} from '@/application/plan-viz-owners';

vi.mock('server-only', () => ({}));

async function load() {
  const { readPlan } = await import('@/infrastructure/plan-store');
  const loaded = await readPlan('alder-finch', 'delivery-promise');
  return loaded.plan!;
}

describe('owner lists', () => {
  it('has the columns in a fixed order, the vote last', () => {
    expect(OWNER_COLUMNS.map((c) => c.key)).toEqual([
      'svc',
      'st',
      'if',
      'msg',
      'chg',
      'wi',
      'tst',
      'dec',
      'vote',
    ]);
  });

  it('lists what a team’s services own and what it builds', async () => {
    const model = derive(await load());
    const lists = ownerLists(model, 'team:fulfilment');
    expect(lists.svc.length).toBeGreaterThan(0);
    expect(lists.wi).toContain('wi:promise-service');
    expect(lists.chg.length).toBeGreaterThan(0);
    const owned = new Set(lists.svc);
    const stores = [...model.asIs.stores, ...model.toBe.stores];
    expect(lists.st.every((id) => owned.has(stores.find((s) => s.id === id)!.owner))).toBe(true);
    expect(new Set(lists.if).size).toBe(lists.if.length);
  });

  it('drops what the plan adds when asked', async () => {
    const model = derive(await load());
    const all = ownerLists(model, 'team:fulfilment');
    const hidden = ownerLists(model, 'team:fulfilment', { hide: (id) => id === all.svc[0] });
    expect(hidden.svc).toHaveLength(all.svc.length - 1);
  });

  it('lists the proposed decisions and open questions a team decides', async () => {
    const plan = await load();
    const model = derive({
      ...plan,
      decisions: [
        { id: 'dec:a', title: 'A', status: 'proposed', decider: 'team:legal' },
        { id: 'dec:b', title: 'B', status: 'accepted', decider: 'team:legal' },
        { id: 'dec:c', title: 'C', status: 'proposed', decider: 'team:catalog' },
      ],
      questions: [
        { id: 'q:open', question: 'Open?', status: 'open', decider: 'team:legal' },
        { id: 'q:done', question: 'Done?', status: 'resolved', decider: 'team:legal' },
      ],
    });
    expect(ownerLists(model, 'team:legal').dec).toEqual(['dec:a', 'q:open']);
  });
});

describe('owner text', () => {
  it('counts work, and says how much is done once delivery has begun', async () => {
    const plan = await load();
    const ids = plan.work_items!.slice(0, 3).map((w) => w.id);
    expect(workText(derive(plan), ids)).toBe('3');
    const work = plan.work_items!.map((w) => (w.id === ids[0] ? { ...w, github_issue: 5 } : w));
    const model = derive(
      { ...plan, work_items: work },
      { status: { [ids[0]!]: { state: 'closed', closed_at: '2026-11-02T10:00:00Z' } } },
    );
    expect(workText(model, ids)).toBe('3 · 1 done');
  });

  it('reads a row as plain text in column order', async () => {
    const model = derive(await load());
    const lists = ownerLists(model, 'team:fulfilment');
    const parts = ownerFacts(model, 'team:fulfilment', lists).split('|');
    expect(parts).toHaveLength(OWNER_COLUMNS.length);
    expect(parts[0]).toBe(String(lists.svc.length));
    expect(parts[5]).toBe(String(lists.wi.length));
  });

  it('names a thing in plain words', async () => {
    const model = derive(await load());
    expect(nameOf(model, 'team:fulfilment')).toBe('Fulfilment');
  });

  it('gives a team’s channel, but not a placeholder', async () => {
    const plan = await load();
    const model = derive({
      ...plan,
      teams: [
        { id: 'team:a', name: 'A', channel: '#team-a' },
        { id: 'team:b', name: 'B', channel: 'TBD' },
        { id: 'team:c', name: 'C' },
      ],
    });
    expect(channelOf(model, 'team:a')).toBe('#team-a');
    expect(channelOf(model, 'team:b')).toBe('');
    expect(channelOf(model, 'team:c')).toBe('');
    expect(channelOf(model, 'team:none')).toBe('');
  });
});
