import { scanReference, type ScanRecords } from './scan-records';
import type {
  ScanDocument,
  SemanticEdge,
  SemanticNode,
  SemanticRecord,
  Source,
} from './scan.generated';
import { semanticLineageErrors } from './semantic-lineage';
import { isSemanticOperator } from './semantic-operators';
import { semanticRoleErrors } from './semantic-relations';

interface Graph {
  readonly records: ScanRecords;
  readonly nodes: ReadonlyMap<string, SemanticNode>;
  readonly edges: readonly SemanticEdge[];
  readonly incoming: ReadonlyMap<string, readonly SemanticEdge[]>;
  readonly outgoing: ReadonlyMap<string, readonly SemanticEdge[]>;
  readonly parents: ReadonlyMap<string, string>;
  readonly operationOwners: ReadonlyMap<string, string>;
}

function provenanceErrors(record: SemanticRecord, graph: Graph): string[] {
  const owner = scanReference(graph.records, record.owner, 'summary');
  const source = scanReference(graph.records, record.source, 'source');
  if (!owner || !source) return [`${record.id}: semantic record needs summary owner and source`];
  const origin = scanReference(graph.records, owner.source, 'source');
  if (source.host !== owner.host) return [`${record.id}: semantic source/owner host mismatch`];
  if (!origin) return [`${record.id}: missing owner source`];
  const contained = source.lines[0] >= origin.lines[0] && source.lines[1] <= origin.lines[1];
  if (!sameDeclarationFile(origin, source) || !contained) {
    return [`${record.id}: semantic source outside owner declaration`];
  }
  return [];
}

function parentOwners(graph: Pick<Graph, 'nodes' | 'edges'>): ReadonlyMap<string, string> {
  const parents = new Map<string, string>();
  for (const edge of graph.edges) {
    if (
      !['contains', 'ast_child', 'scope', 'initializer', 'initialiser', 'continuation'].includes(
        edge.relation,
      )
    ) {
      continue;
    }
    const from = graph.nodes.get(edge.from);
    const to = graph.nodes.get(edge.to);
    if (from && to?.nodeKind === 'function' && from.owner !== to.owner) {
      parents.set(to.owner, from.owner);
    }
  }
  return parents;
}

function isAncestor(owner: string, target: string, parents: ReadonlyMap<string, string>): boolean {
  const seen = new Set<string>();
  let current: string | undefined = owner;
  while (current !== undefined && !seen.has(current)) {
    if (current === target) return true;
    seen.add(current);
    current = parents.get(current);
  }
  return false;
}

function endpointOwner(id: string, graph: Graph): string | undefined {
  const record = graph.records.get(id);
  if (record?.kind === 'summary') return record.id;
  const semantic = graph.nodes.get(id);
  if (semantic) return semantic.owner;
  return graph.operationOwners.get(id);
}

function ownershipErrors(edge: SemanticEdge, graph: Graph): string[] {
  const fromOwner = endpointOwner(edge.from, graph);
  const toOwner = endpointOwner(edge.to, graph);
  if (fromOwner === undefined || toOwner === undefined) {
    return [`${edge.id}: semantic edge has missing or invalid endpoint`];
  }
  if (fromOwner !== edge.owner) {
    return [`${edge.id}: semantic edge origin belongs to another owner`];
  }
  const owner = scanReference(graph.records, edge.owner, 'summary');
  const target = scanReference(graph.records, toOwner, 'summary');
  if (owner?.host !== target?.host) return [`${edge.id}: semantic edge crosses execution hosts`];
  if (fromOwner === toOwner) return [];
  return lexicalEdgeErrors(edge, graph);
}

function lexicalEdgeErrors(edge: SemanticEdge, graph: Graph): string[] {
  if (['callback', 'call_target', 'registration'].includes(edge.relation)) return [];
  if (
    ['contains', 'ast_child', 'scope', 'initializer', 'initialiser', 'continuation'].includes(
      edge.relation,
    ) &&
    graph.nodes.get(edge.to)?.nodeKind === 'function'
  ) {
    return [];
  }
  if (
    ['binds', 'capture', 'captures', 'reads', 'reaching_definition'].includes(edge.relation) &&
    isAncestor(edge.owner, declarationOwner(edge.to, graph), graph.parents)
  ) {
    return [];
  }
  return [`${edge.id}: semantic relation escapes its lexical owner`];
}

function declarationOwner(id: string, graph: Graph): string {
  const owner = endpointOwner(id, graph) ?? '';
  return graph.nodes.get(id)?.nodeKind === 'function' ? (graph.parents.get(owner) ?? owner) : owner;
}

function nodeErrors(node: SemanticNode, graph: Graph): string[] {
  const errors = provenanceErrors(node, graph);
  if (['identifier', 'member', 'sql_column'].includes(node.nodeKind) && node.name === undefined) {
    errors.push(`${node.id}: ${node.nodeKind} requires name`);
  }
  if (node.nodeKind === 'literal' && node.value === undefined) {
    errors.push(`${node.id}: literal requires parsed value`);
  }
  if (
    ['binary', 'unary', 'assignment'].includes(node.nodeKind) &&
    !isSemanticOperator(node.operator ?? '')
  ) {
    errors.push(`${node.id}: ${node.nodeKind} requires operator from the supported token set`);
  }
  if (['runtime_boundary', 'policy'].includes(node.nodeKind) && node.authority !== 'unresolved') {
    errors.push(`${node.id}: runtime policy requires explicit unresolved authority`);
  }
  return [...errors, ...nodeTopologyErrors(node, graph)];
}

function nodeTopologyErrors(node: SemanticNode, graph: Graph): string[] {
  const errors: string[] = [];
  const edges = graph.outgoing.get(node.id) ?? [];
  if (
    ['if', 'conditional', 'branch'].includes(node.nodeKind) &&
    edges.filter((edge) => edge.relation === 'condition').length !== 1
  ) {
    errors.push(`${node.id}: branch requires one condition`);
  }
  if (
    node.nodeKind === 'assignment' &&
    !edges.some((edge) => ['assigned_value', 'value', 'right'].includes(edge.relation)) &&
    !assignedFunctionValue(edges, graph)
  ) {
    errors.push(`${node.id}: assignment requires assigned value`);
  }
  return errors;
}

function assignedFunctionValue(edges: readonly SemanticEdge[], graph: Graph): boolean {
  return edges.some(
    (edge) =>
      edge.relation === 'callback' &&
      containedFunction(edge, graph) &&
      edges.some(
        (child) => child.to === edge.to && ['contains', 'ast_child'].includes(child.relation),
      ),
  );
}

function containedFunction(edge: SemanticEdge, graph: Graph): boolean {
  const from = graph.nodes.get(edge.from);
  const to = graph.nodes.get(edge.to);
  if (!from || to?.nodeKind !== 'function') return false;
  const assignment = scanReference(graph.records, from.source, 'source');
  const value = scanReference(graph.records, to.source, 'source');
  if (!assignment || !value || !sameDeclarationFile(assignment, value)) return false;
  return value.lines[0] >= assignment.lines[0] && value.lines[1] <= assignment.lines[1];
}

function edgeErrors(edge: SemanticEdge, graph: Graph): string[] {
  return [
    ...provenanceErrors(edge, graph),
    ...ownershipErrors(edge, graph),
    ...semanticRoleErrors(edge, { from: graph.nodes.get(edge.from), to: graph.nodes.get(edge.to) }),
    ...semanticLineageErrors(edge, graph),
    ...assignmentBindingErrors(edge, graph),
  ];
}

function indexedEdges(
  semantic: readonly SemanticRecord[],
  direction: 'from' | 'to',
): ReadonlyMap<string, readonly SemanticEdge[]> {
  const outgoing = new Map<string, SemanticEdge[]>();
  for (const edge of semantic) {
    if (edge.kind !== 'semantic_edge') continue;
    const entries = outgoing.get(edge[direction]) ?? [];
    entries.push(edge);
    outgoing.set(edge[direction], entries);
  }
  return outgoing;
}

export function semanticErrors(document: ScanDocument, records: ScanRecords): string[] {
  const semantic = document.semantic ?? [];
  const nodes = new Map(
    semantic.filter((record) => record.kind === 'semantic_node').map((node) => [node.id, node]),
  );
  const edges = semantic.filter((record) => record.kind === 'semantic_edge');
  const graph: Graph = {
    records,
    nodes,
    edges,
    parents: parentOwners({ nodes, edges }),
    outgoing: indexedEdges(semantic, 'from'),
    incoming: indexedEdges(semantic, 'to'),
    operationOwners: new Map(
      document.summaries.flatMap((summary) =>
        summary.operations.map((operation) => [operation.id, summary.id]),
      ),
    ),
  };
  return [
    ...hierarchyErrors(graph),
    ...semantic.flatMap((record) =>
      record.kind === 'semantic_node' ? nodeErrors(record, graph) : edgeErrors(record, graph),
    ),
  ];
}

function hierarchyErrors(graph: Graph): string[] {
  const errors: string[] = [];
  for (const [child, parent] of graph.parents) {
    if (isAncestor(parent, child, graph.parents)) {
      errors.push(`${child}: cyclic semantic lexical ownership`);
    }
    const owner = scanReference(graph.records, parent, 'summary');
    const nested = scanReference(graph.records, child, 'summary');
    const origin = owner && scanReference(graph.records, owner.source, 'source');
    const target = nested && scanReference(graph.records, nested.source, 'source');
    if (!origin || !target) continue;
    const contained = target.lines[0] >= origin.lines[0] && target.lines[1] <= origin.lines[1];
    if (!sameDeclarationFile(origin, target) || !contained) {
      errors.push(`${child}: lexical child declaration outside parent scope`);
    }
  }
  return errors;
}

function assignmentBindingErrors(edge: SemanticEdge, graph: Graph): string[] {
  if (edge.relation !== 'assigned_value') return [];
  if (graph.nodes.get(edge.from)?.nodeKind === 'assignment') return [];
  const assignment = (graph.incoming.get(edge.from) ?? []).some(
    (binding) =>
      ['assigns', 'target'].includes(binding.relation) &&
      ['assignment', 'declaration', 'variable'].includes(
        graph.nodes.get(binding.from)?.nodeKind ?? 'unknown',
      ),
  );
  return assignment ? [] : [`${edge.id}: assigned value needs an assignment target binding`];
}

function sameDeclarationFile(origin: Source, target: Source): boolean {
  const sameFile = origin.repo === target.repo && origin.path === target.path;
  const sameRevision = origin.commit === target.commit && origin.blob === target.blob;
  return sameFile && sameRevision;
}
