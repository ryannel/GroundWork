import type { SemanticNode } from '@/domain/scan/scan.generated';

import { profileMethod, type ProfileGraph } from './scan-profile-review-graph';
import { descendants, targets } from './scan-semantic-query';

export function profileLocalNodes(
  graph: ProfileGraph,
  file: string,
  method: string,
): readonly SemanticNode[] {
  return profileMethod(graph, file, method).flatMap((owner) => descendants(graph, owner));
}

export function profileLocalCalls(
  graph: ProfileGraph,
  nodes: readonly SemanticNode[],
  names: readonly string[],
): boolean {
  return names.every((name) =>
    nodes.some((node) => {
      const callee = targets(graph, node, 'callee')[0];
      return (
        node.nodeKind === 'call' &&
        callee?.name === name &&
        graph.calls.some((call) => call.call === node.source && call.methodName === name)
      );
    }),
  );
}

export function profileLocalAtoms(
  nodes: readonly SemanticNode[],
  names: readonly string[],
): boolean {
  return names.every((name) =>
    nodes.some(
      (node) =>
        ['identifier', 'member', 'type', 'expression'].includes(node.nodeKind) &&
        node.name === name,
    ),
  );
}

export function profileLocalOperators(
  nodes: readonly SemanticNode[],
  operators: readonly string[],
): boolean {
  return operators.every((operator) => nodes.some((node) => node.operator === operator));
}

export function profileConstruction(
  graph: ProfileGraph,
  nodes: readonly SemanticNode[],
  expected: { readonly type: string; readonly arguments: readonly (string | boolean | null)[] },
): boolean {
  return nodes.some((node) => {
    if (node.nodeKind !== 'construct') return false;
    if (targets(graph, node, 'callee')[0]?.name !== expected.type) return false;
    if (
      !nodes.some(
        (statement) =>
          statement.nodeKind === 'return' &&
          targets(graph, statement, 'returns').some((value) => value.source === node.source),
      )
    ) {
      return false;
    }
    const args = targets(graph, node, 'argument');
    return (
      args.length === expected.arguments.length &&
      expected.arguments.every((name, index) => {
        const argument = args[index];
        if (!argument) return false;
        if (typeof name !== 'string') {
          return argument.nodeKind === 'literal' && argument.value === name;
        }
        if (argument.nodeKind === 'identifier') {
          return (
            argument.name === name &&
            graph.values.some(
              (value) => value.relation === 'reference' && value.to === argument.source,
            )
          );
        }
        if (argument.nodeKind === 'member') return argument.name === name;
        return targets(graph, argument, 'callee')[0]?.name === name;
      })
    );
  });
}

export function profileNullReturn(graph: ProfileGraph, nodes: readonly SemanticNode[]): boolean {
  return nodes
    .filter((node) => node.nodeKind === 'return')
    .some((node) =>
      targets(graph, node, 'returns').some(
        (value) => value.nodeKind === 'literal' && value.value === null,
      ),
    );
}

export function profileInitializers(
  graph: ProfileGraph,
  nodes: readonly SemanticNode[],
  expected: Readonly<Record<string, string>>,
): boolean {
  return Object.entries(expected).every(([name, method]) =>
    nodes.some(
      (node) =>
        node.nodeKind === 'declaration' &&
        node.name === name &&
        graph.values.some(
          (value) =>
            value.relation === 'initializer' &&
            value.to === node.source &&
            targets(graph, graph.bySource.get(value.from), 'callee')[0]?.name === method,
        ),
    ),
  );
}
