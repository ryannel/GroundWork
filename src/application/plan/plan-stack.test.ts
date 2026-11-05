import { describe, expect, it } from 'vitest';

import type { Neighbour, Touch } from '@/domain/plan/plan-neighbours';

import {
  changedSince,
  overlapsOf,
  overlapWords,
  stackOf,
  touchesOf,
  unlandedBases,
} from './plan-stack';

const plan = (buildsOn: string[] = [], touches: Touch[] = [], landed = false): Neighbour => ({
  ids: new Map(),
  buildsOn,
  touches,
  hash: '',
  landed,
});

const touch = (change: string, kind: Touch['kind'], target: string): Touch => ({
  change,
  kind,
  target,
});

describe('touchesOf', () => {
  it('reads what each change adds, changes and removes', () => {
    expect(
      touchesOf({
        changes: [
          {
            id: 'chg:a',
            ops: [
              { add: 'service', value: { id: 'svc:new' } },
              { add: 'field', into: 'sch:order', value: { name: 'paused' } },
              { modify: 'svc:old', set: { name: 'Old' } },
              { deprecate: 'api:get' },
              { remove: 'flow:x#step' },
              { add: 'service', value: 'not a value' },
              { add: 'field', value: { name: 'nowhere' } },
              'not an op',
              { rename: 'svc:what' },
            ],
          },
          { ops: [{ remove: 'svc:gone' }] },
        ],
      }),
    ).toEqual([
      touch('chg:a', 'add', 'svc:new'),
      touch('chg:a', 'add', 'sch:order#paused'),
      touch('chg:a', 'change', 'svc:old'),
      touch('chg:a', 'change', 'api:get'),
      touch('chg:a', 'remove', 'flow:x#step'),
      touch('', 'remove', 'svc:gone'),
    ]);
    expect(touchesOf('not a plan')).toEqual([]);
    expect(touchesOf({ changes: 'none' })).toEqual([]);
  });
});

describe('stackOf', () => {
  // financing ← stock ← online, and sales-tool builds on financing and stock; legacy has landed.
  const plans = new Map([
    ['legacy', plan([], [], true)],
    ['financing', plan(['legacy'])],
    ['stock', plan(['financing'])],
    ['sales-tool', plan(['financing', 'stock'])],
    ['order-change', plan(['sales-tool', 'financing'])],
  ]);

  it('orders the closure bases first and drops landed plans', () => {
    expect(stackOf('order-change', ['sales-tool', 'financing'], plans)).toEqual({
      order: ['financing', 'stock', 'sales-tool'],
      cycle: null,
    });
    expect(stackOf('stock', ['financing'], plans).order).toEqual(['financing']);
    expect(stackOf('financing', ['legacy'], plans).order).toEqual([]);
    expect(stackOf('x', ['no-such-plan'], plans).order).toEqual([]);
  });

  it('finds a circle through the plan or among its bases', () => {
    const circle = new Map([
      ['a', plan(['b'])],
      ['b', plan(['a'])],
      ['c', plan(['a'])],
    ]);
    expect(stackOf('a', ['b'], circle)).toEqual({ order: null, cycle: ['a', 'b', 'a'] });
    expect(stackOf('c', ['a'], circle)).toEqual({ order: null, cycle: ['a', 'b', 'a'] });
  });

  it('lists the bases that must land first', () => {
    expect(unlandedBases('order-change', plans)).toEqual(['financing', 'stock', 'sales-tool']);
    expect(unlandedBases('financing', plans)).toEqual([]);
    expect(unlandedBases('nothing', plans)).toEqual([]);
    const circle = new Map([
      ['a', plan(['b'])],
      ['b', plan(['a'])],
    ]);
    expect(unlandedBases('a', circle)).toEqual(['b']);
  });
});

describe('overlapsOf', () => {
  it('reports each kind between plans neither builds on', () => {
    const plans = new Map([
      [
        'b',
        plan(
          [],
          [
            touch('chg:b', 'change', 'svc:x'),
            touch('chg:b', 'remove', 'svc:y'),
            touch('chg:b', 'add', 'svc:new'),
            touch('chg:b', 'add', 'svc:z'),
          ],
        ),
      ],
      [
        'a',
        plan(
          [],
          [
            touch('chg:a', 'change', 'svc:x'),
            touch('chg:a', 'change', 'svc:y'),
            touch('chg:a', 'add', 'svc:new'),
            touch('chg:a', 'change', 'svc:z'),
          ],
        ),
      ],
    ]);
    expect(overlapsOf(plans)).toEqual([
      { kind: 'add-add', target: 'svc:new', plans: ['a', 'b'], changes: ['a/chg:a', 'b/chg:b'] },
      {
        kind: 'modify-modify',
        target: 'svc:x',
        plans: ['a', 'b'],
        changes: ['a/chg:a', 'b/chg:b'],
      },
      {
        kind: 'remove-change',
        target: 'svc:y',
        plans: ['a', 'b'],
        changes: ['a/chg:a', 'b/chg:b'],
      },
    ]);
  });

  it('reports two removes as remove-change, and each pair of changes once', () => {
    const plans = new Map([
      ['a', plan([], [touch('chg:a', 'remove', 'svc:x'), touch('chg:a', 'remove', 'svc:x')])],
      ['b', plan([], [touch('chg:b', 'remove', 'svc:x'), touch('chg:c', 'change', 'svc:x')])],
    ]);
    expect(overlapsOf(plans).map((each) => [each.kind, each.changes.join(',')])).toEqual([
      ['remove-change', 'a/chg:a,b/chg:b'],
      ['remove-change', 'a/chg:a,b/chg:c'],
    ]);
  });

  it('reads a change to a part of what the other removes as remove-change', () => {
    const plans = new Map([
      ['a', plan([], [touch('chg:a', 'remove', 'flow:x')])],
      [
        'b',
        plan([], [touch('chg:b', 'change', 'flow:x#step'), touch('chg:c', 'add', 'flow:x#new')]),
      ],
      [
        'c',
        plan([], [touch('chg:d', 'remove', 'flow:x#step'), touch('chg:e', 'change', 'flow:xy')]),
      ],
    ]);
    expect(overlapsOf(plans).map((each) => [each.target, each.changes.join(',')])).toEqual([
      ['flow:x', 'a/chg:a,b/chg:b'],
      ['flow:x', 'a/chg:a,b/chg:c'],
      ['flow:x', 'a/chg:a,c/chg:d'],
      ['flow:x#step', 'b/chg:b,c/chg:d'],
    ]);
  });

  it('says nothing when one builds on the other, even further down, or one has landed', () => {
    const same = [touch('chg:x', 'change', 'svc:x')];
    const ordered = new Map([
      ['a', plan([], same)],
      ['mid', plan(['a'])],
      ['b', plan(['mid'], same)],
      ['done', plan([], same, true)],
    ]);
    expect(overlapsOf(ordered)).toEqual([]);
    const loose = new Map([...ordered, ['c', plan([], same)]]);
    expect(overlapsOf(loose).map((each) => each.plans)).toEqual([
      ['a', 'c'],
      ['b', 'c'],
    ]);
    expect(overlapsOf(loose, new Set(['a', 'c'])).map((each) => each.plans)).toEqual([['a', 'c']]);
  });

  it('words an overlap from either side', () => {
    const [overlap] = overlapsOf(
      new Map([
        ['a', plan([], [touch('chg:a', 'remove', 'svc:x')])],
        ['b', plan([], [touch('chg:b', 'change', 'svc:x')])],
      ]),
    );
    expect(overlap).toBeDefined();
    if (overlap === undefined) return;
    expect(overlapWords(overlap, 'a')).toBe(
      'overlaps b (remove-change): one removes what the other changes: svc:x (a/chg:a and b/chg:b). Neither builds on the other, so a plan that builds on both cannot be read; order them, or agree which one changes it',
    );
    expect(overlapWords(overlap, 'b')).toMatch(/^overlaps a .*\(b\/chg:b and a\/chg:a\)/u);
  });
});

describe('changedSince', () => {
  const locked = { bases: { a: '1', b: '2' }, programme: { id: 'care', hash: '3' } };

  it('names nothing when the plans below and the programme read the same', () => {
    expect(changedSince(locked, locked)).toEqual({ bases: [], programme: false });
    expect(changedSince(locked, { bases: { a: '1' }, programme: null })).toEqual({
      bases: [],
      programme: false,
    });
  });

  it('names a base that changed or was never checked, and a changed programme', () => {
    expect(
      changedSince(locked, { bases: { a: '1', b: '9', c: '4' }, programme: locked.programme }),
    ).toEqual({ bases: ['b', 'c'], programme: false });
    expect(changedSince(locked, { bases: {}, programme: { id: 'care', hash: '5' } })).toEqual({
      bases: [],
      programme: true,
    });
    expect(
      changedSince(locked, { bases: {}, programme: { id: 'other', hash: '3' } }).programme,
    ).toBe(true);
    expect(
      changedSince({ bases: {}, programme: null }, { bases: {}, programme: locked.programme })
        .programme,
    ).toBe(true);
  });
});
