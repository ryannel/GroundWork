import type { ValueFlowConnection } from './value-flow-connections';
import type { ValueFlowNode } from './value-flow-system';

/** This is a reading aid, not an assertion that selected arrows form an execution sequence. */
function preference(edge: ValueFlowConnection, nodes: ReadonlyMap<string, ValueFlowNode>): number {
  const from = nodes.get(edge.from);
  const to = nodes.get(edge.to);
  // Shared infrastructure must not become the convenient bridge between business services.
  const external = from?.component.kind === 'external' || to?.component.kind === 'external';
  return Number(external) * 8 + Number(from?.systemId !== to?.systemId);
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
): ReadonlySet<string> {
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const ranked = edges
    .filter((edge) => edge.platform !== true || !edge.supporting)
    .toSorted((a, b) => {
      const difference = preference(a, byId) - preference(b, byId);
      return difference === 0 ? a.id.localeCompare(b.id) : difference;
    });
  const core = edges.filter((edge) => !edge.supporting);
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
    const edge = edges.find((candidate) => candidate.platform === true && candidate.to === node.id);
    if (edge !== undefined) selected.add(edge.id);
  }
  return includeTopicSides(selected, ranked, nodes);
}
