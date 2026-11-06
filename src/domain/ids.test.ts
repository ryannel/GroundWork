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
  hasAnyPrefix,
  hasChildPrefix,
  firstFlowReference,
  idToToken,
  isDisplayId,
  isAuthoredReference,
  isQualifiedId,
  isTextId,
  isWithinId,
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
    expect(isWithinId('h:apply#tx/read', 'h:apply#tx')).toBe(true);
    expect(isWithinId('h:apply#tx-other/read', 'h:apply#tx')).toBe(false);
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
    for (const id of [
      'dom:orders',
      'plan:confirm',
      'sub:on-confirmed',
      'job:relay',
      'ui:confirm',
    ]) {
      expect(tokenToId(idToToken(id))).toBe(id);
    }
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
  it('resolves explicit node mappings, including nested children', () => {
    expect(
      resolveAlias('h:old#tx/read', {
        'h:old#tx/read': { to: 'h:middle#fetch' },
        'h:middle#fetch': { to: 'h:new#load' },
        'h:old': { to: 'h:other' },
      }),
    ).toEqual({ id: 'h:new#load', used: ['h:old#tx/read', 'h:middle#fetch'], problem: null });
    expect(resolveAlias('svc:current', {}).used).toEqual([]);
  });

  it('leaves an unmapped child of a retired parent as a visible gap', () => {
    expect(resolveAlias('h:old#tx/read', { 'h:old': { to: 'h:new' } })).toEqual({
      id: null,
      used: ['h:old'],
      problem: 'h:old#tx/read needs an explicit alias because h:old was retired',
    });
    expect(resolveAlias('h:old#tx/read', { 'h:old#tx': { to: 'h:new#queue' } }).used).toEqual([
      'h:old#tx',
    ]);
    expect(resolveAlias('h:old#tx/read', { 'h:old#tx-other': { to: 'h:new#queue' } }).id).toBe(
      'h:old#tx/read',
    );
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

describe('legacy regular-expression identity forms', () => {
  it('classifies only the explicitly selected prefixes without declaring the id valid', () => {
    expect(hasAnyPrefix('gql:read', ['api', 'gql'])).toBe(true);
    expect(hasAnyPrefix('api:read', ['api', 'gql'])).toBe(true);
    expect(hasAnyPrefix('api:', ['api'])).toBe(true);
    expect(hasAnyPrefix('api-more:read', ['api'])).toBe(false);
    expect(hasAnyPrefix('msg:read', ['api', 'gql'])).toBe(false);
    expect(hasAnyPrefix('api:read', [])).toBe(false);
    expect(hasAnyPrefix(undefined, ['api'])).toBe(false);
    expect(hasAnyPrefix(null, ['api'])).toBe(false);
    expect(hasAnyPrefix({}, ['api'])).toBe(false);
  });
  it('recognises legacy child links only after a non-empty root of the requested prefix', () => {
    expect(hasChildPrefix('flow:read#one', 'flow')).toBe(true);
    expect(hasChildPrefix('flow:read#', 'flow')).toBe(true);
    expect(hasChildPrefix('flow:#one', 'flow')).toBe(false);
    expect(hasChildPrefix('flow:read', 'flow')).toBe(false);
    expect(hasChildPrefix('flow-other:read#one', 'flow')).toBe(false);
    expect(hasChildPrefix('sch:read#one', 'flow')).toBe(false);
  });
  it('keeps the first explicit flow reference and the existing authored-link grammar', () => {
    expect(firstFlowReference('[[svc:reader]] then [[flow:read]] and [[flow:save]]')).toBe(
      'flow:read',
    );
    expect(firstFlowReference('[[flow:]] then [[flow:read#one]]')).toBe('flow:read#one');
    expect(firstFlowReference('[[outer [[flow:read]]')).toBe('flow:read');
    expect(firstFlowReference('flow:read')).toBeUndefined();
    expect(firstFlowReference('[[flow:read]')).toBeUndefined();
    expect(firstFlowReference('')).toBeUndefined();
  });
});

describe('authored reference grammar', () => {
  it('preserves the legacy Markdown grammar without assuming an entity exists', () => {
    expect(
      [
        'svc:a',
        'sch:Order#item_id',
        'unknown:root.part',
        'h:entry#step',
        'h:entry#tx/read',
        'h:entry#!failure',
        'not an id',
        'svc:',
        'SVC:a',
      ].map(isAuthoredReference),
    ).toEqual([true, true, true, true, false, false, false, false, false]);
  });
});
