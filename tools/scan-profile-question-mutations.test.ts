import { describe, expect, it } from 'vitest';

import { scanFixture } from '@/../test/scan-kit';
import type { SemanticEdge, SemanticNode } from '@/domain/scan/scan.generated';

import { profileQuestionMutations } from './scan-profile-question-mutations';

function node(id: string, nodeKind: SemanticNode['nodeKind'], name: string): SemanticNode {
  return {
    kind: 'semantic_node',
    id,
    nodeKind,
    name,
    source: 'source:handler',
    owner: 'owner:fixture',
    authority: 'declared',
    syntax: 'original source display',
  };
}
function edge(from: string, relation: SemanticEdge['relation'], to: string): SemanticEdge {
  return {
    kind: 'semantic_edge',
    id: `${from}:${relation}:${to}`,
    from,
    to,
    relation,
    source: 'source:handler',
    owner: 'owner:fixture',
  };
}

describe('whole-question mutation accounting', () => {
  it('never counts an unsupported baseline as rejection of a whole question', () => {
    const results = profileQuestionMutations(scanFixture());
    expect(results.length).toBeGreaterThan(24);
    expect(new Set(results.map((result) => result.question))).toEqual(new Set(['q12', 'q13']));
    expect(results.every((result) => !result.baselinePassed && !result.rejected)).toBe(true);
  });

  it('does not count an applied native mutation until its entire original question was supported', () => {
    const document = scanFixture();
    document.sources[0]!.path = 'src/CdbClient.java';
    document.semantic = [
      node('method', 'function', 'getConsumer'),
      node('call', 'call', 'retained expression'),
      node('callee', 'member', 'executeSync'),
      node('client', 'identifier', 'client'),
      edge('method', 'ast_child', 'call'),
      edge('call', 'callee', 'callee'),
      edge('call', 'ast_child', 'callee'),
      edge('callee', 'receiver', 'client'),
    ];
    const before = structuredClone(document);
    const results = profileQuestionMutations(document);
    expect(results.find((result) => result.name === 'CDB request receiver chain')).toMatchObject({
      question: 'q12',
      mutationApplied: true,
      baselinePassed: false,
      rejected: false,
    });
    expect(document).toEqual(before);
  });
});
