import type { FlowModel } from '@/application/plan/flow-steps';
import { todayJourneys, type Route } from '@/application/plan/ui-journeys';
import { interactionScreenMap } from '@/application/plan/ui-journeys-interactions';
import {
  groupByActor,
  type MapNode,
  newNode,
  type RecordedEdge,
  type RecordedJourney,
  type ScreenMap,
} from '@/application/plan/ui-journeys-map-types';
import {
  todayWireflows,
  type WireRoute,
  type WireStop,
} from '@/application/plan/ui-journeys-wireflow';
import type { RegionNode, ScreenNode } from '@/domain/plan/plan-graph';

/** Every baseline screen once, grouped by its recorded serving app. */
export interface ScreenCatalogue {
  readonly routes: readonly Route[];
  readonly screens: readonly ScreenNode[];
  readonly groups: readonly { readonly service: string; readonly screens: readonly ScreenNode[] }[];
  readonly unlinked: readonly ScreenNode[];
}

export function todayScreenCatalogue(model: FlowModel): ScreenCatalogue {
  const screens = model.asIs.screens;
  const byService = new Map<string, ScreenNode[]>();
  for (const screen of screens) {
    byService.set(screen.service, [...(byService.get(screen.service) ?? []), screen]);
  }
  return {
    routes: todayJourneys(model).routes,
    screens,
    groups: [...byService].map(([service, group]) => ({ service, screens: group })),
    unlinked: todayScreenMap(model).unlinked,
  };
}

const plainControlText = (value: string | undefined): string =>
  (value ?? '').replaceAll(/\*\*|__/gu, '').trim();
/** The text after `prefix`, compared case-insensitively, or null when it does not start with it. */
const after = (text: string, prefix: string): readonly string[] =>
  text.toLowerCase().startsWith(prefix.toLowerCase()) ? [text.slice(prefix.length)] : [];

/** The text with and without an optional leading part. */
const maybe = (text: string, optional: RegExp): readonly string[] => {
  const without = text.replace(optional, '');
  return without === text ? [text] : [text, without];
};

const PRESS = /^\s+(?:presses|clicks|taps|press|click|tap)\s+/iu;
const ENDING = /^["”’']?(?:\s+(?:button|link))?[.!?]?$/iu;

/** "[The] <actor> presses [the] ["]<control>["] [button]." */
function isPressSentence(text: string, actor: string, control: string): boolean {
  return maybe(text, /^The\s+/iu)
    .flatMap((t) => after(t, actor))
    .flatMap((t) => maybe(t, PRESS).filter((x) => x !== t))
    .flatMap((t) => maybe(t, /^the\s+/iu))
    .flatMap((t) => maybe(t, /^["“‘']/u))
    .flatMap((t) => after(t, control))
    .some((t) => ENDING.test(t));
}

/**
 * The trigger can establish the initiating control only for the first, single screen record. Exact names and a
 * complete explicit actor-and-action sentence deliberately leave partial, conditional and later-screen prose
 * unclassified.
 */
function explicitStartingControl(
  route: WireRoute,
  visit: { readonly stop: WireStop; readonly stopIndex: number },
  region: RegionNode | null,
): boolean {
  if (visit.stopIndex !== 0 || visit.stop.records.length !== 1 || region === null) return false;
  if (route.actor === undefined || route.actor === '' || region.name === '') return false;
  const actor = plainControlText(route.actor);
  const control = plainControlText(region.name);
  return isPressSentence(plainControlText(route.trigger), actor, control);
}

function edgeOf(
  model: FlowModel,
  route: WireRoute,
  visit: { readonly stop: WireStop; readonly stopIndex: number },
): RecordedEdge | null {
  const { stop, stopIndex } = visit;
  const { connector } = stop;
  const source = stop.records.at(-1);
  if (connector === null || source === undefined) return null;
  const node = source.region === null ? undefined : model.asIs.get(source.region);
  const region = node?.$type === 'region' ? node : null;
  const output = connector.kind === 'output';
  const explicit = !output && explicitStartingControl(route, visit, region);
  const display = (): string => {
    if (output) return connector.steps.at(-1)?.action ?? '';
    return explicit && region !== null ? region.name : 'Next screen';
  };
  let evidence = 'recorded-order';
  if (output) evidence = 'recorded-output';
  else if (explicit) evidence = 'explicit-trigger';
  return {
    id: `${route.id}:screen-edge:${String(stopIndex)}`,
    flowId: route.id,
    actor: route.actor ?? null,
    source: connector.sourceScreen,
    destination: connector.destinationScreen,
    sourceStepId: connector.sourceStepId,
    destinationStepId: connector.destinationStepId,
    kind: connector.kind,
    relationship: 'recorded-order',
    label: source.action,
    labelSource: 'authored-action',
    displayLabel: display(),
    labelEvidence: evidence,
    region: source.region,
    regionName: region?.name ?? null,
    steps: connector.steps,
    notes: connector.notes,
  };
}

/** Put each stop's records on its screen, counting how often the route returns there. */
function visitRoute(
  model: FlowModel,
  route: WireRoute,
  byScreen: ReadonlyMap<string, MapNode>,
): { readonly edges: readonly RecordedEdge[]; readonly touches: readonly Touch[] } {
  const edges: RecordedEdge[] = [];
  const touches: Touch[] = [];
  const visits = new Map<string, number>();
  for (const [stopIndex, stop] of route.stops.entries()) {
    if (!byScreen.has(stop.screen)) continue;
    const visitIndex = visits.get(stop.screen) ?? 0;
    visits.set(stop.screen, visitIndex + 1);
    touches.push({
      screen: stop.screen,
      journeyId: route.id,
      actor: route.actor ?? null,
      records: stop.records.map((record) => ({
        ...record,
        flowId: route.id,
        stopIndex,
        visitIndex,
      })),
    });
    const edge = edgeOf(model, route, { stop, stopIndex });
    if (edge !== null) edges.push(edge);
  }
  return { edges, touches };
}

/** A route reaching a screen: who, and what it records there. */
interface Touch {
  readonly screen: string;
  readonly journeyId: string;
  readonly actor: string | null;
  readonly records: MapNode['records'];
}

const unique = <T>(xs: readonly T[]): T[] => [...new Set(xs)];

const touched = (node: MapNode, touches: readonly Touch[]): MapNode => {
  const mine = touches.filter((t) => t.screen === node.id);
  return {
    ...node,
    journeyIds: unique(mine.map((t) => t.journeyId)),
    actors: unique(mine.map((t) => t.actor)),
    records: mine.flatMap((t) => t.records),
  };
};

/**
 * The current screen landscape. Screens have one identity even when several journeys visit them, or a journey
 * returns to them. Edges keep each recorded flow boundary; sharing a screen does not imply a link between two
 * flows.
 *
 * A region name describes an area, never a navigation action. When the plan records no navigation
 * interactions, every edge keeps the explicit `recorded-order` relationship.
 */
export function todayScreenMap(model: FlowModel): ScreenMap {
  if (model.asIs.interactions.length > 0) return interactionScreenMap(model);
  const wire = todayWireflows(model);
  const blank = model.asIs.screens.map(newNode);
  const byScreen = new Map(blank.map((node) => [node.id, node]));
  const edges: RecordedEdge[] = [];
  const touches: Touch[] = [];
  const journeys: RecordedJourney[] = [];
  for (const route of wire.routes) {
    const visited = visitRoute(model, route, byScreen);
    const routeEdges = visited.edges;
    edges.push(...routeEdges);
    touches.push(...visited.touches);
    journeys.push({
      explicit: false,
      id: route.id,
      name: route.name,
      actor: route.actor ?? null,
      flow: route.flow,
      trigger: route.trigger,
      outcome: route.outcome,
      nodeIds: route.stops.map((stop) => stop.screen),
      edgeIds: routeEdges.map((edge) => edge.id),
      stops: route.stops,
    });
  }
  const nodes = blank.map((node) => touched(node, touches));
  return {
    explicit: false,
    nodes,
    edges,
    journeys,
    groups: groupByActor(journeys),
    unlinked: wire.unlinked,
  };
}
