import type { ProfileGraph } from './scan-profile-review-graph';
import { profileLocalNodes } from './scan-profile-review-local';
import { methodRecipe } from './scan-profile-review-method';
import { profileHasPattern, type ProfilePattern } from './scan-profile-review-pattern';
import { targets } from './scan-semantic-query';

function claim(name: string): ProfilePattern {
  return { call: 'getClaimAsString', receiver: { ref: 'jwt' }, args: [{ scalar: name }] };
}
function nonblank(value: ProfilePattern): ProfilePattern {
  return { call: 'hasText', receiver: 'StringUtils', args: [value] };
}
function negated(value: ProfilePattern): ProfilePattern {
  return { op: '!', operands: [value] };
}
function and(left: ProfilePattern, right: ProfilePattern): ProfilePattern {
  return { op: '&&', operands: [left, right] };
}

function connectLineage(graph: ProfileGraph): Readonly<Record<string, boolean>> {
  const nodes = (method: string) => profileLocalNodes(graph, 'ConnectTokenService', method);
  const tokenField = (field: string): ProfilePattern => ({
    call: field,
    receiver: { ref: 'token' },
    args: [],
  });
  const empty = and(
    and(
      and(negated(nonblank(tokenField('email'))), negated(nonblank(tokenField('givenName')))),
      negated(nonblank(tokenField('familyName'))),
    ),
    { call: 'isEmpty', receiver: tokenField('accesses'), args: [] },
  );
  const decode: ProfilePattern = {
    call: 'decode',
    args: [
      { ref: 'connectToken' },
      {
        call: 'of',
        receiver: 'Set',
        args: [{ call: 'connect', receiver: 'trustedIssuerSettings', args: [] }],
      },
    ],
  };
  const conversion: ProfilePattern = {
    call: 'convertValue',
    receiver: 'jsonMapper',
    args: [
      { call: 'getClaims', receiver: { ref: 'jwt' }, args: [] },
      { member: 'class', receiver: 'ConnectToken' },
    ],
  };
  const chain: ProfilePattern = {
    call: 'filter',
    args: ['isPresent'],
    receiver: { call: 'map', args: [{ lambda: conversion }], receiver: decode },
  };
  const returnsEmpty = nodes('isEmpty')
    .filter((node) => node.nodeKind === 'return')
    .some((node) =>
      targets(graph, node, 'returns').some((value) => profileHasPattern(graph, [value], empty)),
    );
  const present = methodRecipe(graph, ['ConnectTokenService', 'isPresent'], {
    branches: [{ condition: 'isEmpty(token)', returns: 'false' }],
    returns: ['true'],
  });
  const emails = profileLocalNodes(graph, 'ConnectTokenIndividualFactory', 'buildEmails');
  return {
    connectDecodeChain: profileHasPattern(graph, nodes('decode'), chain),
    connectEmptyPredicate: returnsEmpty && present,
    connectContactInvoiceRoles: profileHasPattern(graph, emails, {
      call: 'of',
      receiver: 'Set',
      args: ['CONTACT', 'INVOICE'],
    }),
  };
}

function entraLineage(graph: ProfileGraph): Readonly<Record<string, boolean>> {
  const nodes = (method: string) => profileLocalNodes(graph, 'EntraIdTokenService', method);
  const predicate = and(
    and(nonblank(claim('oid')), nonblank(claim('scp'))),
    negated({ call: 'equalsIgnoreCase', receiver: { scalar: 'app' }, args: [claim('idtyp')] }),
  );
  const decode: ProfilePattern = {
    call: 'decode',
    args: [
      { ref: 'token' },
      {
        call: 'of',
        receiver: 'Set',
        args: [
          { call: 'entraIdV1', receiver: 'trustedIssuerSettings', args: [] },
          { call: 'entraIdV2', receiver: 'trustedIssuerSettings', args: [] },
        ],
      },
    ],
  };
  const chain: ProfilePattern = {
    call: 'map',
    args: ['toUser'],
    receiver: { call: 'filter', args: ['isUserToken'], receiver: decode },
  };
  const emailFilter = and(nonblank({ ref: 'value' }), {
    call: 'contains',
    receiver: { ref: 'value' },
    args: [{ scalar: '@' }],
  });
  return {
    entraDecodeChain: profileHasPattern(graph, nodes('decode'), chain),
    entraDelegatedPredicate: profileHasPattern(graph, nodes('isUserToken'), predicate),
    entraOrderedEmailClaims: profileHasPattern(graph, nodes('email'), {
      call: 'of',
      receiver: 'Stream',
      args: [{ scalar: 'upn' }, { scalar: 'preferred_username' }],
    }),
    entraEmailFilter: profileHasPattern(graph, nodes('email'), {
      call: 'filter',
      args: [{ lambda: emailFilter }],
    }),
    entraEmailFirstNonblank: profileHasPattern(graph, nodes('email'), {
      call: 'orElse',
      args: [null],
      receiver: { call: 'findFirst', args: [], receiver: { call: 'filter' } },
    }),
  };
}

export function profileTokenLineage(graph: ProfileGraph): Readonly<Record<string, boolean>> {
  return { ...connectLineage(graph), ...entraLineage(graph) };
}
