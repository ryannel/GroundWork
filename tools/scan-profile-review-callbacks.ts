import type { ProfileGraph } from './scan-profile-review-graph';
import { methodRecipe } from './scan-profile-review-method';

function fleetCallbacks(graph: ProfileGraph): Readonly<Record<string, boolean>> {
  return {
    fleetAccountCallback: methodRecipe(graph, ['FleetCorporateEntityFactory', 'getFleetAccount'], {
      callbacks: [
        {
          call: 'ContextAwareCompletableFuture.supplyAsyncWithContext()',
          body: 'fleetService.getAndValidateFleetAccountForOrdering(fleetAccountId)',
          captures: ['fleetAccountId'],
        },
      ],
    }),
    fleetUnitsCallback: methodRecipe(graph, ['FleetCorporateEntityFactory', 'getOrgUnits'], {
      callbacks: [
        {
          call: 'ContextAwareCompletableFuture.supplyAsyncWithContext()',
          body: 'fleetService.getFleetOrgUnits(fleetAccountId)',
          captures: ['fleetAccountId'],
        },
      ],
    }),
    fleetMainUnitCallback: methodRecipe(
      graph,
      ['FleetCorporateEntityFactory', 'determineFleetOrgUnitId'],
      { callbacks: [{ call: 'orgUnits.stream().filter()', body: 'MAIN.equals(unit.type())' }] },
    ),
    fleetUnitMembershipCallback: methodRecipe(
      graph,
      ['FleetCorporateEntityFactory', 'orgUnitIdDoNotExists'],
      {
        callbacks: [
          {
            call: 'orgUnits.stream().noneMatch()',
            body: 'unit.organizationalUnitId().equals(orgUnitId)',
            captures: ['orgUnitId'],
          },
        ],
      },
    ),
  };
}

function partnerCallbacks(graph: ProfileGraph): Readonly<Record<string, boolean>> {
  return {
    partnerNameCallbacks: methodRecipe(graph, ['PartnerCorporateEntityMapper', 'getName'], {
      callbacks: [
        {
          call: 'partner.partnerOrganizationalUnitNames().stream().filter()',
          body: 'StringUtils.hasText(preferredLanguageCode)&&preferredLanguageCode.equalsIgnoreCase(name.languageCode())',
          captures: ['preferredLanguageCode'],
        },
        {
          call: 'preferredName.orElseGet()',
          body: 'partner.partnerOrganizationalUnitNames().getFirst().name()',
          captures: ['partner'],
        },
      ],
    }),
    partnerAddressCallback: methodRecipe(graph, ['PartnerCorporateEntityMapper', 'getAddresses'], {
      callbacks: [
        {
          call: 'facility.addresses().stream().filter()',
          body: 'StringUtils.hasText(preferredLanguageCode)&&preferredLanguageCode.equalsIgnoreCase(addr.languageCode())',
          captures: ['preferredLanguageCode'],
        },
      ],
    }),
    partnerFacilityCallbacks: methodRecipe(
      graph,
      ['PartnerCorporateEntityMapper', 'activeFacility'],
      {
        callbacks: [
          {
            call: 'partner.partnerOrganizationalUnitFacilities().stream().filter(PartnerOrganizationalUnit.Facility::active).filter()',
            body: 'MAIN_FACILITY_TYPE.equalsIgnoreCase(facility.facilityType())',
          },
          {
            call: 'partner.partnerOrganizationalUnitFacilities().stream().filter(PartnerOrganizationalUnit.Facility::active).filter().findFirst().or()',
            body: 'partner.partnerOrganizationalUnitFacilities().stream().filter(PartnerOrganizationalUnit.Facility::active).findFirst()',
            captures: ['partner'],
          },
        ],
      },
    ),
  };
}

export function profileCorporateCallbacks(graph: ProfileGraph): Readonly<Record<string, boolean>> {
  return { ...fleetCallbacks(graph), ...partnerCallbacks(graph) };
}
