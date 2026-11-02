import { describe, expect, it, vi } from 'vitest';

import { scanFixture } from '@/../test/scan-kit';
import { semanticErrors } from '@/domain/scan/check-scan-semantic';
import { scanRecords } from '@/domain/scan/scan-records';
import type { SemanticEdge, SemanticNode } from '@/domain/scan/scan.generated';
import { extractBackendSemantics } from '@/infrastructure/scan/backend-semantics';
import { extractLocalFacts } from '@/infrastructure/scan/local-facts';
import { indexSource } from '@/infrastructure/scan/source-index';

vi.mock(import('server-only'), () => ({}));
const JAVA = process.env.GROUNDWORK_TEST_JAVA ?? 'java';
const NATIVE = process.env.GROUNDWORK_NATIVE_PARSERS === '1';
const CONTEXT = { host: 'host:test', repo: 'fixture/java25', commit: 'b'.repeat(40) };

function capture(content: string) {
  const index = indexSource({ content, language: 'java', path: 'Modern.java', java: JAVA });
  const facts = extractBackendSemantics(index, CONTEXT);
  const local = extractLocalFacts(index, CONTEXT);
  const document = {
    ...scanFixture(),
    summaries: [...local.summaries],
    gaps: [...local.gaps],
    sources: [...new Map(local.sources.map((source) => [source.id, source])).values()],
    semantic: [...(local.semantic ?? [])],
  };
  expect(
    semanticErrors(document, new Map(scanRecords(document).map((record) => [record.id, record]))),
  ).toEqual([]);
  const nodes = facts.semantic.filter(
    (record): record is SemanticNode => record.kind === 'semantic_node',
  );
  const edges = facts.semantic.filter(
    (record): record is SemanticEdge => record.kind === 'semantic_edge',
  );
  const linked = (relation: SemanticEdge['relation']) =>
    edges
      .filter((edge) => edge.relation === relation)
      .map((edge) => ({
        from: nodes.find((node) => node.id === edge.from)?.syntax,
        to: nodes.find((node) => node.id === edge.to)?.syntax,
      }));
  return { index, nodes, edges, linked };
}

const FIXTURE = `class Modern {
  record Connect(String token) {} record Entra(String user) {}
  Object f(Object auth) {
    return switch (auth) {
      case null -> empty();
      case String _ -> empty();
      case Connect(var token) when token != null -> Optional.of(token);
      case Entra(var user) -> { yield Optional.of(user); }
      default -> empty();
    };
  }
  Object g(Object auth) {
    if (auth instanceof Connect(var token)) return token != null ? Optional.of(token) : Optional.empty();
    try { work(); } catch (RuntimeException _) { failed(); }
    return null;
  }
}`;

describe.skipIf(!NATIVE)('Java 25 compiler structure', () => {
  it('lowers record patterns, guarded switch arms and yield with bounded binding scopes', () => {
    const graph = capture(FIXTURE);
    expect(graph.index.diagnostics).toEqual([]);
    expect(
      graph.nodes.some(
        (node) => node.nodeKind === 'control' && node.syntax.startsWith('switch (auth)'),
      ),
    ).toBe(true);
    expect(graph.linked('consequent')).toHaveLength(7);
    expect(graph.linked('binds')).toHaveLength(3);
    const unnamedCatch = graph.nodes.find((node) => node.nodeKind === 'catch');
    expect(
      graph.edges.filter((edge) => edge.from === unnamedCatch?.id && edge.relation === 'parameter'),
    ).toEqual([]);
    expect(
      graph.index.nodes
        .filter((node) => node.kind === 'VARIABLE' && node.text.endsWith(' _'))
        .map((node) => node.symbol),
    ).toEqual(['_', '_']);
    expect(graph.linked('reaching_definition')).toHaveLength(5);
    expect(graph.linked('value')).toContainEqual({
      from: 'yield Optional.of(user);',
      to: 'Optional.of(user)',
    });
    expect(
      graph
        .linked('condition')
        .some(
          (edge) =>
            edge.from?.includes('when token != null') === true && edge.to === 'token != null',
        ),
    ).toBe(true);
    expect(
      graph.nodes.filter((node) => node.syntax === 'derived').map((node) => node.name),
    ).not.toContain('_');
    expect(graph.nodes).toContainEqual(
      expect.objectContaining({
        nodeKind: 'conditional',
        syntax: 'token != null ? Optional.of(token) : Optional.empty()',
      }),
    );
  }, 30_000);

  it('reacts to renamed pattern operands and a missing case without borrowing neighbouring bindings', () => {
    const graph = capture(FIXTURE.replace('Entra(var user)', 'Entra(var renamed)'));
    expect(graph.index.diagnostics).toEqual([]);
    expect(graph.linked('reaching_definition')).not.toContainEqual({
      from: 'user',
      to: 'var user',
    });
    const truncated = capture(
      FIXTURE.replace('case Entra(var user) -> { yield Optional.of(user); }', ''),
    );
    expect(truncated.index.diagnostics).toEqual([]);
    expect(truncated.index.nodes.filter((node) => node.kind === 'CASE')).toHaveLength(4);
    expect(truncated.nodes.some((node) => node.syntax === 'yield Optional.of(user);')).toBe(false);
  }, 30_000);

  it('binds a record pattern only in the positive conditional result', () => {
    const graph = capture(
      'class Modern { record Connect(String token) {} Object f(Object auth) { return auth instanceof Connect(var token) ? Optional.of(token) : Optional.of(token); } }',
    );
    expect(graph.index.diagnostics).toEqual([]);
    expect(graph.linked('reaching_definition')).toEqual([{ from: 'token', to: 'var token' }]);
  }, 30_000);

  it('keeps a named type-pattern condition separate from its same-span declaration', () => {
    const graph = capture(
      'class Modern { Object f(Object auth) { return switch(auth) { case String text -> text; default -> null; }; } }',
    );
    expect(graph.index.diagnostics).toEqual([]);
    expect(graph.linked('reaching_definition')).toEqual([{ from: 'text', to: 'String text' }]);
  }, 30_000);

  it('captures a positive-arm record binding in a nested lambda', () => {
    const graph = capture(
      'class Modern { record Connect(String token) {} Object f(Object auth) { return auth instanceof Connect(var token) ? execute(() -> load(token)) : empty(); } }',
    );
    expect(graph.index.diagnostics).toEqual([]);
    expect(graph.linked('captures')).toEqual([{ from: 'token', to: 'var token' }]);
    expect(graph.linked('reaching_definition')).toEqual([]);
  }, 30_000);

  it('uses compiler operator kinds through inline comments and keeps full long expressions', () => {
    const filler = ' '.repeat(600);
    const graph = capture(
      `class Modern { Object f(Object a) { if (a != null /* guard */ && enabled()) return a != null ?${filler} Optional.of(a) : Optional.empty(); return null; } }`,
    );
    expect(graph.index.diagnostics).toEqual([]);
    expect(graph.nodes).toContainEqual(
      expect.objectContaining({ nodeKind: 'binary', operator: '&&' }),
    );
    expect(
      graph.nodes.some(
        (node) => node.nodeKind === 'conditional' && node.syntax.endsWith('Optional.empty()'),
      ),
    ).toBe(true);
    expect(
      graph
        .linked('otherwise')
        .some((edge) => edge.from?.includes(filler) === true && edge.to === 'Optional.empty()'),
    ).toBe(true);
  }, 30_000);
});
