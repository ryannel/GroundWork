import type { Model } from '@/application/plan/derive';
import type { GraphDiff } from '@/application/plan/federation-diff';
import type { GraphMode } from '@/application/plan-viz-graph-base';
import {
  type GridColumn,
  type GridField,
  type GridRow,
  ownershipGrid,
} from '@/application/plan-viz-graph-grid';
import { EntityChip } from '@/features/plan/common/entity-chip';
import { TeamTag } from '@/features/plan/common/team-dot';
import { ScrollCue } from '@/features/plan/viz/zoompane/scroll-cue.client';

import styles from './ownership-grid.module.css';

export interface OwnershipGridProps {
  readonly model: Model;
  readonly graphId: string;
  /** Today's graph by default; ignored when there is a diff, which shows today and the plan together. */
  readonly mode?: GraphMode;
  /** `model.graphDiff(graphId)`: a field that leaves is struck, one that arrives is marked new. */
  readonly diff?: GraphDiff | null;
  /** A team id: columns of other teams are dimmed. */
  readonly lens?: string | null;
}

const COLUMN_STATUS = {
  added: '+ new',
  deprecated: 'deprecated',
  removed: 'removed',
} as const;

function FieldButton({ field }: { readonly field: GridField }) {
  const title = field.note === '' ? field.name : `${field.name} · ${field.note}`;
  return (
    <span className={styles.fieldWrap}>
      {field.key ? (
        <span
          aria-label="key field"
          className={styles.mark}
          role="img"
          title="Key field: how the other subgraphs find this row"
        >
          ⚿
        </span>
      ) : null}
      <button
        className={styles.field}
        data-inspect={field.id}
        data-state={field.state}
        title={title}
        type="button"
      >
        {field.name}
      </button>
      {field.private ? (
        <span
          aria-label="private"
          className={styles.mark}
          role="img"
          title="Private: a response that carries it cannot be cached at the edge"
        >
          🔒
        </span>
      ) : null}
      {field.note === '' ? null : <span className={styles.note}>{field.note}</span>}
      {field.usage === '' ? null : <span className={styles.note}>{field.usage}</span>}
    </span>
  );
}

function Head({
  model,
  column,
  lens,
}: {
  readonly model: Model;
  readonly column: GridColumn;
  readonly lens: string | null;
}) {
  const dim = lens !== null && column.team !== null && column.team !== lens;
  return (
    <th
      className={styles.head}
      data-dim={dim ? '' : undefined}
      data-status={column.status ?? undefined}
      scope="col"
    >
      <EntityChip id={column.id} label={column.label} model={model} status="existing" />
      {column.team === null ? null : <TeamTag model={model} teamId={column.team} />}
      {column.status === null ? null : (
        <span className={styles.status}>{COLUMN_STATUS[column.status]}</span>
      )}
    </th>
  );
}

function Row({
  model,
  row,
  columns,
  lens,
}: {
  readonly model: Model;
  readonly row: GridRow;
  readonly columns: readonly GridColumn[];
  readonly lens: string | null;
}) {
  return (
    <tr>
      <th className={styles.type} scope="row">
        <EntityChip id={row.id} model={model} status="existing" />
        {row.summary === '' ? null : <span className={styles.summary}>{row.summary}</span>}
        {row.callout === '' ? null : (
          <details className={styles.callout}>
            <summary>⚿ How the others find it</summary>
            <p>{row.callout}</p>
          </details>
        )}
      </th>
      {row.cells.map((cell) => {
        const team = columns.find((c) => c.id === cell.subgraph)?.team ?? null;
        const dim = lens !== null && team !== null && team !== lens;
        return (
          <td className={styles.cell} data-dim={dim ? '' : undefined} key={cell.subgraph}>
            {cell.fields.length === 0 ? (
              <span aria-label="owns nothing here" className={styles.empty}>
                ·
              </span>
            ) : (
              cell.fields.map((field) => <FieldButton field={field} key={field.id} />)
            )}
          </td>
        );
      })}
    </tr>
  );
}

/** Who owns which field: a type per row, a subgraph per column. Nothing when the graph has no types. */
export function OwnershipGrid({
  model,
  graphId,
  mode = 'asIs',
  diff = null,
  lens = null,
}: OwnershipGridProps) {
  const grid = ownershipGrid(model, graphId, { mode, diff });
  if (grid === null) return <p className={styles.none}>No graph types in this plan.</p>;
  return (
    <figure className={styles.figure}>
      <ScrollCue note>
        <table className={styles.table} data-diff={diff === null ? undefined : ''}>
          <caption className={styles.caption}>Who owns which field</caption>
          <thead>
            <tr>
              <th className={styles.corner} scope="col">
                type
              </th>
              {grid.columns.map((column) => (
                <Head column={column} key={column.id} lens={lens} model={model} />
              ))}
            </tr>
          </thead>
          <tbody>
            {grid.rows.map((row) => (
              <Row columns={grid.columns} key={row.id} lens={lens} model={model} row={row} />
            ))}
          </tbody>
        </table>
      </ScrollCue>
      <p className={styles.key}>
        ⚿ key field: how the other subgraphs find this row · 🔒 private: a response that carries it
        cannot be cached at the edge · click a field for what is behind it
      </p>
    </figure>
  );
}
