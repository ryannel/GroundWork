import type { SemanticEdge } from '@/domain/scan/scan.generated';
import type { ExplorerLink } from '@/domain/service-explorer';

import type { VisualContext } from './visual-types';

const STRUCTURE = new Set([
  'ast_child',
  'body',
  'statement',
  'condition',
  'consequent',
  'otherwise',
  'catch',
  'finally',
  'try_body',
  'catches',
  'deferred',
  'callback',
  'continuation',
  'awaited',
  'returns',
  'value',
  'operand',
  'argument',
  'receiver',
  'callee',
  'initialiser',
  'initializer',
  'assigned_value',
]);

export function visualDescendants(context: VisualContext, root: string): ReadonlySet<string> {
  const reached = new Set([root]);
  const pending = [root];
  while (pending.length > 0 && reached.size < 10_000) {
    const id = pending.shift();
    if (id === undefined) break;
    for (const edge of context.edges.get(id) ?? []) {
      if (!STRUCTURE.has(edge.relation) || reached.has(edge.to)) continue;
      reached.add(edge.to);
      pending.push(edge.to);
    }
  }
  return reached;
}

function edgeKind(path: readonly SemanticEdge[]): ExplorerLink['kind'] {
  if (path.some((edge) => ['catch', 'catches'].includes(edge.relation))) {
    return 'failure';
  }
  if (path.some((edge) => ['continuation', 'awaited'].includes(edge.relation))) {
    return 'async';
  }
  if (path.some((edge) => ['consequent', 'otherwise', 'condition'].includes(edge.relation))) {
    return 'branch';
  }
  if (
    path.some((edge) => ['value', 'argument', 'returns', 'assigned_value'].includes(edge.relation))
  ) {
    return 'data';
  }
  return 'control';
}

function collapsed(
  context: VisualContext,
  visible: ReadonlySet<string>,
  from: string,
): ExplorerLink[] {
  const pending = (context.edges.get(from) ?? [])
    .toSorted(
      (left, right) =>
        Number(left.relation === 'ast_child') - Number(right.relation === 'ast_child'),
    )
    .filter((edge) => STRUCTURE.has(edge.relation))
    .map((edge) => ({ to: edge.to, path: [edge] }));
  const seen = new Set<string>();
  const result: ExplorerLink[] = [];
  while (pending.length > 0 && seen.size < 10_000) {
    const next = pending.shift();
    if (next === undefined) return result;
    if (seen.has(next.to)) continue;
    seen.add(next.to);
    if (visible.has(next.to)) {
      result.push({
        id: `${from}:${next.to}:${String(result.length)}`,
        from,
        to: next.to,
        label: next.path
          .map((edge) => edge.label ?? edge.relation)
          .filter((label, index, labels) => index === 0 || label !== labels[index - 1])
          .join(' → ')
          .slice(0, 120),
        kind: edgeKind(next.path),
        sourceIds: [...new Set(next.path.map((edge) => edge.source))],
      });
    } else {
      const onward = (context.edges.get(next.to) ?? [])
        .toSorted(
          (left, right) =>
            Number(left.relation === 'ast_child') - Number(right.relation === 'ast_child'),
        )
        .filter((edge) => STRUCTURE.has(edge.relation));
      pending.push(...onward.map((edge) => ({ to: edge.to, path: [...next.path, edge] })));
    }
  }
  return result;
}

export function visualLinks(context: VisualContext, visible: ReadonlySet<string>): ExplorerLink[] {
  return [...visible].flatMap((from) => collapsed(context, visible, from));
}
