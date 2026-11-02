import type { ProfileGraph } from './scan-profile-review-graph';
import { methodRecipe } from './scan-profile-review-method';

function fleetCreation(graph: ProfileGraph): Readonly<Record<string, boolean>> {
  return {
    fleetConcurrentArguments: methodRecipe(graph, ['FleetCorporateEntityFactory', 'create'], {
      calls: ['CompletableFuture.allOf(fleetAccountCF,orgUnitsCF).join()'],
      initializers: {
        fleetAccountCF: 'getFleetAccount(request.getFleetAccountId())',
        orgUnitsCF: 'getOrgUnits(request.getFleetAccountId())',
        fleetAccount: 'fleetAccountCF.resultNow()',
        orgUnits: 'orgUnitsCF.resultNow()',
        fleetOrgUnitId: 'determineFleetOrgUnitId(orgUnits,request)',
        roles: 'request.getRoles()',
        id: 'idGenerator.generateId()',
      },
      returns: ['mapper.to(fleetAccount,fleetOrgUnitId,id,roles)'],
    }),
  };
}

function fleetFactory(graph: ProfileGraph): Readonly<Record<string, boolean>> {
  return {
    ...fleetCreation(graph),
    fleetUnitBranch: methodRecipe(
      graph,
      ['FleetCorporateEntityFactory', 'determineFleetOrgUnitId'],
      {
        branches: [
          {
            condition: 'StringUtils.hasText(request.getFleetOrgUnitId())',
            returns: 'validateAndReturnOrgUnitIdFromRequest(orgUnits,request)',
          },
        ],
        calls: [
          'MAIN.equals(unit.type())',
          'orgUnits.stream().filter().findFirst().map(OrganizationalUnit::organizationalUnitId).orElse(null)',
        ],
      },
    ),
    fleetUnitValidation:
      methodRecipe(graph, ['FleetCorporateEntityFactory', 'orgUnitIdDoNotExists'], {
        calls: ['unit.organizationalUnitId().equals(orgUnitId)'],
        returns: ['orgUnits.stream().noneMatch()'],
      }) &&
      methodRecipe(
        graph,
        ['FleetCorporateEntityFactory', 'validateAndReturnOrgUnitIdFromRequest'],
        {
          branches: [{ condition: 'orgUnitIdDoNotExists(orgUnits,request.getFleetOrgUnitId())' }],
          returns: ['request.getFleetOrgUnitId()'],
        },
      ),
    fleetStateGuards: methodRecipe(
      graph,
      ['FleetService', 'getAndValidateFleetAccountForOrdering'],
      {
        branches: [
          {
            condition: 'INACTIVE_FLEET_ACCOUNT_STATUSES.contains(fleetAccount.status())',
            throws: 'FleetAccountInactiveException(fleetAccountId,fleetAccount.status())',
          },
          {
            condition:
              'fleetAccount.accountType()!=FleetAccount.FleetAccountType.FLEET&&fleetAccount.status()!=FleetAccountStatus.APPROVED',
            throws: 'FleetAccountNotApprovedException(fleetAccountId,fleetAccount.status())',
          },
        ],
        returns: ['fleetAccount'],
      },
    ),
  };
}

function fleetMapper(graph: ProfileGraph): Readonly<Record<string, boolean>> {
  return {
    fleetMappedOrigins: methodRecipe(graph, ['FleetCorporateEntityMapper', 'to'], {
      initializers: {
        vatNumber: 'fleetAccount.company().taxIdentifier()',
        type: 'mapEntityType(fleetAccount.company().entityType())',
        legalEntityType: 'LegalEntityType.ORGANIZATION',
        displayName: 'fleetAccount.company().name()',
        addresses: 'getAddresses(fleetAccount.company())',
        registrationName: 'fleetAccount.company().name()',
        registrationNumber: 'fleetAccount.company().organizationNumber()',
        emails: 'getEmails(fleetAccount.company())',
        phones: 'getPhoneList(fleetAccount.company())',
        cdbId: 'fleetAccount.cdbId()',
        fleetId: 'fleetAccount.fleetAccountId()',
      },
    }),
    fleetInvoiceAddressChoice:
      methodRecipe(graph, ['FleetCorporateEntityMapper', 'getAddresses'], {
        branches: [
          {
            condition: 'isEmptyAddress(fleetCompany.invoiceAddress())',
            returns:
              'List.of(mapAddress(Set.of(AddressRole.MAILING,AddressRole.BILLING),fleetCompany.address()))',
          },
        ],
        returns: [
          'List.of(mapAddress(Set.of(AddressRole.MAILING),fleetCompany.address()),mapAddress(Set.of(AddressRole.BILLING),fleetCompany.invoiceAddress()))',
        ],
      }) &&
      methodRecipe(graph, ['FleetCorporateEntityMapper', 'isEmptyAddress'], {
        returns: ['address==null||!StringUtils.hasText(address.line1())'],
      }),
    fleetContactConstruction:
      methodRecipe(graph, ['FleetCorporateEntityMapper', 'getEmails'], {
        branches: [
          { condition: 'fleetCompany.contactEmailAddress()!=null' },
          { condition: 'fleetCompany.invoiceEmailAddress()!=null' },
        ],
        calls: [
          'Email(fleetCompany.contactEmailAddress(),Set.of(EmailRole.CONTACT))',
          'Email(fleetCompany.invoiceEmailAddress(),Set.of(EmailRole.INVOICE))',
        ],
      }) &&
      methodRecipe(graph, ['FleetCorporateEntityMapper', 'getPhoneList'], {
        branches: [{ condition: 'fleetCompany.contactPhoneNumber()!=null' }],
        calls: ['Phone(fleetCompany.contactPhoneNumber(),Set.of(PhoneRole.CONTACT))'],
      }),
  };
}

function partnerFactory(graph: ProfileGraph): Readonly<Record<string, boolean>> {
  return {
    partnerLookupArguments: methodRecipe(graph, ['PartnerCorporateEntityFactory', 'create'], {
      calls: ['validatePartnerId(partnerId,context)'],
      initializers: {
        partnerId: 'request.getPartnerId()',
        partner: 'commercialPartnerClient.getActivePartnerByPartnerId(partnerId)',
        id: 'idGenerator.generateId()',
        market: 'context!=null?context.getMarket()?null',
        preferredLanguageCode: 'market!=null?market.getDefaultLanguage().getCode()?null',
      },
      branches: [{ condition: 'partner==null', returns: 'null' }],
      returns: ['mapper.to(partner,id,request.getRoles(),preferredLanguageCode)'],
    }),
    partnerTokenAuthorization: methodRecipe(
      graph,
      ['PartnerCorporateEntityFactory', 'validatePartnerId'],
      {
        branches: [
          { condition: 'context!=null&&context.getEntraIdUser().isPresent()', exits: true },
          {
            condition: '!tokenPartnerIds.contains(partnerId)',
            throws: 'PartnerIdMismatchException(partnerId,tokenPartnerIds)',
          },
        ],
        initializers: {
          connectToken: 'context!=null?context.getConnectToken()?Optional.empty()',
          tokenPartnerIds: 'connectToken.map(ConnectToken::partnerIds).orElse(List.of())',
        },
      },
    ),
  };
}

function partnerContacts(graph: ProfileGraph): Readonly<Record<string, boolean>> {
  return {
    partnerAddressPreference: methodRecipe(
      graph,
      ['PartnerCorporateEntityMapper', 'getAddresses'],
      {
        branches: [
          {
            condition: 'facility==null||CollectionUtils.isEmpty(facility.addresses())',
            returns: 'List.of()',
          },
        ],
        calls: [
          'StringUtils.hasText(preferredLanguageCode)&&preferredLanguageCode.equalsIgnoreCase(addr.languageCode())',
          'Address(Set.of(AddressRole.MAILING,AddressRole.BILLING),getCountryCode(address),address.addressLine1(),null,null,null,null,address.city(),address.postalCode(),null,null,false)',
        ],
        initializers: {
          address:
            'facility.addresses().stream().filter().findFirst().orElse(facility.addresses().getFirst())',
        },
      },
    ),
    partnerCountryFallback: methodRecipe(
      graph,
      ['PartnerCorporateEntityMapper', 'getCountryCode'],
      {
        branches: [{ condition: '!StringUtils.hasText(address.countryCode())', returns: 'null' }],
        returns: ['Country.fromValue(address.countryCode())', 'null'],
      },
    ),
    partnerContactConstruction:
      methodRecipe(graph, ['PartnerCorporateEntityMapper', 'getEmails'], {
        branches: [
          {
            condition: 'facility==null||!StringUtils.hasText(facility.generalContactEmail())',
            returns: '()',
          },
        ],
        returns: ['List.of(Email(facility.generalContactEmail(),Set.of(EmailRole.CONTACT)))'],
      }) &&
      methodRecipe(graph, ['PartnerCorporateEntityMapper', 'getPhones'], {
        branches: [
          {
            condition: 'facility==null||!StringUtils.hasText(facility.phone())',
            returns: '()',
          },
        ],
        returns: ['List.of(Phone(facility.phone(),Set.of(PhoneRole.CONTACT)))'],
      }),
  };
}

function partnerMapper(graph: ProfileGraph): Readonly<Record<string, boolean>> {
  return {
    partnerMappedOrigins: methodRecipe(graph, ['PartnerCorporateEntityMapper', 'to'], {
      initializers: {
        facility: 'activeFacility(partner)',
        name: 'getName(partner,preferredLanguageCode)',
        addresses: 'getAddresses(facility,preferredLanguageCode)',
        emails: 'getEmails(facility)',
        phones: 'getPhones(facility)',
      },
    }),
    partnerFacilityPreference: methodRecipe(
      graph,
      ['PartnerCorporateEntityMapper', 'activeFacility'],
      {
        branches: [
          {
            condition: 'CollectionUtils.isEmpty(partner.partnerOrganizationalUnitFacilities())',
            returns: 'null',
          },
        ],
        calls: [
          'MAIN_FACILITY_TYPE.equalsIgnoreCase(facility.facilityType())',
          'partner.partnerOrganizationalUnitFacilities().stream().filter(PartnerOrganizationalUnit.Facility::active).findFirst()',
        ],
        returns: [
          'partner.partnerOrganizationalUnitFacilities().stream().filter(PartnerOrganizationalUnit.Facility::active).filter().findFirst().or().orElse(null)',
        ],
      },
    ),
    partnerNamePreference: methodRecipe(graph, ['PartnerCorporateEntityMapper', 'getName'], {
      branches: [
        {
          condition: 'CollectionUtils.isEmpty(partner.partnerOrganizationalUnitNames())',
          returns: 'null',
        },
      ],
      calls: [
        'StringUtils.hasText(preferredLanguageCode)&&preferredLanguageCode.equalsIgnoreCase(name.languageCode())',
        'partner.partnerOrganizationalUnitNames().getFirst().name()',
      ],
      initializers: {
        preferredName:
          'partner.partnerOrganizationalUnitNames().stream().filter().map(PartnerOrganizationalUnit.Name::name).findFirst()',
      },
      returns: ['preferredName.orElseGet()'],
    }),
    ...partnerContacts(graph),
  };
}

export function profileCorporateLineage(graph: ProfileGraph): Readonly<Record<string, boolean>> {
  return {
    ...fleetFactory(graph),
    ...fleetMapper(graph),
    ...partnerFactory(graph),
    ...partnerMapper(graph),
  };
}
