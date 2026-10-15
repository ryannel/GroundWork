import {
  pathParts,
  parseSig,
  type Param,
  type PathPart,
  type Sig,
} from '@/application/plan-viz-endpoint';
import type { EndpointNode } from '@/domain/plan/plan-graph';

import styles from './endpoint-parts.module.css';

// A path may break after a slash, never inside a segment or a {param}.
const breakable = (text: string): string => text.replaceAll('/', '/\u200B');

function Part({ part }: { readonly part: PathPart }) {
  return part.param ? (
    <span className={styles.param}>{part.text}</span>
  ) : (
    <span>{breakable(part.text)}</span>
  );
}

function Path({ path }: { readonly path: string }) {
  const { parts, query } = pathParts(path);
  return (
    <span className={styles.path}>
      {parts.map((p) => (
        <Part key={p.key} part={p} />
      ))}
      {query.length === 0 ? null : (
        <span className={styles.query}>
          {query.map((p) => (
            <Part key={p.key} part={p} />
          ))}
        </span>
      )}
    </span>
  );
}

function SigLine({ sig }: { readonly sig: Sig }) {
  return (
    <span className={styles.sig}>
      {sig.verbs.map((v) => (
        <span className={styles.verb} data-verb={v} key={v}>
          {v}
        </span>
      ))}
      <Path path={sig.path} />
    </span>
  );
}

/** The signature lines of an endpoint: a verb badge and a path each; several signatures stack. */
export function EndpointSig({ ep }: { readonly ep: Pick<EndpointNode, 'id' | 'sig'> }) {
  const sigs = parseSig(ep.sig);
  if (sigs.length === 0) return <span className={styles.path}>{ep.id}</span>;
  return (
    <span className={styles.sigs}>
      {sigs.map((s) => (
        <SigLine key={`${s.verbs.join('|')} ${s.path}`} sig={s} />
      ))}
    </span>
  );
}

function Sep() {
  return (
    <span aria-hidden="true" className={styles.sep}>
      ·
    </span>
  );
}

function TypeNote({ param, kind }: { readonly param: Param; readonly kind: 'path' | 'query' }) {
  if (param.type !== null) return <span className={styles.faint}>{param.type}</span>;
  return kind === 'path' ? <span className={styles.faint}>type not recorded</span> : null;
}

/** Parameters with their types; a path parameter with none says so. */
export function ParamLine({
  params,
  kind,
}: {
  readonly params: readonly Param[];
  readonly kind: 'path' | 'query';
}) {
  return (
    <span className={styles.items}>
      {params.map((p, i) => (
        <span key={p.name}>
          {i > 0 ? <Sep /> : null}
          <span className={styles.mono}>{p.name}</span> <TypeNote kind={kind} param={p} />
        </span>
      ))}
    </span>
  );
}

/** "409 stale_price — when the price moved", one per error. */
export function ErrorsLine({ errors }: { readonly errors: NonNullable<EndpointNode['errors']> }) {
  return (
    <span className={styles.items}>
      {errors.map((e, i) => (
        <span key={`${String(e.status)}${e.code ?? ''}`}>
          {i > 0 ? <Sep /> : null}
          <span className={styles.mono}>
            {e.status}
            {e.code === undefined ? '' : ` ${e.code}`}
          </span>
          {e.when === undefined ? null : <span className={styles.faint}> — {e.when}</span>}
        </span>
      ))}
    </span>
  );
}
