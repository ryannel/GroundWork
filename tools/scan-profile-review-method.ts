import type { SemanticNode } from '@/domain/scan/scan.generated';

import { profileMethod, type ProfileGraph } from './scan-profile-review-graph';
import {
  individualInitialisers,
  individualRecipe,
  individualReferences,
  individualReturn,
} from './scan-profile-review-individual-atoms';
import { profileLocalNodes } from './scan-profile-review-local';
import { descendants, targets } from './scan-semantic-query';

interface RecipeExpectation {
  readonly calls?: readonly string[];
  readonly initializers?: Readonly<Record<string, string>>;
  readonly branches?: readonly {
    readonly condition: string;
    readonly returns?: string;
    readonly throws?: string;
    readonly exits?: boolean;
    readonly calls?: readonly string[];
  }[];
  readonly callbacks?: readonly {
    readonly call: string;
    readonly body: string;
    readonly captures?: readonly string[];
  }[];
  readonly returns?: readonly string[];
}

function branchMatches(
  graph: ProfileGraph,
  node: SemanticNode,
  expected: NonNullable<RecipeExpectation['branches']>[number],
): boolean {
  const condition = targets(graph, node, 'condition')[0];
  if (individualRecipe(graph, condition) !== expected.condition) return false;
  const bodies = targets(graph, node, 'consequent');
  const bodyNodes = bodies.flatMap((body) => descendants(graph, body));
  if (
    !(expected.calls ?? []).every((recipe) =>
      bodyNodes.some((child) => individualRecipe(graph, child) === recipe),
    )
  ) {
    return false;
  }
  if (
    expected.returns !== undefined &&
    !bodies.some((body) => individualReturn(graph, body, expected.returns ?? ''))
  ) {
    return false;
  }
  if (
    expected.exits === true &&
    !bodies
      .flatMap((body) => descendants(graph, body))
      .some((child) => child.nodeKind === 'return' && targets(graph, child, 'returns').length === 0)
  ) {
    return false;
  }
  return (
    expected.throws === undefined ||
    bodies
      .flatMap((body) => descendants(graph, body))
      .filter((child) => child.nodeKind === 'throw')
      .some((child) =>
        targets(graph, child, 'value').some(
          (value) => individualRecipe(graph, value) === expected.throws,
        ),
      )
  );
}

function capturedReference(
  graph: ProfileGraph,
  context: { readonly owner: SemanticNode; readonly nodes: readonly SemanticNode[] },
  name: string,
): boolean {
  const parameter = targets(graph, context.owner, 'parameter').find((node) => node.name === name);
  if (!parameter) return false;
  return context.nodes
    .filter((node) => node.nodeKind === 'identifier' && node.name === name)
    .some((use) =>
      graph.values.some(
        (value) =>
          value.relation === 'reference' &&
          value.from === parameter.source &&
          value.to === use.source,
      ),
    );
}

function callbackMatches(
  graph: ProfileGraph,
  context: { readonly owner: SemanticNode; readonly node: SemanticNode },
  expected: NonNullable<RecipeExpectation['callbacks']>[number],
): boolean {
  if (individualRecipe(graph, context.node) !== expected.call) return false;
  return targets(graph, context.node, 'callback').some((callback) => {
    const nodes = descendants(graph, callback);
    if (!nodes.some((node) => individualRecipe(graph, node) === expected.body)) return false;
    return (expected.captures ?? []).every((name) =>
      capturedReference(graph, { owner: context.owner, nodes }, name),
    );
  });
}

export function methodRecipe(
  graph: ProfileGraph,
  identity: readonly [string, string, number?],
  expected: RecipeExpectation,
): boolean {
  const [file, method, arity] = identity;
  const owner = profileMethod(graph, file, method).find(
    (node) => arity === undefined || targets(graph, node, 'parameter').length === arity,
  );
  if (!owner || !individualReferences(graph, owner)) return false;
  const nodes = profileLocalNodes(graph, file, method);
  const initializers = individualInitialisers(graph, owner);
  const data =
    (expected.calls ?? []).every((recipe) =>
      nodes.some((node) => individualRecipe(graph, node) === recipe),
    ) &&
    Object.entries(expected.initializers ?? {}).every(
      ([name, recipe]) => individualRecipe(graph, initializers.get(name)) === recipe,
    ) &&
    (expected.returns ?? []).every((recipe) => individualReturn(graph, owner, recipe));
  const control =
    (expected.callbacks ?? []).every((callback) =>
      nodes.some((node) => callbackMatches(graph, { owner, node }, callback)),
    ) &&
    (expected.branches ?? []).every((branch) =>
      nodes
        .filter((node) => node.nodeKind === 'if')
        .some((node) => branchMatches(graph, node, branch)),
    );
  return data && control;
}
