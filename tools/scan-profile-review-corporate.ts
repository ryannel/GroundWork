import type { ScanDocument } from '@/domain/scan/scan.generated';

import { profileCorporateCallbacks } from './scan-profile-review-callbacks';
import { profileCorporateLineage } from './scan-profile-review-corporate-lineage';
import { profileFleetDefinitions } from './scan-profile-review-enums';
import { profileGraph, type ProfileGraph } from './scan-profile-review-graph';
import {
  profileConstruction,
  profileInitializers,
  profileLocalAtoms,
  profileLocalCalls,
  profileLocalNodes,
  profileLocalOperators,
  profileNullReturn,
} from './scan-profile-review-local';

const FLEET_FIELDS: readonly (string | null)[] = [
  'id',
  'emails',
  'phones',
  'addresses',
  'roles',
  'cdbId',
  null,
  'fleetId',
  'fleetOrgUnitId',
  null,
  'registrationName',
  'displayName',
  'registrationNumber',
  'vatNumber',
  null,
  'type',
  'legalEntityType',
];

const PARTNER_FIELDS: readonly (string | null)[] = [
  'id',
  'emails',
  'phones',
  'addresses',
  'roles',
  null,
  null,
  null,
  null,
  'partnerId',
  'name',
  'name',
  null,
  null,
  null,
  null,
  'ORGANIZATION',
];

function fleetMapper(graph: ProfileGraph): Readonly<Record<string, boolean>> {
  const nodes = profileLocalNodes(graph, 'FleetCorporateEntityMapper', 'to');
  const addresses = profileLocalNodes(graph, 'FleetCorporateEntityMapper', 'getAddresses');
  const mapAddress = profileLocalNodes(graph, 'FleetCorporateEntityMapper', 'mapAddress');
  return {
    corporateFields: profileConstruction(graph, nodes, {
      type: 'CorporateEntity',
      arguments: FLEET_FIELDS,
    }),
    fieldOrigins: profileInitializers(graph, nodes, {
      vatNumber: 'taxIdentifier',
      type: 'mapEntityType',
      displayName: 'name',
      addresses: 'getAddresses',
      registrationName: 'name',
      registrationNumber: 'organizationNumber',
      emails: 'getEmails',
      phones: 'getPhoneList',
      cdbId: 'cdbId',
      fleetId: 'fleetAccountId',
    }),
    addressConstruction: profileConstruction(graph, mapAddress, {
      type: 'Address',
      arguments: [
        'addressRoles',
        'countryCode',
        'line1',
        'line2',
        'line3',
        'line4',
        null,
        'locality',
        'postalCode',
        null,
        null,
        false,
      ],
    }),
    invoiceAddressBranchAtoms:
      profileLocalCalls(graph, addresses, [
        'isEmptyAddress',
        'invoiceAddress',
        'address',
        'mapAddress',
      ]) && profileLocalAtoms(addresses, ['MAILING', 'BILLING']),
    contactFields: ['getEmails', 'getPhoneList'].every((method) => {
      const body = profileLocalNodes(graph, 'FleetCorporateEntityMapper', method);
      return profileLocalOperators(body, ['!=']) && profileLocalAtoms(body, ['CONTACT']);
    }),
  };
}

function fleetFactory(graph: ProfileGraph): Readonly<Record<string, boolean>> {
  const create = profileLocalNodes(graph, 'FleetCorporateEntityFactory', 'create');
  const determine = profileLocalNodes(
    graph,
    'FleetCorporateEntityFactory',
    'determineFleetOrgUnitId',
  );
  const validate = profileLocalNodes(
    graph,
    'FleetCorporateEntityFactory',
    'validateAndReturnOrgUnitIdFromRequest',
  );
  const status = profileLocalNodes(graph, 'FleetService', 'getAndValidateFleetAccountForOrdering');
  return {
    inputAndMapperAtoms: profileLocalCalls(graph, create, [
      'getFleetAccountId',
      'getFleetAccount',
      'getOrgUnits',
      'allOf',
      'join',
      'resultNow',
      'determineFleetOrgUnitId',
      'getRoles',
      'generateId',
      'to',
    ]),
    futureOrigins: profileInitializers(graph, create, {
      fleetAccountCF: 'getFleetAccount',
      orgUnitsCF: 'getOrgUnits',
      fleetAccount: 'resultNow',
      orgUnits: 'resultNow',
      fleetOrgUnitId: 'determineFleetOrgUnitId',
      roles: 'getRoles',
      id: 'generateId',
    }),
    unitSelectionAtoms:
      profileLocalCalls(graph, determine, [
        'hasText',
        'getFleetOrgUnitId',
        'validateAndReturnOrgUnitIdFromRequest',
        'filter',
        'findFirst',
        'map',
        'orElse',
      ]) && profileLocalAtoms(determine, ['MAIN', 'organizationalUnitId']),
    explicitUnitValidationAtoms:
      profileLocalCalls(graph, validate, ['orgUnitIdDoNotExists', 'getFleetOrgUnitId']) &&
      profileLocalAtoms(validate, ['FleetAccountBadRequestException']),
    statusPredicateAtoms:
      profileLocalCalls(graph, status, ['contains', 'status', 'accountType']) &&
      profileLocalAtoms(status, [
        'FLEET',
        'APPROVED',
        'FleetAccountInactiveException',
        'FleetAccountNotApprovedException',
      ]) &&
      profileLocalOperators(status, ['!=', '&&']),
  };
}

function partnerFactory(graph: ProfileGraph): Readonly<Record<string, boolean>> {
  const create = profileLocalNodes(graph, 'PartnerCorporateEntityFactory', 'create');
  const validate = profileLocalNodes(graph, 'PartnerCorporateEntityFactory', 'validatePartnerId');
  return {
    lookupAndMapperAtoms: profileLocalCalls(graph, create, [
      'getPartnerId',
      'validatePartnerId',
      'getActivePartnerByPartnerId',
      'generateId',
      'getRoles',
      'getMarket',
      'getDefaultLanguage',
      'getCode',
      'to',
    ]),
    nullPartnerSkipped: profileLocalOperators(create, ['==']) && profileNullReturn(graph, create),
    authorizationAtoms:
      profileLocalCalls(graph, validate, [
        'getEntraIdUser',
        'isPresent',
        'getConnectToken',
        'map',
        'orElse',
        'contains',
      ]) &&
      profileLocalAtoms(validate, ['partnerIds', 'PartnerIdMismatchException']) &&
      profileLocalOperators(validate, ['&&', '!']),
    localLookupOrigins: profileInitializers(graph, create, {
      partnerId: 'getPartnerId',
      partner: 'getActivePartnerByPartnerId',
      id: 'generateId',
    }),
  };
}

function partnerMapper(graph: ProfileGraph): Readonly<Record<string, boolean>> {
  const body = (method: string) => profileLocalNodes(graph, 'PartnerCorporateEntityMapper', method);
  const to = body('to');
  const facility = body('activeFacility');
  return {
    corporateFields: profileConstruction(graph, to, {
      type: 'CorporateEntity',
      arguments: PARTNER_FIELDS,
    }),
    fieldOrigins: profileInitializers(graph, to, {
      facility: 'activeFacility',
      name: 'getName',
      addresses: 'getAddresses',
      emails: 'getEmails',
      phones: 'getPhones',
    }),
    facilityPreferenceAtoms:
      profileLocalCalls(graph, facility, [
        'isEmpty',
        'filter',
        'equalsIgnoreCase',
        'facilityType',
        'findFirst',
        'or',
        'orElse',
      ]) &&
      profileLocalAtoms(facility, ['active', 'MAIN_FACILITY_TYPE']) &&
      profileNullReturn(graph, facility),
    languageFallbackAtoms: ['getName', 'getAddresses'].every((method) =>
      profileLocalCalls(graph, body(method), [
        'hasText',
        'equalsIgnoreCase',
        'languageCode',
        'findFirst',
        'getFirst',
      ]),
    ),
    countryFallback:
      profileLocalCalls(graph, body('getCountryCode'), ['hasText', 'countryCode', 'fromValue']) &&
      profileLocalAtoms(body('getCountryCode'), ['IllegalArgumentException']) &&
      profileNullReturn(graph, body('getCountryCode')),
    contactAndAddressAtoms:
      profileLocalCalls(graph, body('getAddresses'), [
        'addressLine1',
        'city',
        'postalCode',
        'getCountryCode',
      ]) &&
      profileLocalCalls(graph, body('getEmails'), ['generalContactEmail', 'hasText']) &&
      profileLocalCalls(graph, body('getPhones'), ['phone', 'hasText']),
  };
}

/** Keep atom coverage distinct from full branch, predicate and mapper argument lineage. */
export function profileCorporateSources(document: ScanDocument): Readonly<Record<string, boolean>> {
  const graph = profileGraph(document);
  const groups = {
    fleetFactory: fleetFactory(graph),
    fleetMapper: fleetMapper(graph),
    partnerFactory: partnerFactory(graph),
    partnerMapper: partnerMapper(graph),
  };
  const entries: (readonly [string, boolean])[] = [
    ...Object.entries(groups).flatMap(([group, clauses]) =>
      Object.entries(clauses).map(([name, value]): readonly [string, boolean] => [
        `${group}.${name}`,
        value,
      ]),
    ),
    ...Object.entries(profileCorporateLineage(graph)),
    ...Object.entries(profileFleetDefinitions(graph)),
    ...Object.entries(profileCorporateCallbacks(graph)),
  ];
  const clauses = Object.fromEntries(entries);
  return { ...clauses, supported: Object.values(clauses).every(Boolean) };
}
