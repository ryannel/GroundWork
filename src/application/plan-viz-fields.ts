import type { PropRow } from '@/application/plan/compat-rules';
import type { Model } from '@/application/plan/derive';
import type { ElementStatus, Mode } from '@/application/plan/derive-core';
import { fieldId } from '@/application/plan/ids';
import { compatOf } from '@/application/plan-viz-compat';
import type { SchemaNode } from '@/domain/plan/plan-graph';
import type { Field } from '@/domain/plan/plan.generated';

// The rows of a field table: a schema's fields in a mode, what changed on each, and which hurt someone most.

export interface FieldRow {
  readonly field: Field;
  readonly fid: string;
  readonly status: ElementStatus;
  /** What changed on the field, from the net result. */
  readonly props: readonly PropRow[];
  /** The changes that edit it. */
  readonly changes: readonly string[];
}

const graphSchema = (model: Model, mode: 'asIs' | 'toBe', id: string): SchemaNode | undefined => {
  const n = model[mode].get(id);
  return n?.$type === 'schema' ? n : undefined;
};

/** The schema as a mode sees it: today's for as-is, else with the plan, falling back to the other. */
export function schemaOf(model: Model, id: string, mode: Mode = 'toBe'): SchemaNode | undefined {
  const [a, b] = [graphSchema(model, 'asIs', id), graphSchema(model, 'toBe', id)];
  return mode === 'asIs' ? (a ?? b) : (b ?? a);
}

const plainRow = (schemaId: string, field: Field): FieldRow => ({
  field,
  fid: fieldId(schemaId, field.name),
  status: 'existing',
  props: [],
  changes: [],
});

function netProps(model: Model, schemaId: string): Map<string, readonly PropRow[]> {
  const out = new Map<string, readonly PropRow[]>();
  for (const r of model.netDiff(schemaId)) if ('field' in r) out.set(r.field, r.props);
  return out;
}

function diffRows(model: Model, schemaId: string, entries: readonly Entry[]): FieldRow[] {
  const net = netProps(model, schemaId);
  const wholly = model.status(schemaId) === 'added';
  const statusOf = (fid: string, removed: boolean): ElementStatus => {
    if (removed) return 'removed';
    return wholly ? 'existing' : (model.status(fid) ?? 'existing');
  };
  return entries.map(({ field, removed }) => {
    const fid = fieldId(schemaId, field.name);
    const mine = wholly ? [] : model.diff(fid).filter((d) => d.target === fid);
    return {
      field,
      fid,
      status: statusOf(fid, removed),
      props: net.get(field.name) ?? [],
      changes: [...new Set(mine.flatMap((d) => (d.changeId === undefined ? [] : [d.changeId])))],
    };
  });
}

interface Entry {
  readonly field: Field;
  readonly removed: boolean;
}

/** The as-is fields the plan removes come after the to-be fields. */
function diffEntries(toBe: SchemaNode | undefined, asIs: SchemaNode | undefined): Entry[] {
  const entries: Entry[] = (toBe?.fields ?? []).map((field) => ({ field, removed: false }));
  const had = new Set(entries.map((e) => e.field.name));
  const gone = (asIs?.fields ?? []).filter((f) => !had.has(f.name));
  return [...entries, ...gone.map((field) => ({ field, removed: true }))];
}

/** The rows of a schema in a mode: to-be order, then the as-is fields the plan removes (diff only). */
export function fieldRows(model: Model, schemaId: string, mode: Mode = 'diff'): FieldRow[] {
  const toBe = graphSchema(model, 'toBe', schemaId);
  const asIs = graphSchema(model, 'asIs', schemaId);
  if (mode === 'diff') return diffRows(model, schemaId, diffEntries(toBe, asIs));
  const only = mode === 'asIs' ? (asIs ?? toBe) : toBe;
  return only?.fields.map((f) => plainRow(schemaId, f)) ?? [];
}

export interface SchemaCounts {
  readonly fields: number;
  readonly before: number;
  readonly added: number;
  readonly modified: number;
  readonly deprecated: number;
  readonly removed: number;
  readonly changes: readonly string[];
}

/** Counts of field changes in a schema. */
export function schemaCounts(model: Model, schemaId: string): SchemaCounts {
  const rows = fieldRows(model, schemaId, 'diff');
  const of = (status: ElementStatus): number => rows.filter((r) => r.status === status).length;
  const own = model.diff(schemaId).flatMap((d) => (d.changeId === undefined ? [] : [d.changeId]));
  return {
    fields: rows.filter((r) => r.status !== 'removed').length,
    before: graphSchema(model, 'asIs', schemaId)?.fields.length ?? 0,
    added: of('added'),
    modified: of('modified'),
    deprecated: of('deprecated'),
    removed: of('removed'),
    changes: [...new Set([...rows.flatMap((r) => r.changes), ...own])],
  };
}

export interface WorstField {
  readonly row: FieldRow;
  readonly fid: string;
  readonly name: string;
  readonly status: ElementStatus;
  readonly verdict: 'breaking' | 'migration' | 'safe';
  readonly unmoved: readonly string[];
  readonly who: readonly string[];
  readonly reasons: readonly string[];
  readonly score: number;
}

const SEVERITY = { breaking: 3, migration: 2, safe: 1 } as const;
const STATUS_RANK: Partial<Record<ElementStatus, number>> = {
  removed: 3,
  deprecated: 2,
  modified: 1,
};
const CAP = 9;

/** The changed fields of a schema, worst first. A field nobody is recorded reading still ranks as breaking. */
export function worstFields(model: Model, schemaId: string): WorstField[] {
  return fieldRows(model, schemaId, 'diff')
    .filter((r) => r.status !== 'existing')
    .map((row): WorstField => {
      const c = compatOf(model, row.fid);
      const verdict = c?.verdict ?? 'safe';
      const who = c?.who ?? [];
      const unmoved = who.filter((w) => w.movedBy === null);
      const score =
        SEVERITY[verdict] * 100 +
        Math.min(unmoved.length, CAP) * 10 +
        Math.min(who.length, CAP) +
        (STATUS_RANK[row.status] ?? 0) / 10;
      return {
        row,
        fid: row.fid,
        name: row.field.name,
        status: row.status,
        verdict,
        unmoved: unmoved.map((w) => w.svc),
        who: who.map((w) => w.svc),
        reasons: (c?.reasons ?? []).map((r) => r.text),
        score,
      };
    })
    .toSorted((a, b) => b.score - a.score);
}

/** Rows ordered worst first: the fields that hurt someone, then the safe edits, then the rows nothing happens to. */
export function worstFirst(model: Model, schemaId: string, rows: readonly FieldRow[]): FieldRow[] {
  const score = new Map(worstFields(model, schemaId).map((w) => [w.fid, w.score]));
  const at = new Map(rows.map((r, i) => [r.fid, i]));
  return rows.toSorted((a, b) => {
    const worse = (score.get(b.fid) ?? -1) - (score.get(a.fid) ?? -1);
    return worse === 0 ? (at.get(a.fid) ?? 0) - (at.get(b.fid) ?? 0) : worse;
  });
}

export type FoldMode = 'unchanged' | 'existing' | false | undefined;

const FOLD_MIN_ROWS = 8;
const FOLD_RUN = 3;
export const FILTER_ROWS = 40;

/**
 * Which rows fold: long runs of unchanged ones (diff), or everything that is not new (chapter 4). The result is a
 * group number per row, 0 for a row that stays.
 */
export function foldGroups(
  rows: readonly FieldRow[],
  { fold, diff, marked }: { fold: FoldMode; diff: boolean; marked: boolean },
): number[] {
  const hidden = Array.from({ length: rows.length }, () => 0);
  const on =
    fold === 'existing' || (fold !== false && diff && marked && rows.length > FOLD_MIN_ROWS);
  if (!on) return hidden;
  const quiet = rows.map((r) =>
    fold === 'existing' ? r.status !== 'added' : r.status === 'existing',
  );
  let group = 0;
  let i = 0;
  while (i < rows.length) {
    let j = i;
    while (quiet[j] === true) j++;
    if (j > i && (fold === 'existing' || j - i > FOLD_RUN)) {
      group++;
      hidden.fill(group, i, j);
    }
    i = Math.max(j, i + 1);
  }
  return hidden;
}
