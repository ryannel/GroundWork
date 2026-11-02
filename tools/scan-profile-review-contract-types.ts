import type { ScanDocument } from '@/domain/scan/scan.generated';

const BASE = 'com.volvocars.ecom.customerservice.';
const CDB = 'consumer.model.CdbConsumer';
const FLEET_COMPANY = 'fleet.FleetAccount.Company';
const FLEET_ADDRESS = 'fleet.FleetAccount.Address';
type NestedTypeLink = readonly [
  owner: string,
  property: string,
  nativeType: string,
  target: string,
];

const INDIVIDUAL: readonly NestedTypeLink[] = [
  ['volvoid.userinfo.VolvoIdUser', 'address', 'Address', 'volvoid.userinfo.Address'],
  ['connecttoken.ConnectToken', 'accesses', 'List<AccessEntry>', 'connecttoken.AccessEntry'],
  ['connecttoken.AccessEntry', 'context', 'ParmaContext', 'connecttoken.ParmaContext'],
  [CDB, 'person', 'CdbPerson', 'consumer.model.CdbPerson'],
  [CDB, 'emails', 'List<CdbEmail>', 'consumer.model.CdbEmail'],
  [CDB, 'telephones', 'List<CdbTelephone>', 'consumer.model.CdbTelephone'],
  [CDB, 'addresses', 'List<CdbAddress>', 'consumer.model.CdbAddress'],
];
const CORPORATE: readonly NestedTypeLink[] = [
  ['fleet.response.FleetAccountResponse', 'data', 'FleetAccount', 'fleet.FleetAccount'],
  [
    'fleet.response.OrganizationalUnitsResponse',
    'data',
    'List<OrganizationalUnit>',
    'fleet.OrganizationalUnit',
  ],
  ['fleet.FleetAccount', 'company', 'Company', FLEET_COMPANY],
  [FLEET_COMPANY, 'address', 'Address', FLEET_ADDRESS],
  [FLEET_COMPANY, 'invoiceAddress', 'Address', FLEET_ADDRESS],
  [
    'partner.client.model.PartnerOrganizationalUnit',
    'partnerOrganizationalUnitNames',
    'List<Name>',
    'partner.client.model.PartnerOrganizationalUnit.Name',
  ],
  [
    'partner.client.model.PartnerOrganizationalUnit',
    'partnerOrganizationalUnitFacilities',
    'List<Facility>',
    'partner.client.model.PartnerOrganizationalUnit.Facility',
  ],
  [
    'partner.client.model.PartnerOrganizationalUnit.Facility',
    'addresses',
    'List<Address>',
    'partner.client.model.PartnerOrganizationalUnit.Address',
  ],
];

function sourcePaths(document: ScanDocument, sources: readonly [string, string, string]): boolean {
  const [owner, property, target] = sources;
  const ownerSource = document.sources.find((source) => source.id === owner);
  const fieldSource = document.sources.find((source) => source.id === property);
  const targetSource = document.sources.find((source) => source.id === target);
  return (
    ownerSource !== undefined &&
    fieldSource?.path === ownerSource.path &&
    targetSource !== undefined
  );
}

/** A pinned lexical type/container must reach its explicit fully qualified source declaration. */
export function profileNestedType(document: ScanDocument, link: NestedTypeLink): boolean {
  const [owner, property, nativeType, target] = link;
  const schemas = document.framework?.filter((record) => record.kind === 'schema_binding') ?? [];
  const owners = schemas.filter((schema) => schema.typeName === `${BASE}${owner}`);
  const targets = schemas.filter((schema) => schema.typeName === `${BASE}${target}`);
  const selected = owners[0];
  const nested = targets[0];
  if (owners.length !== 1 || targets.length !== 1 || !selected || !nested) return false;
  const properties = selected.properties.filter((entry) => entry.name === property);
  const field = properties[0];
  if (properties.length !== 1 || field?.type !== nativeType) return false;
  return sourcePaths(document, [selected.source, field.source, nested.source]);
}

export function profileContractTypes(
  document: ScanDocument,
): Readonly<Record<'individual' | 'corporate', boolean>> {
  return {
    individual: INDIVIDUAL.every((link) => profileNestedType(document, link)),
    corporate: CORPORATE.every((link) => profileNestedType(document, link)),
  };
}
