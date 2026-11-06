import { describe, expect, it } from 'vitest';

import { dispatchDate } from '@/../test/fixtures/acme/plans/work-dispatch';
import { modelOf } from '@/../test/plan-kit';

import {
  andList,
  isConsumer,
  ladderIds,
  lastMigrateMs,
  msBefore,
  msShort,
  retireMilestone,
  rungMilestone,
  sequenceNotes,
  sequencing,
  versionNames,
} from './plan-viz-ladder-order';

const event = 'msg:product-changed';
describe('migration sequencing', () => {
  it('uses plan milestone order and leaves missing work dates unknown', () => {
    const model = modelOf(dispatchDate());
    expect(rungMilestone(model, ['wi:retire-v1', 'wi:publish-v2', 'wi:missing'])).toBe('ms:m4');
    expect(rungMilestone(model, ['wi:missing'])).toBeNull();
    expect(msBefore(model, 'ms:m1', 'ms:m2')).toBe(true);
    expect(msBefore(model, 'ms:m2', 'ms:m1')).toBe(false);
    expect(msBefore(model, 'ms:m1', 'ms:m1')).toBe(false);
    expect(msBefore(model, null, 'ms:m1')).toBe(false);
    expect(msBefore(model, 'ms:m1', null)).toBe(false);
    expect(msShort(model, 'ms:m1')).toBe('M1');
    expect(msShort(model, 'ms:missing')).toBe('ms:missing');
    expect(lastMigrateMs(model, model.ladder(event))).toBe('ms:m2');
    expect(lastMigrateMs(model, { rungs: [] })).toBeNull();
    expect(versionNames(model, event, 'msg:product-changed-v2')).toEqual({
      old: 'v1',
      next: 'v2',
      named: true,
      name: 'product.changed',
    });
    expect(versionNames(model, 'unknown', 'missing')).toEqual({
      old: 'unknown',
      next: 'missing',
      named: false,
      name: null,
    });
    expect([undefined, '', 'svc:a', 'msg:a'].map(isConsumer)).toEqual([false, false, true, false]);
    expect([[], ['a'], ['a', 'b'], ['a', 'b', 'c']].map(andList)).toEqual([
      '',
      'a',
      'a and b',
      'a, b and c',
    ]);
  });
  it('reports a safe retirement and no sequencing warning for ordered work', () => {
    const model = modelOf(dispatchDate());
    expect(retireMilestone(model, event)).toEqual({
      ms: 'ms:m4',
      early: false,
      lastMigrate: 'ms:m2',
      changes: ['chg:retire-v1'],
      kind: 'retire',
    });
    expect(retireMilestone(model, 'missing')).toEqual({
      ms: null,
      early: false,
      lastMigrate: null,
      changes: [],
      kind: null,
    });
    expect(sequencing(model, event)).toBeNull();
    expect(sequencing(model, 'missing')).toBeNull();
    expect(sequenceNotes(model)).toEqual(new Map());
    expect(ladderIds(model)).toContain(event);
    expect(ladderIds(model)).not.toContain('msg:product-changed-v2');
  });
  it('explains early switches and early retirement on each responsible work item', () => {
    const value = dispatchDate();
    value.work_items!.find((item) => item.id === 'wi:publish-v2')!.milestone = 'ms:m4';
    value.work_items!.find((item) => item.id === 'wi:retire-v1')!.milestone = 'ms:m1';
    const model = modelOf(value);
    const warning = sequencing(model, event);
    expect(warning?.id).toBe(event);
    expect(warning?.sentences).toEqual([
      'Search indexer and Order API are planned to switch to v2 in M2, a milestone before v2 exists.',
      'v1 is planned to be removed in M1, before Search indexer and Order API have moved (M2).',
    ]);
    expect(warning?.notes).toEqual([
      {
        wi: 'wi:indexer-v2',
        text: 'Switches Search indexer to v2 in M2, a milestone before v2 exists (M4)',
      },
      {
        wi: 'wi:orders-v2',
        text: 'Switches Order API to v2 in M2, a milestone before v2 exists (M4)',
      },
      {
        wi: 'wi:publish-v2',
        text: 'Publishes v2 in M4, after Search indexer and Order API are planned to switch (M2)',
      },
      {
        wi: 'wi:retire-v1',
        text: 'Removes v1 in M1, before Search indexer and Order API moves (M2)',
      },
      {
        wi: 'wi:indexer-v2',
        text: 'Moves Search indexer and Order API in M2, after v1 is planned to go (M1)',
      },
      {
        wi: 'wi:orders-v2',
        text: 'Moves Search indexer and Order API in M2, after v1 is planned to go (M1)',
      },
    ]);
    const notes = sequenceNotes(model);
    for (const id of ['wi:indexer-v2', 'wi:orders-v2']) expect(notes.get(id)).toHaveLength(2);
    expect(notes.get('wi:publish-v2')).toEqual([warning!.notes[2]!.text]);
    expect(notes.get('wi:missing')).toBeUndefined();
  });
  it('distinguishes consumers moving in different milestones and a deprecation from removal', () => {
    const value = dispatchDate();
    value.work_items!.find((item) => item.id === 'wi:publish-v2')!.milestone = 'ms:m4';
    value.work_items!.find((item) => item.id === 'wi:indexer-v2')!.milestone = 'ms:m1';
    const model = modelOf(value);
    expect(sequencing(model, event)?.sentences).toEqual([
      'Search indexer and Order API are planned to switch to v2 before v2 exists (M4).',
    ]);
    value.changes = value.changes!.filter((change) => change.id !== 'chg:retire-v1');
    expect(retireMilestone(modelOf(value), event)).toEqual({
      ms: 'ms:m4',
      early: false,
      lastMigrate: 'ms:m2',
      changes: ['chg:product-changed-v2'],
      kind: 'deprecate',
    });
  });
  it('names a single early consumer and quotes contracts whose names differ', () => {
    const value = dispatchDate();
    value.work_items!.find((item) => item.id === 'wi:publish-v2')!.milestone = 'ms:m2';
    value.work_items!.find((item) => item.id === 'wi:indexer-v2')!.milestone = 'ms:m1';
    const named = sequencing(modelOf(value), event);
    expect(named?.sentences).toEqual([
      'Search indexer is planned to switch to v2 in M1, a milestone before v2 exists.',
    ]);
    expect(named?.notes).toEqual([
      {
        wi: 'wi:indexer-v2',
        text: 'Switches Search indexer to v2 in M1, a milestone before v2 exists (M2)',
      },
      {
        wi: 'wi:publish-v2',
        text: 'Publishes v2 in M2, after Search indexer is planned to switch (M1)',
      },
    ]);
    const added = value
      .changes!.flatMap((change) => change.ops ?? [])
      .find((op) => 'add' in op && op.add === 'message');
    if (added === undefined) {
      throw new Error('Fixture must add its replacement event');
    }
    added.value.name = 'product.updated';
    const unnamed = modelOf(value);
    expect(versionNames(unnamed, event, 'msg:product-changed-v2')).toEqual({
      old: 'product.changed v1',
      next: 'product.updated v2',
      named: false,
      name: null,
    });
    expect(sequencing(unnamed, event)?.sentences).toEqual([
      'Search indexer is planned to switch to `product.updated v2` in M1, a milestone before `product.updated v2` exists.',
    ]);
    expect(sequencing(unnamed, event)?.notes[0]?.text).toBe(
      'Switches Search indexer to product.updated v2 in M1, a milestone before it exists (M2)',
    );
    value.work_items = [];
    expect(sequencing(modelOf(value), event)).toBeNull();
  });
});
