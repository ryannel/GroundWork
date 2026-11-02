import { describe, expect, it, vi } from 'vitest';

import { scanFixture } from '@/../test/scan-kit';
import { validateScanDocument } from '@/domain/scan/check-scan';
import type { SemanticEdge, SemanticNode } from '@/domain/scan/scan.generated';

import { createBackendEdgeWriter } from './backend-semantic-edge-writer';
import { semanticEdge } from './semantic-edge-identity';

vi.mock(import('server-only'), () => ({}));

function node(id: string, nodeKind: SemanticNode['nodeKind']): SemanticNode {
  return {
    kind: 'semantic_node',
    id,
    owner: 'summary:handler',
    source: 'source:handler',
    nodeKind,
    syntax: id,
    name: id,
    value: 1,
  };
}

describe('native unsupported semantic edges', () => {
  it('retains a gap without inventing AST containment between an unsupported target and its value', () => {
    const emitted: SemanticEdge[] = [];
    const writer = createBackendEdgeWriter({
      append(edge) {
        emitted.push(edge);
      },
      duplicate: vi.fn<() => void>(),
    });
    const pattern = { ...node('pattern', 'expression'), syntax: '(base_url, api_key)' };
    const value = node('conditional', 'conditional');
    writer.append(pattern, value, 'assigned_value', 0);
    expect(emitted).toEqual([]);
    expect(writer.gaps).toHaveLength(1);
    expect(writer.gaps[0]).toMatchObject({
      source: 'source:handler',
      reason: 'unsupported',
    });
    expect(writer.gaps[0]?.description).toContain('assigned_value');
  });

  it('preserves a valid typed edge and its source rather than substituting a gap', () => {
    const emitted: SemanticEdge[] = [];
    const writer = createBackendEdgeWriter({
      append(edge) {
        emitted.push(edge);
      },
      duplicate: vi.fn<() => void>(),
    });
    const target = node('target', 'identifier');
    const value = node('value', 'literal');
    writer.append(target, value, 'assigned_value', 0);
    expect(emitted).toHaveLength(1);
    expect(emitted[0]).toMatchObject({
      relation: 'assigned_value',
      from: target.id,
      to: value.id,
      owner: target.owner,
      source: target.source,
      position: 0,
    });
    expect(writer.gaps).toEqual([]);
  });

  it('keeps the public validator strict when an invalid assignment relation is injected manually', () => {
    const document = scanFixture();
    document.summaries.push({
      kind: 'summary',
      id: 'summary:handler',
      host: 'host:server',
      source: 'source:handler',
      implementation: 'handler',
      context: { arguments: [], captures: [], typeArguments: [], configuration: [], policy: [] },
      operations: [],
      effects: { state: 'unresolved', reason: 'unsupported', gap: 'gap:unknown' },
      frontiers: [],
      support: ['source:handler'],
    });
    const pattern = node('pattern', 'expression');
    const value = node('value', 'literal');
    document.semantic = [
      pattern,
      value,
      semanticEdge({
        kind: 'semantic_edge',
        owner: pattern.owner,
        source: pattern.source,
        from: pattern.id,
        to: value.id,
        relation: 'assigned_value',
        position: 0,
      }),
    ];
    expect(validateScanDocument(document).join('\n')).toContain(
      'invalid assigned_value origin kind',
    );
  });
});
