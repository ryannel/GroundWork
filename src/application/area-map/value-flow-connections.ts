import type { AreaView } from '@/application/workspace-area';
import { landscapeCountCaption } from '@/application/workspace-landscape-areas';

import { cardLayout } from './card-geometry';
import { combinedConnectionSummary, connectionDetails } from './connection-summary';
import type { ValueFlowNode } from './value-flow-system';

interface Connection {
  readonly from: string;
  readonly to: string;
  readonly usageFrom?: string;
  readonly usageTo?: string;
  readonly kind: 'api' | 'message' | 'data' | 'membership';
  readonly directed?: boolean;
  readonly label: string;
  readonly detail: string;
  readonly evidence: readonly string[];
  readonly endpointId?: string | null;
  readonly topicId?: string;
  readonly supporting: boolean;
  readonly platform?: boolean;
}

export interface ValueFlowConnection extends Connection {
  readonly id: string;
  readonly sourceY?: number;
  readonly targetY?: number;
  readonly surfaceId?: string;
  readonly relations: readonly {
    readonly from: string;
    readonly to: string;
    readonly usageFrom?: string;
    readonly usageTo?: string;
    readonly endpointId?: string | null;
  }[];
}

function rowOf(node: ValueFlowNode, id: string | undefined) {
  if (id === undefined || node.open !== true) return null;
  return (
    cardLayout(node.component, true)
      .sections.flatMap((section) => section.rows)
      .flatMap((row) => {
        if (row.kind === 'endpoint') {
          return row.endpoint.id === id ? [{ id, y: node.y + row.centre }] : [];
        }
        if (row.kind === 'api') {
          return row.surface.id === id ? [{ id: row.surface.id, y: node.y + row.centre }] : [];
        }
        return row.resource.id === id ? [{ id, y: node.y + row.centre }] : [];
      })[0] ?? null
  );
}

function connectionRows(connection: Connection, from: ValueFlowNode, to: ValueFlowNode) {
  const endpoint =
    connection.endpointId ??
    to.component.endpoints.find((item) => connection.evidence.includes(item.id))?.id;
  const topic =
    connection.topicId ??
    from.component.attachments?.find((item) => item.id === connection.from && item.kind === 'queue')
      ?.id;
  const sourceResource = connection.kind === 'data' ? connection.to : connection.from;
  return {
    endpoint,
    source: rowOf(
      from,
      from.component.category === 'group' ? connection.from : (topic ?? sourceResource),
    ),
    target: rowOf(
      to,
      to.component.category === 'group' ? connection.to : (endpoint ?? topic ?? connection.to),
    ),
  };
}

/** Usage direction follows the dependency, separately from the arrow's information direction. */
function usageOf(
  connection: Pick<Connection, 'usageFrom' | 'usageTo'>,
  resolve: (id: string) => string = (id) => id,
) {
  return {
    ...(connection.usageFrom === undefined ? {} : { usageFrom: resolve(connection.usageFrom) }),
    ...(connection.usageTo === undefined ? {} : { usageTo: resolve(connection.usageTo) }),
  };
}

function project(
  connection: Connection,
  nodes: readonly ValueFlowNode[],
): ValueFlowConnection | undefined {
  const from = nodes.find((node) => node.members.includes(connection.from));
  const to = nodes.find((node) => node.members.includes(connection.to));
  if (from === undefined || to === undefined || from.id === to.id) return undefined;
  const { endpoint, source, target } = connectionRows(connection, from, to);
  const usage = usageOf(connection);
  const projectedUsage = usageOf(
    connection,
    (id) => nodes.find((node) => node.members.includes(id))?.id ?? id,
  );
  return {
    ...connection,
    from: from.id,
    to: to.id,
    id: `${from.id}|${to.id}|${connection.kind}|${source?.id ?? ''}|${target?.id ?? ''}`,
    ...(source === null ? {} : { sourceY: source.y }),
    ...(target === null ? {} : { targetY: target.y, surfaceId: target.id }),
    relations: [
      { from: connection.from, to: connection.to, endpointId: endpoint ?? null, ...usage },
      { from: from.id, to: to.id, endpointId: endpoint ?? null, ...projectedUsage },
    ],
  };
}

/** One line per pair between whole-system cards, counted; record names once a card is opened. */
export function valueFlowConnections(
  nodes: readonly ValueFlowNode[],
  technical: AreaView['technicalRelationships'],
  platform: ReadonlySet<string> = new Set(),
): readonly ValueFlowConnection[] {
  const collapsed = new Set(nodes.flatMap((node) => (node.collapsed ? [node.id] : [])));
  const grouped = new Map<string, ValueFlowConnection[]>();
  for (const connection of technical) {
    const edge = project(
      { ...connection, evidence: [], supporting: true, platform: platform.has(connection.to) },
      nodes,
    );
    if (edge === undefined) continue;
    const key =
      collapsed.has(edge.from) && collapsed.has(edge.to)
        ? `${[edge.from, edge.to].toSorted((a, b) => a.localeCompare(b)).join('|')}|${edge.kind}`
        : edge.id;
    grouped.set(key, [...(grouped.get(key) ?? []), edge]);
  }
  return [...grouped]
    .map(([id, edges]) => {
      const first = edges[0];
      if (first === undefined) throw new Error('A connection group must contain an edge.');
      const counted = collapsed.has(first.from) && collapsed.has(first.to);
      const out = edges.filter((edge) => edge.from === first.from).length;
      const label = counted
        ? landscapeCountCaption(out, edges.length)
        : combinedConnectionSummary(edges);
      return {
        ...first,
        id: `value:${id}`,
        label,
        detail: connectionDetails(label, edges),
        relations: edges.flatMap((edge) => edge.relations),
        platform: edges.every((edge) => edge.platform === true),
      };
    })
    .toSorted((a, b) => a.id.localeCompare(b.id));
}
