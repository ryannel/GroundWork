import { describe, expect, it, vi } from 'vitest';

import { modelValidator } from '@/infrastructure/model-schema';

import { migrateOperation } from './graphql';
import { migrationReview } from './review';

vi.mock(import('server-only'), () => ({}));

describe('migration of authored GraphQL documents', () => {
  it('retains the complete text, invocation facts and historical code pin while deriving selections', async () => {
    const document = 'query Order($id: ID!) { order(id: $id) { id } }';
    const value = {
      id: 'gql:order',
      name: 'Order',
      kind: 'query',
      graph: 'graph:shop',
      client: 'app:shop',
      method: 'POST',
      persisted: true,
      trigger: 'load',
      document,
      sources: [
        { repo: 'example/shop', path: 'queries/Order.ts', commit: 'b'.repeat(40), lines: [3, 8] },
      ],
    };
    const result = migrateOperation(value, migrationReview());
    const check = await modelValidator('evidence', 'GraphqlDocumentBinding');
    expect(check(result.record), JSON.stringify(check.errors)).toBe(true);
    expect(result.operation).toMatchObject({
      component: 'app:shop',
      method: 'POST',
      persisted: true,
      trigger: 'load',
    });
    expect(result.record).toMatchObject({
      document,
      source: {
        repo: 'example/shop',
        path: 'queries/Order.ts',
        commit: 'b'.repeat(40),
        lines: [3, 8],
      },
      selections: [{ path: 'order' }, { path: 'order.id' }],
    });
    expect(migrateOperation(value, migrationReview())).toEqual(result);
  });
  it('preserves unsupported query text as an explicit review gap', () => {
    const review = migrationReview();
    const result = migrateOperation(
      {
        id: 'gql:unsupported',
        name: 'Unsupported',
        kind: 'query',
        client: 'app:shop',
        graph: 'graph:shop',
        document: 'not a query',
        sources: [{ repo: 'example/shop', path: 'x.ts', commit: 'b'.repeat(40) }],
      },
      review,
    );
    expect(result.record).toMatchObject({ document: 'not a query', selections: [] });
    expect(review.pending('graphql-documents')).toBe(1);
  });
  it('retains a complete cited document when its client remains unknown', async () => {
    const review = migrationReview();
    const document = 'query Unknown { value }';
    const source = {
      repo: 'example/shop',
      path: 'shared/query.ts',
      commit: 'b'.repeat(40),
      lines: [3, 8],
    };
    const result = migrateOperation(
      { id: 'gql:unknown', graph: 'graph:shop', document, sources: [source] },
      review,
    );
    const check = await modelValidator('workspace', 'Operation');
    expect(check(result.operation), JSON.stringify(check.errors)).toBe(true);
    expect(result.operation).not.toHaveProperty('component');
    expect(result.operation.graph).toBe('graph:shop');
    expect(result.record).toMatchObject({ document, source, selections: [{ path: 'value' }] });
    expect(review.pending('placements')).toBe(1);
    expect(review.pending('documents')).toBe(0);
  });
  it('leaves an absent client in review instead of choosing a component', () => {
    const review = migrationReview();
    const result = migrateOperation(
      { id: 'gql:unknown', document: 'query Unknown { value }' },
      review,
    );
    expect(result.operation).not.toHaveProperty('component');
    expect(review.pending('placements')).toBe(1);
    expect(review.pending('documents')).toBe(1);
  });
});
