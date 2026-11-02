import { apiSurface, surfaceAnchor, surfaceLabel } from '@/application/area-map/api-surface';
import { type CardRow, cardLayout } from '@/application/area-map/card-geometry';
import {
  combinedConnectionSummary,
  connectionSummary,
  connectionDetails,
} from '@/application/area-map/connection-summary';
import { isPlatformLine, platformComponents } from '@/application/area-map/platform';
import { settleRoutes } from '@/application/area-routing/settle';
import { areaEdgeGeometry, type AreaSystemBox } from '@/application/area-system-layout';
import type { AreaTechnicalRelationship, AreaView } from '@/application/workspace-area';
import type { LandscapeSystemRelationship } from '@/domain/landscape';
import type { SystemNarrative } from '@/domain/system-narrative';
import type { ConnectedCanvasEdge } from '@/ui/connected-canvas.client';

import type { AreaComponentBox } from './area-system-shape';

interface CanvasSystem extends AreaSystemBox {
  readonly story?: SystemNarrative;
  readonly componentBoxes: readonly AreaComponentBox[];
  readonly componentRelationships: readonly LandscapeSystemRelationship[];
}

/** The original relations remain available even when several lines share one visible anchor. */
export interface AreaCanvasEdge extends ConnectedCanvasEdge {
  readonly relations?: readonly AreaTechnicalRelationship[];
}

interface AreaRouted extends AreaCanvasEdge {
  readonly points: readonly { readonly x: number; readonly y: number }[];
  readonly drawn: readonly [string, string];
  readonly narrative?: boolean;
}

interface ProjectedRelationship extends LandscapeSystemRelationship {
  readonly directed?: boolean;
  readonly supporting?: boolean;
  readonly relations?: readonly AreaTechnicalRelationship[];
  readonly surfaceId?: string;
  readonly narrative?: boolean;
}

interface ProjectionOptions {
  readonly view: AreaView;
  readonly systems: readonly CanvasSystem[];
  readonly expanded: ReadonlySet<string>;
  readonly selected?: ReadonlyMap<string, string>;
  readonly detail: 'grouped' | 'all';
}

function cardRows(component: AreaComponentBox): readonly CardRow[] {
  if (component.overview === true) return [];
  return cardLayout(component, component.open).sections.flatMap((section) => section.rows);
}

function componentBoxes(system: CanvasSystem): readonly AreaSystemBox[] {
  return system.componentBoxes.flatMap((box) => [
    {
      id: box.id,
      x: system.x + box.x,
      y: system.y + box.y,
      width: box.width,
      height: box.height,
      rank: box.rank,
    },
    ...cardRows(box).flatMap((row) =>
      row.kind === 'resource'
        ? [
            {
              id: row.resource.id,
              x: system.x + box.x,
              y: system.y + box.y + row.centre,
              width: box.width,
              height: 0,
              rank: box.rank,
            },
          ]
        : [],
    ),
  ]);
}

function insideCard(
  relation: LandscapeSystemRelationship,
  systems: readonly CanvasSystem[],
): boolean {
  return systems.some((system) =>
    system.componentBoxes.some((component) =>
      (component.attachments ?? []).some(
        (resource) =>
          (relation.from === component.id && relation.to === resource.id) ||
          (relation.to === component.id && relation.from === resource.id),
      ),
    ),
  );
}

/** Keep authored purpose and API row identities; never replace meaning with a count. */
function groupLabel(group: readonly ProjectedRelationship[], first: ProjectedRelationship): string {
  if (first.narrative === true) return first.label;
  return combinedConnectionSummary(group);
}

function groupedRelationships(
  relationships: readonly ProjectedRelationship[],
  detail: 'grouped' | 'all',
): readonly ProjectedRelationship[] {
  if (detail === 'all') return relationships;
  const groups = new Map<string, ProjectedRelationship[]>();
  for (const relationship of relationships) {
    const key = `${relationship.from}|${relationship.to}|${relationship.kind}`;
    groups.set(key, [...(groups.get(key) ?? []), relationship]);
  }
  return [...groups.entries()].flatMap(([key, group]): readonly ProjectedRelationship[] => {
    const first = group[0];
    if (first === undefined) return [];
    return [
      {
        ...first,
        id: `group:${key}`,
        label: groupLabel(group, first),
        detail:
          group.length === 1 ? first.detail : connectionDetails(groupLabel(group, first), group),
        relations: group.flatMap((relationship) => relationship.relations ?? []),
      },
    ];
  });
}

function drawnEdge(
  edge: ProjectedRelationship,
  geometry: Pick<AreaRouted, 'path' | 'x' | 'y' | 'points'>,
): AreaRouted {
  const relations = edge.relations ?? [];
  const single = relations.length === 1 ? relations[0] : undefined;
  return {
    ...edge,
    ...geometry,
    drawn: [edge.from, edge.to],
    from: single?.from ?? edge.from,
    to: single?.to ?? edge.to,
    endpointId: single?.endpointId ?? null,
  };
}

function routedEdges(
  relationships: readonly ProjectedRelationship[],
  boxes: readonly AreaSystemBox[],
  previous: readonly AreaCanvasEdge[] = [],
): readonly AreaRouted[] {
  const edges: AreaRouted[] = [];
  for (const edge of relationships) {
    const geometry = areaEdgeGeometry({
      edge,
      boxes,
      relationships,
      labels: [...previous, ...edges],
    });
    if (geometry !== null) edges.push(drawnEdge(edge, geometry));
  }
  return edges;
}

function headerBox(system: CanvasSystem): AreaSystemBox {
  return { ...system, id: `header:${system.id}`, height: 82 };
}

function internalEdges(
  options: ProjectionOptions,
  previous: readonly AreaCanvasEdge[],
): readonly AreaRouted[] {
  return options.systems.flatMap((system) => {
    if (!options.expanded.has(system.id)) return [];
    const boxes = [headerBox(system), ...componentBoxes(system), ...endpointBoxes(options)];
    const ids = new Set(boxes.map((box) => box.id));
    const canonical = options.view.technicalRelationships.filter(
      (relation) => relation.fromSystem === system.id && relation.toSystem === system.id,
    );
    const source =
      canonical.length === 0
        ? system.componentRelationships
        : canonical.map((relation) => projectRelation(relation, options, ids));
    const relationships = groupedRelationships(
      source.filter(
        (relation) => relation.from !== relation.to && !insideCard(relation, options.systems),
      ),
      options.detail,
    );
    return routedEdges(relationships, boxes, previous);
  });
}

function pairKey(from: string, to: string, kind: LandscapeSystemRelationship['kind']): string {
  return `${[from, to].toSorted((a, b) => a.localeCompare(b)).join('|')}|${kind}`;
}

/** API group ports share the card's fixed header and row geometry. */
function endpointBoxes(options: ProjectionOptions): readonly AreaSystemBox[] {
  return options.systems.flatMap((system) => {
    if (!options.expanded.has(system.id)) return [];
    return system.componentBoxes.flatMap((component) =>
      cardRows(component).flatMap((row) =>
        row.kind === 'api'
          ? [
              {
                id: surfaceAnchor(component.id, row.surface),
                x: system.x + component.x,
                y: system.y + component.y + row.centre,
                width: component.width,
                height: 0,
                rank: component.rank,
              },
            ]
          : [],
      ),
    );
  });
}

/** A store or topic folded into a closed card is drawn as that card. */
function visibleEnd(id: string, options: ProjectionOptions, ids: ReadonlySet<string>) {
  if (ids.has(id)) return id;
  const owner = options.systems
    .flatMap((system) => system.componentBoxes)
    .find((box) => box.attachments?.some((resource) => resource.id === id) === true);
  return owner !== undefined && ids.has(owner.id) ? owner.id : undefined;
}

/** Interpretations name recorded connections; they never create or reverse an edge. */
function connectionLabel(
  relation: AreaTechnicalRelationship,
  options: ProjectionOptions,
): { readonly label?: string; readonly narrative?: boolean } {
  const connection = options.systems
    .flatMap((system) => system.story?.connections ?? [])
    .find(
      (candidate) =>
        candidate.from === relation.from &&
        candidate.to === relation.to &&
        candidate.kind === relation.kind,
    );
  return connection === undefined ? {} : { label: connection.label, narrative: true };
}

function projectRelation(
  relation: AreaTechnicalRelationship,
  options: ProjectionOptions,
  ids: ReadonlySet<string>,
): ProjectedRelationship {
  const endpoint = relation.endpointId ?? relation.via;
  const component = options.systems
    .flatMap((system) => system.componentBoxes)
    .find((box) => box.id === relation.to);
  const surface = apiSurface(component?.endpoints ?? []).find((group) =>
    group.endpoints.some((port) => port.id === endpoint),
  );
  const endpointAnchor = surface === undefined ? '' : surfaceAnchor(relation.to, surface);
  const end = (id: string, system: string): string =>
    (options.expanded.has(system) ? visibleEnd(id, options, ids) : undefined) ?? system;
  const from = end(relation.from, relation.fromSystem);
  const to = ids.has(endpointAnchor) ? endpointAnchor : end(relation.to, relation.toSystem);
  const onRow = surface !== undefined && to === endpointAnchor;
  return {
    ...relation,
    from,
    to,
    ...(onRow ? { surfaceId: surface.id } : {}),
    ...connectionLabel(relation, options),
    label:
      connectionLabel(relation, options).label ??
      (onRow
        ? surfaceLabel(surface)
        : connectionSummary(
            relation,
            options.view.systems.flatMap((system) => system.components),
            options.view.valueFlow?.summaries,
          )),
    relations: [relation],
  };
}

function visibleComponentEnd(id: string, system: string, options: ProjectionOptions): boolean {
  if (!options.expanded.has(system)) return true;
  return (
    options.systems
      .find((candidate) => candidate.id === system)
      ?.componentBoxes.some(
        (box) => box.id === id || box.attachments?.some((item) => item.id === id) === true,
      ) === true
  );
}

function crossSystemEdges(options: ProjectionOptions): readonly AreaRouted[] {
  const { view, systems, expanded, detail } = options;
  const boxes = [
    ...systems.flatMap((system) => [
      system,
      ...(expanded.has(system.id) ? [headerBox(system)] : []),
      ...componentBoxes(system),
    ]),
    ...endpointBoxes(options),
  ];
  const ids = new Set(boxes.map((box) => box.id));
  const visible = view.technicalRelationships.filter(
    (relation) =>
      relation.fromSystem !== relation.toSystem &&
      (expanded.has(relation.fromSystem) || expanded.has(relation.toSystem)),
  );
  const replacedPairs = new Set(
    visible.map((relation) => pairKey(relation.fromSystem, relation.toSystem, relation.kind)),
  );
  // Authored API exchanges can describe responses. Never reuse their direction or label for a call.
  // A known API relation cannot replace an unrelated authored message or data relationship.
  const authored = view.relationships.filter(
    (relation) =>
      !expanded.has(relation.from) &&
      !expanded.has(relation.to) &&
      !replacedPairs.has(pairKey(relation.from, relation.to, relation.kind)),
  );
  const technical = visible
    .filter(
      (relation) =>
        visibleComponentEnd(relation.from, relation.fromSystem, options) &&
        visibleComponentEnd(relation.to, relation.toSystem, options),
    )
    .map((relation) => projectRelation(relation, options, ids));
  const relationships = [...authored, ...groupedRelationships(technical, detail)];
  return routedEdges(relationships, boxes);
}

/** Every card a line must keep clear of; open systems are outlines that lines may run inside. */
function cards(options: ProjectionOptions): readonly AreaSystemBox[] {
  return options.systems.flatMap((system) =>
    options.expanded.has(system.id)
      ? [headerBox(system), ...componentBoxes(system).filter((box) => box.height > 0)]
      : [system],
  );
}

/**
 * Resolve each relation independently; a hidden endpoint falls back to its component, then system.
 * A line that lands on a component or API row is named by that row, so its label waits for a highlight.
 * While a system is open, its own lines lead and every line between systems is faint context;
 * calls to shared platform services are flagged so the canvas can leave them out by default.
 */
export function areaCanvasEdges(options: ProjectionOptions): readonly AreaCanvasEdge[] {
  const external = crossSystemEdges(options);
  const crossing = new Set(external.map((edge) => edge.id));
  const systems = new Set(options.systems.map((system) => system.id));
  const platform = platformComponents(options.view);
  const routed = [...external, ...internalEdges(options, external)].map(({ drawn, ...edge }) => {
    const onCard = !drawn.every((end) => systems.has(end));
    return {
      ...edge,
      ...(onCard && edge.narrative !== true ? { quiet: true } : {}),
      ...(options.expanded.size > 0 && crossing.has(edge.id) && edge.narrative !== true
        ? { context: true }
        : {}),
      ...(isPlatformLine(edge.relations, platform) ? { platform: true } : {}),
    };
  });
  return settleRoutes(routed, cards(options));
}
