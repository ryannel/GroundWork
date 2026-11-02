import { describe, expect, it, vi } from 'vitest';

import { scanFixture } from '@/../test/scan-kit';
import type { SemanticNode } from '@/domain/scan/scan.generated';
import { indexSource } from '@/infrastructure/scan/source-index';
import { extractTypescriptSemantics } from '@/infrastructure/scan/typescript-semantics';

import { expressionSpelling } from './scan-semantic-expression';
import { semanticGraph } from './scan-semantic-query';

vi.mock(import('server-only'), () => ({}));

function graphOf(expression: string) {
  const index = indexSource({
    path: 'expression.ts',
    language: 'typescript',
    content: `function sample(){return ${expression};}`,
  });
  const extracted = extractTypescriptSemantics(index, {
    host: 'host:server',
    repo: 'fixture/repo',
    commit: 'pinned',
  });
  const document = scanFixture();
  document.semantic = [...extracted.semantic];
  return semanticGraph(document);
}

function nodeOf(graph: ReturnType<typeof graphOf>, syntax: string): SemanticNode {
  const node = graph.nodes.find((candidate) => candidate.syntax === syntax);
  if (!node) throw new Error(`Missing expression ${syntax}`);
  return node;
}

describe('typed semantic expression rendering', () => {
  it('uses parsed operators, receiver roles and optionality', () => {
    const source = '!response.ok || data.section?.status === "eligible"';
    const graph = graphOf(source);
    expect(expressionSpelling(graph, nodeOf(graph, source))).toBe(
      '!response.ok||data.section?.status==="eligible"',
    );
    const member = nodeOf(graph, 'response.ok');
    member.name = 'failed';
    expect(expressionSpelling(graph, nodeOf(graph, source))).toContain('response.failed');
    expect(member.syntax).toBe('response.ok');
    const binary = nodeOf(graph, source);
    binary.operator = '&&';
    expect(expressionSpelling(graph, binary)).toContain('&&');
  });

  it('retains the shape of nested operators', () => {
    const first = graphOf('(a || b) && c');
    const second = graphOf('a || b && c');
    expect(expressionSpelling(first, nodeOf(first, '(a || b) && c'))).toBe('(a||b)&&c');
    expect(expressionSpelling(second, nodeOf(second, 'a || b && c'))).toBe('a||b&&c');
  });

  it('decodes literal escapes and reconstructs template selectors', () => {
    const source = `\`prefix/\${name}/lookup?lat=\${location.lat}&lon=\${location.lng}\``;
    const graph = graphOf(source);
    expect(expressionSpelling(graph, nodeOf(graph, source))).toBe(source);
    const escaped = graphOf(String.raw`"a\nb\u0021"`);
    expect(expressionSpelling(escaped, nodeOf(escaped, String.raw`"a\nb\u0021"`))).toBe(
      JSON.stringify('a\nb!'),
    );
    nodeOf(graph, 'location.lng').name = 'wrong';
    expect(expressionSpelling(graph, nodeOf(graph, source))).toContain(`\${location.wrong}`);
  });

  it('uses compiler numeric values for separators and non-decimal literals', () => {
    const graph = graphOf('1_000 + 0x10');
    expect(expressionSpelling(graph, nodeOf(graph, '1_000 + 0x10'))).toBe('1000+16');
  });

  it('reconstructs payload fields and invocation arguments', () => {
    const source = 'JSON.stringify({lat: location.lat, lng: location.lng})';
    const graph = graphOf(source);
    expect(expressionSpelling(graph, nodeOf(graph, source))).toBe(
      'JSON.stringify({lat:location.lat,lng:location.lng})',
    );
    nodeOf(graph, 'location.lng').name = 'latitude';
    expect(expressionSpelling(graph, nodeOf(graph, source))).toContain('lng:location.latitude');
  });
});
