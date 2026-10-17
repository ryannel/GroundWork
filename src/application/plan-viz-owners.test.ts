// @vitest-environment node
import { describe, expect, it } from 'vitest';

import { dispatchDate } from '@/../test/fixtures/acme/plans/work-dispatch';
import { modelOf } from '@/../test/plan-kit';
import {
  channelOf,
  nameOf,
  OWNER_COLUMNS,
  ownerFacts,
  ownerLists,
  workText,
} from '@/application/plan-viz-owners';

const load = dispatchDate;

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

  it('lists what a team’s services own and what it builds', () => {
    const model = modelOf(load());
    const lists = ownerLists(model, 'team:catalogue');
    expect(lists.svc).toEqual([
      'svc:products',
      'svc:product-admin',
      'svc:search-indexer',
      'svc:search-api',
    ]);
    expect(lists.st).toEqual(['st:products-db', 'st:product-events', 'st:search-index']);
    expect(lists.msg).toEqual(['msg:product-changed', 'msg:product-changed-v2']);
    expect(lists.wi).toEqual([
      'wi:dispatch-field',
      'wi:publish-v2',
      'wi:indexer-v2',
      'wi:retire-v1',
    ]);
    expect(lists.chg).toEqual([
      'chg:dispatch-field',
      'chg:product-changed-v2',
      'chg:indexer-reads-v2',
      'chg:retire-v1',
    ]);
    expect(lists.tst).toEqual(['tst:dispatch-unit', 'tst:indexer-contract', 'tst:no-v1-left']);
    const owned = new Set(lists.svc);
    const stores = [...model.asIs.stores, ...model.toBe.stores];
    expect(lists.st.every((id) => owned.has(stores.find((s) => s.id === id)!.owner))).toBe(true);
    expect(new Set(lists.if).size).toBe(lists.if.length);
  });

  it('drops what the plan adds when asked', () => {
    const model = modelOf(load());
    const all = ownerLists(model, 'team:catalogue');
    const hidden = ownerLists(model, 'team:catalogue', {
      hide: (id) => model.status(id) === 'added',
    });
    expect(all.msg).toContain('msg:product-changed-v2');
    expect(hidden.msg).toEqual(['msg:product-changed']);
    expect(hidden.svc).toEqual(all.svc);
  });

  it('lists the proposed decisions and open questions a team decides', () => {
    const plan = load();
    const model = modelOf({
      ...plan,
      decisions: [
        { id: 'dec:a', title: 'A', status: 'proposed', decider: 'team:payments' },
        { id: 'dec:b', title: 'B', status: 'accepted', decider: 'team:payments' },
        { id: 'dec:c', title: 'C', status: 'proposed', decider: 'team:orders' },
      ],
      questions: [
        { id: 'q:open', question: 'Open?', status: 'open', decider: 'team:payments' },
        { id: 'q:done', question: 'Done?', status: 'resolved', decider: 'team:payments' },
      ],
    });
    expect(ownerLists(model, 'team:payments').dec).toEqual(['dec:a', 'q:open']);
  });
});

describe('owner text', () => {
  it('counts work, and says how much is done once delivery has begun', () => {
    const plan = load();
    const ids = plan.work_items!.slice(0, 3).map((w) => w.id);
    expect(workText(modelOf(plan), ids)).toBe('3');
    const work = plan.work_items!.map((w) => (w.id === ids[0] ? { ...w, github_issue: 5 } : w));
    const model = modelOf(
      { ...plan, work_items: work },
      { status: { [ids[0]!]: { state: 'closed', closed_at: '2026-11-02T10:00:00Z' } } },
    );
    expect(workText(model, ids)).toBe('3 · 1 done');
  });

  it('reads a row as plain text in column order', () => {
    const model = modelOf(load());
    const lists = ownerLists(model, 'team:catalogue');
    const parts = ownerFacts(model, 'team:catalogue', lists).split('|');
    expect(parts).toHaveLength(OWNER_COLUMNS.length);
    expect(parts).toEqual(['4', '3', '1', '2', '4', '4', '3', '0', 'not yet']);
  });

  it('names a thing in plain words', () => {
    const model = modelOf(load());
    expect(nameOf(model, 'team:catalogue')).toBe('Catalogue');
  });

  it('gives a team’s channel, but not a placeholder', () => {
    const plan = load();
    const model = modelOf({
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
