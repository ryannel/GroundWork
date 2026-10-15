import { describe, expect, it, vi } from 'vitest';

import { derive } from '@/application/plan/derive';
import {
  keyBadges,
  keyContext,
  keyNames,
  noteCell,
  requiredCell,
  rollouts,
  typeCell,
} from '@/application/plan-viz-field-cells';
import {
  fieldRows,
  foldGroups,
  schemaCounts,
  worstFields,
  worstFirst,
  type FieldRow,
} from '@/application/plan-viz-fields';

vi.mock('server-only', () => ({}));

const { readPlan } = await import('@/infrastructure/plan-store');

const loaded = await readPlan('alder-finch', 'delivery-promise');
const model = derive(loaded.plan!);
const PRODUCT = 'sch:product';

describe('fieldRows', () => {
  it('lists the to-be fields in a diff with what changed on each', () => {
    const rows = fieldRows(model, PRODUCT, 'diff');
    expect(rows.length).toBeGreaterThan(2);
    const lead = rows.find((r) => r.field.name === 'lead_time_text');
    expect(lead?.status).not.toBe('existing');
    expect(lead?.changes.length).toBeGreaterThan(0);
  });

  it('shows the as-is fields without marks in as-is mode', () => {
    const rows = fieldRows(model, PRODUCT, 'asIs');
    expect(rows.every((r) => r.status === 'existing')).toBe(true);
  });

  it('has no rows for something that is not a schema', () => {
    expect(fieldRows(model, 'sch:nothing', 'diff')).toEqual([]);
  });
});

describe('schemaCounts and worstFields', () => {
  it('counts what changed and ranks the field that breaks readers first', () => {
    const counts = schemaCounts(model, PRODUCT);
    expect(counts.added + counts.modified + counts.deprecated + counts.removed).toBeGreaterThan(0);
    const worst = worstFields(model, PRODUCT);
    expect(worst[0]?.verdict).toBe('breaking');
    const order = worstFirst(model, PRODUCT, fieldRows(model, PRODUCT, 'diff'));
    expect(order[0]?.fid).toBe(worst[0]?.fid);
  });
});

const row = (status: FieldRow['status'], i: number): FieldRow => ({
  field: { name: `f${String(i)}`, type: 'string' },
  fid: `sch:x#f${String(i)}`,
  status,
  props: [],
  changes: [],
});

describe('foldGroups', () => {
  it('folds a long run of unchanged rows once the table is long and has marks', () => {
    const rows = [
      ...Array.from({ length: 6 }, (_, i) => row('existing', i)),
      row('added', 6),
      ...Array.from({ length: 3 }, (_, i) => row('existing', i + 7)),
    ];
    const groups = foldGroups(rows, { fold: 'unchanged', diff: true, marked: true });
    expect(groups.slice(0, 6)).toEqual([1, 1, 1, 1, 1, 1]);
    expect(groups.slice(6)).toEqual([0, 0, 0, 0]);
  });

  it('keeps short tables open and folds all but the new in chapter 4', () => {
    const rows = [row('existing', 0), row('added', 1), row('modified', 2)];
    expect(foldGroups(rows, { fold: 'unchanged', diff: true, marked: true })).toEqual([0, 0, 0]);
    expect(foldGroups(rows, { fold: 'existing', diff: true, marked: true })).toEqual([1, 0, 2]);
    expect(foldGroups(rows, { fold: false, diff: true, marked: true })).toEqual([0, 0, 0]);
  });
});

describe('field cells', () => {
  const rows = fieldRows(model, PRODUCT, 'diff');

  it('reads the key names of an event', () => {
    expect(keyNames('a, b')).toEqual(['a', 'b']);
    expect(keyNames(['x'])).toEqual(['x']);
    expect(keyNames()).toEqual([]);
  });

  it('builds cells for every row', () => {
    const ctx = keyContext(model, PRODUCT, 'diff');
    for (const r of rows) {
      expect(typeCell(model, r, { schemaId: PRODUCT, depth: 0 }).text).not.toBe('');
      expect(requiredCell(r).required).toBe(r.field.required === true);
      expect(noteCell(model, r).others).toBeDefined();
      expect(keyBadges(model, r.field, ctx)).toBeDefined();
      expect(rollouts(model, r, 'diff')).toBeDefined();
    }
  });
});
