import type { SemanticNode } from '@/domain/scan/scan.generated';

import { profileReference, type ProfileGraph } from './scan-profile-review-graph';
import { expressionSpelling } from './scan-semantic-expression';
import { descendants, targets } from './scan-semantic-query';

/** Canonical source recipe from atomic names, scalar values and ordered semantic roles. */
export function individualRecipe(graph: ProfileGraph, node: SemanticNode | undefined): string {
  return renderIndividual(graph, node, new Set());
}

function renderIndividual(
  graph: ProfileGraph,
  node: SemanticNode | undefined,
  seen: ReadonlySet<string>,
): string {
  if (!node || seen.has(node.id) || seen.size >= 64) return '';
  const next = new Set([...seen, node.id]);
  if (node.nodeKind === 'expression') {
    const receiver = targets(graph, node, 'receiver')[0];
    if (receiver && node.name !== undefined && targets(graph, node, 'declared_type').length === 0) {
      return `${renderIndividual(graph, receiver, next)}::${node.name}`;
    }
    return renderIndividual(graph, targets(graph, node, 'value')[0], next);
  }
  if (node.nodeKind === 'conditional') {
    return (['condition', 'consequent', 'otherwise'] as const)
      .map((relation) => renderIndividual(graph, targets(graph, node, relation)[0], next))
      .join('?');
  }
  if (['call', 'construct'].includes(node.nodeKind)) {
    const callee = renderIndividual(graph, targets(graph, node, 'callee')[0], next);
    const argumentRecipes = targets(graph, node, 'argument').map((argument) =>
      renderIndividual(graph, argument, next),
    );
    return `${callee}(${argumentRecipes.join(',')})`;
  }
  if (node.nodeKind === 'member') {
    return `${renderIndividual(graph, targets(graph, node, 'receiver')[0], next)}.${node.name ?? ''}`;
  }
  return expressionSpelling(graph, node);
}

export function individualNodes(graph: ProfileGraph, owner: SemanticNode): readonly SemanticNode[] {
  return graph.nodes.filter((node) => node.owner === owner.owner);
}

export function individualInitialisers(
  graph: ProfileGraph,
  owner: SemanticNode,
): ReadonlyMap<string, SemanticNode> {
  return new Map(
    individualNodes(graph, owner)
      .filter((node) => node.nodeKind === 'declaration' && node.name !== undefined)
      .flatMap((node) => {
        const value = targets(graph, node, 'value')[0];
        return value ? [[node.name ?? '', value] as const] : [];
      }),
  );
}

/** Same-spelled formals and locals count only with an explicit lexical reference relation. */
export function individualReferences(graph: ProfileGraph, owner: SemanticNode): boolean {
  const nodes = individualNodes(graph, owner);
  const declarations = nodes.filter((node) => ['parameter', 'declaration'].includes(node.nodeKind));
  const uses = nodes.filter(
    (node) => node.nodeKind === 'identifier' && !node.id.endsWith(':binding'),
  );
  return (
    declarations.length > 0 &&
    uses.every((use) => {
      const candidates = declarations.filter((candidate) => candidate.name === use.name);
      return (
        candidates.length === 0 ||
        candidates.some((declaration) => profileReference(graph, declaration.source, use.source))
      );
    })
  );
}

export function individualReturn(graph: ProfileGraph, root: SemanticNode, recipe: string): boolean {
  return descendants(graph, root).some(
    (node) =>
      node.nodeKind === 'return' &&
      targets(graph, node, 'returns').some((value) => individualRecipe(graph, value) === recipe),
  );
}
