import type { Model } from '@/application/plan/derive';
import type { Mode } from '@/application/plan/derive-core';
import { callersOf, interfaceEndpoints, sharedFacts } from '@/application/plan-viz-endpoint';
import type { InterfaceNode } from '@/domain/plan/plan-graph';

import { EndpointRow } from './endpoint-row';
import { FilterableGroups, type FilterGroup } from './filterable-groups.client';
import { InterfaceHead } from './interface-group';

/** The filter box shows past this many endpoints. */
const FILTER_FROM = 7;

interface Props {
  readonly model: Model;
  readonly ifcs: readonly InterfaceNode[];
  readonly mode?: Mode;
  readonly flowHref?: string | undefined;
}

function groupOf(
  { model, mode = 'diff', flowHref }: Omit<Props, 'ifcs'>,
  ifc: InterfaceNode,
): FilterGroup | null {
  const eps = interfaceEndpoints(model, ifc.id, mode);
  if (eps.length === 0) return null;
  const shared = sharedFacts(eps);
  return {
    key: ifc.id,
    head: <InterfaceHead eps={eps} ifc={ifc} mode={mode} model={model} />,
    rows: eps.map((ep) => ({
      key: ep.id,
      search: [
        ep.sig,
        ep.summary,
        ep.id,
        ep.request,
        ep.response,
        ...callersOf(model, ep.id, mode).map((c) => model.label(c.svc)),
      ]
        .filter((x) => x !== undefined)
        .join(' ')
        .toLowerCase(),
      node: <EndpointRow ep={ep} flowHref={flowHref} mode={mode} model={model} shared={shared} />,
    })),
  };
}

/** The interfaces of a service as groups of endpoint rows, with a filter box once there are many. */
export function ApiGroups({ ifcs, ...rest }: Props) {
  const groups = ifcs.map((ifc) => groupOf(rest, ifc)).filter((g) => g !== null);
  const total = groups.reduce((n, g) => n + g.rows.length, 0);
  if (total === 0) return null;
  return <FilterableGroups filter={total >= FILTER_FROM} groups={groups} />;
}
