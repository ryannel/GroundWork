// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest';

import { derive } from '@/application/plan/derive';
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

vi.mock('server-only', () => ({}));

async function load() {
  const { readPlan } = await import('@/infrastructure/plan-store');
  const loaded = await readPlan('alder-finch', 'delivery-promise');
  return derive(loaded.plan!);
}

describe('signatures', () => {
  it('splits several signatures and shared verbs', () => {
    expect(parseSig('GET|PUT /a/{id}; PUT /b')).toEqual([
      { verbs: ['GET', 'PUT'], path: '/a/{id}' },
      { verbs: ['PUT'], path: '/b' },
    ]);
    expect(parseSig('query product(sku)')).toEqual([{ verbs: ['query'], path: 'product(sku)' }]);
    expect(parseSig()).toEqual([]);
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
  it('lists endpoints, says what they share, types params and finds callers', async () => {
    const model = await load();
    const eps = interfaceEndpoints(model, 'if:pim-rest', 'diff');
    expect(eps.map((e) => e.id)).toEqual(['api:pim-save-product', 'api:pim-get-product']);
    expect(sharedFacts(eps)).toEqual({ auth: 'staff SSO', idempotent: true });
    expect(sharedFacts([])).toEqual({});
    const [save] = eps;
    const params = typedParams(model, save!, { names: ['sku'], mode: 'toBe' });
    expect(params).toHaveLength(1);
    expect(Array.isArray(callersOf(model, 'api:pim-save-product', 'diff'))).toBe(true);
    expect(interfaceEndpoints(model, 'if:nothing', 'asIs')).toEqual([]);
  });
});
