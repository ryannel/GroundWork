import type { SemanticNode } from '@/domain/scan/scan.generated';

import { profileMethod, profileReturned, type ProfileGraph } from './scan-profile-review-graph';
import { individualRecipe } from './scan-profile-review-individual-atoms';
import { profileLocalNodes } from './scan-profile-review-local';
import { methodRecipe } from './scan-profile-review-method';
import { targets } from './scan-semantic-query';

const ENTITY_TYPES: Readonly<Record<string, string>> = {
  SOLE_TRADER: 'CorporateType.SOLE_TRADER',
  LIMITED_COMPANY: 'CorporateType.LIMITED_COMPANY',
  CHARITY_NGO_UNION: 'CorporateType.CHARITY',
  LOCAL_AUTHORITY: 'CorporateType.LOCAL_AUTHORITY',
  PUBLIC_LIMITED_COMPANY: 'CorporateType.PUBLIC_LIMITED_COMPANY',
  LIMITED_LIABILITY_PARTNERSHIP: 'CorporateType.LIMITED_LIABILITY_PARTNERSHIP',
  NON_LIMITED_LIABILITY_PARTNERSHIP: 'CorporateType.NON_LLP_PARTNERSHIP',
  UNKNOWN: 'null',
};

function mappedCase(
  graph: ProfileGraph,
  branch: SemanticNode,
  entry: readonly [string, string],
): boolean {
  const [label, result] = entry;
  const condition = targets(graph, branch, 'condition')[0];
  const atom = targets(graph, condition, 'ast_child')[0];
  return (
    atom?.nodeKind === 'identifier' &&
    atom.name === label &&
    targets(graph, branch, 'value').some((value) => individualRecipe(graph, value) === result)
  );
}

function mappedTypes(graph: ProfileGraph): boolean {
  const owner = profileMethod(graph, 'FleetCorporateEntityMapper', 'mapEntityType')[0];
  if (!owner) return false;
  const nodes = profileLocalNodes(graph, 'FleetCorporateEntityMapper', 'mapEntityType');
  return nodes
    .filter((node) => node.nodeKind === 'control')
    .some((node) => {
      if (individualRecipe(graph, targets(graph, node, 'condition')[0]) !== 'entityType') {
        return false;
      }
      if (!profileReturned(graph, owner, node.source)) return false;
      const cases = targets(graph, node, 'consequent');
      return (
        cases.length === Object.keys(ENTITY_TYPES).length &&
        Object.entries(ENTITY_TYPES).every((entry) =>
          cases.some((branch) => mappedCase(graph, branch, entry)),
        )
      );
    });
}

export function profileFleetDefinitions(graph: ProfileGraph): Readonly<Record<string, boolean>> {
  const declarations = graph.nodes.filter(
    (node) => node.nodeKind === 'declaration' && node.name === 'INACTIVE_FLEET_ACCOUNT_STATUSES',
  );
  return {
    fleetInactiveStatuses: declarations.some((node) =>
      graph.values.some(
        (value) =>
          value.relation === 'initializer' &&
          value.to === node.source &&
          individualRecipe(graph, graph.bySource.get(value.from)) ===
            'List.of(FleetAccountStatus.CANCELED,FleetAccountStatus.REJECTED,FleetAccountStatus.DISABLED)',
      ),
    ),
    fleetEntityTypeCases:
      mappedTypes(graph) &&
      methodRecipe(graph, ['FleetCorporateEntityMapper', 'mapEntityType'], {
        branches: [{ condition: 'entityType==null', returns: 'null' }],
      }),
  };
}
