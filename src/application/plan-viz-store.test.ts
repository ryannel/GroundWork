import { describe, expect, it } from 'vitest';

import { derive } from '@/application/plan/derive';
import type { Plan } from '@/domain/plan/plan.generated';

import {
  accessRows,
  isPipe,
  recordsOf,
  relationships,
  shortTech,
  storeGlance,
  storeNode,
} from './plan-viz-store';

function storagePlan(): Plan {
  return {
    meta: { id: 'storage', title: 'Keep orders' },
    problem: { summary: 'Keep orders and their references.' },
    teams: [],
    services: ['owner', 'reader', 'writer', 'both', 'new'].map((name) => ({
      id: `svc:${name}`,
      name,
      kind: 'service',
    })),
    stores: [
      {
        id: 'st:db',
        name: 'Orders',
        kind: 'database',
        tech: '`PostgreSQL` via driver; tables',
        owner: 'svc:owner',
        access: [
          { svc: 'svc:reader', mode: 'read' },
          { svc: 'svc:writer', mode: 'write' },
          { svc: 'svc:both', mode: 'readwrite' },
        ],
      },
      { id: 'st:other', name: 'Customers', kind: 'database' },
      { id: 'st:pipe', name: 'Events', kind: 'topic' },
      { id: 'st:removed', name: 'Retired', kind: 'cache', owner: '' },
    ],
    schemas: [
      {
        id: 'sch:order',
        name: 'Order',
        kind: 'record',
        store: 'st:db',
        fields: [
          { name: 'id', type: 'string' },
          { name: 'customer', type: 'string', ref: 'sch:customer#id' },
          { name: 'whole', type: 'string', ref: 'sch:customer' },
          { name: 'local', type: 'string', ref: 'sch:old#id' },
          { name: 'missing', type: 'string', ref: 'sch:missing#id' },
        ],
      },
      {
        id: 'sch:old',
        name: 'Old',
        kind: 'record',
        store: 'st:db',
        fields: [{ name: 'id', type: 'string' }],
      },
      {
        id: 'sch:customer',
        name: 'Customer',
        kind: 'record',
        store: 'st:other',
        fields: [{ name: 'id', type: 'string' }],
      },
      { id: 'sch:loose', name: 'Unplaced', kind: 'dto' },
    ],
    flows: [
      {
        id: 'flow:read',
        name: 'Read orders',
        steps: ['a', 'b', 'c', 'd'].map((id) => ({
          id: `flow:read#${id}`,
          from: 'svc:reader',
          to: 'svc:owner',
          via: 'internal',
          action: 'Read the order',
          reads: ['sch:order'],
        })),
      },
    ],
    changes: [
      {
        id: 'chg:storage',
        title: 'Replace old records',
        ops: [
          { remove: 'sch:old' },
          { remove: 'st:removed' },
          {
            add: 'schema',
            value: { id: 'sch:new', name: 'New', kind: 'record', store: 'st:db', fields: [] },
          },
          { add: 'store', value: { id: 'st:new', name: 'New store', kind: 'database' } },
          { modify: 'st:db', append: { access: [{ svc: 'svc:new', mode: 'read' }] } },
        ],
      },
    ],
  };
}
const load = () => derive(storagePlan());

describe('store facts', () => {
  it.each(['topic', 'queue', 'database', 'cache', 'warehouse', 'bucket'] as const)(
    'distinguishes %s from a record store',
    (kind) => {
      expect(isPipe({ kind })).toBe(['topic', 'queue'].includes(kind));
    },
  );
  it.each([' via driver', '; details', ' · extra', ' plus replica', ' / partition', ', version'])(
    'shortens a technology at %s',
    (suffix) => {
      expect(shortTech(` \`Postgres\`${suffix}`)).toBe('Postgres');
    },
  );
  it('keeps an unqualified technology, uses the earliest separator and leaves an unknown one blank', () => {
    expect(shortTech('Redis')).toBe('Redis');
    expect(shortTech('Postgres, version via driver')).toBe('Postgres');
    expect(shortTech()).toBe('');
  });
  it('shows current records, planned records, and removed records only in the diff', () => {
    const model = load();
    const ids = (mode: 'asIs' | 'toBe' | 'diff') =>
      recordsOf(model, 'st:db', mode).map((record) => record.id);
    expect(ids('asIs')).toEqual(['sch:order', 'sch:old']);
    expect(ids('toBe')).toEqual(['sch:order', 'sch:new']);
    expect(ids('diff')).toEqual(['sch:order', 'sch:new', 'sch:old']);
    expect(recordsOf(model, 'st:db')).toEqual(recordsOf(model, 'st:db', 'diff'));
    expect(recordsOf(model, 'st:missing')).toEqual([]);
  });
  it('keeps cross-store, local, whole-schema and missing references visibly distinct', () => {
    expect(relationships(load(), 'st:db')).toEqual([
      {
        key: 'sch:order#customer',
        from: { id: 'sch:order#customer', text: 'Order.customer' },
        to: { id: 'sch:customer#id', text: 'Customer.id' },
        elsewhere: 'Customers',
      },
      {
        key: 'sch:order#whole',
        from: { id: 'sch:order#whole', text: 'Order.whole' },
        to: { id: 'sch:customer', text: 'Customer' },
        elsewhere: 'Customers',
      },
      {
        key: 'sch:order#local',
        from: { id: 'sch:order#local', text: 'Order.local' },
        to: { id: 'sch:old#id', text: 'Old.id' },
        elsewhere: null,
      },
      {
        key: 'sch:order#missing',
        from: { id: 'sch:order#missing', text: 'Order.missing' },
        to: { id: null, text: 'sch:missing.id' },
        elsewhere: null,
      },
    ]);
    expect(relationships(load(), 'st:other', 'asIs')).toEqual([]);
  });
  it('puts the owner first, distinguishes access roles, limits visible steps and flags new access only in a diff', () => {
    const model = load();
    expect(accessRows(model, 'st:db')).toEqual([
      {
        svc: 'svc:owner',
        role: 'owner',
        steps: ['flow:read#a', 'flow:read#b', 'flow:read#c'],
        moreSteps: 1,
        fresh: false,
      },
      { svc: 'svc:reader', role: 'reads', steps: [], moreSteps: 0, fresh: false },
      { svc: 'svc:writer', role: 'writes', steps: [], moreSteps: 0, fresh: false },
      { svc: 'svc:both', role: 'reads and writes', steps: [], moreSteps: 0, fresh: false },
      { svc: 'svc:new', role: 'reads', steps: [], moreSteps: 0, fresh: true },
    ]);
    expect(accessRows(model, 'st:db', 'asIs').map((row) => row.svc)).not.toContain('svc:new');
    expect(accessRows(model, 'st:db', 'toBe').every((row) => !row.fresh)).toBe(true);
    expect(accessRows(model, 'st:missing')).toEqual([]);
  });
  it('counts planned records and distinct non-owner readers, with visible missing facts', () => {
    const model = load();
    expect(storeGlance(model, 'st:db')).toEqual({
      tech: 'PostgreSQL',
      owner: 'svc:owner',
      records: 2,
      readers: 3,
    });
    expect(storeGlance(model, 'st:db', 'asIs')).toEqual({
      tech: 'PostgreSQL',
      owner: 'svc:owner',
      records: 2,
      readers: 2,
    });
    expect(storeGlance(model, 'st:pipe')).toEqual({
      tech: null,
      owner: null,
      records: 0,
      readers: 0,
    });
    expect(storeGlance(model, 'st:removed')).toEqual({
      tech: null,
      owner: null,
      records: 0,
      readers: 0,
    });
    expect(storeGlance(model, 'st:missing')).toBeNull();
    expect(storeGlance(model, 'svc:owner')).toBeNull();
    expect(storeNode(model, 'st:new', 'asIs')).toBeNull();
    expect(storeNode(model, 'st:new')?.name).toBe('New store');
    expect(storeNode(model, 'st:removed')?.name).toBe('Retired');
  });
});
