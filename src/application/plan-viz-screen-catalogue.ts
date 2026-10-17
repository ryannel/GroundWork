import type { Model } from '@/application/plan/derive';
import { todayScreenCatalogue, todayScreenMap } from '@/application/plan/ui-journeys-map';
import type { MapEdge, MapNode, ScreenMap } from '@/application/plan/ui-journeys-map-types';
import {
  type FlowBox,
  type FlowLine,
  type Routed,
  type Size,
  layoutScreenFlow,
} from '@/application/plan-viz-screen-flow-layout';
import { screenKind } from '@/application/plan-viz-screens';
import { plainLine } from '@/application/plan-viz-text';

// The screens people use today, drawn once each and joined by the sequences the plan records. Every screen is
// drawn once, even when several journeys share it; joining screens into groups is a drawing convenience, never an
// inferred journey.

export interface CatalogueScreenBox {
  readonly id: string;
  readonly name: string;
  readonly meta: string;
  readonly journeys: string;
  readonly sharedOnly: boolean;
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

export interface CatalogueLine {
  readonly id: string;
  readonly label: string;
  readonly describe: string;
  readonly path: string;
  readonly inspect: string;
  readonly journeys: string;
  readonly output: boolean;
  readonly shared: boolean;
  readonly pill: Routed['label'];
}

export interface CatalogueCluster {
  readonly caption: string;
  readonly note: string;
  readonly width: number;
  readonly height: number;
  readonly screens: readonly CatalogueScreenBox[];
  readonly lines: readonly CatalogueLine[];
}

export interface CatalogueGroup {
  readonly label: string;
  readonly clusters: readonly CatalogueCluster[];
}

export interface CatalogueJourney {
  readonly id: string;
  readonly name: string;
  readonly actor: string;
}

export interface CatalogueCard {
  readonly id: string;
  readonly meta: string;
  readonly unlinked: boolean;
}

export interface CatalogueView {
  readonly headline: string;
  readonly key: string;
  readonly journeys: readonly CatalogueJourney[];
  readonly hasShared: boolean;
  readonly groups: readonly CatalogueGroup[];
  readonly sections: readonly {
    readonly app: string | null;
    readonly cards: readonly CatalogueCard[];
  }[];
}

const APP_MISSING = 'Serving app not recorded';
const ACTOR_MISSING = 'Actor not recorded';
const CARDS_ALONE = 3;
const LABEL_H = 26;
const LABEL_MAX = 190;
const GLYPH = 7;

const isShared = (edge: MapEdge): boolean => edge.relationship === 'interaction' && edge.shared;
const journeysOf = (edge: MapEdge): readonly string[] =>
  edge.relationship === 'interaction' ? edge.journeyIds : [edge.flowId];

function appName(model: Model, service: string): string {
  const node = model.asIs.get(service);
  return node !== undefined && 'name' in node && node.name !== '' ? node.name : APP_MISSING;
}

export function screenCatalogueHeadline(model: Model): string {
  if (todayScreenCatalogue(model).screens.length === 0) {
    return 'No screens are recorded in this version.';
  }
  const map = todayScreenMap(model);
  return map.journeys.length > 0 || map.edges.length > 0
    ? 'Follow what people do and see today.'
    : 'These screens have no recorded journey link.';
}

function keyLine(map: ScreenMap): string {
  if (map.explicit) {
    return 'Actions label arrows. Dashed arrows produce outputs. Open a screen to see its picture and actions.';
  }
  if (map.edges.length > 0) {
    return 'Arrows show recorded sequences. Exact navigation controls are not recorded unless named. Dashed arrows produce outputs.';
  }
  return 'No transitions between screens are recorded. Highlight a journey to see which screens it uses.';
}

interface Component {
  readonly nodes: readonly MapNode[];
  readonly edges: readonly MapEdge[];
}

function connected(map: ScreenMap): Component[] {
  const parent = new Map(map.nodes.map((n) => [n.id, n.id]));
  const root = (id: string): string => {
    const up = parent.get(id) ?? id;
    return up === id ? id : root(up);
  };
  for (const e of map.edges) parent.set(root(e.destination), root(e.source));
  const parts = new Map<string, Component>();
  for (const node of map.nodes) {
    const part = parts.get(root(node.id)) ?? { nodes: [], edges: [] };
    parts.set(root(node.id), { ...part, nodes: [...part.nodes, node] });
  }
  for (const edge of map.edges) {
    const part = parts.get(root(edge.source));
    if (part !== undefined) parts.set(root(edge.source), { ...part, edges: [...part.edges, edge] });
  }
  return [...parts.values()];
}

/** Recorded visiting order is a helpful drawing order; it adds no edges. */
function ordered(map: ScreenMap, part: Component): Component {
  const own = new Set(part.nodes.map((n) => n.id));
  const visits = map.journeys.flatMap((j) => j.nodeIds).filter((id) => own.has(id));
  const order = [...new Set([...visits, ...part.nodes.map((n) => n.id)])];
  return {
    ...part,
    nodes: part.nodes.toSorted((a, b) => order.indexOf(a.id) - order.indexOf(b.id)),
  };
}

interface Bucket {
  readonly label: string;
  readonly parts: readonly Component[];
  readonly size: number;
}

function grouped(
  map: ScreenMap,
): { readonly label: string; readonly parts: readonly Component[] }[] {
  const buckets = new Map<string, Bucket>();
  for (const part of connected(map).map((p) => ordered(map, p))) {
    const actors = [...new Set(part.nodes.flatMap((n) => n.actors).filter((a) => a !== null))];
    const label = actors.length > 0 ? actors.join(' · ') : 'Other recorded screens';
    const bucket = buckets.get(label) ?? { label, parts: [], size: 0 };
    buckets.set(label, {
      label,
      parts: [...bucket.parts, part],
      size: bucket.size + part.nodes.length,
    });
  }
  return [...buckets.values()]
    .toSorted((a, b) => b.size - a.size)
    .map(({ label, parts }) => ({
      label,
      // Screens with no recorded link between them share one cluster.
      parts:
        parts.length > 1 && parts.every((p) => p.edges.length === 0)
          ? [{ nodes: parts.flatMap((p) => p.nodes), edges: [] }]
          : parts,
    }));
}

const labelSize = (text: string): Size => ({
  w: Math.min(LABEL_MAX, 20 + text.length * GLYPH),
  h: LABEL_H,
});

const pathOf = (points: Routed['points']): string =>
  points.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${String(x)},${String(y)}`).join(' ');

function cluster(
  { model, map }: { readonly model: Model; readonly map: ScreenMap },
  part: Component,
  index: number,
): CatalogueCluster {
  const boxes: FlowBox[] = part.nodes.map((n) => ({ id: n.id }));
  const lines: FlowLine[] = part.edges.map((e) => ({
    id: e.id,
    source: e.source,
    destination: e.destination,
    shared: isShared(e),
  }));
  const layout = layoutScreenFlow(boxes, lines, {
    label: new Map(part.edges.map((e) => [e.id, labelSize(e.displayLabel)])),
  });
  const own = new Set(part.nodes.map((n) => n.id));
  const names = journeysIn(map, own);
  const edgeById = new Map(part.edges.map((e) => [e.id, e]));
  const nodeById = new Map(part.nodes.map((n) => [n.id, n]));
  const touching = (id: string): MapEdge[] =>
    part.edges.filter((e) => e.source === id || e.destination === id);
  let note = '';
  if (part.edges.length === 0) note = 'No recorded screen transition.';
  else if (index > 0) note = 'Connection to the other journeys is not recorded.';
  return {
    caption: map.explicit ? '' : names.join(' · '),
    note,
    width: layout.width,
    height: layout.height,
    screens: layout.nodes.flatMap((placed) => {
      const node = nodeById.get(placed.id);
      if (node === undefined) return [];
      const near = touching(node.id);
      return [
        {
          id: node.id,
          name: node.screen.name,
          meta: `${screenKind(node.screen)} · ${appName(model, node.screen.service)}`,
          journeys: node.journeyIds.join(' '),
          sharedOnly: near.length > 0 && near.every(isShared) && near.some(isShared),
          x: placed.x,
          y: placed.y,
          w: placed.w,
          h: placed.h,
        },
      ];
    }),
    lines: layout.edges.flatMap((routed) => {
      const edge = edgeById.get(routed.id);
      if (edge === undefined) return [];
      return [lineOf(model, edge, routed)];
    }),
  };
}

function journeysIn(map: ScreenMap, own: ReadonlySet<string>): string[] {
  return map.journeys.filter((j) => j.nodeIds.some((id) => own.has(id))).map((j) => j.name);
}

function lineOf(model: Model, edge: MapEdge, routed: Routed): CatalogueLine {
  const from = model.asIs.get(edge.source);
  const to = model.asIs.get(edge.destination);
  const name = (n: typeof from): string => (n !== undefined && 'name' in n ? n.name : '');
  return {
    id: edge.id,
    label: edge.displayLabel,
    describe: `${name(from)} to ${name(to)} · ${edge.displayLabel}`,
    path: pathOf(routed.points),
    inspect: edge.relationship === 'interaction' ? edge.interactionId : edge.flowId,
    journeys: journeysOf(edge).join(' '),
    output: edge.kind === 'output',
    shared: isShared(edge),
    pill: routed.label,
  };
}

function cardsOf(model: Model): CatalogueView['sections'] {
  const { screens, groups, unlinked } = todayScreenCatalogue(model);
  const missing = new Set(unlinked.map((s) => s.id));
  const card = (screen: (typeof screens)[number], owner: boolean): CatalogueCard => ({
    id: screen.id,
    meta: owner ? appName(model, screen.service) : '',
    unlinked: missing.has(screen.id),
  });
  if (screens.length <= CARDS_ALONE) {
    return [{ app: null, cards: screens.map((s) => card(s, true)) }];
  }
  return groups.map((g) => ({
    app: appName(model, g.service),
    cards: g.screens.map((s) => card(s, false)),
  }));
}

/** The map and the card list for the screens chapter. Null when no screens are recorded. */
export function screenCatalogue(model: Model): CatalogueView | null {
  if (model.asIs.screens.length === 0) return null;
  const map = todayScreenMap(model);
  const nameOf = new Map(map.journeys.map((j) => [j.id, j.name]));
  return {
    headline: screenCatalogueHeadline(model),
    key: keyLine(map),
    journeys: map.journeys.map((j) => ({
      id: j.id,
      name: plainLine(nameOf.get(j.id) ?? j.id),
      actor: j.actor ?? ACTOR_MISSING,
    })),
    hasShared: map.edges.some(isShared),
    groups: grouped(map).map((g) => ({
      label: g.label,
      clusters: g.parts.map((part, index) => cluster({ model, map }, part, index)),
    })),
    sections: cardsOf(model),
  };
}
