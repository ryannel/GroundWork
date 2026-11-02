import type { GraphqlBinding, ScanDocument } from '@/domain/scan/scan.generated';

import {
  profileCall,
  profileGraph,
  profileInput,
  profileMethod,
  profileReceiver,
  profileScalar,
  type ProfileGraph,
} from './scan-profile-review-graph';
import { targets } from './scan-semantic-query';

interface GraphqlExpectation {
  readonly file: string;
  readonly method: string;
  readonly client: string;
  readonly document: string;
  readonly variable: string;
  readonly field: string;
  readonly argument: string;
  readonly result: string;
  readonly leaves: readonly string[];
}
const EXPECTED: readonly GraphqlExpectation[] = [
  {
    file: 'CdbClient',
    method: 'getConsumer',
    client: 'cdb',
    document: 'getConsumer',
    variable: 'cdbId',
    field: 'consumerCdb',
    argument: 'consumerId',
    result: 'CdbConsumer',
    leaves: [
      'consumerId',
      'language',
      'market',
      'person.firstName',
      'person.additionalName',
      'person.surname',
      'person.gender',
      'person.dateOfBirth',
      'person.initials',
      'person.titleDescription',
      'emails.emailAddress',
      'telephones.telephoneNumber',
      'addresses.addressLine1',
      'addresses.postalCodeNumber',
      'addresses.city',
    ],
  },
  {
    file: 'CommercialPartnerClient',
    method: 'getActivePartnerByPartnerId',
    client: 'commercial-partner',
    document: 'getPartnerById',
    variable: 'id',
    field: 'partnerOrganizationalUnit',
    argument: 'partnerId',
    result: 'PartnerOrganizationalUnit',
    leaves: [
      'partnerId',
      'partnerOrganizationalUnitNames.languageCode',
      'partnerOrganizationalUnitNames.name',
      'partnerOrganizationalUnitFacilities.active',
      'partnerOrganizationalUnitFacilities.facilityType',
      'partnerOrganizationalUnitFacilities.generalContactEmail',
      'partnerOrganizationalUnitFacilities.phone',
      'partnerOrganizationalUnitFacilities.addresses.languageCode',
      'partnerOrganizationalUnitFacilities.addresses.addressLine1',
      'partnerOrganizationalUnitFacilities.addresses.postalCode',
      'partnerOrganizationalUnitFacilities.addresses.city',
      'partnerOrganizationalUnitFacilities.addresses.countryCode',
    ],
  },
];

function graphqlDocument(graph: ProfileGraph, expected: GraphqlExpectation) {
  const documents = graph.document.bindings?.filter(
    (record) =>
      record.kind === 'graphql_document_binding' && record.document_name === expected.document,
  );
  const document = documents?.[0];
  if (documents?.length !== 1 || document?.kind !== 'graphql_document_binding') return false;
  const root = document.selections.find((selection) => selection.path === expected.field);
  const variable = document.variables.find((entry) => entry.name === expected.variable);
  return (
    document.operation_type === 'query' &&
    variable?.type === 'String!' &&
    root?.arguments.some(
      (argument) => argument.name === expected.argument && argument.variable === expected.variable,
    ) === true &&
    expected.leaves.every((path) =>
      document.selections.some((selection) => selection.path === `${expected.field}.${path}`),
    )
  );
}

function variableInput(graph: ProfileGraph, boundary: GraphqlBinding) {
  const owner = graph.bySource.get(boundary.owner_source);
  return (
    owner !== undefined &&
    boundary.variables.length === 1 &&
    boundary.variables.every(
      (variable) =>
        variable.value_sources.length === 1 &&
        variable.value_sources.every((source) => profileInput(graph, owner, source)),
    )
  );
}

function requestChain(graph: ProfileGraph, boundary: GraphqlBinding) {
  const execution = graph.bySource.get(boundary.execution_source);
  const variable = profileReceiver(graph, execution);
  const document = profileReceiver(graph, variable);
  const executionCall = graph.calls.find((call) => call.call === execution?.source);
  const executes =
    executionCall !== undefined &&
    ['executeSync', 'retrieveSync'].includes(executionCall.methodName);
  const variableMatches =
    variable !== undefined &&
    variable.source === boundary.variables[0]?.source &&
    profileCall(graph, variable.source, 'variable') !== undefined;
  const documentMatches =
    document?.source === boundary.document_source &&
    profileCall(graph, document.source, 'documentName') !== undefined;
  return (
    executes &&
    variableMatches &&
    documentMatches &&
    profileReceiver(graph, document)?.source === boundary.client.receiver_source
  );
}

function documentAtom(graph: ProfileGraph, boundary: GraphqlBinding, expected: GraphqlExpectation) {
  const document = graph.bySource.get(boundary.document_source);
  const variable = graph.bySource.get(boundary.variables[0]?.source ?? '');
  const field = graph.bySource.get(boundary.response.field_source ?? '');
  return (
    profileScalar(graph, targets(graph, document, 'argument')[0]?.source ?? '') ===
      expected.document &&
    profileScalar(graph, targets(graph, variable, 'argument')[0]?.source ?? '') ===
      expected.variable &&
    profileScalar(graph, targets(graph, field, 'argument')[0]?.source ?? '') === expected.field
  );
}

function reviewBoundary(
  graph: ProfileGraph,
  expected: GraphqlExpectation,
): Readonly<Record<string, boolean>> {
  const owners = profileMethod(graph, expected.file, expected.method);
  const boundaries = graph.document.bindings?.filter(
    (record) => record.kind === 'graphql_binding' && record.owner_source === owners[0]?.source,
  );
  const boundary = boundaries?.[0];
  if (owners.length !== 1 || boundaries?.length !== 1 || boundary?.kind !== 'graphql_binding') {
    return { uniqueBoundary: false, supported: false };
  }
  const clauses = {
    uniqueBoundary: true,
    logicalClient:
      boundary.client.logical_name === expected.client && boundary.client.registry_source !== null,
    requestChain: requestChain(graph, boundary),
    requestAtoms: documentAtom(graph, boundary, expected),
    variableInput: variableInput(graph, boundary),
    documentContract: graphqlDocument(graph, expected),
    resultType: boundary.response.type?.endsWith(`.${expected.result}`) === true,
    resultField: boundary.response.field_path === expected.field,
  };
  return { ...clauses, supported: Object.values(clauses).every(Boolean) };
}

/** Native document/variable and fluent-source checks; failure and caller clauses are separate. */
export function profileGraphqlBoundaries(
  document: ScanDocument,
): Readonly<Record<string, Readonly<Record<string, boolean>>>> {
  const graph = profileGraph(document);
  return Object.fromEntries(
    EXPECTED.map((expected) => [expected.client, reviewBoundary(graph, expected)]),
  );
}
