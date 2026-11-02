import { describe, expect, it, vi } from 'vitest';

import type { SemanticEdge, SemanticRecord } from '@/domain/scan/scan.generated';
import { extractLocalFacts } from '@/infrastructure/scan/local-facts';
import { semanticEdge } from '@/infrastructure/scan/semantic-edge-identity';
import { indexSource } from '@/infrastructure/scan/source-index';
import type { SourceIndex, SyntaxFields } from '@/infrastructure/scan/source-index-types';

vi.mock(import('server-only'), () => ({}));
const CONTEXT = { host: 'host:fixture', repo: 'fixture/repo', commit: 'a'.repeat(40) };

function reverseFields(fields: SyntaxFields): SyntaxFields {
  return Object.fromEntries(Object.entries(fields).toReversed());
}
function reverseRoles(index: SourceIndex): SourceIndex {
  return {
    ...index,
    nodes: index.nodes.map((node) =>
      node.fields === undefined ? node : { ...node, fields: reverseFields(node.fields) },
    ),
  };
}
function byId(records: readonly SemanticRecord[]): readonly SemanticRecord[] {
  return records.toSorted((left, right) => left.id.localeCompare(right.id));
}
function assertStableEdges(index: SourceIndex): void {
  expect(index.diagnostics).toEqual([]);
  const first = extractLocalFacts(index, CONTEXT);
  const reversed = extractLocalFacts(reverseRoles(index), CONTEXT);
  const before = first.semantic ?? [];
  const after = reversed.semantic ?? [];
  const edges = before.filter((record): record is SemanticEdge => record.kind === 'semantic_edge');
  expect(edges.length).toBeGreaterThan(0);
  expect(new Set(before.map((record) => record.id)).size).toBe(before.length);
  expect(edges.every((edge) => semanticEdge(edge).id === edge.id)).toBe(true);
  expect(byId(after)).toEqual(byId(before));
  expect(reversed.sources).toEqual(first.sources);
  expect(after.filter((record) => record.kind !== 'semantic_edge')).toEqual(
    before.filter((record) => record.kind !== 'semantic_edge'),
  );
  expect(after.map((record) => record.id)).not.toEqual(before.map((record) => record.id));
}

describe('semantic edge emitter traversal independence', () => {
  it('retains TypeScript callbacks, nested bodies and source identities when role traversal reverses', () => {
    assertStableEdges(
      indexSource({
        path: 'callbacks.ts',
        language: 'typescript',
        content: `async function run(items: string[]) {
      const load = async (value: string) => await fetch(value);
      return Promise.all(items.map(item => load(item)));
    }`,
      }),
    );
  });
});

describe.runIf(process.env.GROUNDWORK_NATIVE_PARSERS === '1')(
  'native semantic edge emitter identities',
  () => {
    it('retains Java callback and branch edges under reversed role traversal', () => {
      assertStableEdges(
        indexSource({
          path: 'Callbacks.java',
          language: 'java',
          content: `import java.util.List;
      class Callbacks { Object run(List<String> items) {
        if (items == null) return null;
        return items.stream().map(value -> value.trim()).toList();
      } }`,
        }),
      );
    }, 30_000);
    it('retains Go callback bodies under reversed role traversal', () => {
      assertStableEdges(
        indexSource({
          path: 'callbacks.go',
          language: 'go',
          content: `package fixture
      func run(items []string) string {
        next := func(value string) string { return value }
        if len(items) == 0 { return "" }
        return next(items[0])
      }`,
        }),
      );
    }, 60_000);
  },
);
