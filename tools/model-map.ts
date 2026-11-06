// Canonical map inspection, shared by the CLI and bulk receipts over one loaded index.
import type { ModelEdge, ModelIndex } from '@/application/model-index';
import type { ModelEntity, ModelGap } from '@/domain/workspace-model';

interface ShownModelFact {
  readonly fact: ModelEntity;
  readonly sources: ReturnType<ModelIndex['cites']>;
  readonly out: readonly ModelEdge[];
  readonly in: readonly ModelEdge[];
  readonly handlers: readonly string[];
  readonly gaps: ReturnType<ModelIndex['gaps']>;
  readonly freshness: ReturnType<ModelIndex['freshness']>;
  readonly href: string;
}
function groupedEdges(
  records: readonly ModelEdge[],
  keys: (edge: ModelEdge) => readonly (string | null)[],
): ReadonlyMap<string, readonly ModelEdge[]> {
  const groups = new Map<string, ModelEdge[]>();
  for (const record of records) {
    for (const key of new Set(keys(record))) {
      if (key === null) continue;
      const group = groups.get(key) ?? [];
      group.push(record);
      groups.set(key, group);
    }
  }
  return groups;
}
function groupedGaps(index: ModelIndex): ReadonlyMap<string, readonly ModelGap[]> {
  const groups = new Map<string, ModelGap[]>();
  for (const gap of index.gaps()) {
    const keys = new Set([gap.id]);
    let node = index.get(gap.id);
    while (node !== null) {
      keys.add(node.id);
      node = node.parent === null ? null : index.get(node.parent);
    }
    for (const key of keys) {
      const group = groups.get(key) ?? [];
      group.push(gap);
      groups.set(key, group);
    }
  }
  return groups;
}
/** Build once; every show uses the same ordinary canonical identity and execution queries. */
export function modelMapOf(index: ModelIndex): {
  readonly show: (id: string) => ShownModelFact | undefined;
} {
  const edges = index.edges();
  const gaps = groupedGaps(index);
  const outgoing = groupedEdges(edges, (edge) => [edge.from, edge.site, edge.handler, edge.entry]);
  const incoming = groupedEdges(edges, (edge) => [edge.to, edge.via]);
  const handlers = new Map<string, string[]>();
  for (const node of index.entities.filter((entity) => entity.kind === 'handler')) {
    const entry = typeof node.data.on === 'string' ? index.get(node.data.on) : null;
    const key = entry?.id ?? '';
    const group = handlers.get(key) ?? [];
    group.push(node.id);
    handlers.set(key, group);
  }
  return {
    show: (id) => {
      const fact = index.get(id);
      return fact === null
        ? undefined
        : {
            fact,
            sources: index.cites(fact.id),
            out: outgoing.get(fact.id) ?? [],
            in: incoming.get(fact.id) ?? [],
            handlers: fact.kind === 'handler' ? [fact.id] : (handlers.get(fact.id) ?? []),
            gaps: gaps.get(fact.id) ?? [],
            freshness: index.freshness(fact.id),
            href: index.href(fact.id),
          };
    },
  };
}
