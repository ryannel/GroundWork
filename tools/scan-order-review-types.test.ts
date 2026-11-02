import { describe, expect, it, vi } from 'vitest';

import { extractLocalFacts } from '@/infrastructure/scan/local-facts';
import { indexSource } from '@/infrastructure/scan/source-index';

vi.mock(import('server-only'), () => ({}));

describe.runIf(process.env.GROUNDWORK_NATIVE_PARSERS === '1')('typed unnamed catches', () => {
  it('retains the catch type without introducing an unnamed lexical parameter', () => {
    const index = indexSource({
      path: 'Catch.java',
      language: 'java',
      content: `class Catch {
      void run() { try { lookup(); } catch (MissingException _) { restore(); }
        catch (ServiceException failure) { log(failure); } }
    }`,
    });
    expect(index.diagnostics).toEqual([]);
    const facts = extractLocalFacts(index, {
      host: 'host:test',
      repo: 'fixture/repo',
      commit: 'a'.repeat(40),
    });
    const nodes = (facts.semantic ?? []).filter((record) => record.kind === 'semantic_node');
    const edges = (facts.semantic ?? []).filter((record) => record.kind === 'semantic_edge');
    const catches = nodes.filter((node) => node.nodeKind === 'catch');
    expect(catches).toHaveLength(2);
    const missing = nodes.find(
      (node) => node.nodeKind === 'type' && node.name === 'MissingException',
    );
    expect(
      edges.some(
        (edge) =>
          edge.from === catches[0]?.id &&
          edge.relation === 'declared_type' &&
          edge.to === missing?.id,
      ),
    ).toBe(true);
    expect(nodes.filter((node) => node.nodeKind === 'parameter').map((node) => node.name)).toEqual([
      'failure',
    ]);
    const unnamed = nodes.find((node) => node.name === '_');
    expect(unnamed?.nodeKind).toBe('unknown');
    expect(
      edges.some(
        (edge) =>
          edge.relation === 'binds' && (edge.from === unnamed?.id || edge.to === unnamed?.id),
      ),
    ).toBe(false);
  }, 30_000);
});
