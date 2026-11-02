import { expressionSpelling } from './scan-semantic-expression';
import { namedCalls, targets, type SemanticGraph } from './scan-semantic-query';

/** The default reason must reach the called argument through typed value relations. */
export function springArchiveReasonProof(graph: SemanticGraph, owner: string): boolean {
  const calls = namedCalls(graph, owner, 'customerService.markForArchival');
  if (calls.length !== 1) return false;
  const argument = targets(graph, calls[0], 'argument')[1];
  const bindings = targets(graph, argument, 'reaching_value');
  if (bindings.length !== 1 || bindings[0]?.name !== 'resolvedArchiveReason') return false;
  const values = targets(graph, bindings[0], 'assigned_value');
  const conditional = values[0];
  if (values.length !== 1 || conditional?.nodeKind !== 'conditional') return false;
  const condition = targets(graph, conditional, 'condition');
  const consequent = targets(graph, conditional, 'consequent');
  const otherwise = targets(graph, conditional, 'otherwise');
  if (![condition, consequent, otherwise].every((nodes) => nodes.length === 1)) return false;
  return (
    expressionSpelling(graph, condition[0]) === 'archiveReason!=null' &&
    expressionSpelling(graph, consequent[0]) === 'archiveReason' &&
    expressionSpelling(graph, otherwise[0]) === 'ArchiveReason.NONE_SPECIFIED'
  );
}
