import 'server-only';

import type {
  Gap,
  LocalSummary,
  SemanticEdge,
  SemanticNode,
  SemanticRecord,
  Source,
} from '@/domain/scan/scan.generated';

import type { ExtractionContext } from './local-facts';
import { createSemanticEdgeWriter } from './semantic-edge-identity';
import { syntaxIdentity } from './source-expressions';
import type { SourceIndex, SyntaxNode } from './source-index-types';
import { spanKey, syntaxLookups } from './source-node-lookups';
import { enclosingFunction, syntaxRole } from './syntax-candidates';
import { semanticNodeDetails } from './typescript-semantic-node';

interface TypescriptSemantics {
  readonly semantic: readonly SemanticRecord[];
  readonly sources: readonly Source[];
  readonly summaries: readonly LocalSummary[];
  readonly gaps: readonly Gap[];
}

interface GraphContext {
  readonly index: SourceIndex;
  readonly lookups: ReturnType<typeof syntaxLookups>;
  readonly nodes: ReadonlyMap<SyntaxNode, SemanticNode>;
  readonly append: (record: SemanticRecord) => void;
  readonly edge: ReturnType<typeof createSemanticEdgeWriter>;
}

const RELATIONS: Readonly<Record<string, SemanticEdge['relation']>> = {
  callee: 'callee',
  arguments: 'argument',
  parameters: 'parameter',
  receiver: 'receiver',
  properties: 'property',
  initializer: 'initializer',
  condition: 'condition',
  consequent: 'consequent',
  otherwise: 'otherwise',
  body: 'body',
  catch: 'catch',
  finally: 'finally',
  task: 'awaited',
  operand: 'operand',
  left: 'left',
  right: 'right',
  definition: 'binds',
  statements: 'statement',
  values: 'value',
  name: 'key',
  expression: 'value',
  elements: 'value',
  tag: 'callee',
  attributes: 'property',
  index: 'argument',
};

/** Reusable compiler graph. Registration records declare source binding, never runtime activation. */
export function extractTypescriptSemantics(
  index: SourceIndex,
  context: ExtractionContext,
): TypescriptSemantics {
  const semantic: SemanticRecord[] = [];
  const sources: Source[] = [];
  const nodes = new Map<SyntaxNode, SemanticNode>();
  if (!['typescript', 'javascript'].includes(index.language)) {
    return { semantic, sources, summaries: [], gaps: [] };
  }
  const lookups = syntaxLookups(index);
  for (const node of index.nodes) {
    if (node.start === node.end) continue;
    const key = syntaxIdentity(index, node);
    const record: SemanticNode = {
      kind: 'semantic_node',
      id: `semantic:${key}`,
      owner: ownerId(index, node, lookups.positions),
      source: `source:${key}`,
      ...semanticNodeDetails(index, node),
      authority: 'declared',
    };
    nodes.set(node, record);
    semantic.push(record);
    sources.push(sourceOf({ index, node, record }, context));
  }
  const graph: GraphContext = {
    edge: createSemanticEdgeWriter((record) => {
      semantic.push(record);
    }),
    index,
    lookups,
    nodes,
    append: (record: SemanticRecord) => {
      semantic.push(record);
    },
  };
  for (const node of index.nodes) appendEdges(graph, node);
  for (const record of nodes.values()) appendRuntimeBoundary(graph, record);
  const moduleFacts = moduleSummary(index, context);
  return { semantic, sources, summaries: moduleFacts.summaries, gaps: moduleFacts.gaps };
}

function ownerId(index: SourceIndex, node: SyntaxNode, positions: ReadonlyMap<SyntaxNode, number>) {
  const position =
    syntaxRole(node) === 'function' ? (positions.get(node) ?? -1) : enclosingFunction(index, node);
  const owner = position === null ? index.nodes[0] : index.nodes[position];
  return `summary:${owner ? syntaxIdentity(index, owner) : index.digest}`;
}

function sourceOf(
  input: { readonly index: SourceIndex; readonly node: SyntaxNode; readonly record: SemanticNode },
  context: ExtractionContext,
): Source {
  return {
    kind: 'source',
    id: input.record.source,
    host: context.host,
    repo: context.repo,
    commit: context.commit,
    path: input.index.path,
    lines: [...input.node.lines],
    blob: context.blob ?? `content-sha256:${input.index.digest}`,
    authority: 'declared',
  };
}

function appendEdges(graph: GraphContext, node: SyntaxNode) {
  const record = graph.nodes.get(node);
  if (!record) return;
  if (node.parent !== null) {
    const parent = graph.index.nodes[node.parent];
    const parentRecord = parent && graph.nodes.get(parent);
    if (parentRecord) {
      edge(graph, { from: parentRecord, to: record, relation: 'contains', label: node.kind });
    }
  }
  for (const [field, spans] of Object.entries(node.fields ?? {})) {
    for (const [position, span] of spans.entries()) {
      const child = fieldTarget(graph.lookups.spans, { node, span, field });
      const target = child && graph.nodes.get(child);
      if (target) roleEdge(graph, { from: record, to: target, field, position });
    }
  }
}

function roleEdge(
  graph: GraphContext,
  input: {
    readonly from: SemanticNode;
    readonly to: SemanticNode;
    readonly field: string;
    readonly position: number;
  },
) {
  let relation = RELATIONS[input.field] ?? 'ast_child';
  if (input.field === 'values' && input.from.nodeKind === 'return') relation = 'returns';
  if (relation === 'parameter' && input.to.nodeKind !== 'parameter') relation = 'ast_child';
  if (input.from.owner !== input.to.owner && relation !== 'binds') relation = 'callback';
  edge(graph, {
    from: input.from,
    to: input.to,
    relation,
    label: input.field,
    position: input.position,
  });
}

function edge(
  graph: GraphContext,
  input: {
    readonly from: SemanticNode;
    readonly to: SemanticNode;
    readonly relation: SemanticEdge['relation'];
    readonly label: string;
    readonly position?: number;
  },
) {
  if (input.from.id === input.to.id) return;
  graph.edge({
    kind: 'semantic_edge',
    owner: input.from.owner,
    source: input.from.source,
    relation: input.relation,
    from: input.from.id,
    to: input.to.id,
    label: input.label,
    ...(input.position === undefined ? {} : { position: input.position }),
  });
}

function moduleSummary(index: SourceIndex, context: ExtractionContext) {
  const root = index.nodes[0];
  if (!root || root.start === root.end) return { summaries: [], gaps: [] };
  const key = syntaxIdentity(index, root);
  const gap: Gap = {
    kind: 'gap',
    id: `gap:semantic-module:${key}`,
    source: `source:${key}`,
    reason: 'missing_dependency',
    description:
      'Module graph retains declarations; module execution and dependency activation remain unresolved.',
  };
  const summary: LocalSummary = {
    kind: 'summary',
    id: `summary:${key}`,
    host: context.host,
    source: `source:${key}`,
    implementation: `${index.path}:module`,
    context: { arguments: [], captures: [], typeArguments: [], configuration: [], policy: [] },
    operations: [],
    effects: { state: 'unresolved', reason: 'missing_dependency', gap: gap.id },
    frontiers: [],
    support: [`source:${key}`],
  };
  return { summaries: [summary], gaps: [gap] };
}

function appendRuntimeBoundary(graph: GraphContext, record: SemanticNode) {
  if (record.nodeKind !== 'jsx_attribute') return;
  const boundary: SemanticNode = {
    kind: 'semantic_node',
    id: `${record.id}:runtime`,
    owner: record.owner,
    source: record.source,
    nodeKind: 'runtime_boundary',
    syntax: record.syntax,
    name: 'JSX property evaluation and callback activation require framework or library context',
    authority: 'unresolved',
  };
  graph.append(boundary);
  edge(graph, {
    from: record,
    to: boundary,
    relation: 'registration',
    label: 'declared-jsx-property',
  });
}

function fieldTarget(
  spans: ReadonlyMap<string, readonly SyntaxNode[]>,
  input: {
    readonly node: SyntaxNode;
    readonly span: readonly [number, number];
    readonly field: string;
  },
): SyntaxNode | undefined {
  const matching = spans.get(spanKey(input.span[0], input.span[1])) ?? [];
  if (input.field === 'attributes') {
    return matching.find(
      (entry) => entry.kind === 'JsxAttribute' || entry.kind === 'JsxSpreadAttribute',
    );
  }
  return matching.find((entry) => entry !== input.node && entry.kind !== 'SourceFile');
}
