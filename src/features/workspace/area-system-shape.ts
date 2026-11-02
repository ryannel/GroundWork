import { CARD, cardLayout } from '@/application/area-map/card-geometry';
import { layoutNarrative } from '@/application/area-map/narrative-layout';
import { type AreaSystemBox, layoutAreaSystems } from '@/application/area-system-layout';
import type { AreaComponentView, AreaSystemView } from '@/application/workspace-area';
import type { LandscapeSystemRelationship } from '@/domain/landscape';
import type { SystemNarrative } from '@/domain/system-narrative';

export interface AreaComponentBox extends AreaComponentView {
  readonly overview?: boolean;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly rank: number;
  readonly compact: boolean;
  /** Whether the card lists its APIs, stores and topics, so lines can land on them. */
  readonly open: boolean;
}

export interface AreaSystemShape {
  readonly width: number;
  readonly height: number;
  readonly components: readonly AreaComponentBox[];
  readonly relationships: readonly LandscapeSystemRelationship[];
}

const MARGIN = 24;
const HEADER = 82;
const ROW_GAP = 48;
const COLUMN_GAP = 200;
const BAND_COLUMNS = 5;
const COMPACT_WIDTH = CARD.width;
const COMPACT_HEIGHT = 156;

function componentSize(component: AreaComponentView, open: ReadonlySet<string>) {
  return { width: CARD.width, height: cardLayout(component, open.has(component.id)).height };
}

/** A store or topic folded into a card stands for that card, so its users are still drawn near it. */
function componentRelationships(
  system: AreaSystemView,
  folded: ReadonlyMap<string, string> = new Map(),
): readonly LandscapeSystemRelationship[] {
  const ids = new Set(system.components.map((component) => component.id));
  const relationships = system.components.flatMap((component) =>
    component.dependencies.flatMap((dependency): readonly LandscapeSystemRelationship[] => {
      if (!ids.has(dependency.id)) return [];
      const id = `${component.id}|${dependency.id}|${dependency.endpointId ?? ''}`;
      const endpoint = dependency.endpoint === null ? '' : ` at ${dependency.endpoint}`;
      return [
        {
          id,
          from: component.id,
          to: dependency.id,
          label: dependency.endpoint ?? 'API call',
          kind: 'api',
          detail: `${component.name} calls ${dependency.name}${endpoint}.`,
        },
      ];
    }),
  );
  const resources = system.components.flatMap((component) =>
    component.resources
      .map((resource) => ({ resource, end: folded.get(resource.id) ?? resource.id }))
      .filter(({ end }) => ids.has(end) && end !== component.id)
      .map(({ resource, end }) => ({
        id: `${component.id}|${resource.id}|${resource.use}`,
        from: resource.use.startsWith('Consumes') ? end : component.id,
        to: resource.use.startsWith('Consumes') ? component.id : end,
        label: resource.use,
        kind: resource.kind === 'topic' ? ('message' as const) : ('data' as const),
        detail: `${component.name}: ${resource.use} ${resource.name}.`,
      })),
  );
  return [
    ...new Map(
      [...relationships, ...resources].map((relationship) => [relationship.id, relationship]),
    ).values(),
  ];
}

function connectedIds(relationships: readonly LandscapeSystemRelationship[]): Set<string> {
  return new Set(relationships.flatMap((relationship) => [relationship.from, relationship.to]));
}

/** A long chain wraps like a line of text: every fifth column starts a new band below the last. */
function wrapped(boxes: readonly AreaSystemBox[]): readonly AreaSystemBox[] {
  const bands = Math.ceil((Math.max(-1, ...boxes.map((box) => box.rank)) + 1) / BAND_COLUMNS);
  const columnX = (rank: number): number =>
    Math.min(...boxes.filter((box) => box.rank === rank).map((box) => box.x));
  let top = Math.min(...boxes.map((box) => box.y));
  return Array.from({ length: bands }, (_, band) => {
    const inBand = boxes.filter((box) => Math.floor(box.rank / BAND_COLUMNS) === band);
    const shiftX = columnX(band * BAND_COLUMNS) - columnX(0);
    const shiftY = Math.min(...inBand.map((box) => box.y)) - top;
    top = Math.max(...inBand.map((box) => box.y + box.height)) - shiftY + ROW_GAP * 2;
    return inBand.map((box) => ({ ...box, x: box.x - shiftX, y: box.y - shiftY }));
  }).flat();
}

/**
 * Callers on the left, what they rely on to the right: cards are lists of rows, so a line reaches the API
 * group or resource it uses by coming straight across, and each gap between columns is a corridor of lanes.
 */
function readingFlow(
  components: readonly AreaComponentView[],
  relationships: readonly LandscapeSystemRelationship[],
  open: ReadonlySet<string>,
): readonly AreaComponentBox[] {
  const placed = wrapped(
    layoutAreaSystems(
      components.map((component) => ({ id: component.id, ...componentSize(component, open) })),
      relationships,
      { compact: true, gap: COLUMN_GAP },
    ),
  );
  const byId = new Map(components.map((component) => [component.id, component]));
  return placed.flatMap((box): readonly AreaComponentBox[] => {
    const component = byId.get(box.id);
    if (component === undefined) return [];
    return [
      {
        ...component,
        ...box,
        y: box.y + HEADER,
        compact: false,
        open: cardLayout(component, open.has(component.id)).open,
      },
    ];
  });
}

function looseBoxes(
  components: readonly AreaComponentView[],
  startY: number,
  open: ReadonlySet<string>,
): readonly AreaComponentBox[] {
  const rowHeight = Math.max(
    COMPACT_HEIGHT,
    ...components.map((component) => componentSize(component, open).height),
  );
  return components.map((component, index) => ({
    ...component,
    x: MARGIN + (index % 3) * (COMPACT_WIDTH + ROW_GAP),
    y: startY + Math.floor(index / 3) * (rowHeight + ROW_GAP),
    width: COMPACT_WIDTH,
    height: Math.max(COMPACT_HEIGHT, componentSize(component, open).height),
    rank: -1,
    compact: true,
    open: cardLayout(component, open.has(component.id)).open,
  }));
}

/**
 * A system becomes a bounded component graph; unconnected evidence stays available without posing as a flow.
 * Cards start closed; `open` names the components whose APIs, stores and topics are listed.
 */
export function systemShape(
  system: AreaSystemView,
  open: ReadonlySet<string> = new Set(),
  story?: SystemNarrative,
): AreaSystemShape {
  const primary = new Set(story?.stages.flatMap((stage) => [stage.component, ...stage.supporting]));
  const visible = system.components.filter(
    (component) =>
      story !== undefined ||
      primary.has(component.id) ||
      !system.components.some(
        (parent) => parent.kind === 'service' && parent.id === component.parentComponent,
      ),
  );
  const grouped = visible.map((component) => ({
    ...component,
    attachments:
      component.kind === 'service' && story === undefined
        ? system.components.filter(
            (resource) => resource.parentComponent === component.id && !primary.has(resource.id),
          )
        : [],
  }));
  const shown = { ...system, components: grouped };
  const folded = new Map(
    grouped.flatMap((card) => card.attachments.map((item) => [item.id, card.id] as const)),
  );
  const relationships = componentRelationships(shown, folded);
  const connected = connectedIds(relationships);
  const flowComponents = grouped.filter((component) => connected.has(component.id));
  const unconnected = grouped.filter((component) => !connected.has(component.id));
  const flow =
    story === undefined
      ? readingFlow(flowComponents, relationships, open)
      : layoutNarrative(
          grouped
            .filter((component) => primary.has(component.id))
            .map((component) => ({
              id: component.id,
              ...(open.has(component.id)
                ? componentSize(component, open)
                : { width: 220, height: 120 }),
            })),
          story,
        ).flatMap((box): readonly AreaComponentBox[] => {
          const component = grouped.find((candidate) => candidate.id === box.id);
          return component === undefined
            ? []
            : [
                {
                  ...component,
                  ...box,
                  overview: !open.has(component.id),
                  compact: false,
                  open: cardLayout(component, open.has(component.id)).open,
                },
              ];
        });
  const flowBottom = Math.max(HEADER, ...flow.map((box) => box.y + box.height));
  const loose = looseBoxes(
    story === undefined
      ? unconnected
      : grouped.filter((component) => !flow.some((box) => box.id === component.id)),
    flowBottom + (unconnected.length === 0 ? 0 : ROW_GAP),
    open,
  );
  const headerSpace = (system.narratives?.notice ?? null) === null ? 0 : 50;
  const components = [...flow, ...loose].map((box) => ({
    ...box,
    y: box.y + headerSpace,
  }));
  return {
    width: Math.max(720, ...components.map((box) => box.x + box.width + MARGIN)),
    height: Math.max(240, ...components.map((box) => box.y + box.height + MARGIN)),
    components,
    relationships,
  };
}
