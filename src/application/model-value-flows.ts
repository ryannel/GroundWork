import { stripPrefix } from '@/domain/ids';
import { modelText } from '@/domain/workspace-model';

import type { ModelIndex } from './model-index';
import { workspaceHref } from './workspace-paths';
import type { ValueFlowArea } from './workspace-value-flows';

/** The catalogue reads the same authored bands, without loading every area's detailed contracts. */
export function modelValueFlowsOf(index: ModelIndex): readonly ValueFlowArea[] {
  const landscape = index.model.landscape;
  if (landscape === null) return [];
  return landscape.areas.flatMap((area) => {
    const value = landscape.details?.find((detail) => detail.area === area.id)?.valueFlow;
    if (value === undefined) return [];
    return [
      {
        id: area.id,
        name: area.name,
        purpose: area.purpose,
        flows: value.bands.map((band) => {
          const ids = new Set(band.nodes.map((node) => node.component));
          const systems = [
            ...new Set(
              [...ids].flatMap((id) => {
                const node = index.get(id);
                if (node?.kind === 'external' || node?.kind === 'system') {
                  return [index.label(node.id)];
                }
                const system = node?.place.system;
                return system === undefined || system === null ? [] : [index.label(system)];
              }),
            ),
          ];
          const names = [...ids].flatMap((id) => {
            const node = index.get(id);
            return [
              index.label(id),
              modelText(node?.data.does) ?? modelText(node?.data.summary) ?? '',
            ];
          });
          const exchanges = value.connections
            .filter((edge) => ids.has(edge.from) && ids.has(edge.to))
            .map((edge) => edge.label);
          return {
            id: band.id,
            title: band.title,
            summary: band.summary,
            href: `${workspaceHref(index.model.id)}areas/${encodeURIComponent(stripPrefix(area.id, 'area'))}/?flow=${encodeURIComponent(band.id)}#value-flow-map`,
            systems,
            search: [band.title, band.summary, area.name, ...systems, ...names, ...exchanges]
              .join(' ')
              .toLowerCase(),
          };
        }),
      },
    ];
  });
}
