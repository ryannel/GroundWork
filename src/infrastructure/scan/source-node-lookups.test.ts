import { describe, expect, it, vi } from 'vitest';

import type { SemanticNode } from '@/domain/scan/scan.generated';

import { backendAttributes } from './backend-semantic-nodes';
import type { SourceIndex, SyntaxNode } from './source-index-types';
import {
  backendFieldRoles,
  semanticSpanLookup,
  spanKey,
  syntaxLookups,
} from './source-node-lookups';

vi.mock(import('server-only'), () => ({}));

function syntax(kind: string, symbol = kind): SyntaxNode {
  return { kind, symbol, text: symbol, start: 0, end: 1, lines: [1, 1], parent: null };
}
function index(
  nodes: readonly SyntaxNode[],
  language: SourceIndex['language'] = 'typescript',
): SourceIndex {
  return {
    path: 'fixture.ts',
    language,
    content: 'x',
    digest: 'fixture',
    parser: 'fixture',
    attribution: 'parse_only',
    options: 'fixture',
    nodes,
    diagnostics: [],
  };
}
function semantic(id: string): SemanticNode {
  return {
    kind: 'semantic_node',
    id,
    owner: 'owner',
    source: 'source',
    nodeKind: 'identifier',
    name: id,
    syntax: id,
  };
}

describe('ordered source node lookups', () => {
  it('retains equal-span wrappers, source files, attributes and repeated references in compiler order', () => {
    const root = syntax('SourceFile');
    const wrapper = syntax('ExpressionStatement');
    const attribute = syntax('JsxAttribute');
    const spread = syntax('JsxSpreadAttribute');
    const captured = index([root, wrapper, attribute, spread, attribute]);
    const lookup = syntaxLookups(captured);
    expect(lookup.spans.get(spanKey(0, 1))).toEqual([root, wrapper, attribute, spread, attribute]);
    expect(lookup.positions.get(attribute)).toBe(2);
    expect(lookup.spans.get(spanKey(1, 1))).toBeUndefined();
  });

  it('gives earlier owners priority over later owners with higher-priority field names', () => {
    const parameterOwner = { ...syntax('first'), fields: { parameters: [[0, 1] as const] } };
    const typeOwner = { ...syntax('second'), fields: { returnType: [[0, 1] as const] } };
    expect(backendFieldRoles(index([parameterOwner, typeOwner])).get(spanKey(0, 1))).toBe(
      'parameter',
    );
    expect(backendFieldRoles(index([typeOwner, parameterOwner])).get(spanKey(0, 1))).toBe('type');
  });

  it('preserves return-type priority within one owner and the Java unnamed-binding exception', () => {
    const owner = {
      ...syntax('owner'),
      fields: { parameters: [[0, 1] as const], returnType: [[0, 1] as const] },
    };
    const unnamed = syntax('VARIABLE', '_');
    const captured = index([owner, unnamed], 'java');
    const roles = backendFieldRoles(captured);
    expect(roles.get(spanKey(0, 1))).toBe('type');
    expect(backendAttributes(captured, unnamed, roles).nodeKind).toBe('unknown');
  });

  it('takes the first surviving semantic node rather than the last equal-span node', () => {
    const first = syntax('first');
    const second = syntax('second');
    const nodes = new Map([
      [first, semantic('first')],
      [second, semantic('second')],
    ]);
    expect(semanticSpanLookup(nodes).get(spanKey(0, 1))?.id).toBe('first');
    expect(semanticSpanLookup(new Map([...nodes].toReversed())).get(spanKey(0, 1))?.id).toBe(
      'second',
    );
  });

  it('rebuilds renamed and reordered indexes instead of retaining a stale cross-extraction cache', () => {
    const first = syntax('Identifier', 'customer');
    const renamed = syntax('Identifier', 'renamed');
    expect(syntaxLookups(index([first, renamed])).spans.get(spanKey(0, 1))?.[0]?.symbol).toBe(
      'customer',
    );
    expect(syntaxLookups(index([renamed, first])).spans.get(spanKey(0, 1))?.[0]?.symbol).toBe(
      'renamed',
    );
  });
});
