import { describe, expect, it } from 'vitest';

import { modelOf } from '@/../test/plan-kit';
import { acme } from '@/../test/workspace-kit';
import type { PropRow } from '@/application/plan/compat-rules';
import {
  type KeyContext,
  keyBadges,
  keyContext,
  noteCell,
  requiredCell,
  rollouts,
  typeCell,
} from '@/application/plan-viz-field-cells';
import type { FieldRow } from '@/application/plan-viz-fields';
import type { Field, Plan, Schema } from '@/domain/plan/plan.generated';

const today = acme().today.plan;

const productType: Schema = {
  id: 'sch:product-type',
  name: 'ProductType',
  kind: 'graph-type',
  keys: [{ fields: ['sku'], in: ['sg:catalogue'] }],
  fields: [{ name: 'sku', type: 'ID' }],
};

const plan: Plan = {
  ...today,
  schemas: [...(today.schemas ?? []), productType],
  changes: [
    {
      id: 'chg:drop-total',
      title: 'Drop the total',
      rollout: 'Readers move to the lines first.',
      ops: [{ deprecate: 'sch:order#total_cents' }],
    },
    {
      id: 'chg:drop-again',
      title: 'Drop the total again',
      rollout: 'Readers move to the lines first.',
      ops: [{ deprecate: 'sch:order#total_cents' }],
    },
    { id: 'chg:quiet', title: 'No rollout', ops: [{ deprecate: 'sch:order#status' }] },
  ],
};
const model = modelOf(plan);

const rowOf = (
  field: Field,
  status: FieldRow['status'],
  props: readonly PropRow[] = [],
  changes: readonly string[] = [],
): FieldRow => ({ field, fid: `sch:order#${field.name}`, status, props, changes });

const ctxOf = (edit: Partial<KeyContext> = {}): KeyContext => ({
  graphType: false,
  keyFields: new Set(),
  msgKeys: new Set(),
  ...edit,
});

describe('typeCell', () => {
  const at = { schemaId: 'sch:product', depth: 0 };

  it('drops a trailing ? and strikes the old type of a modified field', () => {
    const row = rowOf({ name: 'total', type: ' long? ' }, 'modified', [
      { prop: 'type', before: 'int?', after: 'long?', status: 'modified' },
    ]);
    expect(typeCell(model, row, at)).toEqual({
      text: 'long',
      was: 'int',
      nested: null,
      nestedName: null,
    });
  });

  it('has no old type unless the field was modified', () => {
    const row = rowOf({ name: 'total', type: 'long' }, 'added', [
      { prop: 'type', before: 'int', after: 'long', status: 'modified' },
    ]);
    expect(typeCell(model, row, at).was).toBeNull();
  });

  it('finds a schema of the plan held in a list, an array or a set', () => {
    for (const type of ['Order[]', 'list<Order>', 'Set<Order>?', 'Order']) {
      expect(typeCell(model, rowOf({ name: 'o', type }, 'existing'), at)).toMatchObject({
        nested: 'sch:order',
        nestedName: 'Order',
      });
    }
  });

  it('does not nest a schema in itself, nor below the first level', () => {
    const row = rowOf({ name: 'o', type: 'Order[]' }, 'existing');
    expect(typeCell(model, row, { schemaId: 'sch:order', depth: 0 }).nested).toBeNull();
    expect(typeCell(model, row, { schemaId: 'sch:product', depth: 1 }).nested).toBeNull();
    expect(
      typeCell(model, rowOf({ name: 'x', type: 'Mystery' }, 'existing'), at).nested,
    ).toBeNull();
  });
});

describe('requiredCell', () => {
  it('says what a modified field was before', () => {
    const made = rowOf({ name: 'a', type: 'int', required: true }, 'modified', [
      { prop: 'required', before: false, after: true, status: 'modified' },
    ]);
    const freed = rowOf({ name: 'a', type: 'int' }, 'modified', [
      { prop: 'required', before: true, after: false, status: 'modified' },
    ]);
    expect(requiredCell(made)).toEqual({ required: true, was: 'was optional' });
    expect(requiredCell(freed)).toEqual({ required: false, was: 'was required' });
  });

  it('says nothing of the past for a field that was not modified', () => {
    const added = rowOf({ name: 'a', type: 'int', required: true }, 'added', [
      { prop: 'required', before: null, after: true, status: 'added' },
    ]);
    expect(requiredCell(added)).toEqual({ required: true, was: null });
  });
});

describe('noteCell', () => {
  it('lists the other props a modified field changed, but not those shown elsewhere or newly added', () => {
    const row = rowOf({ name: 'a', type: 'int', note: 'In pence.' }, 'modified', [
      { prop: 'type', before: 'string', after: 'int', status: 'modified' },
      { prop: 'unique', before: true, after: null, status: 'removed' },
      { prop: 'default', before: null, after: 0, status: 'added' },
      { prop: 'ref', before: '', after: 'sch:order#id', status: 'modified' },
    ]);
    expect(noteCell(model, row)).toEqual({
      note: 'In pence.',
      others: [
        { prop: 'unique', was: 'true' },
        { prop: 'ref', was: '(none)' },
      ],
    });
  });

  it('has no note when it is empty, and no others unless modified', () => {
    const row = rowOf({ name: 'a', type: 'int', note: '' }, 'added', [
      { prop: 'unique', before: true, after: false, status: 'modified' },
    ]);
    expect(noteCell(model, row)).toEqual({ note: null, others: [] });
  });
});

describe('keyContext', () => {
  it('knows the fields an event is keyed by', () => {
    const ctx = keyContext(model, 'sch:order-placed-v1', 'asIs');
    expect(ctx.graphType).toBe(false);
    expect([...ctx.msgKeys]).toEqual(['order_id']);
    expect([...ctx.keyFields]).toEqual([]);
  });

  it('knows a graph type and its key fields', () => {
    const ctx = keyContext(model, 'sch:product-type', 'toBe');
    expect(ctx.graphType).toBe(true);
    expect([...ctx.keyFields]).toEqual(['sku']);
    expect(keyContext(model, 'sch:nothing', 'diff')).toEqual({
      graphType: false,
      keyFields: new Set(),
      msgKeys: new Set(),
    });
  });
});

describe('keyBadges', () => {
  it('marks a stored field as key, pointer, unique, defaulted and message key', () => {
    const field: Field = {
      name: 'order_id',
      type: 'uuid',
      key: true,
      ref: 'sch:order#id',
      unique: true,
      default: 0,
    };
    expect(keyBadges(model, field, ctxOf({ msgKeys: new Set(['order_id']) }))).toEqual([
      { key: 'pk', text: 'PK', title: 'part of the record’s key' },
      { key: 'fk', text: 'FK → Order.id', id: 'sch:order#id', title: 'points at Order.id' },
      { key: 'unique', text: 'unique' },
      { key: 'default', text: 'default 0', title: 'used when the field is left out' },
      { key: 'msg', text: 'message key', title: 'the event is keyed by this field' },
    ]);
  });

  it('points at a whole schema, or at something the plan does not know, without a link', () => {
    expect(keyBadges(model, { name: 'o', type: 'uuid', ref: 'sch:order' }, ctxOf())).toEqual([
      { key: 'fk', text: 'FK → Order', id: 'sch:order', title: 'points at Order' },
    ]);
    expect(keyBadges(model, { name: 'o', type: 'uuid', ref: 'sch:gone#id' }, ctxOf())).toEqual([
      { key: 'fk', text: 'FK → sch:gone.id' },
    ]);
    expect(keyBadges(model, { name: 'plain', type: 'int' }, ctxOf())).toEqual([]);
  });

  it('marks a graph field as key, by the subgraphs that serve it, and private', () => {
    const ctx = ctxOf({ graphType: true, keyFields: new Set(['sku']) });
    const badges = keyBadges(
      model,
      { name: 'sku', type: 'ID', subgraphs: ['sg:catalogue'], auth: 'signed-in customer' },
      ctx,
    );
    expect(badges).toEqual([
      {
        key: 'key',
        text: 'key',
        glyph: '⚿',
        title: 'key field: the gateway asks other subgraphs for the type by it',
      },
      { key: 'sg:catalogue', text: model.label('sg:catalogue'), id: 'sg:catalogue' },
      { key: 'private', text: 'private', glyph: '🔒', title: 'private: signed-in customer' },
    ]);
  });

  it('calls a field private by its cache scope alone', () => {
    const ctx = ctxOf({ graphType: true });
    expect(
      keyBadges(
        model,
        { name: 'price', type: 'Int', cache_control: { max_age: 60, scope: 'private' } },
        ctx,
      ),
    ).toEqual([
      { key: 'private', text: 'private', glyph: '🔒', title: 'private: a private cache scope' },
    ]);
    expect(
      keyBadges(
        model,
        { name: 'price', type: 'Int', cache_control: { max_age: 60, scope: 'public' } },
        ctx,
      ),
    ).toEqual([]);
  });
});

describe('rollouts', () => {
  const total = rowOf(
    { name: 'total_cents', type: 'int' },
    'deprecated',
    [],
    ['chg:drop-total', 'chg:drop-again', 'chg:quiet', 'chg:gone'],
  );

  it('gives the rollout words of a deprecated or removed field once each, in a diff only', () => {
    expect(rollouts(model, total, 'diff')).toEqual(['Readers move to the lines first.']);
    expect(rollouts(model, { ...total, status: 'removed' }, 'diff')).toHaveLength(1);
    expect(rollouts(model, total, 'toBe')).toEqual([]);
    expect(rollouts(model, { ...total, status: 'modified' }, 'diff')).toEqual([]);
  });

  it('has none when no change says how', () => {
    expect(rollouts(model, { ...total, changes: ['chg:quiet'] }, 'diff')).toEqual([]);
    const { changes, ...bare } = plan;
    expect(changes).toHaveLength(3);
    expect(rollouts(modelOf(bare), total, 'diff')).toEqual([]);
  });
});
