import type { SemanticEdge, SemanticNode } from '@/domain/scan/scan.generated';

import type { DepthResult } from './scan-benchmark-depth-facts';
import { expressionSpelling } from './scan-semantic-expression';
import {
  descendants,
  includesNode,
  ownedNodes,
  targets,
  type SemanticGraph,
} from './scan-semantic-query';

export type NativeCheck = readonly [string, boolean];

export function nativeResult(
  id: string,
  checks: readonly NativeCheck[],
  evidence: readonly (SemanticNode | undefined)[],
): DepthResult {
  const failures = checks.filter(([, holds]) => !holds).map(([name]) => name);
  return {
    id,
    status: failures.length === 0 ? 'supported' : 'failed',
    evidence: evidence.flatMap((node) => (node ? [node.id] : [])),
    reason:
      failures.length === 0
        ? 'Structured value, control and boundary relations establish every required clause.'
        : `Missing structured proof: ${failures.join('; ')}.`,
  };
}

export function argumentSpellings(graph: SemanticGraph, call: SemanticNode | undefined): string[] {
  return targets(graph, call, 'argument').map((node) => expressionSpelling(graph, node));
}

export function argumentsAre(
  graph: SemanticGraph,
  call: SemanticNode | undefined,
  expected: readonly string[],
): boolean {
  const actual = argumentSpellings(graph, call);
  return (
    actual.length === expected.length &&
    expected.every((text, position) => actual[position] === text)
  );
}

export function returnWith(
  graph: SemanticGraph,
  owner: string,
  expected: string,
): SemanticNode | undefined {
  return ownedNodes(graph, owner, 'return').find((node) =>
    returned(graph, node).some((value) => expressionSpelling(graph, value) === expected),
  );
}

export function returned(graph: SemanticGraph, node: SemanticNode | undefined): SemanticNode[] {
  const explicit = targets(graph, node, 'returns');
  return explicit.length > 0 ? explicit : targets(graph, node, 'value');
}

export function unknownBoundary(
  graph: SemanticGraph,
  node: SemanticNode | undefined,
  relation: SemanticEdge['relation'],
): boolean {
  return targets(graph, node, relation).some(
    (target) => target.nodeKind === 'runtime_boundary' && target.authority === 'unresolved',
  );
}

export function inBranch(
  graph: SemanticGraph,
  branch: SemanticNode | undefined,
  node: SemanticNode | undefined,
): boolean {
  return targets(graph, branch, 'consequent').some((root) => includesNode(graph, root, node));
}

export function conditionIs(
  graph: SemanticGraph,
  node: SemanticNode | undefined,
  expected: string,
): boolean {
  return targets(graph, node, 'condition').some((condition) => {
    const spellingWithoutParentheses = expressionSpelling(graph, condition).replace(
      /^\((.*)\)$/u,
      '$1',
    );
    return spellingWithoutParentheses === expected;
  });
}

/** Both sites must occur in the same ordered block; normal completion is a prerequisite. */
export function comesBefore(
  graph: SemanticGraph,
  left: SemanticNode | undefined,
  right: SemanticNode | undefined,
): boolean {
  if (!left || !right) return false;
  return graph.nodes.some((block) => {
    const statements = targets(graph, block, 'statement');
    const first = statements.findIndex((statement) => includesNode(graph, statement, left));
    const second = statements.findIndex((statement) => includesNode(graph, statement, right));
    return first !== -1 && second > first;
  });
}

export function guardReturning(
  graph: SemanticGraph,
  owner: string,
  predicate: string,
): SemanticNode | undefined {
  return ownedNodes(graph, owner, 'if').find(
    (node) =>
      conditionIs(graph, node, predicate) &&
      targets(graph, node, 'consequent').some((root) =>
        descendants(graph, root).some((child) => child.nodeKind === 'return'),
      ),
  );
}

export function reboundFrom(
  graph: SemanticGraph,
  use: SemanticNode | undefined,
  source: SemanticNode | undefined,
): boolean {
  return (
    source !== undefined &&
    targets(graph, use, 'reaching_value').some((target) =>
      targets(graph, target, 'assigned_value').some((value) => value.id === source.id),
    )
  );
}

export function sameFile(
  graph: SemanticGraph,
  left: SemanticNode | undefined,
  right: SemanticNode | undefined,
): boolean {
  const first = graph.document.sources.find((source) => source.id === left?.source);
  const second = graph.document.sources.find((source) => source.id === right?.source);
  if (!first || !second) return false;
  return first.path === second.path && first.repo === second.repo && first.commit === second.commit;
}
