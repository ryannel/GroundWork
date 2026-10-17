import type { Model } from '@/application/plan/derive';
import type { GraphDiff } from '@/application/plan/federation-diff';
import type { GraphMode } from '@/application/plan-viz-graph-base';
import {
  type BlockedLine,
  type CacheRowView,
  type TtlItem,
  type TtlLine,
  cacheTable,
} from '@/application/plan-viz-graph-caches';
import { EntityChip } from '@/features/plan/common/entity-chip';
import { ModelInline } from '@/features/plan/common/model-text';
import { TeamTag } from '@/features/plan/common/team-dot';
import { GoLink } from '@/features/plan/viz/go-link/go-link';
import { ScrollCue } from '@/features/plan/viz/zoompane/scroll-cue.client';

import styles from './cache-table.module.css';

export interface CacheTableProps {
  readonly model: Model;
  /** Today's caches by default; ignored when there is a diff, which shows today and the plan together. */
  readonly mode?: GraphMode;
  /** `model.graphDiff(graphId)`: what the plan changes is struck out and marked new. */
  readonly diff?: GraphDiff | null;
  /** A team id: caches of other teams are dimmed. */
  readonly lens?: string | null;
  /** Where a flow is read; gives each purge a link to the flow that does it. */
  readonly purgeHref?: (flowId: string) => string | null;
}

const LAYER = { edge: 'Edge', gateway: 'Gateway', subgraph: 'Subgraph' } as const;

function Item({ item }: { readonly item: TtlItem }) {
  return (
    <span title={item.why}>
      {item.label === '' ? null : `${item.label} `}
      <strong>{item.text}</strong>
      {item.override ? ' (set per field)' : ''}
    </span>
  );
}

function Lifetimes({ lines }: { readonly lines: readonly TtlLine[] }) {
  if (lines.length === 0) return <span className={styles.muted}>no lifetime set</span>;
  return (
    <ul className={styles.list}>
      {lines.map((line, i) => (
        <li key={`${line.item?.label ?? line.was?.label ?? ''}-${String(i)}`}>
          {line.was === null ? null : (
            <s className={styles.was}>
              <Item item={line.was} />
            </s>
          )}
          {line.item === null ? (
            <span className={styles.gone}> dropped</span>
          ) : (
            <>
              {line.was === null ? '' : ' '}
              {line.isNew ? <span className={styles.new}>+ </span> : null}
              <Item item={line.item} />
            </>
          )}
        </li>
      ))}
    </ul>
  );
}

function Emptied({
  model,
  row,
  purgeHref,
}: {
  readonly model: Model;
  readonly row: CacheRowView;
  readonly purgeHref?: CacheTableProps['purgeHref'];
}) {
  const href = row.purgeFlow === null ? null : (purgeHref?.(row.purgeFlow) ?? null);
  const parts = [...row.events, ...row.steps];
  return (
    <div className={styles.emptied}>
      {parts.length === 0 && row.eventsAdded.length === 0 ? (
        <span className={styles.muted}>
          {row.purge === '' ? 'only when it expires' : row.purge}
        </span>
      ) : (
        <ul className={styles.list}>
          {parts.map((part) => (
            <li key={part}>
              <ModelInline model={model} text={part} />
            </li>
          ))}
          {row.eventsAdded.map((part) => (
            <li key={part}>
              <span className={styles.new}>+ </span>
              <ModelInline model={model} text={part} />
            </li>
          ))}
        </ul>
      )}
      {href === null ? null : <GoLink href={href} label="See the purge" />}
    </div>
  );
}

function Blocked({
  model,
  lines,
}: {
  readonly model: Model;
  readonly lines: readonly BlockedLine[];
}) {
  if (lines.length === 0) return null;
  return (
    <ul className={styles.blocked}>
      {lines.map((line) => (
        <li key={`${line.operation}-${line.field ?? ''}`}>
          Never stored for <EntityChip id={line.operation} model={model} status="existing" />
          {line.field === null ? ' as a whole' : ' because of its private field '}
          {line.field === null ? null : (
            <EntityChip id={line.field} model={model} status="existing" />
          )}
        </li>
      ))}
    </ul>
  );
}

function Row({
  model,
  row,
  lens,
  purgeHref,
}: {
  readonly model: Model;
  readonly row: CacheRowView;
  readonly lens: string | null;
  readonly purgeHref?: CacheTableProps['purgeHref'];
}) {
  const dim = lens !== null && row.team !== null && row.team !== lens;
  return (
    <tr data-dim={dim ? '' : undefined} data-status={row.status}>
      <th className={styles.layer} scope="row">
        <span className={styles.layerName}>{LAYER[row.layer]}</span>
        <EntityChip id={row.id} model={model} status="existing" />
        {row.team === null ? null : <TeamTag model={model} teamId={row.team} />}
        {row.status === 'same' ? null : <span className={styles.badge}>{row.status}</span>}
      </th>
      <td className={styles.cell}>{row.does}</td>
      <td className={styles.cell}>
        <Lifetimes lines={row.ttl} />
      </td>
      <td className={styles.cell}>
        {row.keyWas === null ? null : <s className={styles.was}>{row.keyWas} </s>}
        {row.key}
      </td>
      <td className={styles.cell}>
        <Emptied model={model} purgeHref={purgeHref} row={row} />
        <Blocked lines={row.blocked} model={model} />
      </td>
    </tr>
  );
}

/**
 * The caches on the graph's path, outermost first: what each holds, for how long, one copy per what, and what empties
 * it. Nothing when the graph has none.
 */
export function CacheTable({
  model,
  mode = 'asIs',
  diff = null,
  lens = null,
  purgeHref,
}: CacheTableProps) {
  const rows = cacheTable(model, { mode, diff });
  if (rows.length === 0) {
    return <p className={styles.none}>No caches are recorded on this graph.</p>;
  }
  return (
    <ScrollCue note>
      <table className={styles.table}>
        <caption className={styles.caption}>Caches on the graph</caption>
        <thead>
          <tr>
            <th scope="col">Cache</th>
            <th scope="col">Holds</th>
            <th scope="col">For how long</th>
            <th scope="col">One copy per</th>
            <th scope="col">Emptied by</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <Row key={row.id} lens={lens} model={model} purgeHref={purgeHref} row={row} />
          ))}
        </tbody>
      </table>
    </ScrollCue>
  );
}
