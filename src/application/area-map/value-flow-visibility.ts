import type { LandscapeValueFlow } from '@/domain/landscape';

import type { ValueFlowConnection } from './value-flow-connections';
import type { ValueFlowNode } from './value-flow-system';

/** Match an authored overview exchange through collapsed systems and privately folded resources. */
export function overviewConnection(
  edge: ValueFlowConnection,
  nodes: ReadonlyMap<string, ValueFlowNode>,
  overview: LandscapeValueFlow['overview'],
): NonNullable<LandscapeValueFlow['overview']>[number] | undefined {
  return overview?.find(
    (connection) =>
      connection.kind === edge.kind &&
      nodes.get(edge.from)?.members.includes(connection.from) === true &&
      nodes.get(edge.to)?.members.includes(connection.to) === true,
  );
}

/** This is a reading aid, not an assertion that selected arrows form an execution sequence. */
function preference(
  edge: ValueFlowConnection,
  nodes: ReadonlyMap<string, ValueFlowNode>,
  summaries: LandscapeValueFlow['summaries'],
): number {
  const from = nodes.get(edge.from);
  const to = nodes.get(edge.to);
  const explained = summaries?.some((summary) =>
    edge.relations.some(
      (relation) =>
        relation.from === summary.from && relation.to === summary.to && edge.kind === summary.kind,
    ),
  );
  // Shared infrastructure must not become the convenient bridge between business services.
  const external = from?.component.kind === 'external' || to?.component.kind === 'external';
  return (
    Number(external) * 8 + Number(explained !== true) * 2 + Number(from?.systemId !== to?.systemId)
  );
}

function includeTopicSides(
  chosen: ReadonlySet<string>,
  edges: readonly ValueFlowConnection[],
  nodes: readonly ValueFlowNode[],
): ReadonlySet<string> {
  const selected = new Set(chosen);
  for (const node of nodes.filter((item) => !item.collapsed && item.component.kind === 'queue')) {
    for (const side of ['from', 'to'] as const) {
      const candidates = edges.filter((edge) => edge.kind === 'message' && edge[side] === node.id);
      if (candidates.some((edge) => selected.has(edge.id))) continue;
      const first = candidates[0];
      if (first !== undefined) selected.add(first.id);
    }
  }
  return selected;
}

/** Keep the core, then one recorded route into it for each reachable card. Never invent a missing link. */
export function defaultValueFlowConnections(
  edges: readonly ValueFlowConnection[],
  nodes: readonly ValueFlowNode[],
  summaries: LandscapeValueFlow['summaries'],
  overview?: LandscapeValueFlow['overview'],
): ReadonlySet<string> {
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const considered = edges.map((edge) => {
    const crossSystem = byId.get(edge.from)?.systemId !== byId.get(edge.to)?.systemId;
    const secondary =
      overview !== undefined &&
      crossSystem &&
      overviewConnection(edge, byId, overview) === undefined;
    return secondary ? { ...edge, supporting: true } : edge;
  });
  const candidates = considered.filter(
    (edge) =>
      overview === undefined ||
      byId.get(edge.from)?.systemId === byId.get(edge.to)?.systemId ||
      overviewConnection(edge, byId, overview) !== undefined,
  );
  const ranked = candidates
    .filter((edge) => edge.platform !== true || !edge.supporting)
    .toSorted((a, b) => {
      const difference = preference(a, byId, summaries) - preference(b, byId, summaries);
      return difference === 0 ? a.id.localeCompare(b.id) : difference;
    });
  const core = considered.filter((edge) => !edge.supporting);
  const selected = new Set(core.map((edge) => edge.id));
  const reached = new Set(core.flatMap((edge) => [edge.from, edge.to]));
  const remaining = new Set(nodes.map((node) => node.id).filter((id) => !reached.has(id)));
  while (remaining.size > 0) {
    const next = ranked.find((edge) => reached.has(edge.from) !== reached.has(edge.to));
    if (next === undefined) {
      // Preserve a disconnected recorded group as a group; do not join it to an unrelated flow.
      const root = [...remaining].toSorted((a, b) => a.localeCompare(b))[0];
      if (root !== undefined) reached.add(root);
    } else {
      selected.add(next.id);
      reached.add(next.from);
      reached.add(next.to);
    }
    for (const id of reached) remaining.delete(id);
  }
  // A visible shared provider can have one quiet explanation; it must not join business groups.
  for (const node of nodes.filter(
    (item) => !item.collapsed && item.component.kind === 'external',
  )) {
    const edge = candidates.find(
      (candidate) => candidate.platform === true && candidate.to === node.id,
    );
    if (edge !== undefined) selected.add(edge.id);
  }
  return includeTopicSides(selected, ranked, nodes);
}
