import { describe, expect, it } from 'vitest';

import type { AreaEndpointView } from '@/application/workspace-area';

import { apiSurface, surfaceLabel } from './api-surface';

const endpoint = (signature: string, index: number): AreaEndpointView => ({
  id: `api:${String(index)}`,
  signature,
  summary: 'Operation',
  request: null,
  response: null,
  callers: [],
  explorer: null,
});

describe('API surface overview', () => {
  it('groups operations by resource, retaining all versions and identities', () => {
    const endpoints = [
      'GET /api/v1/offers',
      'POST /v2/offers/{id}/commit',
      'GET /api/v1/settings?market=gb',
    ].map(endpoint);
    const groups = apiSurface(endpoints);
    expect(groups).toHaveLength(2);
    expect(surfaceLabel(groups[0]!)).toBe('REST /offers · v1, v2');
    expect(groups[0]?.endpoints.map((port) => port.id)).toEqual(['api:0', 'api:1']);
    expect(surfaceLabel(groups[1]!)).toBe('REST /settings · v1');
  });

  it('retains route prefixes other than generic api and handles parameterised versions', () => {
    const groups = apiSurface(
      ['GET /api/v{version}/offers/{offerId}', 'GET /v1/admin/settings'].map(endpoint),
    );
    expect(surfaceLabel(groups[0]!)).toBe('REST /offers · v{version}');
    expect(surfaceLabel(groups[1]!)).toBe('REST /admin · v1');
  });

  it('keeps GraphQL and unknown interfaces separate without pretending they are REST', () => {
    const groups = apiSurface(
      [
        'Query.offer(id): Offer',
        'Mutation.updateOffer: Offer',
        'PriceBreakdownQuery',
        'grpc CalculatePrice',
      ].map(endpoint),
    );
    expect(groups.map((group) => group.protocol)).toEqual(['GraphQL', 'API']);
    expect(groups[0]?.endpoints).toHaveLength(3);
    expect(apiSurface([])).toEqual([]);
  });

  it('does not silently drop groups beyond the old eight-endpoint bank', () => {
    const groups = apiSurface(
      Array.from({ length: 12 }, (_, index) =>
        endpoint(`GET /v1/resource-${String(index)}`, index),
      ),
    );
    expect(groups).toHaveLength(12);
    expect(groups.flatMap((group) => group.endpoints)).toHaveLength(12);
  });

  it('uses the recorded interface protocol and version ahead of signature guesses', () => {
    const groups = apiSurface([
      { ...endpoint('POST /graphql', 0), protocol: 'graphql', version: '2026-10' },
      { ...endpoint('CalculatePrice', 1), protocol: 'grpc', version: 'v2' },
    ]);
    expect(groups.map(surfaceLabel)).toEqual(['GraphQL API · 2026-10', 'gRPC API · v2']);
  });
});
