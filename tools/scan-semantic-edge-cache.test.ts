import { readFileSync } from 'node:fs';

import { expect, it, vi } from 'vitest';

import { extractLocalFacts } from '@/infrastructure/scan/local-facts';
import { semanticEdge } from '@/infrastructure/scan/semantic-edge-identity';
import type { SourceIndex } from '@/infrastructure/scan/source-index-types';

vi.mock(import('server-only'), () => ({}));

it('replays retained native facts and counts an exact repeated parsed child projection explicitly', () => {
  const cached = JSON.parse(
    readFileSync('test/fixtures/scan/MigrationControllerImpl.index.json', 'utf8'),
  ) as { readonly index: SourceIndex };
  const child = cached.index.nodes.find(
    (node) => node.kind === 'IDENTIFIER' && node.parent !== null,
  );
  if (!child) throw new Error('Expected an existing parsed child');
  const repeated = { ...cached.index, nodes: [...cached.index.nodes, { ...child }] };
  const facts = extractLocalFacts(repeated, {
    host: 'host:fixture',
    repo: 'volvo-cars/cds-ecom-customer-service',
    commit: '09623ab3a1f39845d8fc02abc3d591b53a3b5fea',
  });
  const records = facts.semantic ?? [];
  const edges = records.filter((record) => record.kind === 'semantic_edge');
  expect(facts.semanticDiagnostics?.exactDuplicateEdges).toBeGreaterThan(0);
  expect(new Set(edges.map((edge) => edge.id)).size).toBe(edges.length);
  expect(edges.every((edge) => semanticEdge(edge).id === edge.id)).toBe(true);
  expect(records.filter((record) => record.kind === 'semantic_node').length).toBeGreaterThanOrEqual(
    cached.index.nodes.length,
  );
});
