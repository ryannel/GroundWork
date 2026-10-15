import type { ReactNode } from 'react';

import type { Model } from '@/application/plan/derive';
import type { Mode } from '@/application/plan/derive-core';
import {
  callersOf,
  idemWord,
  pathParams,
  typedParams,
  type Shared,
} from '@/application/plan-viz-endpoint';
import { teamOf } from '@/application/plan-viz-teams';
import type { EndpointNode } from '@/domain/plan/plan-graph';
import { EntityChip } from '@/features/plan/common/entity-chip';
import { TeamDot } from '@/features/plan/common/team-dot';
import { FieldTable } from '@/features/plan/viz/field-table/field-table';
import { GoLink } from '@/features/plan/viz/go-link/go-link';

import styles from './endpoint-lines.module.css';
import { ErrorsLine, ParamLine } from './endpoint-parts';

interface LinesProps {
  readonly model: Model;
  readonly ep: EndpointNode;
  readonly mode: Mode;
  readonly shared: Shared;
  readonly flowHref?: string | undefined;
}

function Line({ label, children }: { readonly label: string; readonly children: ReactNode }) {
  return (
    <div className={styles.line}>
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

function Shape({
  model,
  schemaId,
  mode,
}: {
  readonly model: Model;
  readonly schemaId: string;
  readonly mode: Mode;
}) {
  return (
    <div className={styles.shape}>
      <EntityChip id={schemaId} model={model} />
      <FieldTable
        changes={false}
        density="compact"
        head={false}
        mode={mode}
        model={model}
        schemaId={schemaId}
      />
    </div>
  );
}

function ParamLines({ model, ep, mode }: LinesProps) {
  const names = pathParams(ep.sig);
  const path = typedParams(model, ep, { names: names.path, mode });
  const query = typedParams(model, ep, { names: names.query, mode });
  return (
    <>
      {path.length === 0 ? null : (
        <Line label="Path">
          <ParamLine kind="path" params={path} />
        </Line>
      )}
      {query.length === 0 ? null : (
        <Line label="Query">
          <ParamLine kind="query" params={query} />
        </Line>
      )}
    </>
  );
}

function ShapeLines({ model, ep, mode }: LinesProps) {
  const errors = ep.errors ?? [];
  return (
    <>
      {ep.request === undefined ? null : (
        <Line label="Body">
          <Shape mode={mode} model={model} schemaId={ep.request} />
        </Line>
      )}
      {ep.response === undefined ? null : (
        <Line label="Returns">
          <Shape mode={mode} model={model} schemaId={ep.response} />
        </Line>
      )}
      {errors.length === 0 ? null : (
        <Line label="Errors">
          <ErrorsLine errors={errors} />
        </Line>
      )}
    </>
  );
}

function FactLines({ ep, shared }: LinesProps) {
  const auth = ep.auth !== undefined && ep.auth !== shared.auth ? ep.auth : null;
  const idem =
    ep.idempotent !== undefined && ep.idempotent !== shared.idempotent ? ep.idempotent : null;
  return (
    <>
      {auth === null ? null : (
        <Line label="Auth">
          <span className={styles.mono}>{auth}</span>
        </Line>
      )}
      {idem === null ? null : <Line label="Idempotent">{idemWord(idem)}</Line>}
    </>
  );
}

function VersionLines({ model, ep, mode }: LinesProps) {
  const v = model.versions(ep.id);
  const after = mode === 'asIs' ? null : v.replacedBy;
  return (
    <>
      {v.supersedes === null ? null : (
        <Line label="Replaces">
          <EntityChip id={v.supersedes} model={model} />
        </Line>
      )}
      {after === null ? null : (
        <Line label="Replaced by">
          <EntityChip id={after} model={model} />
        </Line>
      )}
    </>
  );
}

function CalledBy({ model, ep, mode, flowHref }: LinesProps) {
  const callers = callersOf(model, ep.id, mode);
  if (callers.length === 0) return null;
  return (
    <Line label="Called by">
      {callers.map(({ svc, steps }) => {
        const team = teamOf(model, svc);
        return (
          <div className={styles.by} key={svc}>
            {team === null ? null : <TeamDot model={model} teamId={team} />}
            <EntityChip id={svc} model={model} status="existing" />
            <span className={styles.faint}>in</span>
            {steps.slice(0, 2).map((s) => (
              <EntityChip id={s} key={s} model={model} status="existing" />
            ))}
            {steps.length > 2 ? <span className={styles.faint}>+{steps.length - 2}</span> : null}
            {flowHref === undefined ? null : <GoLink href={flowHref} title="Open the flows page" />}
          </div>
        );
      })}
    </Line>
  );
}

/** What an open endpoint says: parameters, body and returns, errors, auth, versions and who calls it. */
export function EndpointLines(props: LinesProps) {
  return (
    <dl className={styles.lines}>
      <ParamLines {...props} />
      <ShapeLines {...props} />
      <FactLines {...props} />
      <VersionLines {...props} />
      <CalledBy {...props} />
    </dl>
  );
}
