import type { SemanticNode } from '@/domain/scan/scan.generated';

import { profileReceiver, profileScalar, type ProfileGraph } from './scan-profile-review-graph';
import { targets } from './scan-semantic-query';

interface CallPattern {
  readonly call: string;
  readonly args?: readonly ProfilePattern[];
  readonly receiver?: ProfilePattern;
}
interface OperatorPattern {
  readonly op: string;
  readonly operands: readonly ProfilePattern[];
}
export type ProfilePattern =
  | string
  | boolean
  | null
  | CallPattern
  | OperatorPattern
  | { readonly lambda: ProfilePattern }
  | { readonly member: string; readonly receiver: ProfilePattern }
  | { readonly scalar: string }
  | { readonly ref: string };

function matchOperator(
  graph: ProfileGraph,
  node: SemanticNode,
  expected: OperatorPattern,
): boolean {
  if (node.operator !== expected.op) return false;
  const operands =
    node.nodeKind === 'unary'
      ? targets(graph, node, 'operand')
      : [...targets(graph, node, 'left'), ...targets(graph, node, 'right')];
  return (
    operands.length === expected.operands.length &&
    expected.operands.every((operand, index) => profilePattern(graph, operands[index], operand))
  );
}

function matchCall(graph: ProfileGraph, node: SemanticNode, expected: CallPattern): boolean {
  if (node.nodeKind !== 'call' || targets(graph, node, 'callee')[0]?.name !== expected.call) {
    return false;
  }
  if (!graph.calls.some((call) => call.call === node.source && call.methodName === expected.call)) {
    return false;
  }
  if (
    expected.receiver !== undefined &&
    !profilePattern(graph, profileReceiver(graph, node), expected.receiver)
  ) {
    return false;
  }
  const args = (graph.outgoing.get(node.id) ?? [])
    .filter((edge) => ['argument', 'callback'].includes(edge.relation))
    .toSorted((left, right) => (left.position ?? 0) - (right.position ?? 0))
    .flatMap((edge) => {
      const target = graph.byId.get(edge.to);
      return target ? [target] : [];
    });
  return (
    expected.args === undefined ||
    (args.length === expected.args.length &&
      expected.args.every((argument, index) => profilePattern(graph, args[index], argument)))
  );
}

function matchObject(
  graph: ProfileGraph,
  node: SemanticNode,
  expected: Exclude<ProfilePattern, string | boolean | null>,
): boolean {
  if ('call' in expected) return matchCall(graph, node, expected);
  if ('op' in expected) return matchOperator(graph, node, expected);
  if ('scalar' in expected) return profileScalar(graph, node.source) === expected.scalar;
  if ('ref' in expected) {
    return graph.values.some(
      (value) =>
        value.relation === 'reference' &&
        value.to === node.source &&
        graph.bySource.get(value.from)?.name === expected.ref,
    );
  }
  if ('lambda' in expected) {
    return (
      node.nodeKind === 'function' &&
      targets(graph, node, 'ast_child').some((child) =>
        profilePattern(graph, child, expected.lambda),
      )
    );
  }
  return (
    node.nodeKind === 'member' &&
    node.name === expected.member &&
    targets(graph, node, 'receiver').some((child) =>
      profilePattern(graph, child, expected.receiver),
    )
  );
}

/** Matches parsed atoms and ordered operand/argument/receiver relations, never display text. */
export function profilePattern(
  graph: ProfileGraph,
  node: SemanticNode | undefined,
  expected: ProfilePattern,
): boolean {
  if (!node) return false;
  if (typeof expected === 'string') {
    return (
      ['identifier', 'member', 'expression', 'type'].includes(node.nodeKind) &&
      node.name === expected
    );
  }
  if (expected === null || typeof expected === 'boolean') {
    return node.nodeKind === 'literal' && node.value === expected;
  }
  return matchObject(graph, node, expected);
}

export function profileHasPattern(
  graph: ProfileGraph,
  nodes: readonly SemanticNode[],
  expected: ProfilePattern,
): boolean {
  return nodes.some((node) => profilePattern(graph, node, expected));
}
