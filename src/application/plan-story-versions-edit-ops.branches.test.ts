// @vitest-environment node
import { describe, expect, it } from 'vitest';

import { orderEventV2 } from '@/../test/fixtures/acme/plans/versions-order-event';
import { modelOf } from '@/../test/plan-kit';
import { revisionImpact } from '@/application/plan/impact';
import { planDiff } from '@/application/plan/plan-diff';
import type { ChangeOps, PlanDiff } from '@/application/plan/plan-diff-core';
import { opItems } from '@/application/plan-story-versions-edit-ops';
import type { View } from '@/application/plan-story-versions-pair';
import { tenseOf } from '@/application/plan-story-versions-words';
import type { Change, Plan } from '@/domain/plan/plan.generated';

const base = orderEventV2();

const fromChange: Change = {
  id: 'chg:edit',
  title: 'Edit things',
  ops: [
    {
      add: 'schema',
      value: {
        id: 'sch:gift',
        name: 'Gift',
        kind: 'record',
        fields: [
          { name: 'wrap', type: 'bool', note: 'Old **note**' },
          { name: 'card', type: 'string' },
          { name: 'colour', type: 'string' },
        ],
      },
    },
    { modify: 'msg:order-placed', set: { key: 'order_id' } },
    { modify: 'sch:order-placed-v1', set: { fields: [{ name: 'a', type: 'int' }, 'loose'] } },
  ],
};

const toChange: Change = {
  id: 'chg:edit',
  title: 'Edit things',
  ops: [
    {
      add: 'schema',
      value: {
        id: 'sch:gift',
        name: 'Gift',
        kind: 'record',
        fields: [
          { name: 'card', type: 'string' },
          { name: 'colour', type: 'enum(red|blue)', note: 'Now **picked**' },
          { name: 'ribbon', type: 'bool' },
        ],
      },
    },
    { modify: 'msg:order-placed', set: { key: 'order_ref' } },
    { modify: 'sch:order-placed-v1', set: { fields: [{ name: 'a', type: 'int' }, { type: 'x' }] } },
    {
      add: 'field',
      into: 'sch:order-placed-v1#body',
      value: { name: 'currency', type: 'string' },
    },
    {
      add: 'step',
      into: 'flow:place-order',
      value: {
        id: 'flow:place-order#wrap',
        from: 'svc:order-api',
        to: 'svc:order-desk',
        via: 'msg:order-placed',
        action: 'Wrap the **gift**',
      },
    },
    {
      add: 'message',
      value: {
        id: 'msg:gift#v1',
        name: 'gift.wrapped',
        topic: 'st:order-events',
        producer: 'svc:order-api',
      },
    },
    { deprecate: 'svc:ghost' },
  ],
};

const newChange = (id: string, decisions: readonly string[]): Change => ({
  id,
  title: `New ${id}`,
  decisions: [...decisions],
  ops: [{ remove: 'msg:order-placed' }],
});

const from: Plan = { ...base, changes: [fromChange, newChange('chg:gone', [])] };
const to: Plan = {
  ...base,
  changes: [toChange, newChange('chg:new', ['dec:wrap']), newChange('chg:twin', ['dec:wrap'])],
  decisions: [{ id: 'dec:wrap', title: 'Wrap gifts', status: 'proposed' }],
  tests: [
    { id: 'test:wrap', level: 'unit', name: 'Wraps', proves: ['chg:new'] },
    { id: 'test:other', level: 'unit', name: 'Other', proves: ['chg:edit'] },
  ],
  work_items: [
    { id: 'wi:wrap', title: 'Wrap', team: 'team:orders', implements: ['chg:new'] },
    { id: 'wi:twin', title: 'Twin', team: 'team:orders', implements: ['chg:twin'] },
  ],
};

const edited = (index: number, fromIndex = index) => ({
  index,
  fromIndex,
  summary: '~ edited',
  fields: [],
});

const changed: ChangeOps = {
  change: 'chg:edit',
  title: 'Edit things',
  status: 'changed',
  edited: [edited(0), edited(1), edited(2), edited(9, 9)],
  added: [
    { index: 3, summary: '+ field' },
    { index: 4, summary: '+ step' },
    { index: 5, summary: '+ message' },
    { index: 6, summary: '+ deprecate the ghost' },
  ],
  removed: [{ index: 9, summary: '− Send the old email' }],
};

const added = (change: string): ChangeOps => ({
  change,
  title: change,
  status: 'added',
  added: [],
  removed: [],
  edited: [],
});

const real = planDiff(from, to);

function viewOf(ops: readonly ChangeOps[], diff: Partial<PlanDiff> = {}): View {
  const whole: PlanDiff = {
    ...real,
    ops,
    entities: { decisions: { added: ['dec:wrap'], removed: [], changed: [] }, ...real.entities },
    workItems: { added: ['wi:wrap', 'wi:twin'], removed: [], remilestoned: [] },
    ...diff,
  };
  return {
    model: modelOf(to),
    tense: tenseOf('proposed'),
    pair: {
      from,
      to,
      fromVersion: '1.0',
      toVersion: '1.1',
      entry: { version: '1.1', status: 'proposed', date: '2026-05-01', summary: 'A try.' },
      diff: whole,
      im: revisionImpact({ from, to }),
    },
  };
}

describe('edits to a changed change', () => {
  const { items, taken } = opItems(viewOf([changed]));
  const whats = items.map((i) => i.what);

  it('says which fields an edited op adds, removes and alters, with their notes', () => {
    expect(items.slice(0, 3)).toEqual([
      {
        what: 'Adds the field `ribbon` to [[sch:gift]]',
        detail: '',
        was: null,
        now: null,
        via: '[[chg:edit]]',
      },
      {
        what: 'Removes the field `wrap` from [[sch:gift]]',
        detail: 'Old note',
        was: null,
        now: null,
        via: '[[chg:edit]]',
      },
      {
        what: 'Changes the field `colour` on [[sch:gift]]',
        detail: 'Now picked',
        was: null,
        now: null,
        via: '[[chg:edit]]',
      },
    ]);
    expect(taken.size).toBe(0);
  });

  it('says the target changes when no field moves', () => {
    expect(whats).toContain('Changes [[msg:order-placed]]');
    expect(whats).toContain('Changes [[sch:order-placed-v1]]');
  });

  it('names nothing for an op the plans do not hold', () => {
    expect(whats).toContain('Changes ****');
  });

  it('says what each new op adds, by its kind', () => {
    expect(whats).toContain('Adds the field `currency` to [[sch:order-placed-v1]]');
    expect(whats).toContain('Adds a step: Wrap the gift');
    expect(whats).toContain('Adds the message **gift**');
    expect(whats).toContain('Adds deprecate the ghost');
    expect(whats.at(-1)).toBe('Removes a step: Send the old email');
  });
});

describe('new and dropped changes', () => {
  it('folds a new change’s decision, test and work item into one edit', () => {
    const { items, taken } = opItems(viewOf([added('chg:new'), added('chg:twin')]));
    expect(items.map((i) => [i.what, i.detail])).toEqual([
      [
        'Adds a new change: [[chg:new]]',
        'with the decision [[dec:wrap]]; with the test [[test:wrap]]; with the work item [[wi:wrap]]',
      ],
      ['Adds a new change: [[chg:twin]]', 'with the work item [[wi:twin]]'],
    ]);
    expect([...taken]).toEqual(['dec:wrap', 'test:wrap', 'wi:wrap', 'wi:twin']);
  });

  it('reads a new change on its own when the diff adds no kin', () => {
    const { items } = opItems(
      viewOf([added('chg:new')], {
        entities: {},
        workItems: { added: [], removed: [], remilestoned: [] },
      }),
    );
    expect(items).toEqual([
      { what: 'Adds a new change: [[chg:new]]', detail: '', was: null, now: null, via: null },
    ]);
  });

  it('says a change is dropped', () => {
    const gone: ChangeOps = { ...added('chg:gone'), status: 'removed' };
    expect(opItems(viewOf([gone])).items.map((i) => i.what)).toEqual([
      'Drops the change **New chg:gone**',
    ]);
  });
});
