import type { ScanDocument, SemanticEdge, SemanticNode } from '@/domain/scan/scan.generated';

import { expressionSpelling } from './scan-semantic-expression';

export interface SemanticGraph {
  readonly document: ScanDocument;
  readonly nodes: readonly SemanticNode[];
  readonly edges: readonly SemanticEdge[];
  readonly byId: ReadonlyMap<string, SemanticNode>;
  readonly outgoing: ReadonlyMap<string, readonly SemanticEdge[]>;
}

export function semanticGraph(document: ScanDocument): SemanticGraph {
  const nodes = (document.semantic ?? []).filter(
    (item): item is SemanticNode => item.kind === 'semantic_node',
  );
  const edges = (document.semantic ?? []).filter(
    (item): item is SemanticEdge => item.kind === 'semantic_edge',
  );
  const outgoing = new Map<string, SemanticEdge[]>();
  for (const edge of edges) {
    const group = outgoing.get(edge.from) ?? [];
    group.push(edge);
    outgoing.set(edge.from, group);
  }
  return { document, nodes, edges, byId: new Map(nodes.map((node) => [node.id, node])), outgoing };
}

export function targets(
  graph: SemanticGraph,
  node: SemanticNode | undefined,
  relation: SemanticEdge['relation'],
): SemanticNode[] {
  if (!node) return [];
  return (graph.outgoing.get(node.id) ?? [])
    .filter((edge) => edge.relation === relation)
    .toSorted((left, right) => (left.position ?? 0) - (right.position ?? 0))
    .flatMap((edge) => {
      const target = graph.byId.get(edge.to);
      return target ? [target] : [];
    });
}

export function ownedNodes(
  graph: SemanticGraph,
  owner: string | undefined,
  kind?: SemanticNode['nodeKind'],
): SemanticNode[] {
  return graph.nodes.filter(
    (node) => node.owner === owner && (kind === undefined || node.nodeKind === kind),
  );
}

export function namedFunction(graph: SemanticGraph, name: string): SemanticNode | undefined {
  return graph.nodes.find((node) => node.nodeKind === 'function' && node.name === name);
}

export function namedCalls(
  graph: SemanticGraph,
  owner: string | undefined,
  callee: string,
): SemanticNode[] {
  return ownedNodes(graph, owner, 'call').filter((node) =>
    targets(graph, node, 'callee').some(
      (target) => expressionSpelling(graph, target) === callee.replaceAll(/\s+/gu, ''),
    ),
  );
}

const TREE: readonly SemanticEdge['relation'][] = [
  'contains',
  'ast_child',
  'statement',
  'body',
  'consequent',
  'otherwise',
  'catch',
  'finally',
];

export function descendants(
  graph: SemanticGraph,
  node: SemanticNode | undefined,
  relations: readonly SemanticEdge['relation'][] = TREE,
): SemanticNode[] {
  if (!node) return [];
  const seen = new Set<string>();
  const pending = [node.id];
  while (pending.length > 0) {
    const id = pending.pop();
    if (id === undefined || seen.has(id)) continue;
    seen.add(id);
    for (const edge of graph.outgoing.get(id) ?? []) {
      if (relations.includes(edge.relation)) pending.push(edge.to);
    }
  }
  return [...seen].flatMap((id) => {
    const target = graph.byId.get(id);
    return target ? [target] : [];
  });
}

export function includesNode(
  graph: SemanticGraph,
  ancestor: SemanticNode | undefined,
  child: SemanticNode | undefined,
): boolean {
  return child !== undefined && descendants(graph, ancestor).some((node) => node.id === child.id);
}

export function objectField(
  graph: SemanticGraph,
  object: SemanticNode | undefined,
  name: string,
): SemanticNode | undefined {
  return targets(graph, object, 'property').find(
    (property) =>
      property.name === name ||
      targets(graph, property, 'key').some((key) => key.name === name || key.value === name),
  );
}

export function fieldValue(
  graph: SemanticGraph,
  field: SemanticNode | undefined,
): SemanticNode | undefined {
  return (
    targets(graph, field, 'initializer')[0] ??
    targets(graph, field, 'value')[0] ??
    targets(graph, field, 'assigned_value')[0]
  );
}
