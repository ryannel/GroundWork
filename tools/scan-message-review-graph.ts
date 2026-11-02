import type { SemanticNode } from '@/domain/scan/scan.generated';

import { profileMethod, type ProfileGraph } from './scan-profile-review-graph';
import { individualRecipe, individualReferences } from './scan-profile-review-individual-atoms';
import { descendants, targets } from './scan-semantic-query';

export function messageMethod(
  graph: ProfileGraph,
  identity: readonly [string, string, number?],
): SemanticNode | undefined {
  const [file, name, arity] = identity;
  const methods = profileMethod(graph, file, name).filter(
    (node) => arity === undefined || targets(graph, node, 'parameter').length === arity,
  );
  return methods.length === 1 ? methods[0] : undefined;
}

export function messageCall(
  graph: ProfileGraph,
  owner: SemanticNode | undefined,
  recipe: string,
): SemanticNode | undefined {
  const calls = descendants(graph, owner).filter(
    (node) =>
      ['call', 'construct'].includes(node.nodeKind) && individualRecipe(graph, node) === recipe,
  );
  return calls.length === 1 ? calls[0] : undefined;
}

/** Check the shared exact target and ordinal actual/formal value applications. */
export function messageBoundary(
  graph: ProfileGraph,
  call: SemanticNode | undefined,
  target: SemanticNode | undefined,
): boolean {
  if (!call || !target) return false;
  const binding = graph.calls.find((entry) => entry.call === call.source);
  const actuals = targets(graph, call, 'argument');
  const formals = targets(graph, target, 'parameter');
  return [
    binding?.target === target.source,
    binding?.resolution === 'exact',
    actuals.length === formals.length,
    actuals.every((actual, ordinal) =>
      graph.values.some(
        (value) =>
          value.relation === 'argument_parameter' &&
          value.call === call.source &&
          value.from === actual.source &&
          value.to === formals[ordinal]?.source,
      ),
    ),
  ].every(Boolean);
}

/** Require a local tree and lexical value links, with no intervening reassignment. */
export function messageLocal(graph: ProfileGraph, owner: SemanticNode | undefined): boolean {
  if (!owner || !individualReferences(graph, owner)) return false;
  return !descendants(graph, targets(graph, owner, 'body')[0]).some(
    (node) => node.nodeKind === 'assignment',
  );
}

export function messageBranches(
  graph: ProfileGraph,
  identity: readonly [string, string],
  values: readonly [string, string, string],
): boolean {
  const owner = messageMethod(graph, identity);
  const statements = targets(graph, targets(graph, owner, 'body')[0], 'statement');
  const first = statements[0];
  const second = targets(graph, first, 'otherwise')[0];
  const last = targets(graph, second, 'otherwise')[0];
  const returns = [
    targets(graph, first, 'consequent')[0],
    targets(graph, second, 'consequent')[0],
    last,
  ];
  return [
    messageLocal(graph, owner),
    statements.length === 1,
    first?.nodeKind === 'if',
    second?.nodeKind === 'if',
    individualRecipe(graph, targets(graph, first, 'condition')[0]) === 'previous==null',
    individualRecipe(graph, targets(graph, second, 'condition')[0]) ===
      'updated.archivalData()!=null',
    returns.every((body, ordinal) => {
      const children = descendants(graph, body).filter((node) => node.nodeKind === 'return');
      return (
        children.length === 1 &&
        individualRecipe(graph, targets(graph, children[0], 'returns')[0]) === values[ordinal]
      );
    }),
  ].every(Boolean);
}

export function messageGuardBeforeEffects(
  graph: ProfileGraph,
  owner: SemanticNode | undefined,
): boolean {
  const statements = targets(graph, targets(graph, owner, 'body')[0], 'statement');
  const guard = statements[0];
  const exits = descendants(graph, targets(graph, guard, 'consequent')[0]).filter(
    (node) => node.nodeKind === 'return',
  );
  const guarded =
    individualRecipe(graph, targets(graph, guard, 'condition')[0]) ===
    'kafkaTemplate==null||!settings.enabled()';
  return guard?.nodeKind === 'if' && guarded && exits.length === 1;
}
