import type { ScanDocument } from '@/domain/scan/scan.generated';

import { profileContractTypes } from './scan-profile-review-contract-types';

function fields(document: ScanDocument, type: string, names: readonly string[]): boolean {
  const bindings = document.framework?.filter(
    (record) => record.kind === 'schema_binding' && record.typeName.endsWith(`.${type}`),
  );
  const schema = bindings?.[0];
  return (
    bindings?.length === 1 &&
    schema?.kind === 'schema_binding' &&
    names.every((name) =>
      schema.properties.some(
        (property) =>
          property.name === name &&
          document.sources.some((source) => source.id === property.source),
      ),
    )
  );
}

const INDIVIDUAL: Readonly<Record<string, readonly string[]>> = {
  VolvoIdUser: ['id', 'givenName', 'familyName', 'email', 'phoneNumber', 'address'],
  ConnectToken: ['email', 'givenName', 'familyName', 'accesses'],
  EntraIdUser: ['id', 'givenName', 'familyName', 'email'],
  CdbConsumer: ['consumerId', 'language', 'market', 'person', 'emails', 'telephones', 'addresses'],
  CdbPerson: [
    'firstName',
    'additionalName',
    'surname',
    'gender',
    'dateOfBirth',
    'initials',
    'titleDescription',
  ],
  CdbEmail: ['emailAddress'],
  CdbTelephone: ['telephoneNumber'],
  CdbAddress: ['addressLine1', 'postalCodeNumber', 'city'],
  'volvoid.userinfo.Address': [
    'countryCode',
    'locality',
    'postalCode',
    'region',
    'streetAddress',
    'districtCode',
    'country',
  ],
  'connecttoken.AccessEntry': ['context'],
  'connecttoken.ParmaContext': ['id', 'type', 'tag', 'market'],
};
const CORPORATE: Readonly<Record<string, readonly string[]>> = {
  FleetAccount: ['company', 'status', 'cdbId', 'fleetAccountId', 'accountType'],
  'FleetAccount.Company': [
    'address',
    'invoiceAddress',
    'contactEmailAddress',
    'invoiceEmailAddress',
    'contactPhoneNumber',
    'name',
    'organizationNumber',
    'taxIdentifier',
    'entityType',
  ],
  'FleetAccount.Address': [
    'line1',
    'line2',
    'line3',
    'line4',
    'locality',
    'countryCode',
    'postalCode',
  ],
  OrganizationalUnit: ['organizationalUnitId', 'type'],
  PartnerOrganizationalUnit: [
    'partnerId',
    'partnerOrganizationalUnitNames',
    'partnerOrganizationalUnitFacilities',
  ],
  'PartnerOrganizationalUnit.Name': ['languageCode', 'name'],
  'PartnerOrganizationalUnit.Facility': [
    'active',
    'facilityType',
    'generalContactEmail',
    'phone',
    'addresses',
  ],
  'PartnerOrganizationalUnit.Address': [
    'languageCode',
    'addressLine1',
    'postalCode',
    'city',
    'countryCode',
  ],
};

/** Declared response fields and their local nested declarations, independently of effective codecs. */
export function profileContracts(
  document: ScanDocument,
): Readonly<Record<'individual' | 'corporate', boolean>> {
  const types = profileContractTypes(document);
  return {
    individual:
      types.individual &&
      Object.entries(INDIVIDUAL).every(([type, names]) => fields(document, type, names)),
    corporate:
      types.corporate &&
      Object.entries(CORPORATE).every(([type, names]) => fields(document, type, names)),
  };
}
