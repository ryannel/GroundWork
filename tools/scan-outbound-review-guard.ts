import type { ScanDocument, SemanticNode } from '@/domain/scan/scan.generated';

import { descendants, semanticGraph, targets } from './scan-semantic-query';

function throwsFleetError(graph: ReturnType<typeof semanticGraph>, thrown: SemanticNode): boolean {
  const callees = targets(graph, thrown, 'value').flatMap((creation) =>
    targets(graph, creation, 'callee'),
  );
  return callees.some((callee) => callee.name === 'FleetServiceException');
}

/** A source helper rejects null responses before returning its response argument. */
export function outboundNullGuard(document: ScanDocument, methodSource: string | null): boolean {
  const graph = semanticGraph(document);
  const method = graph.nodes.find(
    (node) => node.source === methodSource && node.nodeKind === 'function',
  );
  if (!method) return false;
  return graph.nodes
    .filter((node) => node.owner === method.owner && node.nodeKind === 'if')
    .some((branch) => {
      const condition = targets(graph, branch, 'condition')[0];
      if (condition?.operator !== '==') return false;
      const left = targets(graph, condition, 'left')[0];
      const right = targets(graph, condition, 'right')[0];
      const isNull = left?.name === 'response' && right?.value === null;
      const throws = targets(graph, branch, 'consequent')
        .flatMap((body) => descendants(graph, body))
        .filter((node) => node.nodeKind === 'throw');
      return isNull && throws.some((thrown) => throwsFleetError(graph, thrown));
    });
}
