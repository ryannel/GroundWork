import type { Model } from '@/application/plan/derive';
import type { Mode } from '@/application/plan/derive-core';
import {
  idemWord,
  interfaceEndpoints,
  sharedFacts,
  type Shared,
} from '@/application/plan-viz-endpoint';
import { teamOf } from '@/application/plan-viz-teams';
import { countOf } from '@/application/plan-viz-text';
import type { EndpointNode, InterfaceNode } from '@/domain/plan/plan-graph';
import { ModelInline } from '@/features/plan/common/model-text';
import { StatusBadge } from '@/features/plan/common/status-badge';
import { TeamDot } from '@/features/plan/common/team-dot';
import { CompatBadge } from '@/features/plan/viz/compat/compat';
import { Badge } from '@/ui/badge';

import { EndpointRow } from './endpoint-row';
import styles from './interface-group.module.css';

interface HeadProps {
  readonly model: Model;
  readonly ifc: InterfaceNode;
  readonly mode?: Mode;
  /** The endpoints it counts; its own when left out. */
  readonly eps?: readonly EndpointNode[];
  /** Leaves its one-line summary off. */
  readonly summary?: boolean;
}

/** The count, and what every endpoint shares, as one line: "staff SSO · idempotent · 2 endpoints". */
function factsOf(shared: Shared, count: number): string {
  const idem = shared.idempotent === undefined ? undefined : idemWord(shared.idempotent);
  return [shared.auth, idem, countOf(count, 'endpoint')].filter((x) => x !== undefined).join(' · ');
}

/** The group head: team dot, service, protocol and version, what every endpoint shares, the count, status, verdict. */
export function InterfaceHead({ model, ifc, mode = 'diff', eps, summary = true }: HeadProps) {
  const list = eps ?? interfaceEndpoints(model, ifc.id, mode);
  const team = teamOf(model, ifc.service);
  const proto = [ifc.protocol, ifc.version]
    .filter((x) => x !== undefined)
    .join(' ')
    .toUpperCase();
  // the verdict is said once: on the rows when they carry it, on the head only when they do not
  const rowsSay = list.some((e) => model.compat(e.id) !== null);
  const diff = mode === 'diff';
  return (
    <div className={styles.head}>
      <div className={styles.title}>
        {team === null ? null : <TeamDot model={model} teamId={team} />}
        <button className={styles.name} data-inspect={ifc.id} type="button">
          {model.label(ifc.service)}
        </button>
        {proto === '' ? null : <Badge>{proto}</Badge>}
        <span className={styles.facts}>{factsOf(sharedFacts(list), list.length)}</span>
        {diff ? <StatusBadge status={model.status(ifc.id)} /> : null}
        {diff && !rowsSay ? <CompatBadge id={ifc.id} model={model} quiet /> : null}
      </div>
      {summary && ifc.summary !== undefined ? (
        <div className={styles.summary}>
          <ModelInline model={model} text={ifc.summary} />
        </div>
      ) : null}
    </div>
  );
}

interface GroupProps {
  readonly model: Model;
  readonly ifc: InterfaceNode;
  readonly mode?: Mode;
  /** Draws the head; a service's page already names the interface. */
  readonly head?: boolean;
  /** Every row open: the page's choice for three endpoints or fewer. */
  readonly open?: boolean;
  readonly flowHref?: string | undefined;
  /** The model's address, to draw each closed row's body in the browser when it opens. */
  readonly src?: string | undefined;
}

/** An interface: its head, then one row per endpoint. Nothing when it has none. */
export function InterfaceGroup({
  model,
  ifc,
  mode = 'diff',
  head = true,
  open = false,
  flowHref,
  src,
}: GroupProps) {
  const eps = interfaceEndpoints(model, ifc.id, mode);
  if (eps.length === 0) return null;
  const shared = sharedFacts(eps);
  const lazy = src === undefined ? undefined : { src, ifc: ifc.id };
  return (
    <div className={styles.group}>
      {head ? <InterfaceHead eps={eps} ifc={ifc} mode={mode} model={model} /> : null}
      <div className={styles.list}>
        {eps.map((e) => (
          <EndpointRow
            ep={e}
            flowHref={flowHref}
            key={e.id}
            lazy={lazy}
            mode={mode}
            model={model}
            open={open}
            shared={shared}
          />
        ))}
      </div>
    </div>
  );
}
