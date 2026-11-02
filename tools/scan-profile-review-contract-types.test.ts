import { describe, expect, it } from 'vitest';

import { scanFixture } from '@/../test/scan-kit';
import type { SpringSchemaBinding } from '@/domain/scan/scan.generated';

import { profileNestedType } from './scan-profile-review-contract-types';

const BASE = 'com.volvocars.ecom.customerservice.';

function schema(type: string, property?: readonly [string, string]): SpringSchemaBinding {
  return {
    kind: 'schema_binding',
    id: `schema:${type}`,
    typeName: `${BASE}${type}`,
    direction: 'source',
    properties: property
      ? [
          {
            name: property[0],
            jsonName: property[0],
            type: property[1],
            source: 'source:handler',
            constraints: [],
            views: [],
            presence: 'unknown',
            nullable: 'unknown',
            access: 'declared_field',
            annotations: [],
          },
        ]
      : [],
    inheritedTypes: [],
    genericArguments: [],
    enumValues: [],
    polymorphism: null,
    completeness: 'partial',
    gaps: [],
    source: 'source:handler',
    support: ['source:handler'],
    profiles: [],
  };
}

describe('nested source contract types', () => {
  it('requires the Q12 consumer person field to reference the qualified person declaration', () => {
    const owner = schema('consumer.model.CdbConsumer', ['person', 'CdbPerson']);
    const nested = schema('consumer.model.CdbPerson');
    const document = { ...scanFixture(), framework: [owner, nested] };
    const link = [
      'consumer.model.CdbConsumer',
      'person',
      'CdbPerson',
      'consumer.model.CdbPerson',
    ] as const;
    expect(profileNestedType(document, link)).toBe(true);
    const changed = structuredClone(document);
    const property = changed.framework[0]?.properties[0];
    if (!property) throw new Error('Missing test property');
    property.type = 'String';
    expect(profileNestedType(changed, link)).toBe(false);
    expect(changed.framework[1]).toEqual(nested);
    nested.typeName = 'impostor.CdbPerson';
    expect(profileNestedType(document, link)).toBe(false);
  });

  it('requires the Q13 facility address list container and its qualified element declaration', () => {
    const owner = schema('partner.client.model.PartnerOrganizationalUnit.Facility', [
      'addresses',
      'List<Address>',
    ]);
    const nested = schema('partner.client.model.PartnerOrganizationalUnit.Address');
    const document = { ...scanFixture(), framework: [owner, nested] };
    const link = [
      'partner.client.model.PartnerOrganizationalUnit.Facility',
      'addresses',
      'List<Address>',
      'partner.client.model.PartnerOrganizationalUnit.Address',
    ] as const;
    expect(profileNestedType(document, link)).toBe(true);
    const changed = structuredClone(document);
    const property = changed.framework[0]?.properties[0];
    if (!property) throw new Error('Missing test property');
    property.type = 'Map<String,Address>';
    expect(profileNestedType(changed, link)).toBe(false);
    expect(changed.framework[1]).toEqual(nested);
    expect(profileNestedType({ ...document, framework: [owner] }, link)).toBe(false);
  });
});
