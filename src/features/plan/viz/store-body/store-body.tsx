import type { ReactNode } from 'react';

import type { Model } from '@/application/plan/derive';
import type { Mode } from '@/application/plan/derive-core';
import {
  accessRows,
  isPipe,
  recordsOf,
  relationships,
  storeGlance,
  storeNode,
} from '@/application/plan-viz-store';
import { countOf } from '@/application/plan-viz-text';
import { EntityChip } from '@/features/plan/common/entity-chip';
import { ServiceChip } from '@/features/plan/common/service-chip';
import { FieldTable } from '@/features/plan/viz/field-table/field-table';
import { SchemaHead } from '@/features/plan/viz/field-table/schema-head';
import { Badge } from '@/ui/badge';

import styles from './store-body.module.css';

const OPEN_RECORDS = 3;

interface StoreProps {
  readonly model: Model;
  readonly id: string;
  readonly mode?: Mode;
}

function Block({
  title,
  count,
  children,
}: {
  readonly title: string;
  readonly count?: number;
  readonly children: ReactNode;
}) {
  return (
    <section className={styles.block}>
      <h4 className={styles.title}>
        {title}
        {count === undefined ? null : <span className={styles.quiet}>{count}</span>}
      </h4>
      {children}
    </section>
  );
}

function Glance({ model, id, mode }: Required<StoreProps>) {
  const g = storeGlance(model, id, mode);
  if (g === null) return null;
  const parts: { key: string; node: ReactNode }[] = [];
  if (g.tech !== null && g.tech !== '')
    parts.push({ key: 'tech', node: <span className={styles.mono}>{g.tech}</span> });
  if (g.owner !== null) {
    parts.push({
      key: 'owner',
      node: (
        <>
          owned by <ServiceChip id={g.owner} model={model} />
        </>
      ),
    });
  }
  if (g.records > 0) parts.push({ key: 'records', node: countOf(g.records, 'record') });
  if (g.readers > 0)
    parts.push({ key: 'readers', node: `read by ${countOf(g.readers, 'other service')}` });
  return (
    <Block title="At a glance">
      <div className={styles.glance}>
        {parts.map((p) => (
          <span className={styles.part} key={p.key}>
            {p.node}
          </span>
        ))}
      </div>
    </Block>
  );
}

function Relationships({ model, id, mode }: Required<StoreProps>) {
  const rels = relationships(model, id, mode);
  if (rels.length === 0) return null;
  return (
    <Block title="Relationships">
      <div className={styles.rels}>
        {rels.map((r) => (
          <div className={styles.rel} key={r.key}>
            <button className={styles.field} data-inspect={r.from.id} type="button">
              {r.from.text}
            </button>
            <span aria-hidden="true">→</span>
            {r.to.id === null ? (
              <span className={styles.mono}>{r.to.text}</span>
            ) : (
              <button className={styles.field} data-inspect={r.to.id} type="button">
                {r.to.text}
              </button>
            )}
            {r.elsewhere === null ? null : <span className={styles.quiet}>in {r.elsewhere}</span>}
          </div>
        ))}
      </div>
    </Block>
  );
}

function Records({ model, id, mode }: Required<StoreProps>) {
  const list = recordsOf(model, id, mode);
  return (
    <Block count={list.length} title="Records">
      {list.length === 0 ? (
        <div className={styles.quiet}>No records recorded for this store.</div>
      ) : null}
      <div className={styles.records}>
        {list.map((s) => (
          <details className={styles.record} key={s.id} open={list.length <= OPEN_RECORDS}>
            <summary className={styles.summary}>
              <SchemaHead mode={mode} model={model} schemaId={s.id} />
            </summary>
            <FieldTable
              changes="auto"
              density="full"
              head={false}
              mode={mode}
              model={model}
              schemaId={s.id}
            />
          </details>
        ))}
      </div>
    </Block>
  );
}

function Access({ model, id, mode }: Required<StoreProps>) {
  const rows = accessRows(model, id, mode);
  if (rows.length === 0) return null;
  return (
    <Block title="Access">
      <div className={styles.scroll}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>service</th>
              <th>access</th>
              <th>through</th>
              <th>
                <span className={styles.hidden}>status</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr data-status={r.fresh ? 'added' : undefined} key={r.svc}>
                <td>
                  <ServiceChip id={r.svc} model={model} />
                </td>
                <td>{r.role}</td>
                <td>
                  {r.steps.length === 0 ? (
                    <span className={styles.quiet}>declared access</span>
                  ) : (
                    r.steps.map((s) => (
                      <EntityChip id={s} key={s} model={model} status="existing" />
                    ))
                  )}
                  {r.moreSteps > 0 ? <span className={styles.quiet}>+{r.moreSteps}</span> : null}
                </td>
                <td>{r.fresh ? <Badge tone="added">+ New</Badge> : null}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Block>
  );
}

interface StoreBodyProps extends StoreProps {
  /** The layer sections of a cache, which keep their own drawing. */
  readonly cache?: ReactNode;
  /** For a topic or queue: the events on it. */
  readonly topicEvents?: ReactNode;
}

/** A store in full: at a glance, how its records relate, the records and their fields, and who reads and writes it. */
export function StoreBody({ model, id, mode = 'diff', cache, topicEvents }: StoreBodyProps) {
  const store = storeNode(model, id, mode);
  if (store === null) return null;
  const pipe = isPipe(store);
  const all = { model, id, mode };
  return (
    <div className={styles.body}>
      <Glance {...all} />
      {store.kind === 'cache' ? cache : null}
      {pipe || store.kind === 'cache' ? null : <Relationships {...all} />}
      {pipe || store.kind === 'cache' ? null : <Records {...all} />}
      {pipe ? <Block title="Events on this topic">{topicEvents}</Block> : <Access {...all} />}
    </div>
  );
}
