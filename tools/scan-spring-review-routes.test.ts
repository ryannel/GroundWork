import { describe, expect, it } from 'vitest';

import { scanFixture } from '@/../test/scan-kit';
import type {
  ScanDocument,
  SpringRouteBinding,
  SpringSchemaBinding,
} from '@/domain/scan/scan.generated';

import { reviewSpringRoutes } from './scan-spring-review-routes';

const EXPECTED = [
  { name: 'read', verb: 'GET', path: '/people/{id}', schemas: ['Person'], returnType: 'Person' },
];

function fixture(): ScanDocument {
  const document = scanFixture();
  const source = document.sources[0]?.id ?? '';
  const route: SpringRouteBinding = {
    kind: 'route_binding',
    id: 'route',
    controller: 'Controller',
    source_ids: [source],
    method: {
      name: 'read',
      parameter_types: [],
      return_type: 'Person',
      declaration_source_id: source,
      implementation_source_id: source,
    },
    http_method: 'GET',
    path: '/people/{id}',
    parameters: [],
    documented_response_statuses: [],
    response_json_views: [],
    request_validation_groups: [],
    security_binding_ids: [],
    schema_binding_ids: ['person'],
    uncertainties: [],
  };
  const schema: SpringSchemaBinding = {
    kind: 'schema_binding',
    id: 'person',
    typeName: 'example.Person',
    source,
    support: [],
    direction: 'source',
    properties: [],
    inheritedTypes: [],
    genericArguments: [],
    enumValues: [],
    polymorphism: null,
    completeness: 'partial',
    gaps: [],
    profiles: [
      {
        routeId: 'route',
        direction: 'response',
        validationGroups: [],
        views: [],
        fields: [],
        completeness: 'partial',
        gaps: [],
      },
    ],
  };
  return { ...document, framework: [route, schema] };
}

describe('independent Spring route question review', () => {
  it('requires the exact source inventory and source-backed type profile links', () => {
    const document = fixture();
    expect(reviewSpringRoutes(document, EXPECTED).supported).toBe(true);
    const removedLink = {
      ...document,
      framework:
        document.framework?.map((record) =>
          record.kind === 'route_binding' ? { ...record, schema_binding_ids: [] } : record,
        ) ?? [],
    };
    const removedSchema = {
      ...document,
      framework: document.framework?.filter((record) => record.kind !== 'schema_binding') ?? [],
    };
    expect(reviewSpringRoutes(removedLink, EXPECTED).supported).toBe(false);
    expect(reviewSpringRoutes(removedSchema, EXPECTED).supported).toBe(false);
    expect(reviewSpringRoutes({ ...document, sources: [] }, EXPECTED).supported).toBe(false);
  });
  it('rejects a changed prefix or severed schema profile with displayed type unchanged', () => {
    const document = fixture();
    const wrongPath = {
      ...document,
      framework:
        document.framework?.map((record) =>
          record.kind === 'route_binding' ? { ...record, path: '/{id}' } : record,
        ) ?? [],
    };
    const removedProfile = {
      ...document,
      framework:
        document.framework?.map((record) =>
          record.kind === 'schema_binding' ? { ...record, profiles: [] } : record,
        ) ?? [],
    };
    const wrongType = {
      ...document,
      framework:
        document.framework?.map((record) =>
          record.kind === 'route_binding'
            ? { ...record, method: { ...record.method, return_type: 'Other' } }
            : record,
        ) ?? [],
    };
    const wrongDirection: ScanDocument = {
      ...document,
      framework:
        document.framework?.map((record) =>
          record.kind === 'schema_binding'
            ? {
                ...record,
                profiles: record.profiles.map((profile) => ({ ...profile, direction: 'request' })),
              }
            : record,
        ) ?? [],
    };
    expect(reviewSpringRoutes(wrongPath, EXPECTED).supported).toBe(false);
    expect(reviewSpringRoutes(removedProfile, EXPECTED).supported).toBe(false);
    expect(reviewSpringRoutes(wrongType, EXPECTED).supported).toBe(false);
    expect(reviewSpringRoutes(wrongDirection, EXPECTED).supported).toBe(false);
  });
});
