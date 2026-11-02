import type {
  ScanDocument,
  SpringRouteBinding,
  SpringSchemaBinding,
  SpringSecurityBinding,
} from '@/domain/scan/scan.generated';

import { scanFixture } from './scan-kit';

export function springRecordFixture(): {
  readonly document: ScanDocument;
  readonly route: SpringRouteBinding;
  readonly schema: SpringSchemaBinding;
  readonly security: SpringSecurityBinding;
} {
  const source = 'source:handler';
  const security: SpringSecurityBinding = {
    kind: 'security_binding',
    id: 'security:test',
    source_ids: [source],
    mechanism: 'filter_chain',
    scope: 'test',
    policies: [{ expression: 'authenticated', source_id: source }],
    activation: { state: 'unresolved', source_ids: [source] },
    authentication: [],
    authorisation: [],
    enforcement_chain: [{ stage: 'filter', source_ids: [source], detail: 'Source declaration' }],
    uncertainties: [],
  };
  const route: SpringRouteBinding = {
    kind: 'route_binding',
    id: 'route:test',
    source_ids: [source],
    controller: 'Controller',
    method: {
      name: 'create',
      parameter_types: ['Request'],
      return_type: 'Response',
      declaration_source_id: source,
      implementation_source_id: source,
    },
    http_method: 'POST',
    path: '/customers',
    parameters: [
      {
        name: 'body',
        java_name: 'request',
        type: 'Request',
        location: 'body',
        source_id: source,
        validation_groups: [],
        json_views: [],
      },
    ],
    response_json_views: [],
    request_validation_groups: [],
    documented_response_statuses: [],
    security_binding_ids: [security.id],
    schema_binding_ids: ['schema:test'],
    uncertainties: [],
  };
  const schema: SpringSchemaBinding = {
    kind: 'schema_binding',
    id: 'schema:test',
    typeName: 'Request',
    direction: 'source',
    properties: [
      {
        name: 'id',
        jsonName: 'id',
        type: 'String',
        source,
        constraints: [],
        views: [],
        presence: 'unknown',
        nullable: 'unknown',
        access: 'declared_field',
        annotations: [{ name: 'NotNull', arguments: {}, source }],
      },
    ],
    inheritedTypes: [],
    genericArguments: [],
    enumValues: [],
    polymorphism: null,
    completeness: 'partial',
    gaps: [],
    source,
    support: [source],
    profiles: [
      {
        routeId: route.id,
        direction: 'request',
        validationGroups: [],
        views: [],
        fields: [],
        completeness: 'partial',
        gaps: [],
      },
    ],
  };
  const document = { ...scanFixture(), framework: [route, schema, security] };
  return { document, route, schema, security };
}
