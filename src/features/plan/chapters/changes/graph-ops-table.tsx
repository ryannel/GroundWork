import type { ReactNode } from 'react';

import type { Model } from '@/application/plan/derive';
import type { GraphDiff } from '@/application/plan/federation-diff';
import {
  type OpImpact,
  edgeWord,
  opImpact,
  splitOf,
  splitWhy,
} from '@/application/plan-story-changes-graph-ops';
import { subgraphLabel } from '@/application/plan-viz-graph-base';
import { EntityChip } from '@/features/plan/common/entity-chip';
import { ModelInline } from '@/features/plan/common/model-text';
import { GraphEstimate } from '@/features/plan/viz/graph-evidence/graph-estimate';
import { ScrollCue } from '@/features/plan/viz/zoompane/scroll-cue.client';
import { Badge } from '@/ui/badge';

import styles from './graph-ops-table.module.css';

interface GraphOpsTableProps {
  readonly model: Model;
  readonly diff: GraphDiff;
}

function Move({ was, now }: { readonly was: string; readonly now: string }) {
  if (was === now) {
    return (
      <>
        {now}
        <span className={styles.same}>same</span>
      </>
    );
  }
  return (
    <>
      <s className={styles.was}>{was}</s>
      <span aria-hidden="true"> → </span>
      <b>{now}</b>
    </>
  );
}

function RoundTrips({ row }: { readonly row: OpImpact }) {
  const { before, after } = row;
  if (after === null) return null;
  if (before === null) return <b>{after.roundTrips}</b>;
  return (
    <>
      <Move was={String(before.roundTrips)} now={String(after.roundTrips)} />
      <span className={styles.hidden}> round trips</span>
    </>
  );
}

function Routes({ model, row }: { readonly model: Model; readonly row: OpImpact }) {
  const name = (id: string): string => subgraphLabel(model, id);
  if (row.before === null)
    return <>{(row.after?.subgraphs ?? []).map((id) => name(id)).join(', ')}</>;
  if (row.added.length === 0 && row.removed.length === 0)
    return <span className={styles.same}>same subgraphs</span>;
  const [gained] = row.added;
  const [lost] = row.removed;
  if (
    gained !== undefined &&
    lost !== undefined &&
    row.added.length === 1 &&
    row.removed.length === 1
  )
    return (
      <>
        <s className={styles.was}>{name(lost)}</s>
        <span aria-hidden="true"> → </span>
        {name(gained)}
      </>
    );
  return (
    <>
      {[
        ...row.added.map((id) => `+ ${name(id)}`),
        ...row.removed.map((id) => `− ${name(id)}`),
      ].join(', ')}
    </>
  );
}

function Name({
  model,
  diff,
  row,
}: {
  readonly model: Model;
  readonly diff: GraphDiff;
  readonly row: OpImpact;
}): ReactNode {
  const pair = row.kind === 'new' ? splitOf(model, diff, row) : null;
  const why = pair === null ? '' : splitWhy(model, row, pair);
  return (
    <>
      <span className={styles.name}>
        <EntityChip id={row.id} model={model} />
        {row.kind === 'new' ? <Badge tone="added">+ New</Badge> : null}
      </span>
      {pair === null ? null : (
        <span className={styles.note}>
          split from {pair.name}
          {why === '' ? null : (
            <>
              : <ModelInline model={model} text={why} />
            </>
          )}
        </span>
      )}
    </>
  );
}

function Row({
  model,
  diff,
  row,
}: {
  readonly model: Model;
  readonly diff: GraphDiff;
  readonly row: OpImpact;
}) {
  const after = edgeWord(model, row.id, { mode: 'toBe', summary: row.after });
  const was =
    row.before === null ? after : edgeWord(model, row.id, { mode: 'asIs', summary: row.before });
  return (
    <tr data-kind={row.kind}>
      <th className={styles.op} scope="row">
        <Name diff={diff} model={model} row={row} />
      </th>
      <td className={styles.cell}>
        <RoundTrips row={row} />
        <GraphEstimate id={row.id} model={model} />
      </td>
      <td className={styles.cell}>
        {row.before === null ? after : <Move now={after} was={was} />}
      </td>
      <td className={styles.cell}>
        <Routes model={model} row={row} />
      </td>
    </tr>
  );
}

/**
 * Each operation the plan changes or adds, worst first: round trips, how long the edge keeps the answer, and the
 * subgraphs it goes through, before and after. Nothing when no operation changes.
 */
export function GraphOpsTable({ model, diff }: GraphOpsTableProps) {
  const rows = opImpact(model, diff);
  if (rows.length === 0) return null;
  return (
    <ScrollCue note>
      <table className={styles.table}>
        <caption className={styles.caption}>
          Each operation the plan changes: round trips, how long the edge keeps the answer, and the
          subgraphs it goes through, before and after
        </caption>
        <thead>
          <tr>
            <th scope="col">Operation</th>
            <th scope="col">Round trips</th>
            <th scope="col">At the edge</th>
            <th scope="col">Goes through</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <Row diff={diff} key={row.id} model={model} row={row} />
          ))}
        </tbody>
      </table>
    </ScrollCue>
  );
}
