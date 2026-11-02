import type { ScanDocument, SemanticNode } from '@/domain/scan/scan.generated';

import {
  profileGraph,
  profileMethod,
  profileScalar,
  type ProfileGraph,
} from './scan-profile-review-graph';
import {
  profileConstruction,
  profileLocalAtoms,
  profileLocalCalls,
  profileLocalNodes,
  profileLocalOperators,
} from './scan-profile-review-local';
import { methodRecipe } from './scan-profile-review-method';
import { profileTokenLineage } from './scan-profile-review-token-lineage';
import { targets } from './scan-semantic-query';

const CONNECT_FIELDS: readonly (string | boolean | null)[] = [
  'id',
  'buildEmails',
  'of',
  'of',
  'of',
  null,
  null,
  null,
  null,
  'givenName',
  null,
  'familyName',
  null,
  null,
  null,
  null,
  null,
  null,
  false,
  null,
  'of',
  null,
  null,
];

function connectClaims(graph: ProfileGraph): Readonly<Record<string, boolean>> {
  const decode = profileLocalNodes(graph, 'ConnectTokenService', 'decode');
  const empty = profileLocalNodes(graph, 'ConnectTokenService', 'isEmpty');
  const create = profileLocalNodes(
    graph,
    'ConnectTokenIndividualFactory',
    'createFromConnectToken',
  );
  const emails = profileLocalNodes(graph, 'ConnectTokenIndividualFactory', 'buildEmails');
  return {
    decodeAndConvert:
      profileLocalCalls(graph, decode, [
        'decode',
        'connect',
        'of',
        'map',
        'getClaims',
        'convertValue',
        'filter',
      ]) && profileLocalAtoms(decode, ['isPresent', 'ConnectToken']),
    emptyClaimFields:
      profileLocalCalls(graph, empty, [
        'email',
        'givenName',
        'familyName',
        'accesses',
        'isEmpty',
        'hasText',
      ]) && profileLocalOperators(empty, ['!', '&&']),
    individualConstruction: profileConstruction(graph, create, {
      type: 'Individual',
      arguments: CONNECT_FIELDS,
    }),
    contactInvoiceEmail:
      profileLocalCalls(graph, emails, ['email', 'hasText']) &&
      profileLocalAtoms(emails, ['CONTACT', 'INVOICE']),
  };
}

function claimArguments(graph: ProfileGraph): boolean {
  const nodes = ['isUserToken', 'toUser', 'email'].flatMap((method) =>
    profileLocalNodes(graph, 'EntraIdTokenService', method),
  );
  const claims = new Set(
    nodes
      .filter((node) => targets(graph, node, 'callee')[0]?.name === 'getClaimAsString')
      .flatMap((node) => targets(graph, node, 'argument'))
      .map((node) => profileScalar(graph, node.source)),
  );
  return ['oid', 'scp', 'idtyp', 'given_name', 'family_name'].every((claim) => claims.has(claim));
}

function entraClaims(graph: ProfileGraph): Readonly<Record<string, boolean>> {
  const decode = profileLocalNodes(graph, 'EntraIdTokenService', 'decode');
  const predicate = profileLocalNodes(graph, 'EntraIdTokenService', 'isUserToken');
  const email = profileLocalNodes(graph, 'EntraIdTokenService', 'email');
  const user = profileLocalNodes(graph, 'EntraIdTokenService', 'toUser');
  return {
    twoIssuers:
      profileLocalCalls(graph, decode, [
        'decode',
        'entraIdV1',
        'entraIdV2',
        'of',
        'filter',
        'map',
      ]) && profileLocalAtoms(decode, ['isUserToken', 'toUser']),
    claimNames: claimArguments(graph),
    delegatedPredicateAtoms:
      profileLocalCalls(graph, predicate, ['hasText', 'equalsIgnoreCase']) &&
      profileLocalOperators(predicate, ['&&', '!']) &&
      predicate.some((node) => node.value === 'app'),
    userConstruction:
      methodRecipe(graph, ['EntraIdTokenService', 'toUser'], {
        returns: [
          'EntraIdUser(jwt.getClaimAsString(OID_CLAIM),jwt.getClaimAsString(GIVEN_NAME_CLAIM),jwt.getClaimAsString(FAMILY_NAME_CLAIM),email(jwt))',
        ],
      }) &&
      profileConstruction(graph, user, {
        type: 'EntraIdUser',
        arguments: ['getClaimAsString', 'getClaimAsString', 'getClaimAsString', 'email'],
      }),
    emailFallbackAtoms:
      profileLocalCalls(graph, email, [
        'of',
        'map',
        'filter',
        'hasText',
        'contains',
        'findFirst',
        'orElse',
      ]) && profileLocalAtoms(email, ['UPN_CLAIM', 'PREFERRED_USERNAME_CLAIM', 'getClaimAsString']),
  };
}

function decoderTokenArgument(graph: ProfileGraph, decode: readonly SemanticNode[]): boolean {
  const argumentsUsed = new Set(
    decode.flatMap((node) => targets(graph, node, 'argument')).map((node) => node.source),
  );
  return profileMethod(graph, 'OidcTokenDecoder', 'decode').some((owner) => {
    const token = targets(graph, owner, 'parameter')[0];
    return (
      token !== undefined &&
      graph.values.some(
        (value) =>
          value.relation === 'reference' &&
          value.from === token.source &&
          argumentsUsed.has(value.to),
      )
    );
  });
}

function decoderBoundary(graph: ProfileGraph): Readonly<Record<string, boolean>> {
  const decode = profileLocalNodes(graph, 'OidcTokenDecoder', 'decode');
  const constructors = profileLocalNodes(graph, 'OidcTokenDecoder', '<init>');
  return {
    libraryFactory: profileLocalAtoms(constructors, ['fromIssuerLocation', 'JwtDecoders']),
    issuerCache: profileLocalCalls(graph, decode, [
      'hasText',
      'issuer',
      'contains',
      'computeIfAbsent',
      'decode',
    ]),
    tokenArgument: decoderTokenArgument(graph, decode),
  };
}

/** Claims and decoder source atoms; atom coverage is reported separately from complete predicate lineage. */
export function profileTokenSources(document: ScanDocument): Readonly<Record<string, boolean>> {
  const graph = profileGraph(document);
  const connect = connectClaims(graph);
  const entra = entraClaims(graph);
  const decoder = decoderBoundary(graph);
  const lineage = profileTokenLineage(graph);
  const entries: (readonly [string, boolean])[] = [
    ...Object.entries(connect).map(([key, value]): readonly [string, boolean] => [
      `connect.${key}`,
      value,
    ]),
    ...Object.entries(entra).map(([key, value]): readonly [string, boolean] => [
      `entra.${key}`,
      value,
    ]),
    ...Object.entries(decoder).map(([key, value]): readonly [string, boolean] => [
      `oidc.${key}`,
      value,
    ]),
    ...Object.entries(lineage),
  ];
  const clauses = Object.fromEntries(entries);
  return { ...clauses, supported: Object.values(clauses).every(Boolean) };
}
