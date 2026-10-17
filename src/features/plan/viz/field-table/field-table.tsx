import type { Model } from '@/application/plan/derive';
import type { ElementStatus, Mode } from '@/application/plan/derive-core';
import { keyContext, typeCell, type KeyContext } from '@/application/plan-viz-field-cells';
import {
  fieldRows,
  foldGroups,
  schemaOf,
  worstFirst,
  FILTER_ROWS,
  type FieldRow,
  type FoldMode,
} from '@/application/plan-viz-fields';
import { SchemaHead } from '@/features/plan/viz/field-table/schema-head';

import {
  ChangeKey,
  ChangedByTd,
  Gut,
  HeadCells,
  KeyTd,
  NameTd,
  NoteBody,
  NoteTd,
  RequiredTd,
  type Column,
} from './field-cells';
import { FieldGrid, type GridRow } from './field-grid.client';
import styles from './field-table.module.css';

export interface FieldTableProps {
  readonly model: Model;
  readonly schemaId: string;
  /** 'asIs' today, 'toBe' with this plan, 'diff' with this plan and the changes marked (removed rows kept). */
  readonly mode?: Mode;
  /** The compact form folds the note under the name; no column is dropped. */
  readonly density?: 'full' | 'compact';
  /** The "changed by" column: always, never, or only when more than one change edits the rows. */
  readonly changes?: boolean | 'auto';
  /** Numbers the changes in the column and names each once under the table. */
  readonly changeKey?: boolean;
  /** The title line above the table; 'bare' keeps only the count. */
  readonly head?: boolean | 'bare';
  readonly caption?: string;
  /** Field names to show: a field's page is a one-row table. */
  readonly only?: readonly string[];
  /** Diff: long runs of unchanged rows fold ('unchanged'), or show only the new rows ('existing'). */
  readonly fold?: FoldMode;
  /** 'worst': the field that hurts someone most first, safe adds last, unchanged rows after. */
  readonly order?: 'worst' | 'schema';
  /** Under a field that breaks or needs migration, who must move. */
  readonly who?: boolean;
  readonly depth?: number;
}

interface Shape {
  readonly mode: Mode;
  readonly compact: boolean;
  readonly diff: boolean;
  readonly marked: boolean;
  readonly wholly: boolean;
  readonly columns: readonly Column[];
  readonly changes: boolean;
}

function shapeOf(model: Model, rows: readonly FieldRow[], p: FieldTableProps): Shape {
  const mode = p.mode ?? 'diff';
  const diff = mode === 'diff';
  const wholly = diff && model.status(p.schemaId) === 'added';
  const many = new Set(rows.flatMap((r) => r.changes)).size > 1;
  const changes = diff && (p.changes === 'auto' ? many : p.changes === true);
  const compact = p.density === 'compact';
  return {
    mode,
    compact,
    diff,
    wholly,
    marked: diff && !wholly && rows.some((r) => r.status !== 'existing'),
    changes,
    columns: [
      'gut',
      'field',
      'type',
      'required',
      'key',
      ...(compact ? [] : (['note'] as const)),
      ...(changes ? (['changed by'] as const) : []),
    ],
  };
}

const NEW_ONE: Readonly<Record<string, string>> = { record: 'record', 'graph-type': 'type' };

interface CaptionOf {
  readonly shape: Shape;
  readonly count: number;
}

function captionOf(model: Model, p: FieldTableProps, { shape, count }: CaptionOf): string {
  if (p.caption !== undefined) return p.caption;
  if (!shape.wholly || count < 2) return '';
  const kind = schemaOf(model, p.schemaId, shape.mode)?.kind ?? '';
  return `All ${String(count)} fields are new, because the ${NEW_ONE[kind] ?? 'schema'} is.`;
}

interface Ctx {
  readonly keys: KeyContext;
  readonly shape: Shape;
  readonly order: readonly string[] | null;
  readonly props: FieldTableProps;
}

const newHere = (r: FieldRow, shape: Shape): boolean =>
  shape.diff && r.status === 'added' && !shape.wholly;

const statusIn = (r: FieldRow, shape: Shape): ElementStatus =>
  shape.marked || newHere(r, shape) ? r.status : 'existing';

function gridRow(r: FieldRow, fold: number, ctx: Ctx): GridRow {
  const { props, shape } = ctx;
  const { model, schemaId } = props;
  const status = statusIn(r, shape);
  const type = typeCell(model, r, { schemaId, depth: props.depth ?? 0 });
  const body = (
    <NoteBody mode={shape.mode} model={model} row={r} status={status} who={props.who === true} />
  );
  return {
    key: r.fid,
    fold,
    status,
    search: `${r.field.name} ${r.field.type} ${r.field.note ?? ''}`.toLowerCase(),
    before: (
      <>
        <Gut marked={shape.marked} status={status} />
        <NameTd compact={shape.compact} row={r} status={status}>
          {body}
        </NameTd>
      </>
    ),
    typeText: type.text,
    typeWas: type.was,
    nestedName: type.nested === null ? null : type.nestedName,
    nested:
      type.nested === null ? null : (
        <FieldTable
          changes={false}
          density="compact"
          depth={(props.depth ?? 0) + 1}
          head={false}
          mode={shape.mode}
          model={model}
          schemaId={type.nested}
        />
      ),
    after: (
      <>
        <RequiredTd row={r} />
        <KeyTd ctx={ctx.keys} model={model} row={r} />
        {shape.compact ? null : <NoteTd>{body}</NoteTd>}
        {shape.changes ? <ChangedByTd model={model} order={ctx.order} row={r} /> : null}
      </>
    ),
  };
}

function rowsOf(model: Model, p: FieldTableProps): FieldRow[] {
  const mode = p.mode ?? 'diff';
  const all = fieldRows(model, p.schemaId, mode);
  const only = new Set(p.only);
  const kept = p.only === undefined ? all : all.filter((r) => only.has(r.field.name));
  return mode === 'diff' && p.order === 'worst' ? worstFirst(model, p.schemaId, kept) : kept;
}

/**
 * The only way a schema's fields are drawn: in the inspector, on the entity page, in Reference, in the story and
 * inside an endpoint or event. One column set for every kind of schema.
 */
export function FieldTable({ head = false, ...table }: FieldTableProps) {
  const { model, schemaId, fold, changeKey } = table;
  const mode = table.mode ?? 'diff';
  if (schemaOf(model, schemaId, mode) === undefined) return null;
  const rows = rowsOf(model, table);
  const shape = shapeOf(model, rows, table);
  const keyOrder = [...new Set(rows.flatMap((r) => r.changes))];
  const ctx: Ctx = {
    keys: keyContext(model, schemaId, mode),
    shape,
    order: changeKey === true ? keyOrder : null,
    props: table,
  };
  const groups = foldGroups(rows, { fold, diff: shape.diff, marked: shape.marked });
  const sizes = Array.from(
    { length: Math.max(0, ...groups) },
    (_, i) => groups.filter((g) => g === i + 1).length,
  );
  const word = fold === 'existing' ? 'existing' : 'unchanged';
  const caption = captionOf(model, table, { shape, count: rows.length });
  return (
    <div
      className={styles.table}
      data-compact={shape.compact ? '' : undefined}
      data-mode={mode}
      data-schema={schemaId}
    >
      {head === false ? null : (
        <SchemaHead
          bare={head === 'bare'}
          compat={head !== 'bare'}
          mode={mode}
          model={model}
          schemaId={schemaId}
        />
      )}
      {caption === '' ? null : <div className={styles.caption}>{caption}</div>}
      {rows.length === 0 ? (
        <div className={styles.empty}>No fields recorded.</div>
      ) : (
        <FieldGrid
          columns={shape.columns.length}
          filter={rows.length > FILTER_ROWS}
          foldLabels={sizes.map((n) => `${String(n)} ${word} ${n === 1 ? 'field' : 'fields'}`)}
          head={<HeadCells columns={shape.columns} graphType={ctx.keys.graphType} />}
          rows={rows.map((r, i) => gridRow(r, groups[i] ?? 0, ctx))}
        />
      )}
      {shape.changes && changeKey === true ? <ChangeKey model={model} order={keyOrder} /> : null}
    </div>
  );
}
