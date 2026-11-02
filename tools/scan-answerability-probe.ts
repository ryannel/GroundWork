import type { SemanticNode } from '@/domain/scan/scan.generated';

import { directBranchReturn } from './scan-depth-error-flow';
import { argumentsAre, comesBefore, conditionIs, inBranch } from './scan-depth-native-query';
import { namedCalls, ownedNodes, type SemanticGraph } from './scan-semantic-query';

interface Check {
  readonly kind:
    'guard-return' | 'guard-exit-before-call' | 'ordered-calls' | 'branch-call' | 'call-arguments';
  readonly expected: string;
  readonly call: string;
  readonly arguments: readonly string[];
}
export interface Probe {
  readonly id: string;
  readonly sourcePath: string;
  readonly functionName: string;
  readonly checks: readonly Check[];
}

function holds(graph: SemanticGraph, owner: SemanticNode, check: Check): boolean {
  const calls = namedCalls(graph, owner.owner, check.call);
  if (check.kind !== 'guard-return' && calls.length !== 1) return false;
  const call = calls[0];
  switch (check.kind) {
    case 'guard-return': {
      return ownedNodes(graph, owner.owner, 'if').some(
        (branch) =>
          conditionIs(graph, branch, check.expected) &&
          directBranchReturn(graph, branch) !== undefined,
      );
    }
    case 'guard-exit-before-call': {
      return ownedNodes(graph, owner.owner, 'if').some(
        (branch) =>
          conditionIs(graph, branch, check.expected) &&
          directBranchReturn(graph, branch) !== undefined &&
          comesBefore(graph, branch, call) &&
          !inBranch(graph, branch, call),
      );
    }
    case 'ordered-calls': {
      const earlier = namedCalls(graph, owner.owner, check.expected);
      return earlier.length === 1 && comesBefore(graph, earlier[0], call);
    }
    case 'branch-call': {
      return ownedNodes(graph, owner.owner, 'if').some(
        (branch) => conditionIs(graph, branch, check.expected) && inBranch(graph, branch, call),
      );
    }
    case 'call-arguments': {
      return call !== undefined && argumentsAre(graph, call, check.arguments);
    }
  }
}

/** Selection uses parsed function names and pinned paths; checks never read display syntax. */
export function answerabilityProbe(
  graph: SemanticGraph,
  probe: Probe,
): {
  readonly id: string;
  readonly status: 'supported-local-clauses' | 'unresolved';
  readonly matches: number;
  readonly checks: readonly { readonly check: Check; readonly supported: boolean }[];
  readonly evidence: readonly string[];
} {
  const sources = new Set(
    graph.document.sources
      .filter((source) => source.path === probe.sourcePath)
      .map((source) => source.id),
  );
  const moduleSources = new Set(
    graph.document.summaries
      .filter((summary) => summary.implementation === `${probe.sourcePath}:module`)
      .map((summary) => summary.source),
  );
  const matches = graph.nodes.filter((node) => {
    const selected =
      probe.functionName === '<module>'
        ? moduleSources.has(node.source)
        : node.nodeKind === 'function' && node.name === probe.functionName;
    return selected && sources.has(node.source);
  });
  const owner = matches.length === 1 ? matches[0] : undefined;
  const checks = probe.checks.map((check) => ({
    check,
    supported: owner !== undefined && holds(graph, owner, check),
  }));
  const nodes = owner
    ? graph.nodes.filter((node) => node.id === owner.id || node.owner === owner.owner)
    : [];
  const ids = new Set(nodes.map((node) => node.id));
  const edges = graph.edges.filter((edge) => ids.has(edge.from) && ids.has(edge.to));
  const evidence = [
    ...new Set([
      ...nodes.map((node) => node.id),
      ...edges.map((edge) => edge.id),
      ...nodes.map((node) => node.source),
      ...edges.map((edge) => edge.source),
    ]),
  ];
  return {
    id: probe.id,
    status:
      checks.length > 0 && checks.every((check) => check.supported)
        ? 'supported-local-clauses'
        : 'unresolved',
    matches: matches.length,
    checks,
    evidence,
  };
}
