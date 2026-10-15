import type { Model } from '@/application/plan/derive';
import { chipInfo } from '@/application/plan-chips';
import type { FetchFieldView, FetchRowView } from '@/application/plan-viz-waterfall-view';
import { EntityChip } from '@/features/plan/common/entity-chip';
import { TeamTag } from '@/features/plan/common/team-dot';

import { FetchBar } from './fetch-bar';
import styles from './fetch-row.module.css';
import { MarkTag } from './mark-tag';
import { Row } from './row';

interface FetchRowProps {
  readonly model: Model;
  readonly row: FetchRowView;
}

function Field({ field }: { readonly field: FetchFieldView }) {
  const router = field.router;
  const named =
    field.field === null ? (
      <span
        className={styles.field}
        data-router={router === null ? undefined : ''}
        title={router?.tip}
      >
        {field.name}
      </span>
    ) : (
      <button
        className={styles.field}
        data-inspect={field.field}
        data-router={router === null ? undefined : ''}
        title={router?.tip}
        type="button"
      >
        {field.name}
      </button>
    );
  if (router === null) return named;
  return (
    <span className={styles.routed}>
      {named}
      <span className={styles.for}>{router.label}</span>
    </span>
  );
}

function Reads({ model, row }: FetchRowProps) {
  if (row.reads.length === 0) return null;
  return (
    <span className={styles.reads}>
      <span className={styles.key}>reads</span>
      {row.reads.map((r) => (
        <span className={styles.read} data-skipped={r.skipped ? '' : undefined} key={r.store}>
          <EntityChip id={r.store} model={model} status="existing" />
          {r.mark === null ? null : <MarkTag mark={r.mark} />}
        </span>
      ))}
    </span>
  );
}

function Sign({ change }: { readonly change: FetchRowView['change'] }) {
  if (change === null || change.kind === 'moved') return null;
  const add = change.kind === 'add';
  return (
    <span
      className={styles.sign}
      data-kind={change.kind}
      title={add ? 'new in this plan' : 'goes away in this plan'}
    >
      {add ? '+' : '−'}
    </span>
  );
}

function Who({ model, row }: FetchRowProps) {
  const was = row.change?.kind === 'moved' ? row.change.was : undefined;
  return (
    <>
      <Sign change={row.change} />
      <span className={styles.layer}>
        <span aria-hidden="true">⬡</span> subgraph
      </span>
      <EntityChip id={row.subgraph} model={model} status="existing" />
      {row.team === null ? null : <TeamTag model={model} teamId={row.team} />}
      {was === undefined ? null : (
        <span className={styles.was}>
          was{' '}
          <s>
            <EntityChip id={was} model={model} status="existing" />
          </s>
        </span>
      )}
    </>
  );
}

function What({ model, row }: FetchRowProps) {
  return (
    <>
      <span className={styles.fields}>
        <span className={styles.key}>returns</span>
        {row.fields.length === 0 ? (
          <span className={styles.nothing}>(nothing of its own)</span>
        ) : (
          row.fields.map((f) => <Field field={f} key={f.name} />)
        )}
        {row.batch === null ? null : (
          <span
            className={styles.batch}
            data-warn={row.batch.warn ? '' : undefined}
            title={row.batch.title}
          >
            {row.batch.text}
          </span>
        )}
        {row.gateCache === null ? null : <MarkTag mark={row.gateCache} />}
      </span>
      <Reads model={model} row={row} />
      {row.blast === null ? null : <span className={styles.blast}>{row.blast}</span>}
    </>
  );
}

// One round-trip fetch: the subgraph that answers, the fields it returns, what it reads, and its bar.
export function FetchRow({ model, row }: FetchRowProps) {
  return (
    <Row
      change={row.change?.kind ?? null}
      fetchId={row.id}
      kind="fetch"
      lens={row.lens}
      state={row.state === 'skipped' ? 'skipped' : undefined}
      track={
        <FetchBar
          bar={row.bar}
          callsName={row.bar.calls === null ? null : chipInfo(model, row.bar.calls).label}
        />
      }
      what={<What model={model} row={row} />}
      who={<Who model={model} row={row} />}
    />
  );
}
