import type { ScanDocument } from '@/domain/scan/scan.generated';
import type { OutboundBinding } from '@/infrastructure/scan/spring-outbound-types';

import {
  profileCall,
  profileGraph,
  profileInput,
  profileMethod,
  profileReceiver,
  profileReference,
  profileReturned,
  type ProfileGraph,
} from './scan-profile-review-graph';
import { descendants, targets } from './scan-semantic-query';

const FLEET = 'com.volvocars.ecom.customerservice.fleet.response.';
const EXPECTED = [
  ['getFleetAccount', '/v1/fleetaccounts/{fleetAccountId}', `${FLEET}FleetAccountResponse`],
  [
    'getOrganizationalUnits',
    '/v1/fleetaccounts/{fleetAccountId}/organizational-units',
    `${FLEET}OrganizationalUnitsResponse`,
  ],
] as const;

function requestChain(graph: ProfileGraph, boundary: OutboundBinding) {
  const chain = ['getBody', 'toEntity', 'retrieve', 'accept', 'uri', 'get'];
  let current = graph.bySource.get(boundary.response.body_source);
  for (const method of chain) {
    if (!current || !profileCall(graph, current.source, method)) return false;
    current = profileReceiver(graph, current);
  }
  return current?.source === boundary.client.receiver_source;
}

function clientOrigin(graph: ProfileGraph, boundary: OutboundBinding) {
  const registry = graph.calls.find(
    (call) =>
      call.call === boundary.client.registry_source &&
      call.methodName === 'getClient' &&
      call.receiverType === 'com.volvocars.ecom.restclient.RestClientRegistry',
  );
  return (
    registry !== undefined &&
    graph.values.some(
      (value) =>
        value.relation === 'assignment' &&
        value.from === registry.call &&
        profileReference(graph, value.to, boundary.client.receiver_source),
    )
  );
}

function returnProjection(graph: ProfileGraph, boundary: OutboundBinding) {
  const owner = graph.bySource.get(boundary.owner_source);
  if (!owner) return false;
  const initialise = graph.values.find(
    (value) => value.relation === 'initializer' && value.from === boundary.response.body_source,
  );
  const nullCheck = graph.calls.find(
    (call) =>
      call.caller === owner.source &&
      call.methodName === 'nullCheck' &&
      call.resolution === 'exact',
  );
  if (!initialise || !nullCheck) return false;
  const argument = graph.values.find(
    (value) =>
      value.relation === 'argument_parameter' &&
      value.call === nullCheck.call &&
      profileReference(graph, initialise.to, value.from),
  );
  const returns = graph.values.some(
    (value) =>
      value.relation === 'return_call' &&
      value.to === nullCheck.call &&
      argument !== undefined &&
      profileReference(graph, argument.to, value.from),
  );
  return returns && projectedReturn(graph, { boundary, helperSource: nullCheck.call });
}

function projectedReturn(
  graph: ProfileGraph,
  input: { readonly boundary: OutboundBinding; readonly helperSource: string },
) {
  const { boundary, helperSource } = input;
  const schema = graph.document.framework?.find(
    (record) => record.kind === 'schema_binding' && record.typeName === boundary.response.type,
  );
  if (schema?.kind !== 'schema_binding') return false;
  const field = schema.properties.find((property) => property.name === 'data');
  return graph.values.some(
    (value) =>
      value.relation === 'field_projection' &&
      value.from === field?.source &&
      profileReceiver(graph, graph.bySource.get(value.to))?.source === helperSource &&
      returnedProjection(graph, boundary.owner_source, value.to),
  );
}

function returnedProjection(graph: ProfileGraph, ownerSource: string, value: string) {
  const owner = graph.bySource.get(ownerSource);
  return owner !== undefined && profileReturned(graph, owner, value);
}
function failureThrown(graph: ProfileGraph, caughtSource: string, thrownSource: string | null) {
  const caught = graph.bySource.get(caughtSource);
  const statements = targets(graph, caught, 'body').flatMap((body) => descendants(graph, body));
  return statements
    .filter((node) => node.nodeKind === 'throw')
    .some((node) => targets(graph, node, 'value').some((value) => value.source === thrownSource));
}

function failureTranslations(graph: ProfileGraph, boundary: OutboundBinding, method: string) {
  const expected =
    method === 'getFleetAccount'
      ? [
          'BadRequest:FleetAccountBadRequestException',
          'NotFound:FleetAccountNotFoundException',
          'RestClientException:FleetServiceException',
        ]
      : ['RestClientException:FleetServiceException'];
  const actual = boundary.failure_paths.map((failure) =>
    [failure.caught_type.split('.').at(-1), failure.thrown_type?.split('.').at(-1)].join(':'),
  );
  return (
    JSON.stringify(actual.toSorted((a, b) => a.localeCompare(b))) === JSON.stringify(expected) &&
    boundary.failure_paths.every((failure) =>
      failureThrown(graph, failure.source, failure.thrown_source),
    )
  );
}

/** Two bounded source boundary checks; neither claims the complete frozen Q13. */
export function profileFleetBoundaries(
  document: ScanDocument,
): Readonly<Record<string, Readonly<Record<string, boolean>>>> {
  const graph = profileGraph(document);
  return Object.fromEntries(
    EXPECTED.map(
      ([method, template, response]): readonly [string, Readonly<Record<string, boolean>>] => {
        const owners = profileMethod(graph, 'FleetClient', method);
        const selected = document.bindings?.filter(
          (record) =>
            record.kind === 'outbound_binding' && record.owner_source === owners[0]?.source,
        );
        const boundary = selected?.[0];
        if (
          owners.length !== 1 ||
          selected?.length !== 1 ||
          boundary?.kind !== 'outbound_binding'
        ) {
          return [method, { uniqueBoundary: false, supported: false }];
        }
        const clauses = {
          uniqueBoundary: true,
          method: boundary.request.method === 'GET',
          template: boundary.request.template === template,
          chain: requestChain(graph, boundary),
          logicalClient: boundary.client.logical_name === 'fleet' && clientOrigin(graph, boundary),
          input: fleetInput(graph, boundary),
          response: boundary.response.type === response && returnProjection(graph, boundary),
          failures: failureTranslations(graph, boundary, method),
        };
        return [method, { ...clauses, supported: Object.values(clauses).every(Boolean) }];
      },
    ),
  );
}

function fleetInput(graph: ProfileGraph, boundary: OutboundBinding) {
  const owner = graph.bySource.get(boundary.owner_source);
  const [argument] = boundary.request.argument_sources;
  return (
    owner !== undefined &&
    argument !== undefined &&
    boundary.request.argument_sources.length === 1 &&
    profileInput(graph, owner, argument)
  );
}
