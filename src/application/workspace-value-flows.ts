import { stripPrefix } from '@/domain/ids';
import type { AuthoredLandscape, LandscapeValueFlow } from '@/domain/landscape';
import type { Workspace } from '@/domain/workspace';

import type { Model } from './plan/derive';
import { areaViewOf, type AreaView } from './workspace-area';

export interface ValueFlowEntry {
  readonly id: string;
  readonly title: string;
  readonly summary: string;
  readonly href: string;
  readonly systems: readonly string[];
  readonly search: string;
}

export interface ValueFlowArea {
  readonly id: string;
  readonly name: string;
  readonly purpose: string;
  readonly flows: readonly ValueFlowEntry[];
}

function flowEntry(view: AreaView, band: LandscapeValueFlow['bands'][number]): ValueFlowEntry {
  const ids = new Set(band.nodes.map((node) => node.component));
  const systems = view.systems.filter((system) =>
    system.components.some((component) => ids.has(component.id)),
  );
  const components = systems.flatMap((system) =>
    system.components
      .filter((component) => ids.has(component.id))
      .flatMap((component) => [component.name, component.summary]),
  );
  const exchanges = (view.valueFlow?.connections ?? [])
    .filter((edge) => ids.has(edge.from) && ids.has(edge.to))
    .map((edge) => edge.label);
  return {
    id: band.id,
    title: band.title,
    summary: band.summary,
    href: `${view.workspace.href}areas/${encodeURIComponent(view.area.id)}/?flow=${encodeURIComponent(band.id)}#value-flow-map`,
    systems: systems.map((system) => system.name),
    search: [
      band.title,
      band.summary,
      view.area.name,
      ...systems.map((system) => system.name),
      ...components,
      ...exchanges,
    ]
      .join(' ')
      .toLowerCase(),
  };
}

/** The same validated activity bands the maps draw, projected into a small searchable catalogue. */
export function workspaceValueFlowsOf(
  workspace: Workspace,
  model: Model,
  landscape: AuthoredLandscape | null,
): readonly ValueFlowArea[] {
  if (landscape === null) return [];
  return landscape.areas.flatMap((area) => {
    const view = areaViewOf({ workspace, model, landscape, area: area.id, explorer: null });
    if (view?.valueFlow === undefined) return [];
    const flows = view.valueFlow.bands.map((band) => flowEntry(view, band));
    return [{ id: area.id, name: area.name, purpose: area.purpose, flows }];
  });
}

/** Match the work, its outcome or its supporting systems without needing to know its area first. */
export function searchValueFlows(
  areas: readonly ValueFlowArea[],
  query: string,
  area = '',
): readonly ValueFlowArea[] {
  const words = query
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean);
  return areas
    .filter((entry) => area === '' || stripPrefix(entry.id, 'area') === stripPrefix(area, 'area'))
    .map((entry) => ({
      ...entry,
      flows: entry.flows.filter((flow) => words.every((word) => flow.search.includes(word))),
    }))
    .filter((entry) => entry.flows.length > 0);
}
