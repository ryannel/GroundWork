import { describe, expect, it } from 'vitest';

import { scanFixture } from '@/../test/scan-kit';

import { validateScanDocument } from './check-scan';
import type { ScanDocument, SemanticEdge, SemanticNode } from './scan.generated';

function fixture(): ScanDocument {
  const document = scanFixture();
  document.summaries.push({
    kind: 'summary',
    id: 'summary:handler',
    host: 'host:server',
    source: 'source:handler',
    implementation: 'handler',
    context: {
      arguments: [],
      captures: [],
      typeArguments: [],
      configuration: [],
      policy: [],
    },
    operations: [],
    effects: { state: 'unresolved', reason: 'unsupported', gap: 'gap:unknown' },
    frontiers: [],
    support: ['source:handler'],
  });
  document.semantic = [];
  return document;
}

function node(id: string, nodeKind: SemanticNode['nodeKind']): SemanticNode {
  return {
    kind: 'semantic_node',
    id,
    owner: 'summary:handler',
    source: 'source:handler',
    nodeKind,
    syntax: id,
    name: 'customer',
    value: true,
  };
}

function edge(relation: SemanticEdge['relation'], from: string, to: string): SemanticEdge {
  return {
    kind: 'semantic_edge',
    id: `edge:${relation}:${from}:${to}`,
    owner: 'summary:handler',
    source: 'source:handler',
    relation,
    from,
    to,
  };
}

describe('semantic graph validation', () => {
  it('does not let an unrelated callback satisfy an assignment through a forged contains edge', () => {
    const document = fixture();
    const parent = document.sources[0]!;
    parent.lines = [1, 30];
    document.sources.push(
      { ...parent, id: 'source:assignment', lines: [2, 3] },
      { ...parent, id: 'source:callback', lines: [2, 3] },
    );
    document.summaries.push({
      ...document.summaries[0]!,
      id: 'summary:callback',
      source: 'source:callback',
      support: ['source:callback'],
    });
    document.semantic = [
      { ...node('write', 'assignment'), source: 'source:assignment', operator: '=' },
      {
        ...node('function', 'function'),
        owner: 'summary:callback',
        source: 'source:callback',
      },
      { ...edge('callback', 'write', 'function'), source: 'source:assignment' },
      { ...edge('contains', 'write', 'function'), source: 'source:assignment' },
    ];
    expect(validateScanDocument(document)).toEqual([]);
    document.sources[2]!.lines = [20, 22];
    expect(validateScanDocument(document).join('\n')).toContain(
      'assignment requires assigned value',
    );
  });

  it('accepts only dereferencing unary expressions as assignment lvalues', () => {
    const document = fixture();
    document.semantic = [
      { ...node('write', 'assignment'), operator: '=' },
      { ...node('pointer', 'unary'), operator: '*' },
      node('value', 'literal'),
      edge('target', 'write', 'pointer'),
      edge('value', 'write', 'value'),
      edge('operand', 'pointer', 'value'),
      edge('assigned_value', 'pointer', 'value'),
    ];
    expect(validateScanDocument(document)).toEqual([]);
    document.semantic[1] = { ...node('pointer', 'unary'), operator: '!' };
    expect(validateScanDocument(document).join('\n')).toContain('requires pointer dereference');
  });
  it('retains a catch type without requiring a lexical parameter and rejects invalid type links', () => {
    const document = fixture();
    document.semantic = [
      node('catch', 'catch'),
      node('type', 'type'),
      edge('declared_type', 'catch', 'type'),
    ];
    expect(validateScanDocument(document)).toEqual([]);
    document.semantic[1] = node('type', 'literal');
    expect(validateScanDocument(document).join('\n')).toContain(
      'invalid declared_type target kind',
    );
    document.semantic[0] = node('catch', 'unknown');
    expect(validateScanDocument(document).join('\n')).toContain(
      'invalid declared_type origin kind',
    );
  });

  it('accepts parsed expressions and kind checked lineage', () => {
    const document = fixture();
    document.semantic = [
      node('read', 'identifier'),
      node('definition', 'parameter'),
      edge('reaching_definition', 'read', 'definition'),
    ];
    expect(validateScanDocument(document)).toEqual([]);
  });

  it('rejects missing owners, dangling endpoints and sources outside declarations', () => {
    const document = fixture();
    document.semantic = [
      { ...node('read', 'identifier'), owner: 'missing' },
      edge('condition', 'read', 'missing'),
    ];
    expect(validateScanDocument(document).join('\n')).toContain('summary owner and source');
    expect(validateScanDocument(document).join('\n')).toContain('missing or invalid endpoint');
    document.sources.push({ ...document.sources[0]!, id: 'source:elsewhere', path: 'other.ts' });
    document.semantic = [{ ...node('read', 'identifier'), source: 'source:elsewhere' }];
    expect(validateScanDocument(document).join('\n')).toContain('outside owner declaration');
  });

  it('rejects wrong condition and SQL binding targets', () => {
    const document = fixture();
    document.semantic = [
      node('branch', 'if'),
      node('catch', 'catch'),
      edge('condition', 'branch', 'catch'),
      node('column', 'sql_column'),
      edge('column_binding', 'column', 'catch'),
    ];
    const errors = validateScanDocument(document).join('\n');
    expect(errors).toContain('invalid condition target kind');
    expect(errors).toContain('invalid column_binding target kind');
    expect(errors).toContain('column_binding requires position');
    expect(errors).toContain('column binding requires column label');
  });

  it('rejects a definition with another name or a definition from only one branch', () => {
    const document = fixture();
    document.semantic = [
      node('read', 'identifier'),
      { ...node('definition', 'parameter'), name: 'other' },
      edge('reaching_definition', 'read', 'definition'),
    ];
    expect(validateScanDocument(document).join('\n')).toContain('same identifier');
    document.semantic = [
      node('read', 'identifier'),
      node('definition', 'parameter'),
      node('branch', 'if'),
      node('condition', 'literal'),
      edge('condition', 'branch', 'condition'),
      edge('consequent', 'branch', 'definition'),
      edge('reaching_definition', 'read', 'definition'),
    ];
    expect(validateScanDocument(document).join('\n')).toContain('escapes its branch context');
  });

  it('rejects cross host edges and unrelated sibling definitions', () => {
    const document = fixture();
    const summary = document.summaries[0]!;
    document.summaries.push({ ...summary, id: 'summary:sibling' });
    document.semantic = [
      node('read', 'identifier'),
      { ...node('definition', 'parameter'), owner: 'summary:sibling' },
      edge('reaching_definition', 'read', 'definition'),
    ];
    expect(validateScanDocument(document).join('\n')).toContain('escapes its lexical owner');
    document.summaries[1]!.host = 'host:other';
    expect(validateScanDocument(document).join('\n')).toContain('crosses execution hosts');
  });

  it('accepts explicit lexical captures and rejects cyclic scope declarations', () => {
    const document = fixture();
    document.summaries.push({ ...document.summaries[0]!, id: 'summary:child' });
    document.semantic = [
      node('parent', 'function'),
      node('definition', 'parameter'),
      { ...node('child', 'function'), owner: 'summary:child' },
      { ...node('read', 'identifier'), owner: 'summary:child' },
      edge('contains', 'parent', 'child'),
      { ...edge('reaching_definition', 'read', 'definition'), owner: 'summary:child' },
    ];
    expect(validateScanDocument(document)).toEqual([]);
    document.semantic.push({ ...edge('contains', 'child', 'parent'), owner: 'summary:child' });
    expect(validateScanDocument(document).join('\n')).toContain(
      'cyclic semantic lexical ownership',
    );
  });

  it('requires parsed literals, operators and explicit runtime uncertainty', () => {
    const document = fixture();
    document.semantic = [
      {
        kind: 'semantic_node',
        id: 'literal',
        owner: 'summary:handler',
        source: 'source:handler',
        nodeKind: 'literal',
        syntax: '1',
      },
      node('binary', 'binary'),
      node('runtime', 'runtime_boundary'),
    ];
    const errors = validateScanDocument(document).join('\n');
    expect(errors).toContain('literal requires parsed value');
    expect(errors).toContain('binary requires operator');
    expect(errors).toContain('runtime policy requires explicit unresolved authority');
  });
});
