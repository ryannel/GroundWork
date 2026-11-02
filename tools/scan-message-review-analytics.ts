import type { ScanDocument } from '@/domain/scan/scan.generated';

import { messageMethod } from './scan-message-review-graph';
import { profileGraph, type ProfileGraph } from './scan-profile-review-graph';
import { individualRecipe } from './scan-profile-review-individual-atoms';
import { methodRecipe } from './scan-profile-review-method';
import { descendants, targets } from './scan-semantic-query';

function customerTypeSwitch(graph: ProfileGraph): boolean {
  const owner = messageMethod(graph, ['AnalyticsCustomerTypeMapper', 'to']);
  return descendants(graph, owner)
    .filter((node) => node.nodeKind === 'control')
    .some((control) => {
      if (
        individualRecipe(graph, targets(graph, control, 'condition')[0]) !==
        'customer.customerType()'
      ) {
        return false;
      }
      const cases = targets(graph, control, 'consequent');
      return (
        cases.length === 2 &&
        [
          ['INDIVIDUAL', 'B2C'],
          ['ORGANIZATION', 'B2B'],
        ].every(([name, value]) =>
          cases.some((branch) => {
            const condition = targets(graph, branch, 'condition')[0];
            return (
              targets(graph, condition, 'ast_child')[0]?.name === name &&
              individualRecipe(graph, targets(graph, branch, 'value')[0]) === value
            );
          }),
        )
      );
    });
}

function eventConstructor(graph: ProfileGraph): boolean {
  return methodRecipe(graph, ['AnalyticsEvent', '<init>', 2], {
    calls: ['this(UUID.randomUUID().toString(),type,Instant.now(),customer)'],
  });
}

export function messageAnalyticsClauses(document: ScanDocument): Readonly<Record<string, boolean>> {
  const graph = profileGraph(document);
  const schema = document.framework
    ?.filter((record) => record.kind === 'schema_binding')
    .find(
      (record) =>
        record.typeName === 'com.volvocars.ecom.customerservice.analytics.model.AnalyticsEvent',
    );
  return {
    analyticsEnvelopeConstructor:
      eventConstructor(graph) &&
      schema?.properties.map((property) => `${property.name}:${property.jsonName}`).join(',') ===
        'id:event_id,type:event_type,createdAt:event_timestamp,payload:payload',
    analyticsFleetSelection: methodRecipe(graph, ['AnalyticsEventService', 'getFleetAccount'], {
      returns: [
        'customer.corporateEntities().stream().filter().map(CorporateEntity::fleetAccountId).filter(Objects::nonNull).findFirst().map(fleetService::getFleetAccount).orElse(null)',
      ],
      callbacks: [
        {
          call: 'customer.corporateEntities().stream().filter()',
          body: 'corporateEntity.roles().contains(Role.SOLD_TO)',
        },
      ],
    }),
    analyticsCustomerTypeSelection:
      customerTypeSwitch(graph) &&
      methodRecipe(graph, ['AnalyticsCustomerTypeMapper', 'to'], {
        branches: [
          { condition: 'fleetAccount==null' },
          { condition: 'isMotabilityFleet(fleetAccount)', returns: 'MOTABILITY' },
          { condition: 'isLeasecoFleet(fleetAccount)', returns: 'AnalyticsCustomerType.LEASECO' },
        ],
        returns: ['AnalyticsCustomerType.FLEET'],
      }) &&
      methodRecipe(graph, ['AnalyticsCustomerTypeMapper', 'isLeasecoFleet'], {
        returns: [
          'fleetAccount.accountType()!=null&&LEASE_FLEET_TYPES.contains(fleetAccount.accountType())',
        ],
      }) &&
      methodRecipe(graph, ['AnalyticsCustomerTypeMapper', 'isMotabilityFleet'], {
        returns: [
          'StringUtils.hasText(motabilityFleetId)&&motabilityFleetId.equals(fleetAccount.fleetAccountId())',
        ],
      }),
  };
}
