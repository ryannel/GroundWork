import reference from '@/../test/fixtures/scan/benchmark-reference.json' with { type: 'json' };
import type { LocalSummary, ScanDocument } from '@/domain/scan/scan.generated';
import type { ScanScope } from '@/infrastructure/scan/scan-scope';
import type { SourceIndex } from '@/infrastructure/scan/source-index-types';
import { syntaxRole } from '@/infrastructure/scan/syntax-candidates';

import { result, type DepthContext, type DepthResult } from './scan-benchmark-depth-facts';
import { evaluateGoDepth } from './scan-depth-go';
import { evaluateLegacyDepth } from './scan-depth-legacy';
import { evaluateNextDepth } from './scan-depth-next';
import { evaluateSpringDepth } from './scan-depth-spring';
import { semanticGraph, type SemanticGraph } from './scan-semantic-query';

export type { DepthResult } from './scan-benchmark-depth-facts';

function evaluate(context: DepthContext, graph: SemanticGraph): DepthResult {
  if (context.summary && graph.nodes.length > 0) {
    const semantic =
      evaluateSpringDepth(graph, context.summary.id, context.id) ??
      evaluateGoDepth(graph, context.summary.id, context.id) ??
      evaluateNextDepth(graph, context.summary.id, context.id);
    if (semantic) return semantic;
  }
  return evaluateLegacyDepth(context);
}

interface Root {
  readonly symbol: string;
  readonly anchor: { readonly path: string; readonly lines: readonly number[] };
}
function rootSummary(
  root: Root,
  document: ScanDocument,
  indexes: readonly SourceIndex[],
): LocalSummary | undefined {
  const index = indexes.find((entry) => entry.path === root.anchor.path);
  const node = index?.nodes.find(
    (entry) => entry.symbol === root.symbol && syntaxRole(entry) === 'function',
  );
  if (node) {
    return document.summaries.find(
      (summary) => summary.implementation === `${root.anchor.path}:${String(node.start)}`,
    );
  }
  return document.summaries.find((summary) => {
    const source = document.sources.find((entry) => entry.id === summary.source);
    return source?.path === root.anchor.path && source.lines[0] === root.anchor.lines[0];
  });
}

/** Frozen semantic checks inspect structured facts; source indexes only locate named root ids. */
export function evaluateBenchmarkDepth(
  scope: ScanScope,
  document: ScanDocument,
  sourceIndexes: readonly SourceIndex[] = [],
): readonly DepthResult[] {
  const selected = reference.scopes.find(
    (entry) => entry.id === scope.id && entry.repo === scope.repo && entry.commit === scope.commit,
  );
  if (!selected) {
    throw new Error(
      'Depth benchmark only accepts the three frozen scopes at their frozen commits.',
    );
  }
  const graph = semanticGraph(document);
  return selected.questions.flatMap((question) => {
    const summary = rootSummary(question.root, document, sourceIndexes);
    const source = document.sources.find((entry) => entry.id === summary?.source);
    return question.checks.map((check) => {
      const context = { id: check.id, summary };
      if (source && (source.repo !== scope.repo || source.commit !== scope.commit)) {
        return result(context, 'failed', {
          evidence: [],
          reason: 'Selected root evidence belongs to another repository or commit.',
        });
      }
      return evaluate(context, graph);
    });
  });
}
