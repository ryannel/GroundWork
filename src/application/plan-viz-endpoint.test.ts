// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';

import { deliveryTime } from '@/../test/fixtures/acme/plans/contracts-delivery-time';
import { modelOf } from '@/../test/plan-kit';
import {
  callersOf,
  copyablePath,
  interfaceEndpoints,
  parseSig,
  pathParams,
  pathParts,
  sharedFacts,
  typedParams,
} from '@/application/plan-viz-endpoint';

const load = () => modelOf(deliveryTime());

describe('signatures', () => {
  it('splits several signatures and shared verbs', () => {
    expect(parseSig('GET|PUT /a/{id}; PUT /b')).toEqual([
      { verbs: ['GET', 'PUT'], path: '/a/{id}' },
      { verbs: ['PUT'], path: '/b' },
    ]);
    expect(parseSig('query product(sku)')).toEqual([{ verbs: ['query'], path: 'product(sku)' }]);
    expect(parseSig()).toEqual([]);
  });

  it('keeps a verb written twice once, so each badge has its own key', () => {
    expect(parseSig('GET|POST|PUT|DELETE|POST /v1/x')).toEqual([
      { verbs: ['GET', 'POST', 'PUT', 'DELETE'], path: '/v1/x' },
    ]);
  });

  it('picks out path params and a dimmed query', () => {
    const { parts, query } = pathParts('/a/{id}/b?x={y}');
    expect(parts.filter((p) => p.param).map((p) => p.text)).toEqual(['{id}']);
    expect(query.map((p) => p.text).join('')).toBe('?x={y}');
    expect(pathParams('GET /a/{id}/b/{line}?in_stock&q={term}')).toEqual({
      path: ['id', 'line'],
      query: ['in_stock', 'q'],
    });
  });

  it('copies a path for a verb but not for a GraphQL word', () => {
    expect(copyablePath({ sig: 'GET /a/{id}' })).toBe('/a/{id}');
    expect(copyablePath({ sig: 'query product(sku)' })).toBe('');
  });
});

describe('an interface in the plan', () => {
  it('lists endpoints, says what they share, types params and finds callers', () => {
    const model = load();
    const eps = interfaceEndpoints(model, 'if:products-rest', 'diff');
    expect(eps.map((e) => e.id)).toEqual(['api:products-get', 'api:products-update']);
    expect(sharedFacts(eps)).toEqual({ auth: 'staff SSO', idempotent: true });
    expect(sharedFacts(interfaceEndpoints(model, 'if:products-rest', 'asIs'))).toEqual({
      idempotent: true,
    });
    expect(sharedFacts([])).toEqual({});
    const [, save] = eps;
    const params = typedParams(model, save!, { names: ['sku'], mode: 'toBe' });
    expect(params).toHaveLength(1);
    expect(callersOf(model, 'api:products-update', 'diff').map((c) => c.svc)).toEqual([
      'svc:product-admin',
    ]);
    expect(callersOf(model, 'api:products-get', 'diff')).toEqual([]);
    expect(interfaceEndpoints(model, 'if:nothing', 'asIs')).toEqual([]);
  });
});
