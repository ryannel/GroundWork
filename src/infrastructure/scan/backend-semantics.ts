import 'server-only';

import type {
  Gap,
  LocalSummary,
  SemanticEdge,
  SemanticNode,
  SemanticRecord,
  Source,
} from '@/domain/scan/scan.generated';

import { createBackendEdgeWriter } from './backend-semantic-edge-writer';
import { backendAttributes } from './backend-semantic-nodes';
import { appendBackendRelations } from './backend-semantic-relations';
import type { ExtractionContext } from './local-facts';
import { appendPythonRustCallTargets } from './python-rust-semantic-bindings';
import type { SemanticEdgeDiagnostics } from './semantic-edge-identity';
import { syntaxIdentity } from './source-expressions';
import { sourceDigest } from './source-index';
import type { SourceIndex, SyntaxNode } from './source-index-types';
import { backendFieldRoles, semanticSpanLookup, syntaxPositions } from './source-node-lookups';
import { enclosingFunction, syntaxRole } from './syntax-candidates';

export interface BackendGraph {
  readonly index: SourceIndex;
  readonly syntaxPositions: ReadonlyMap<SyntaxNode, number>;
  readonly semanticSpans: ReadonlyMap<string, SemanticNode>;
  readonly nodes: ReadonlyMap<SyntaxNode, SemanticNode>;
  readonly records: readonly SemanticRecord[];
  readonly diagnostics: SemanticEdgeDiagnostics;
  readonly gaps: readonly Gap[];
  readonly edge: (
    ...args: readonly [SemanticNode, SemanticNode, SemanticEdge['relation'], number?, string?]
  ) => void;
  readonly extra: (
    ...args: readonly [SemanticNode, SemanticNode['nodeKind'], string, string]
  ) => SemanticNode;
}

const FIELDS: Readonly<Record<string, SemanticEdge['relation']>> = {
  parameters: 'parameter',
  returnType: 'declared_type',
  type: 'declared_type',
  callee: 'callee',
  arguments: 'argument',
  condition: 'condition',
  consequent: 'consequent',
  otherwise: 'otherwise',
  values: 'value',
  targets: 'target',
  left: 'left',
  right: 'right',
  operand: 'operand',
  receiver: 'receiver',
  member: 'property',
  key: 'key',
  properties: 'property',
  statements: 'statement',
  body: 'body',
  catches: 'catch',
  finally: 'finally',
  annotations: 'annotation',
  expression: 'value',
  initializer: 'initializer',
  labels: 'condition',
  pattern: 'operand',
  patterns: 'operand',
  bindings: 'binds',
};

function sourceOf(index: SourceIndex, node: SyntaxNode, context: ExtractionContext): Source {
  return {
    kind: 'source',
    id: `source:${syntaxIdentity(index, node)}`,
    host: context.host,
    repo: context.repo,
    commit: context.commit,
    path: index.path,
    blob: context.blob ?? `content-sha256:${index.digest}`,
    lines: [...node.lines],
    authority: 'declared',
  };
}

function moduleSummary(
  index: SourceIndex,
  context: ExtractionContext,
): { readonly summary: LocalSummary; readonly gap: Gap } {
  const root = index.nodes[0];
  const source = `source:${root ? syntaxIdentity(index, root) : sourceDigest(JSON.stringify([index.path, index.digest, 'module']))}`;
  const id = `summary:module:${index.digest}:${index.path}`;
  const gap: Gap = {
    kind: 'gap',
    id: `gap:${id}`,
    source,
    reason: 'missing_dependency',
    description:
      'Module context is source-declared; runtime initialisation and external bindings remain unresolved.',
  };
  const summary: LocalSummary = {
    kind: 'summary',
    id,
    host: context.host,
    source,
    implementation: `${index.path}:module`,
    context: { arguments: [], captures: [], typeArguments: [], configuration: [], policy: [] },
    operations: [],
    effects: { state: 'unresolved', reason: 'missing_dependency', gap: gap.id },
    frontiers: [],
    support: [source],
  };
  return { summary, gap };
}

function graphOf(index: SourceIndex, context: ExtractionContext) {
  const nodes = new Map<SyntaxNode, SemanticNode>();
  const roles = backendFieldRoles(index);
  const sources: Source[] = [];
  const moduleFacts = moduleSummary(index, context);
  if (index.nodes.length === 0) {
    sources.push({
      kind: 'source',
      id: moduleFacts.summary.source,
      host: context.host,
      repo: context.repo,
      commit: context.commit,
      path: index.path,
      blob: context.blob ?? `content-sha256:${index.digest}`,
      lines: [1, index.content.split('\n').length],
      authority: 'declared',
    });
  }
  for (const node of index.nodes) {
    const source = sourceOf(index, node, context);
    sources.push(source);
    if (node.start === node.end) continue;
    const owner =
      syntaxRole(node) === 'function' ? node : index.nodes[enclosingFunction(index, node) ?? -1];
    nodes.set(node, {
      kind: 'semantic_node',
      id: `semantic:${syntaxIdentity(index, node)}`,
      owner:
        owner && node.start >= owner.start && node.end <= owner.end
          ? `summary:${syntaxIdentity(index, owner)}`
          : moduleFacts.summary.id,
      source: source.id,
      authority: 'declared',
      ...backendAttributes(index, node, roles),
    });
  }
  return {
    graph: buildGraph(index, nodes),
    sources,
    summaries: [moduleFacts.summary],
    gaps: [moduleFacts.gap],
  };
}

function buildGraph(
  index: SourceIndex,
  nodes: ReadonlyMap<SyntaxNode, SemanticNode>,
): BackendGraph {
  const records: SemanticRecord[] = [...nodes.values()];
  const diagnostics = { exactDuplicateEdges: 0 };
  const writer = createBackendEdgeWriter({
    append(edge) {
      records.push(edge);
    },
    duplicate() {
      diagnostics.exactDuplicateEdges += 1;
    },
  });
  const graph: BackendGraph = {
    index,
    syntaxPositions: syntaxPositions(index),
    semanticSpans: semanticSpanLookup(nodes),
    nodes,
    records,
    diagnostics,
    gaps: writer.gaps,
    edge(...args) {
      writer.append(...args);
    },
    extra(...args) {
      const [parent, nodeKind, name, suffix] = args;
      const node: SemanticNode = {
        kind: 'semantic_node',
        id: `${parent.id}:${suffix}`,
        owner: parent.owner,
        source: parent.source,
        nodeKind,
        syntax: 'derived',
        name,
        authority: nodeKind === 'runtime_boundary' ? 'unresolved' : 'declared',
      };
      records.push(node);
      return node;
    },
  };
  return graph;
}

function appendFields(graph: BackendGraph) {
  const exact = new Map(
    [...graph.nodes].flatMap(([syntax, node]): (readonly [string, SemanticNode])[] => {
      const span = `${String(syntax.start)}:${String(syntax.end)}`;
      return [
        [span, node],
        [`${node.nodeKind}:${span}`, node],
        [`${String(syntax.parent)}:${span}`, node],
      ];
    }),
  );
  for (const [syntax, node] of graph.nodes) {
    const parent = graph.index.nodes[syntax.parent ?? -1];
    const parentNode = parent && graph.nodes.get(parent);
    if (parentNode) {
      graph.edge(parentNode, node, node.nodeKind === 'function' ? 'contains' : 'ast_child');
    }
    appendFieldEdges(graph, syntax, node, exact);
  }
}

function fieldChild(
  exact: ReadonlyMap<string, SemanticNode>,
  field: string,
  keys: readonly [string, string],
): SemanticNode | undefined {
  if (field === 'annotations') return exact.get(`annotation:${keys[1]}`);
  const patternField = ['labels', 'pattern', 'patterns', 'bindings'].includes(field);
  return (patternField ? exact.get(keys[0]) : undefined) ?? exact.get(keys[1]);
}

function appendFieldEdges(
  ...args: readonly [BackendGraph, SyntaxNode, SemanticNode, ReadonlyMap<string, SemanticNode>]
) {
  const [graph, syntax, node, exact] = args;
  for (const [field, spans] of Object.entries(syntax.fields ?? {})) {
    const relation = fieldRelation(node, field);
    if (relation === undefined) continue;
    for (const [position, [start, end]] of spans.entries()) {
      const span = `${String(start)}:${String(end)}`;
      const direct = `${String(graph.syntaxPositions.get(syntax) ?? -1)}:${span}`;
      const child = fieldChild(exact, field, [direct, span]);
      if (child) {
        graph.edge(node, child, child.nodeKind === 'function' ? 'callback' : relation, position);
      }
    }
  }
}

/** Native compiler trees lowered to explicit value, control and boundary relations. */
export function extractBackendSemantics(
  index: SourceIndex,
  context: ExtractionContext,
): {
  readonly semantic: readonly SemanticRecord[];
  readonly diagnostics: SemanticEdgeDiagnostics;
  readonly sources: readonly Source[];
  readonly summaries: readonly LocalSummary[];
  readonly gaps: readonly Gap[];
} {
  if (['typescript', 'javascript'].includes(index.language)) {
    return {
      semantic: [],
      diagnostics: { exactDuplicateEdges: 0 },
      sources: [],
      summaries: [],
      gaps: [],
    };
  }
  const { graph, sources, summaries, gaps } = graphOf(index, context);
  appendFields(graph);
  appendBackendRelations(graph);
  appendPythonRustCallTargets(graph);
  return {
    semantic: graph.records,
    diagnostics: graph.diagnostics,
    sources,
    summaries,
    gaps: [...gaps, ...graph.gaps],
  };
}

function fieldRelation(node: SemanticNode, field: string): SemanticEdge['relation'] | undefined {
  if (['type', 'parameter'].includes(node.nodeKind) && ['operand', 'receiver'].includes(field)) {
    return 'ast_child';
  }
  if (node.nodeKind === 'type' && field === 'operand') return 'ast_child';
  return node.nodeKind === 'unknown' ? 'ast_child' : FIELDS[field];
}
