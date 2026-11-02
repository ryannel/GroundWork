import { describe, expect, it, vi } from 'vitest';

import { scanFixture } from '@/../test/scan-kit';
import { semanticErrors } from '@/domain/scan/check-scan-semantic';
import { scanRecords } from '@/domain/scan/scan-records';
import type { SemanticEdge, SemanticNode } from '@/domain/scan/scan.generated';
import { extractBackendSemantics } from '@/infrastructure/scan/backend-semantics';
import { extractLocalFacts } from '@/infrastructure/scan/local-facts';
import { indexSource } from '@/infrastructure/scan/source-index';

import { expressionSpelling } from './scan-semantic-expression';
import { semanticGraph } from './scan-semantic-query';

vi.mock(import('server-only'), () => ({}));
const JAVA = process.env.GROUNDWORK_TEST_JAVA ?? 'java';
const NATIVE = process.env.GROUNDWORK_NATIVE_PARSERS === '1';
const CONTEXT = { host: 'host:test', repo: 'fixture/repo', commit: 'a'.repeat(40) };

function graph(content: string, language: 'java' | 'go') {
  const index = indexSource({
    content,
    language,
    path: language === 'java' ? 'A.java' : 'a.go',
    java: JAVA,
  });
  expect(index.diagnostics).toEqual([]);
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
  const facts = extractBackendSemantics(index, CONTEXT);
  const nodes = facts.semantic.filter(
    (record): record is SemanticNode => record.kind === 'semantic_node',
  );
  const edges = facts.semantic.filter(
    (record): record is SemanticEdge => record.kind === 'semantic_edge',
  );
  const semantic = semanticGraph(document);
  const display = (node: SemanticNode | undefined) =>
    node?.nodeKind === 'member' ? expressionSpelling(semantic, node) : node?.name;
  const linked = (relation: SemanticEdge['relation']) =>
    edges
      .filter((edge) => edge.relation === relation)
      .map((edge) => ({
        from: display(nodes.find((node) => node.id === edge.from)),
        to: display(nodes.find((node) => node.id === edge.to)),
        position: edge.position,
      }));
  return { nodes, edges, linked };
}

describe.skipIf(!NATIVE)('native semantic lowering', () => {
  it('retains Java array writes and type-use annotation arguments as their actual source kinds', () => {
    const captured = graph(
      'import java.util.List; class A { List<@Pattern(regexp=".+") String> names; String f(String[] split) { split[1] = clean(); return split[1]; } }',
      'java',
    );
    expect(captured.linked('assigned_value')).toContainEqual({
      from: 'split[1]',
      to: 'clean()',
      position: 0,
    });
    expect(captured.nodes).toContainEqual(
      expect.objectContaining({ nodeKind: 'annotation', syntax: '@Pattern(regexp=".+")' }),
    );
    expect(captured.linked('argument')).toContainEqual({
      from: '@Pattern(regexp=".+")',
      to: 'regexp=".+"',
      position: 0,
    });
  }, 30_000);
  it('keeps leading comments, unnamed type parameters and assigned function values in their source scopes', () => {
    const captured = graph(
      '// Leading comment\npackage a\nimport "context"\ntype Request struct{}\nfunc unnamed(context.Context, *Request) {}\nfunc bind() func(context.Context) error { handler := func(ctx context.Context) error { return nil }; return handler }',
      'go',
    );
    expect(captured.nodes).toContainEqual(
      expect.objectContaining({
        nodeKind: 'assignment',
        syntax: 'handler := func(ctx context.Context) error { return nil }',
      }),
    );
    expect(captured.linked('callback')).toContainEqual({
      from: 'handler := func(ctx context.Context) error { return nil }',
      to: 'func(ctx context.Context) error { return nil }',
      position: 0,
    });
    expect(captured.nodes.some((node) => node.syntax === '// Leading comment')).toBe(true);
  }, 30_000);
  it('retains a dereferenced Go assignment without claiming the pointer variable was rebound', () => {
    const captured = graph('package a; func assign(p *int, x int) { *p = x; consume(p) }', 'go');
    expect(captured.nodes).toContainEqual(
      expect.objectContaining({ nodeKind: 'unary', syntax: '*p', operator: '*' }),
    );
    expect(captured.linked('assigned_value')).toContainEqual({ from: '*p', to: 'x', position: 0 });
    expect(captured.linked('reaching_value')).toEqual([]);
    expect(
      captured.edges
        .filter((edge) => edge.relation === 'operand')
        .every((edge) => captured.nodes.find((node) => node.id === edge.from)?.nodeKind !== 'type'),
    ).toBe(true);
  }, 30_000);
  it('retains module-owned Lombok fields, annotations and enum declarations without methods', () => {
    const captured = graph(
      '@Getter class A { @NotNull private CustomerType customerType; } enum CustomerType { INDIVIDUAL, ORGANIZATION }',
      'java',
    );
    expect(captured.nodes).toContainEqual(
      expect.objectContaining({ nodeKind: 'declaration', name: 'customerType' }),
    );
    expect(captured.nodes).toContainEqual(
      expect.objectContaining({ nodeKind: 'annotation', syntax: '@NotNull' }),
    );
    expect(captured.nodes).toContainEqual(
      expect.objectContaining({ nodeKind: 'declaration', name: 'INDIVIDUAL' }),
    );
    expect(
      captured.nodes.some(
        (node) => node.nodeKind === 'declaration' && node.syntax.startsWith('enum CustomerType'),
      ),
    ).toBe(true);
    expect(captured.nodes.every((node) => node.owner.startsWith('summary:module:'))).toBe(true);
    expect(captured.linked('declared_type')).toContainEqual({
      from: 'customerType',
      to: 'CustomerType',
      position: 0,
    });
  }, 30_000);

  it('retains a Java catch rethrow as a typed throw', () => {
    const captured = graph(
      'class A { void f(){ try { save(); } catch (Exception problem) { throw problem; } } }',
      'java',
    );
    expect(captured.nodes).toContainEqual(
      expect.objectContaining({ nodeKind: 'throw', syntax: 'throw problem;' }),
    );
  }, 30_000);

  it('tracks rebound results through renamed identifiers and rejects a changed assignment', () => {
    for (const variable of ['customer', 'renamed']) {
      const before = graph(
        `class A { Object f(Object ${variable}) { ${variable} = repo.persist(${variable}); next(${variable}); return ${variable}; } }`,
        'java',
      );
      expect(before.linked('assigned_value')).toContainEqual({
        from: variable,
        to: `repo.persist(${variable})`,
        position: 0,
      });
      expect(before.linked('reaching_value').filter((edge) => edge.from === variable)).toHaveLength(
        2,
      );
      const after = graph(
        `class A { Object f(Object ${variable}) { other = repo.persist(${variable}); next(${variable}); return ${variable}; } }`,
        'java',
      );
      expect(after.linked('reaching_value')).toEqual([]);
    }
  }, 30_000);

  it('retains guard operators, try catch order and declared async uncertainty', () => {
    const before = graph(
      'class A { @Async void f(){ if (client == null || !settings.enabled()) return; try { archive(x); erase(x); } catch (Exception ex) { failed(); } } }',
      'java',
    );
    const after = graph(
      'class A { @Async void f(){ if (client == null && !settings.enabled()) return; try { archive(x); erase(x); } catch (Exception ex) { failed(); } } }',
      'java',
    );
    expect(before.nodes.some((node) => node.nodeKind === 'binary' && node.operator === '||')).toBe(
      true,
    );
    expect(after.nodes.some((node) => node.nodeKind === 'binary' && node.operator === '||')).toBe(
      false,
    );
    expect(before.linked('next')).toContainEqual({
      from: 'archive(x);',
      to: 'erase(x);',
      position: 0,
    });
    expect(before.linked('catch')).toHaveLength(1);
    expect(before.nodes).toContainEqual(
      expect.objectContaining({ nodeKind: 'function', declaredAsync: true, returnType: 'void' }),
    );
    expect(
      before.nodes
        .filter((node) => node.nodeKind === 'runtime_boundary')
        .every((node) => node.authority === 'unresolved'),
    ).toBe(true);
  }, 30_000);

  it('binds literal SQL columns to actual operands and reacts to a column swap', () => {
    expect(sqlGraph('left_col,right_col').linked('column_binding')).toEqual([
      { from: 'left_col', to: 'row.Left', position: 1 },
      { from: 'right_col', to: 'row.Right', position: 2 },
    ]);
    expect(sqlGraph('right_col,left_col').linked('column_binding')).toEqual([
      { from: 'right_col', to: 'row.Left', position: 1 },
      { from: 'left_col', to: 'row.Right', position: 2 },
    ]);
  }, 30_000);

  it('represents defer registration order and ordinary error returns', () => {
    const before = enqueueGraph(
      'tx, err := pool.Begin(ctx); if err != nil { return err }; defer rollback(ctx, tx); return tx.Commit(ctx)',
    );
    const after = enqueueGraph(
      'tx, err := pool.Begin(ctx); defer rollback(ctx, tx); if err != nil { return err }; return tx.Commit(ctx)',
    );
    expect(before.linked('deferred')).toMatchObject([
      { from: 'defer rollback(ctx, tx)', to: 'rollback(ctx, tx)' },
    ]);
    expect(before.linked('returns').some((edge) => edge.to === 'err')).toBe(true);
    expect(before.linked('next')[0]?.to).toContain('if err');
    expect(after.linked('next')[0]?.to).toContain('defer rollback');
  }, 30_000);
  it('binds an if-initialiser error only inside its lexical condition and branch', () => {
    const scoped = graph(
      'package a; var problem error; func enqueue() error { if _, problem := queue.Stage(ctx); problem != nil { return problem }; return problem }',
      'go',
    );
    expect(scoped.linked('assigned_value')).toContainEqual({
      from: 'problem',
      to: 'queue.Stage(ctx)',
      position: 1,
    });
    expect(scoped.linked('reaching_value')).toMatchObject([
      { from: 'problem', to: 'problem' },
      { from: 'problem', to: 'problem' },
    ]);
    const stale = graph(
      'package a; var problem error; func enqueue() error { if _, discarded := queue.Stage(ctx); problem != nil { return problem }; return problem }',
      'go',
    );
    expect(stale.linked('reaching_value')).toEqual([]);
  }, 30_000);
});

function sqlGraph(columns: string) {
  return graph(
    `package a; func store(tx Tx, row Row) error { _, err := tx.Exec(ctx, \`INSERT INTO records (${columns}) VALUES ($1,$2)\`, row.Left, row.Right); return err }`,
    'go',
  );
}

function enqueueGraph(body: string) {
  return graph(`package a; func enqueue() error { ${body} }`, 'go');
}
