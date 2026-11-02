import type { ScanDocument, SpringRouteBinding } from '@/domain/scan/scan.generated';

export interface ExpectedSpringRoute {
  readonly name: string;
  readonly verb: string;
  readonly path: string;
  readonly schemas: readonly string[];
  readonly returnType: string;
}

const CUSTOMER = '/v1/customers';
const DETAIL = 'CustomerResponse';

/** Independently read from the pinned controller declarations, before inspecting bindings. */
const SOURCE_ROUTES: readonly Omit<ExpectedSpringRoute, 'returnType'>[] = [
  { name: 'getCustomer', verb: 'GET', path: `${CUSTOMER}/{customerId}`, schemas: [DETAIL] },
  {
    name: 'archiveCustomer',
    verb: 'PATCH',
    path: `${CUSTOMER}/{customerId}/archive`,
    schemas: [DETAIL],
  },
  {
    name: 'unarchiveCustomer',
    verb: 'PATCH',
    path: `${CUSTOMER}/{customerId}/unarchive`,
    schemas: [DETAIL],
  },
  {
    name: 'getCustomers',
    verb: 'POST',
    path: `${CUSTOMER}/customer-ids`,
    schemas: [DETAIL, 'CustomerIdsRequest'],
  },
  { name: 'createCustomer', verb: 'POST', path: CUSTOMER, schemas: [DETAIL, 'CustomerRequest'] },
  {
    name: 'updateCustomer',
    verb: 'PUT',
    path: `${CUSTOMER}/{customerId}`,
    schemas: [DETAIL, 'CustomerRequest'],
  },
  {
    name: 'patchCustomer',
    verb: 'PATCH',
    path: `${CUSTOMER}/{customerId}`,
    schemas: [DETAIL, 'CustomerRequest'],
  },
  {
    name: 'addIndividual',
    verb: 'POST',
    path: `${CUSTOMER}/{customerId}/individual`,
    schemas: [DETAIL, 'IndividualRequest'],
  },
  {
    name: 'updateIndividual',
    verb: 'PUT',
    path: `${CUSTOMER}/{customerId}/individual/{id}`,
    schemas: [DETAIL, 'IndividualRequest'],
  },
  {
    name: 'patchIndividual',
    verb: 'PATCH',
    path: `${CUSTOMER}/{customerId}/individual/{id}`,
    schemas: [DETAIL, 'IndividualRequest'],
  },
  {
    name: 'deleteIndividual',
    verb: 'DELETE',
    path: `${CUSTOMER}/{customerId}/individual/{id}`,
    schemas: [DETAIL],
  },
  {
    name: 'updateOrganization',
    verb: 'PUT',
    path: `${CUSTOMER}/{customerId}/organization/{id}`,
    schemas: [DETAIL, 'CorporateEntityRequest'],
  },
  {
    name: 'addOrganization',
    verb: 'POST',
    path: `${CUSTOMER}/{customerId}/organization`,
    schemas: [DETAIL, 'ICorporateEntityRequest'],
  },
  {
    name: 'patchOrganization',
    verb: 'PATCH',
    path: `${CUSTOMER}/{customerId}/organization/{id}`,
    schemas: [DETAIL, 'CorporateEntityRequest'],
  },
  {
    name: 'duplicateCustomer',
    verb: 'POST',
    path: `${CUSTOMER}/{customerId}/duplicate`,
    schemas: ['DuplicateResponse', 'DuplicateRequest'],
  },
  {
    name: 'getCustomerAuditLog',
    verb: 'GET',
    path: `${CUSTOMER}/{customerId}/audit-logs/{version}`,
    schemas: ['CustomerAuditLog'],
  },
  {
    name: 'getCustomerAuditLogs',
    verb: 'GET',
    path: `${CUSTOMER}/{customerId}/audit-log`,
    schemas: ['AuditLogPage'],
  },
  {
    name: 'migrateCustomer',
    verb: 'POST',
    path: '/v1/migrate',
    schemas: [DETAIL, 'MigrateCustomerRequest'],
  },
  { name: 'deleteCustomer', verb: 'DELETE', path: '/v1/migrate/{customerId}', schemas: [] },
];

function expectedReturn(route: Omit<ExpectedSpringRoute, 'returnType'>): string {
  if (route.name === 'getCustomers') return 'BaseResponse<List<CustomerResponse>>';
  if (route.name === 'getCustomerAuditLogs') return 'AuditLogPage';
  return `BaseResponse<${route.schemas[0] ?? 'Void'}>`;
}

export const CUSTOMER_SPRING_ROUTES: readonly ExpectedSpringRoute[] = SOURCE_ROUTES.map(
  (route) => ({ ...route, returnType: expectedReturn(route) }),
);

function schemaLinked(document: ScanDocument, route: SpringRouteBinding, name: string): boolean {
  const declared = [...route.method.parameter_types, route.method.return_type].flatMap(
    (type) => type.match(/[A-Za-z_$][\w$.]*/gu) ?? [],
  );
  if (!declared.some((token) => token.split('.').at(-1) === name)) return false;
  const schemas = (document.framework ?? []).filter(
    (record) => record.kind === 'schema_binding' && record.typeName.split('.').at(-1) === name,
  );
  if (schemas.length !== 1) return false;
  const schema = schemas[0];
  if (schema?.kind !== 'schema_binding') return false;
  const responseTypes = route.method.return_type.match(/[A-Za-z_$][\w$.]*/gu) ?? [];
  const direction = responseTypes.some((token) => token.split('.').at(-1) === name)
    ? 'response'
    : 'request';
  return (
    (route.schema_binding_ids ?? []).includes(schema.id) &&
    schema.profiles.some(
      (profile) => profile.routeId === route.id && profile.direction === direction,
    ) &&
    document.sources.some((source) => source.id === schema.source)
  );
}

function linked(document: ScanDocument, route: SpringRouteBinding): boolean {
  const sourceIds = new Set(document.sources.map((source) => source.id));
  const required = [
    ...route.source_ids,
    route.method.declaration_source_id,
    route.method.implementation_source_id ?? '',
    ...route.parameters.map((parameter) => parameter.source_id),
  ];
  return (
    required.every((id) => sourceIds.has(id)) &&
    JSON.stringify(route.method.parameter_types) ===
      JSON.stringify(route.parameters.map((parameter) => parameter.type)) &&
    route.method.return_type.length > 0
  );
}

/** This checks inventory and declared type references, not complete external wire serialisation. */
export function reviewSpringRoutes(
  document: ScanDocument,
  expected: readonly ExpectedSpringRoute[],
): { readonly supported: boolean; readonly routes: number; readonly failures: readonly string[] } {
  const routes = (document.framework ?? []).filter((record) => record.kind === 'route_binding');
  const failures = expected.flatMap((item) => {
    const matches = routes.filter(
      (route) =>
        route.method.name === item.name &&
        route.http_method === item.verb &&
        route.path === item.path,
    );
    const route = matches[0];
    if (matches.length !== 1 || !route) return [`Missing or ambiguous route ${item.name}`];
    if (route.method.return_type.replaceAll(/\s/gu, '') !== item.returnType) {
      return [`Wrong return type ${item.name}`];
    }
    if (!linked(document, route)) return [`Missing source/type declaration link ${item.name}`];
    return item.schemas
      .filter((name) => !schemaLinked(document, route, name))
      .map((name) => `Missing schema reference ${item.name}: ${name}`);
  });
  if (routes.length !== expected.length) {
    failures.push('Route denominator differs from the source inventory.');
  }
  return { supported: failures.length === 0, routes: routes.length, failures };
}
