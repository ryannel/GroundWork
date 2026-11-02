import type { AreaView } from '@/application/workspace-area';
import type { LandscapeValueFlow } from '@/domain/landscape';

import { cardLayout } from './card-geometry';
import {
  connectionSummary,
  combinedConnectionSummary,
  connectionDetails,
} from './connection-summary';
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
        if (row.kind === 'api') {
          return row.surface.id === id ||
            row.surface.endpoints.some((endpoint) => endpoint.id === id)
            ? [{ id: row.surface.id, y: node.y + row.centre }]
            : [];
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
  return {
    endpoint,
    source: rowOf(from, topic ?? (connection.kind === 'data' ? connection.to : connection.from)),
    target: rowOf(to, endpoint ?? topic ?? connection.to),
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

/** Keep exact direction and row identities when folding resources into their service cards. */
export function valueFlowConnections(
  narrative: LandscapeValueFlow,
  nodes: readonly ValueFlowNode[],
  technical: AreaView['technicalRelationships'],
  platform: ReadonlySet<string> = new Set(),
): readonly ValueFlowConnection[] {
  const components = nodes.flatMap((node) => [
    node.component,
    ...(node.component.attachments ?? []),
  ]);
  const main = narrative.connections.flatMap((connection) => {
    const recorded = technical.find(
      (edge) =>
        edge.from === connection.from && edge.to === connection.to && edge.kind === connection.kind,
    );
    // A consumer uses its publisher/topic, while the arrow still follows event delivery.
    // Publication into an explicit topic keeps its recorded dependency direction.
    const usage =
      recorded ??
      (connection.kind === 'message' &&
      components.find((component) => component.id === connection.to)?.kind !== 'queue'
        ? { usageFrom: connection.to, usageTo: connection.from }
        : {});
    const edge = project(
      {
        ...connection,
        ...usageOf(usage),
        supporting: false,
        detail: `${connection.label}. Evidence: ${connection.evidence.join(', ')}.`,
      },
      nodes,
    );
    return edge === undefined ? [] : [edge];
  });
  const pairs = new Set(main.map((edge) => `${edge.from}|${edge.to}|${edge.kind}`));
  const exact = technical.flatMap((connection) => {
    const edge = project(
      { ...connection, evidence: [], supporting: true, platform: platform.has(connection.to) },
      nodes,
    );
    if (edge === undefined) return [];
    const summaries = edge.targetY === undefined ? narrative.summaries : [];
    return [
      {
        ...edge,
        label: connectionSummary(connection, components, summaries),
        supporting: !pairs.has(`${edge.from}|${edge.to}|${edge.kind}`),
      },
    ];
  });
  const grouped = new Map<string, ValueFlowConnection[]>();
  for (const edge of [...main, ...exact]) {
    grouped.set(edge.id, [...(grouped.get(edge.id) ?? []), edge]);
  }
  return [...grouped]
    .map(([id, edges]) => {
      const first = edges[0];
      if (first === undefined) throw new Error('A connection group must contain an edge.');
      const primary = edges.find((edge) => !edge.supporting) ?? first;
      const label = primary.supporting ? combinedConnectionSummary(edges) : primary.label;
      return {
        ...primary,
        id: `value:${id}`,
        label,
        detail: connectionDetails(label, edges),
        relations: edges.flatMap((edge) => edge.relations),
        platform: edges.every((edge) => edge.platform === true),
      };
    })
    .toSorted((a, b) =>
      Number(a.supporting) - Number(b.supporting) === 0
        ? a.id.localeCompare(b.id)
        : Number(a.supporting) - Number(b.supporting),
    );
}
