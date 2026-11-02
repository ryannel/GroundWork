import type { SemanticNode, CsharpSymbolBinding } from '@/domain/scan/scan.generated';
import type { ExplorerLink, ExplorerNode } from '@/domain/service-explorer';

import { visualFile } from './visual-file';
import type { VisualContext } from './visual-types';

export function visualCandidates(
  context: VisualContext,
  calls: readonly SemanticNode[],
): {
  readonly nodes: readonly ExplorerNode[];
  readonly links: readonly ExplorerLink[];
} {
  const pairs = calls.flatMap((call) => {
    const dispatch = (context.recordsAt.get(call.source) ?? []).find(
      (record) =>
        record.kind === 'csharp_symbol_binding' &&
        record.relation === 'call_target' &&
        record.dispatch === 'polymorphic',
    );
    if (dispatch?.kind !== 'csharp_symbol_binding' || dispatch.target === null) return [];
    return (context.recordsAt.get(dispatch.target) ?? [])
      .filter(
        (record): record is CsharpSymbolBinding =>
          record.kind === 'csharp_symbol_binding' && record.relation === 'implementation_candidate',
      )
      .map((candidate) => ({ call, candidate }));
  });
  return {
    nodes: pairs.map(({ call, candidate }) => ({
      id: `${call.id}:${candidate.id}`,
      label: `Candidate: ${[...context.nodes.values()].find((node) => node.source === candidate.target && node.nodeKind === 'function')?.name ?? candidate.symbol}`,
      detail: [candidate.symbol, ...candidate.conditions, ...candidate.limitations]
        .join('. ')
        .slice(0, 1200),
      kind: 'call',
      sourceIds: [
        candidate.source,
        ...candidate.configurationSources,
        ...(candidate.target === null ? [] : [candidate.target]),
      ],
      target: candidate.target === null ? null : visualFile(context, candidate.target),
    })),
    links: pairs.map(({ call, candidate }) => ({
      id: `candidate:${call.id}:${candidate.id}`,
      from: call.id,
      to: `${call.id}:${candidate.id}`,
      label: 'Conditional implementation candidate; runtime selection unresolved',
      kind: 'interaction',
      sourceIds: [call.source, ...candidate.configurationSources],
    })),
  };
}
