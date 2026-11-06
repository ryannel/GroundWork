// File containment is the placement evidence while old readers still supply separate facets.
import type { LegacyPlacements, LegacyPlace } from '@/application/plan/derive-placement';
import { buildId } from '@/domain/ids';
import type { Workspace } from '@/domain/workspace';
import { modelRecord, modelList, modelText, type SystemContracts } from '@/domain/workspace-model';

function facetPlaces(
  value: unknown,
  place: LegacyPlace,
): readonly (readonly [string, LegacyPlace])[] {
  const data = modelRecord(value);
  if (data === null) return [];
  const id = modelText(data.id);
  const reference = ['component', 'service', 'store', 'topic', 'gateway']
    .map((key) => modelText(data[key]))
    .find((candidate) => candidate !== null);
  const component = reference ?? place.component;
  const here = { ...place, component };
  const children = ['endpoints', 'regions'].flatMap((key) => modelList(data[key]));
  return [
    ...(id === null ? [] : [[id, here] as const]),
    ...children.flatMap((child) => facetPlaces(child, here)),
  ];
}
export function legacyPlacements(
  workspace: Workspace,
  contracts: readonly SystemContracts[],
): LegacyPlacements {
  const records: (readonly [string, LegacyPlace])[] = [];
  for (const domain of workspace.domains) {
    for (const system of domain.systems) {
      const place = { domain: domain.id, system: buildId('sys', system.id), component: null };
      records.push([place.system, place]);
      for (const component of system.components) {
        records.push([component.id, { ...place, component: component.id }]);
      }
      const facets = contracts.filter((contract) => contract.system === system.id);
      for (const contract of facets) {
        const collections = [
          'interfaces',
          'schemas',
          'messages',
          'screens',
          'operations',
          'handlers',
          'graphs',
          'subgraphs',
        ];
        records.push(
          ...collections.flatMap((key) =>
            modelList(modelRecord(contract)?.[key]).flatMap((value) => facetPlaces(value, place)),
          ),
        );
      }
    }
  }
  return Object.fromEntries(records);
}
