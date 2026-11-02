import type { SemanticNode } from '@/domain/scan/scan.generated';

import { expressionSpelling } from './scan-semantic-expression';
import { targets, type SemanticGraph } from './scan-semantic-query';

interface ErrorOrigin {
  readonly call: SemanticNode | undefined;
  readonly position: number;
  readonly wrapper?: string;
}

/** Conservative direct exits only; a nested conditional return cannot discharge a guard. */
export function directBranchReturn(
  graph: SemanticGraph,
  branch: SemanticNode | undefined,
): SemanticNode | undefined {
  const consequent = targets(graph, branch, 'consequent')[0];
  if (consequent?.nodeKind === 'return') return consequent;
  const statements = targets(graph, consequent, 'statement');
  const terminal = statements.at(-1);
  if (terminal?.nodeKind !== 'return') return undefined;
  const prefix = statements.slice(0, -1);
  return prefix.every((node) => ['expression', 'declaration', 'assignment'].includes(node.nodeKind))
    ? terminal
    : undefined;
}

export function errorGuard(
  graph: SemanticGraph,
  guard: SemanticNode | undefined,
  origin: ErrorOrigin,
): boolean {
  const condition = targets(graph, guard, 'condition')[0];
  const left = targets(graph, condition, 'left')[0];
  const right = targets(graph, condition, 'right')[0];
  if (condition?.operator !== '!=' || expressionSpelling(graph, right) !== 'nil') return false;
  const binding = targets(graph, left, 'reaching_value').find((target) =>
    assignedError(graph, target, origin),
  );
  if (!binding) return false;
  const terminal = directBranchReturn(graph, guard);
  const value = targets(graph, terminal, 'returns')[0];
  return returnsBinding(graph, value, { binding, wrapper: origin.wrapper });
}

function assignedError(graph: SemanticGraph, target: SemanticNode, origin: ErrorOrigin): boolean {
  if (!origin.call) return false;
  return (graph.outgoing.get(target.id) ?? []).some(
    (edge) =>
      edge.relation === 'assigned_value' &&
      edge.to === origin.call?.id &&
      edge.position === origin.position,
  );
}

function returnsBinding(
  graph: SemanticGraph,
  value: SemanticNode | undefined,
  input: { readonly binding: SemanticNode; readonly wrapper: string | undefined },
): boolean {
  if (input.wrapper === undefined) return sameBinding(graph, value, input.binding);
  const callee = targets(graph, value, 'callee')[0];
  const args = targets(graph, value, 'argument');
  if (expressionSpelling(graph, callee) !== input.wrapper || args.length !== 2) return false;
  return args[1]?.value === 0 && sameBinding(graph, args[0], input.binding);
}

function sameBinding(
  graph: SemanticGraph,
  use: SemanticNode | undefined,
  binding: SemanticNode,
): boolean {
  return targets(graph, use, 'reaching_value').some((target) => target.id === binding.id);
}

export function directBlockCall(
  graph: SemanticGraph,
  block: SemanticNode | undefined,
  call: SemanticNode | undefined,
): boolean {
  if (!call) return false;
  return targets(graph, block, 'statement').some(
    (statement) =>
      statement.nodeKind === 'expression' &&
      targets(graph, statement, 'value').some((value) => value.id === call.id),
  );
}
