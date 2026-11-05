import { describe, expect, it } from 'vitest';

import {
  appendChild,
  buildId,
  childId,
  childPathOf,
  colonLocalId,
  failureId,
  hasChildPath,
  hasPrefix,
  idToToken,
  isDisplayId,
  isQualifiedId,
  isTextId,
  kindOf,
  lastChildId,
  localId,
  nestedId,
  parentOf,
  parseId,
  planEntityTypeOf,
  prefixOf,
  qualifiedOf,
  qualifyId,
  resolveAlias,
  rootId,
  scopedId,
  splitChildId,
  startsWithId,
  stripPrefix,
  tokenToId,
} from './ids';

describe('model identities', () => {
  it('keeps explicit nested paths and failure addresses distinct', () => {
    const parent = buildId('h', 'apply');
    const id = nestedId(parent, ['tx', 'queue', 'outbox']);
    expect(id).toBe('h:apply#tx/queue/outbox');
    expect(parseId(id)).toEqual({
      prefix: 'h',
      local: 'apply',
      root: parent,
      path: ['tx', 'queue', 'outbox'],
      failure: false,
    });
    expect(kindOf(id)).toBe('step');
    expect(parseId(failureId(parent, 'db-down'))?.failure).toBe(true);
    expect(kindOf(failureId(parent, 'db-down'))).toBe('failure');
    expect(kindOf('sch:response#status')).toBe('field');
    expect(kindOf('scr:editor#actions')).toBe('region');
    expect(kindOf('sub:orders')).toBe('subscription');
    expect(kindOf('term:sku')).toBe('keyTerm');
    expect(kindOf('flow:checkout#reserve')).toBe('step');
    expect(kindOf('sys:orders#invented-child')).toBeNull();
    expect(kindOf('svc:orders#!invented-failure')).toBeNull();
    expect(appendChild(childId(parent, 'tx'), 'read')).toBe('h:apply#tx/read');
    expect(appendChild(parent, 'read')).toBe('h:apply#read');
  });

  it.each([null, 2, 'unknown:x', 'h:x#', 'h:x#tx//read', 'h:x#!', 'h:x#two words', 'h:x#a#b'])(
    'leaves malformed ids visible as gaps: %s',
    (id) => {
      expect(parseId(id)).toBeNull();
      expect(kindOf(id)).toBeNull();
    },
  );

  it('preserves the existing plan vocabulary and address tokens', () => {
    expect(planEntityTypeOf('flow:x#read')).toBe('step');
    expect(planEntityTypeOf('sch:x#id')).toBe('field');
    expect(planEntityTypeOf('scr:x#button')).toBe('region');
    expect(planEntityTypeOf('h:x#read')).toBeNull();
    expect(planEntityTypeOf('api:x')).toBe('endpoint');
    expect(planEntityTypeOf(4)).toBeNull();
    expect(planEntityTypeOf('unknown:x')).toBeNull();
    expect(idToToken('flow:cancel#publish')).toBe('flow-cancel.publish');
    expect(tokenToId('flow-cancel.publish')).toBe('flow:cancel#publish');
    expect(tokenToId('svc-orders')).toBe('svc:orders');
    for (const token of ['svc-', '-orders', 'unknown-orders', 'orders']) {
      expect(tokenToId(token)).toBeNull();
    }
  });

  it('keeps local and scoped identity operations in the same boundary', () => {
    expect(qualifiedOf(qualifyId('care-se', 'dec:x'))).toEqual({ scope: 'care-se', id: 'dec:x' });
    expect(qualifiedOf('dec:x')).toBeNull();
    expect(scopedId('care', 'h:x#tx/read')).toBe('care/h:x#tx/read');
    expect(scopedId('care', 'other/h:x#tx/read')).toBe('other/h:x#tx/read');
    expect(parentOf('flow:x#read')).toBe('flow:x');
    expect(parentOf('flow:x')).toBeNull();
    expect(parentOf(null)).toBeNull();
    expect(prefixOf('svc:orders')).toBe('svc');
    expect(hasPrefix(null, 'svc')).toBe(false);
    expect(hasPrefix('svc:orders', 'svc')).toBe(true);
    const otherPrefix = (id: `${string}:${string}`): string =>
      hasPrefix(id, 'team') ? 'team' : id.toUpperCase();
    expect(otherPrefix('svc:orders')).toBe('SVC:ORDERS');
    expect(stripPrefix('svc:orders', 'svc')).toBe('orders');
    expect(stripPrefix('st:orders', 'svc')).toBe('st:orders');
    expect(stripPrefix(null, 'svc')).toBeUndefined();
    expect(stripPrefix(undefined, 'svc')).toBeUndefined();
    expect(rootId()).toBeUndefined();
    expect(childPathOf('h:x')).toBeUndefined();
    expect(splitChildId('h:x#tx/read')).toEqual(['h:x', 'tx/read']);
    expect(colonLocalId('svc:orders')).toBe('orders');
    expect(colonLocalId('orders')).toBe('orders');
    expect(localId('svc:orders')).toBe('orders');
    expect(lastChildId('h:x#read')).toBe('read');
    expect(isQualifiedId('svc:orders')).toBe(true);
    expect(hasChildPath(null)).toBe(false);
    expect(hasChildPath('h:x#read')).toBe(true);
    expect(isDisplayId('svc:orders')).toBe(true);
    expect(startsWithId('svc:orders')).toBe(true);
    expect(isTextId('svc:orders')).toBe(true);
    expect(isTextId('svc:orders are new')).toBe(false);
  });
});

describe('aliases', () => {
  it('resolves a chain, reports its use and keeps child paths', () => {
    expect(
      resolveAlias('h:old#tx/read', { 'h:old': { to: 'h:middle' }, 'h:middle': { to: 'h:new' } }),
    ).toEqual({ id: 'h:new#tx/read', used: ['h:old', 'h:middle'], problem: null });
    expect(
      resolveAlias('h:old#tx/read', {
        'h:old': { to: 'h:new' },
        'h:old#tx/read': { to: 'h:other#fetch' },
      }).id,
    ).toBe('h:other#fetch');
    expect(resolveAlias('svc:current', {}).used).toEqual([]);
  });

  it('does not invent a successor for retirement, missing reasons or cycles', () => {
    expect(
      resolveAlias('svc:old', { 'svc:old': { to: null, reason: 'Retired without replacement' } }),
    ).toEqual({ id: null, used: ['svc:old'], problem: 'Retired without replacement' });
    expect(resolveAlias('svc:old', { 'svc:old': { to: null } }).problem).toBe(
      'Alias svc:old needs a reason',
    );
    expect(
      resolveAlias('svc:a', { 'svc:a': { to: 'svc:b' }, 'svc:b': { to: 'svc:a' } }).problem,
    ).toBe('Alias cycle at svc:a');
    expect(resolveAlias('toString', {}).id).toBe('toString');
  });
});
