import { describe, expect, it, vi } from 'vitest';

import { scanFixture } from '@/../test/scan-kit';
import type { SemanticEdge, SemanticNode } from '@/domain/scan/scan.generated';

import { semanticGraph } from './scan-semantic-query';
import { springArchiveReasonProof } from './scan-spring-review-native';

vi.mock(import('server-only'), () => ({}));

const node = (
  id: string,
  nodeKind: SemanticNode['nodeKind'],
  extra: Partial<SemanticNode> = {},
): SemanticNode => ({
  kind: 'semantic_node',
  id,
  nodeKind,
  owner: 'owner',
  source: 'source',
  authority: 'declared',
  syntax: 'unchanged display',
  ...extra,
});
const edge = (
  from: string,
  relation: SemanticEdge['relation'],
  to: string,
  position = 0,
): SemanticEdge => ({
  kind: 'semantic_edge',
  id: `${from}:${relation}:${to}`,
  from,
  to,
  relation,
  position,
  owner: 'owner',
  source: 'source',
});
function fixture() {
  return semanticGraph({
    ...scanFixture(),
    semantic: [
      node('call', 'call'),
      node('callee', 'member', { name: 'markForArchival' }),
      node('service', 'identifier', { name: 'customerService' }),
      node('customer', 'identifier', { name: 'customerId' }),
      node('argument', 'identifier', { name: 'resolvedArchiveReason' }),
      node('binding', 'identifier', { name: 'resolvedArchiveReason' }),
      node('conditional', 'conditional'),
      node('condition', 'binary', { operator: '!=' }),
      node('reason', 'identifier', { name: 'archiveReason' }),
      node('null', 'literal', { value: null }),
      node('default', 'member', { name: 'NONE_SPECIFIED' }),
      node('enum', 'identifier', { name: 'ArchiveReason' }),
      edge('call', 'callee', 'callee'),
      edge('callee', 'receiver', 'service'),
      edge('call', 'argument', 'customer'),
      edge('call', 'argument', 'argument', 1),
      edge('argument', 'reaching_value', 'binding'),
      edge('binding', 'assigned_value', 'conditional'),
      edge('conditional', 'condition', 'condition'),
      edge('condition', 'left', 'reason'),
      edge('condition', 'right', 'null'),
      edge('conditional', 'consequent', 'reason'),
      edge('conditional', 'otherwise', 'default'),
      edge('default', 'receiver', 'enum'),
    ],
  });
}

describe('independent Spring native default proof', () => {
  it('requires every value and operand relation with display syntax unchanged', () => {
    const graph = fixture();
    expect(springArchiveReasonProof(graph, 'owner')).toBe(true);
    for (const removed of [
      'reaching_value',
      'assigned_value',
      'condition',
      'left',
      'right',
      'consequent',
      'otherwise',
      'receiver',
    ]) {
      const changed = semanticGraph({
        ...graph.document,
        semantic: (graph.document.semantic ?? []).filter(
          (record) => record.kind !== 'semantic_edge' || record.relation !== removed,
        ),
      });
      expect(springArchiveReasonProof(changed, 'owner')).toBe(false);
    }
  });
  it('rejects a swapped default even when display text is retained', () => {
    const graph = fixture();
    const changed = semanticGraph({
      ...graph.document,
      semantic: (graph.document.semantic ?? []).map((record) =>
        record.kind === 'semantic_node' && record.id === 'default'
          ? { ...record, name: 'ORDER_COMPLETED' }
          : record,
      ),
    });
    expect(springArchiveReasonProof(changed, 'owner')).toBe(false);
  });
});
