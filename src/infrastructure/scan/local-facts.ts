import 'server-only';

import type {
  Gap,
  LocalSummary,
  Operation,
  SemanticRecord,
  Source,
} from '@/domain/scan/scan.generated';

import { extractBackendSemantics } from './backend-semantics';
import { frameworkObservations, type FrameworkObservation } from './framework-observations';
import { operationOf, unresolvedCallGap } from './local-operation';
import type { SemanticEdgeDiagnostics } from './semantic-edge-identity';
import { fieldExpressions, syntaxIdentity } from './source-expressions';
import type { SourceIndex, SyntaxNode } from './source-index-types';
import { candidateKind, enclosingFunction } from './syntax-candidates';
import { extractTypescriptSemantics } from './typescript-semantics';

export interface ExtractionContext {
  readonly host: string;
  readonly repo: string;
  readonly commit: string;
  readonly blob?: string;
  readonly ruleVersion?: string;
  readonly disabledRecognisers?: readonly string[];
  readonly configuration?: readonly string[];
  readonly dependencyFingerprint?: string;
}
export interface CandidateReceipt {
  readonly id: string;
  readonly source: string;
  readonly kind: string;
  readonly rule: string;
  readonly disposition: 'syntax_supported' | 'frontier';
  readonly reason: string;
  readonly observations: readonly FrameworkObservation[];
}
export interface LocalFacts {
  readonly semantic?: readonly SemanticRecord[];
  readonly semanticDiagnostics?: SemanticEdgeDiagnostics;
  readonly summaries: readonly LocalSummary[];
  readonly sources: readonly Source[];
  readonly gaps: readonly Gap[];
  readonly candidates: readonly CandidateReceipt[];
  readonly parser: string;
  readonly attribution: SourceIndex['attribution'];
}

function diagnosticFacts(index: SourceIndex, context: ExtractionContext): LocalFacts {
  const root = index.nodes[0];
  const identity = root ? syntaxIdentity(index, root) : `${index.digest}:${index.path}`;
  const source: Source = {
    kind: 'source',
    id: `source:${identity}`,
    host: context.host,
    repo: context.repo,
    commit: context.commit,
    blob: context.blob ?? `content-sha256:${index.digest}`,
    path: index.path,
    lines: [1, index.content.split('\n').length],
    authority: 'declared',
  };
  return {
    semantic: [],
    summaries: [],
    sources: [source],
    candidates: [],
    gaps: [
      {
        kind: 'gap',
        id: `gap:parser:${identity}`,
        source: source.id,
        reason: 'unsupported',
        description:
          'Parser diagnostics quarantine this file: recovery trees cannot establish local control, values, calls or declarations. Source bytes and diagnostics remain in the source index; use a compatible parser before semantic extraction.',
      },
    ],
    parser: index.parser,
    attribution: index.attribution,
  };
}

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

function summaryOf(index: SourceIndex, node: SyntaxNode, context: ExtractionContext): LocalSummary {
  const key = syntaxIdentity(index, node);
  const source = `source:${key}`;
  return {
    kind: 'summary',
    id: `summary:${key}`,
    host: context.host,
    source,
    implementation: `${index.path}:${String(node.start)}`,
    context: {
      arguments: [...fieldExpressions(index, node, 'parameters')],
      captures: [],
      typeArguments: [],
      configuration: [],
      policy: [],
    },
    operations: [],
    effects: { state: 'unresolved', reason: 'missing_dependency', gap: `gap:${key}` },
    frontiers: [
      {
        kind: 'frontier',
        id: `frontier:${key}`,
        reason: 'missing_dependency',
        source,
        nextQuestion:
          'Resolve receiver, arguments, captures, types and dependencies before attributing effects.',
        contextLoss: [
          'incomplete-receiver-and-capture-attribution',
          'incomplete-dependency-closure',
        ],
      },
    ],
    support: [source],
  };
}

function receiptOf(
  input: { readonly index: SourceIndex; readonly node: SyntaxNode; readonly kind: string },
  context: ExtractionContext,
): CandidateReceipt {
  const { index, node, kind } = input;
  const key = syntaxIdentity(index, node);
  const supported = ['function', 'return', 'call', 'await', 'throw', 'value', 'import'].includes(
    kind,
  );
  return {
    id: `candidate:${key}`,
    source: `source:${key}`,
    kind,
    rule: 'rule:compiler-syntax-v1',
    observations:
      context.disabledRecognisers?.includes('framework') === true
        ? []
        : frameworkObservations(index, index.nodes.indexOf(node)),
    disposition: supported ? 'syntax_supported' : 'frontier',
    reason: supported
      ? 'Compiler syntax only; semantic attribution is unresolved.'
      : 'Syntax candidate retained; framework, control-flow or user intent attribution is unresolved.',
  };
}

/** Extracts local operations without fabricating HTTP, storage or semantic actions from names. */
export function extractLocalFacts(index: SourceIndex, context: ExtractionContext): LocalFacts {
  return index.diagnostics.length > 0
    ? diagnosticFacts(index, context)
    : parsedLocalFacts(index, context);
}

function parsedLocalFacts(index: SourceIndex, context: ExtractionContext): LocalFacts {
  const localSummaries: LocalSummary[] = [];
  const sources: Source[] = [];
  const gaps: Gap[] = [];
  const candidates: CandidateReceipt[] = [];
  const facts = {
    summaries: localSummaries,
    sources,
    gaps,
    candidates,
    parser: index.parser,
    attribution: index.attribution,
  };
  const summaries = new Map<number, LocalSummary>();
  for (const [position, node] of index.nodes.entries()) {
    const kind = candidateKind(node);
    if (kind === undefined) continue;
    facts.sources.push(sourceOf(index, node, context));
    facts.candidates.push(receiptOf({ index, node, kind }, context));
    if (kind === 'function') {
      const summary = summaryOf(index, node, context);
      facts.summaries.push(summary);
      summaries.set(position, summary);
      facts.gaps.push(unresolvedCallGap(`gap:${syntaxIdentity(index, node)}`, summary.source));
    }
    const gap = appendOperation({ index, node, position }, summaries);
    if (gap) facts.gaps.push(gap);
  }
  const semantic = ['typescript', 'javascript'].includes(index.language)
    ? { ...extractTypescriptSemantics(index, context), diagnostics: { exactDuplicateEdges: 0 } }
    : extractBackendSemantics(index, context);
  return {
    ...facts,
    semantic: semantic.semantic,
    semanticDiagnostics: semantic.diagnostics,
    sources: [...facts.sources, ...semantic.sources],
    summaries: [...facts.summaries, ...semantic.summaries],
    gaps: [...facts.gaps, ...semantic.gaps],
  };
}

function appendOperation(
  input: { readonly index: SourceIndex; readonly node: SyntaxNode; readonly position: number },
  summaries: ReadonlyMap<number, LocalSummary>,
) {
  const owner = enclosingFunction(input.index, input.node);
  if (owner === null) return null;
  const summary = summaries.get(owner);
  if (!summary) return null;
  const key = syntaxIdentity(input.index, input.node);
  const source = `source:${key}`;
  const operation = operationOf({
    index: input.index,
    position: input.position,
    id: `operation:${key}`,
    source,
    gap: `gap:${key}`,
  });
  if (operation) summary.operations.push(operation);
  const role = candidateKind(input.node);
  if (operation?.kind === 'opaque' || role === 'loop' || role === 'unsupported_syntax') {
    summary.frontiers.push({
      kind: 'frontier',
      id: `frontier:${key}`,
      source,
      reason: 'unsupported',
      nextQuestion: `Lower compiler construct ${input.node.kind} before claiming control or effect closure.`,
      contextLoss: ['unsupported-control-lowering'],
    });
    if (!operation) {
      summary.operations.push({
        kind: 'opaque',
        id: `operation:${key}`,
        source,
        frontier: `frontier:${key}`,
      });
    }
  }
  return operationGap(operation, key, source);
}

function operationGap(operation: Operation | undefined, key: string, source: string): Gap | null {
  if (operation?.kind === 'return' && operation.value.kind === 'unresolved') {
    return {
      kind: 'gap',
      id: `gap:${key}`,
      source,
      reason: 'missing_evidence',
      description:
        'Compiler return metadata is missing; absence of returned values is not established.',
    };
  }
  if (operation?.kind === 'call') return unresolvedCallGap(`gap:${key}`, source);
  return null;
}
