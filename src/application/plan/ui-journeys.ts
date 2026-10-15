import type { FlowModel } from '@/application/plan/flow-steps';
import type { FlowNode, ScreenNode, StepNode, SystemGraph } from '@/domain/plan/plan-graph';

/** A step with the flow it belongs to. */
export interface StepEvent {
  flow: FlowNode;
  step: StepNode;
}

/** One visit to a screen: its consecutive actions, and the work around them. */
export interface Stop {
  screen: string;
  flow: FlowNode;
  actions: StepNode[];
  /** Background steps between the actions of this visit. */
  during: StepEvent[];
  regions: string[];
  start: number;
  end: number;
  before: StepEvent[];
  after: StepEvent[];
}

/** One baseline flow as the screens it visits. */
export interface Route {
  id: string;
  scenario: false;
  flowIds: string[];
  flow: FlowNode;
  actor: string | undefined;
  trigger: string | undefined;
  outcome: string | undefined;
  stops: Stop[];
  name: string;
  /** How many stops come before this route in the whole list. */
  offset: number;
}

export interface Journeys {
  routes: Route[];
  /** Baseline screens that no recorded step visits. */
  unlinked: ScreenNode[];
  stops: Stop[];
}

/** A step as it was recorded, with absent fields made explicit. */
export interface RecordedStep {
  stepId: string;
  action: string;
  screenReference: string | null;
  logic: string | null;
  fails: string | null;
  from: string | null;
  to: string | null;
  via: string | null;
  reads: string[];
  writes: string[];
}

export const recordedStep = (step: StepNode): RecordedStep => ({
  stepId: step.id,
  action: step.action,
  screenReference: step.screen ?? null,
  logic: step.logic ?? null,
  fails: step.fails ?? null,
  from: step.from,
  to: step.to,
  via: step.via,
  reads: [...(step.reads ?? [])],
  writes: [...(step.writes ?? [])],
});

/** The stops of one flow. Consecutive steps on the same screen share a stop, keeping the background work between them. */
function stopsOf(graph: SystemGraph, flow: FlowNode): Stop[] {
  const events = flow.steps.map((step) => ({ flow, step }));
  const stops: Stop[] = [];
  for (const [i, event] of events.entries()) {
    const reference = event.step.screen;
    const screen = reference?.split('#')[0];
    if (reference === undefined || screen === undefined || !graph.has(screen)) continue;
    const regions = reference.includes('#') ? [reference] : [];
    const last = stops.at(-1);
    if (last?.screen === screen) {
      last.during.push(...events.slice(last.end + 1, i + 1));
      last.actions.push(event.step);
      last.end = i;
      last.regions.push(...regions);
    } else {
      stops.push({
        screen,
        flow,
        actions: [event.step],
        during: [],
        regions,
        start: i,
        end: i,
        before: [],
        after: [],
      });
    }
  }
  return bounded(stops, events);
}

/** The work before the first stop, and after each stop until the next. */
function bounded(stops: Stop[], events: StepEvent[]): Stop[] {
  for (const [i, stop] of stops.entries()) {
    stop.before = i === 0 ? events.slice(0, stop.start) : [];
    stop.after = events.slice(stop.end + 1, stops[i + 1]?.start ?? events.length);
  }
  return stops;
}

/**
 * Today's recorded screen paths. Each baseline flow keeps its own boundary; proposal scenarios do not
 * establish a connection between today's flows.
 */
export function todayJourneys(model: FlowModel): Journeys {
  const routes: Route[] = [];
  let offset = 0;
  for (const flow of model.asIs.flows) {
    const stops = stopsOf(model.asIs, flow);
    if (stops.length === 0) continue;
    routes.push({
      id: flow.id,
      scenario: false,
      flowIds: [flow.id],
      flow,
      actor: flow.actor,
      trigger: flow.trigger,
      outcome: flow.outcome,
      stops,
      name: flow.name,
      offset,
    });
    offset += stops.length;
  }
  const linked = new Set(routes.flatMap((route) => route.stops.map((stop) => stop.screen)));
  return {
    routes,
    unlinked: model.asIs.screens.filter((screen) => !linked.has(screen.id)),
    stops: routes.flatMap((route) => route.stops),
  };
}
