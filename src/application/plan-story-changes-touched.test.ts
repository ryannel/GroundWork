import { describe, expect, it } from 'vitest';

import { quickCheckoutOnToday } from '@/../test/fixtures/acme/plans/core-checkout';
import { dispatchDate } from '@/../test/fixtures/acme/plans/work-dispatch';
import { modelOf } from '@/../test/plan-kit';

import {
  changesOf,
  isEmptyReach,
  isSmallPlan,
  leftOver,
  reachIds,
  reachOf,
  teamsBehind,
  topOf,
  touched,
  type Reach,
  type Touched,
} from './plan-story-changes-touched';

const empty: Reach = { records: [], screens: [], ladders: [], retired: [], shapes: [] };

describe('what a plan changes and where its flows reach', () => {
  it('classifies changed records, flows, version chains, retired payloads and screens without duplicating a retired contract', () => {
    const model = modelOf(dispatchDate());
    expect(touched(model)).toEqual({
      records: ['sch:product', 'sch:search-doc', 'sch:order'],
      flows: ['flow:publish-product'],
      ladders: ['msg:product-changed'],
      retired: ['sch:product-changed-v1'],
      shapes: [],
      screens: ['scr:product-page'],
    });
    expect(changesOf(model, 'sch:product')).toEqual(['chg:dispatch-field']);
    expect(
      teamsBehind(model, ['chg:dispatch-field', 'chg:orders-read-dispatch', 'chg:dispatch-field']),
    ).toEqual(['team:catalogue', 'team:orders']);
    expect(teamsBehind(model, [])).toEqual([]);
    const value = dispatchDate();
    value.schemas!.push({
      id: 'sch:body',
      name: 'Body',
      kind: 'dto',
      fields: [{ name: 'id', type: 'string' }],
    });
    value.changes!.push({
      id: 'chg:body',
      title: 'Change the request and retire the old entry',
      ops: [{ modify: 'sch:body#id', set: { type: 'int' } }, { remove: 'api:products-update' }],
    });
    const altered = touched(modelOf(value));
    expect(altered.shapes).toEqual(['sch:body']);
    expect(
      [...altered.retired, ...altered.ladders].filter((id) => id === 'api:products-update'),
    ).toHaveLength(1);
    expect(new Set(altered.retired).size).toBe(altered.retired.length);
    expect(altered.records).not.toContain('sch:body');
  });
  it('reaches records only through marked changed steps, while following versioned contracts through any recorded step', () => {
    const model = modelOf(dispatchDate());
    const changes = touched(model);
    const all = new Set([...model.asIs.steps, ...model.toBe.steps].map((step) => step.id));
    expect(
      reachOf(model, changes, { id: 'flow:publish-product', changed: all, taken: new Set() }),
    ).toEqual({
      records: ['sch:product', 'sch:search-doc'],
      screens: [],
      ladders: ['msg:product-changed'],
      retired: [],
      shapes: [],
    });
    expect(
      reachOf(model, changes, { id: 'flow:publish-product', changed: new Set(), taken: new Set() }),
    ).toEqual({ ...empty, ladders: ['msg:product-changed'] });
    expect(
      reachOf(model, changes, {
        id: 'flow:publish-product',
        changed: new Set(['flow:publish-product#save']),
        taken: new Set(['sch:product', 'msg:product-changed']),
      }),
    ).toEqual(empty);
    expect(reachOf(model, changes, { id: 'flow:missing', changed: all, taken: new Set() })).toEqual(
      empty,
    );
  });
  it('keeps a changed screen with each flow that shows it until another flow has claimed it', () => {
    const model = modelOf(quickCheckoutOnToday().plan);
    const changes = touched(model);
    expect(
      reachOf(model, changes, { id: 'flow:add-to-basket', changed: new Set(), taken: new Set() }),
    ).toEqual({ ...empty, screens: ['scr:basket'] });
    expect(
      reachOf(model, changes, {
        id: 'flow:add-to-basket',
        changed: new Set(),
        taken: new Set(['scr:basket']),
      }),
    ).toEqual(empty);
  });
  it('retains every unclaimed category, with addressable child references reduced only to their root', () => {
    const changes: Touched = {
      records: ['sch:order', 'sch:line'],
      flows: ['flow:read'],
      screens: ['scr:page'],
      ladders: ['msg:changed'],
      retired: ['st:old'],
      shapes: ['sch:request'],
    };
    const reach = leftOver(changes, new Set(['sch:order', 'msg:changed']));
    expect(reach).toEqual({
      records: ['sch:line'],
      screens: ['scr:page'],
      ladders: [],
      retired: ['st:old'],
      shapes: ['sch:request'],
    });
    expect(reachIds(reach)).toEqual(['sch:line', 'scr:page', 'st:old', 'sch:request']);
    expect(topOf('h:read#tx/load')).toBe('h:read');
    expect(topOf('sch:order')).toBe('sch:order');
    expect(topOf(null)).toBe('');
  });
  it.each(['records', 'screens', 'ladders', 'retired', 'shapes'] as const)(
    'keeps a non-empty %s reach visible',
    (key) => {
      expect(isEmptyReach({ ...empty, [key]: ['kept'] })).toBe(false);
      expect(isEmptyReach(empty)).toBe(true);
    },
  );
  it.each([
    [0, true],
    [3, true],
    [4, false],
  ] as const)('uses the small-plan boundary at %s changes', (count, expected) => {
    const value = dispatchDate();
    value.changes = value.changes!.slice(0, count);
    expect(isSmallPlan(modelOf(value))).toBe(expected);
  });
});
