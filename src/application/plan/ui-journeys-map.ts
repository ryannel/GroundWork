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
  routes: Route[];
  screens: ScreenNode[];
  groups: { service: string; screens: ScreenNode[] }[];
  unlinked: ScreenNode[];
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
  (value ?? '').replaceAll(/\*\*|__/g, '').trim();
const regexpText = (value: string): string =>
  value.replaceAll(/[$()*+.?[\\\]^{|}]/g, String.raw`\$&`);

/**
 * The trigger can establish the initiating control only for the first, single screen record. Exact names and a
 * complete explicit actor-and-action sentence deliberately leave partial, conditional and later-screen prose
 * unclassified.
 */
function explicitStartingControl(
  route: WireRoute,
  visit: { stop: WireStop; stopIndex: number },
  region: RegionNode | null,
): boolean {
  if (visit.stopIndex !== 0 || visit.stop.records.length !== 1 || region === null) return false;
  if (route.actor === undefined || route.actor === '' || region.name === '') return false;
  const actor = regexpText(plainControlText(route.actor));
  const control = regexpText(plainControlText(region.name));
  const sentence = new RegExp(
    String.raw`^(?:The\s+)?${actor}\s+(?:presses|clicks|taps|press|click|tap)\s+(?:the\s+)?(?:["“‘'])?${control}(?:["”’'])?(?:\s+(?:button|link))?[.!?]?$`,
    'i',
  );
  return sentence.test(plainControlText(route.trigger));
}

function edgeOf(
  model: FlowModel,
  route: WireRoute,
  visit: { stop: WireStop; stopIndex: number },
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
): RecordedEdge[] {
  const edges: RecordedEdge[] = [];
  const visits = new Map<string, number>();
  for (const [stopIndex, stop] of route.stops.entries()) {
    const node = byScreen.get(stop.screen);
    if (node === undefined) continue;
    if (!node.journeyIds.includes(route.id)) node.journeyIds.push(route.id);
    const actor = route.actor ?? null;
    if (!node.actors.includes(actor)) node.actors.push(actor);
    const visitIndex = visits.get(stop.screen) ?? 0;
    visits.set(stop.screen, visitIndex + 1);
    node.records.push(
      ...stop.records.map((record) => ({ ...record, flowId: route.id, stopIndex, visitIndex })),
    );
    const edge = edgeOf(model, route, { stop, stopIndex });
    if (edge !== null) edges.push(edge);
  }
  return edges;
}

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
  const nodes = model.asIs.screens.map(newNode);
  const byScreen = new Map(nodes.map((node) => [node.id, node]));
  const edges: RecordedEdge[] = [];
  const journeys: RecordedJourney[] = [];
  for (const route of wire.routes) {
    const routeEdges = visitRoute(model, route, byScreen);
    edges.push(...routeEdges);
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
  return {
    explicit: false,
    nodes,
    edges,
    journeys,
    groups: groupByActor(journeys),
    unlinked: wire.unlinked,
  };
}
