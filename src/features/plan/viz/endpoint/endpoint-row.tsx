import type { Model } from '@/application/plan/derive';
import type { Mode } from '@/application/plan/derive-core';
import { callersOf, copyablePath, isRemoved, type Shared } from '@/application/plan-viz-endpoint';
import { sourceLabel } from '@/application/plan-viz-source';
import { countOf } from '@/application/plan-viz-text';
import type { EndpointNode } from '@/domain/plan/plan-graph';
import { EntityChip } from '@/features/plan/common/entity-chip';
import { ModelInline } from '@/features/plan/common/model-text';
import { StatusBadge } from '@/features/plan/common/status-badge';
import { CompatBadge } from '@/features/plan/viz/compat/compat';

import { CopyPath } from './copy-path.client';
import { EndpointBody, type LazyEndpoint } from './endpoint-body.client';
import { EndpointLines } from './endpoint-lines';
import { EndpointSig } from './endpoint-parts';
import styles from './endpoint-row.module.css';

export interface EndpointRowProps {
  readonly model: Model;
  readonly ep: EndpointNode;
  /** 'diff' marks what the plan changes; 'asIs' and 'toBe' draw one side. */
  readonly mode?: Mode;
  readonly open?: boolean;
  /** Facts its interface says once in the head (auth, idempotency); left out of the row. */
  readonly shared?: Shared;
  /** The page that draws the flows, for the "go" link beside each caller. */
  readonly flowHref?: string | undefined;
  /** Draws the body in the browser when the row first opens, rather than in the page. Ignored when open. */
  readonly lazy?: LazyEndpoint | undefined;
}

function Summary({
  model,
  ep,
  mode,
}: {
  readonly model: Model;
  readonly ep: EndpointNode;
  readonly mode: Mode;
}) {
  const callers = callersOf(model, ep.id, mode);
  const errs = ep.errors?.length ?? 0;
  const status = isRemoved(model, ep, mode) ? 'removed' : model.status(ep.id);
  return (
    <summary className={styles.summary}>
      <EndpointSig ep={ep} />
      <span className={styles.sum}>
        {ep.summary === undefined ? null : <ModelInline model={model} text={ep.summary} />}
      </span>
      <span className={styles.by}>
        {callers.slice(0, 3).map((c) => (
          <EntityChip id={c.svc} key={c.svc} model={model} status="existing" />
        ))}
        {callers.length > 3 ? <span className={styles.faint}>+{callers.length - 3}</span> : null}
      </span>
      <span className={styles.meta}>
        {errs > 0 ? <span className={styles.faint}>{countOf(errs, 'error')}</span> : null}
        {mode === 'diff' ? <StatusBadge status={status} /> : null}
        {mode === 'diff' ? <CompatBadge id={ep.id} model={model} quiet /> : null}
      </span>
    </summary>
  );
}

function Foot({ ep }: { readonly ep: EndpointNode }) {
  const path = copyablePath(ep);
  return (
    <div className={styles.foot}>
      {(ep.sources ?? [])
        .filter((s) => s.url !== '')
        .map((s) => (
          <a
            className={styles.source}
            href={s.url}
            key={s.url}
            rel="noopener noreferrer"
            target="_blank"
          >
            <span aria-hidden="true">⎇</span> {sourceLabel(s)}
          </a>
        ))}
      <span className={styles.grow} />
      {path === '' ? null : <CopyPath text={path} />}
      <button className={styles.open} data-inspect={ep.id} type="button">
        Open endpoint →
      </button>
    </div>
  );
}

const NOTHING_SHARED: NonNullable<EndpointRowProps['shared']> = {};

/** One endpoint, collapsed to a line (signature, summary, callers, errors, status) and opening to its body. */
export function EndpointRow({
  model,
  ep,
  mode = 'diff',
  open = false,
  shared = NOTHING_SHARED,
  flowHref,
  lazy,
}: EndpointRowProps) {
  const status = isRemoved(model, ep, mode) ? 'removed' : model.status(ep.id);
  const shown = mode === 'diff' ? status : null;
  return (
    <details className={styles.row} data-status={shown ?? 'existing'} open={open}>
      <Summary ep={ep} mode={mode} model={model} />
      <div className={styles.body}>
        {lazy === undefined || open ? (
          <EndpointLines ep={ep} flowHref={flowHref} mode={mode} model={model} shared={shared} />
        ) : (
          <EndpointBody flowHref={flowHref} id={ep.id} lazy={lazy} mode={mode} shared={shared} />
        )}
        <Foot ep={ep} />
      </div>
    </details>
  );
}
