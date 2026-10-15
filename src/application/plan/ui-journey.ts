import type { Model } from '@/application/plan/derive';

/** One stretch of a flow on a single screen. */
export interface JourneyLeg {
  screen: string;
  /** Indices of the flow's steps on this screen. */
  steps: number[];
  stepIds: string[];
  /** The regions of the screen those steps touch. */
  regions: string[];
}

export type JourneyModel = Pick<Model, 'asIs' | 'toBe' | 'screenOfStep'>;

const graphOf = (model: JourneyModel, flowId: string, mode: 'asIs' | 'toBe' | undefined) =>
  mode === 'asIs' || (mode === undefined && !model.toBe.has(flowId)) ? model.asIs : model.toBe;

/**
 * A flow as a UI journey: the screens its steps reach, in order, with the steps and regions on each. Without a
 * mode it reads to-be, then as-is. Empty when no step of the flow names a screen.
 */
export function uiJourney(
  model: JourneyModel,
  flowId: string,
  mode?: 'asIs' | 'toBe',
): JourneyLeg[] {
  const graph = graphOf(model, flowId, mode);
  const flow = graph.get(flowId);
  const legs: JourneyLeg[] = [];
  if (flow?.$type !== 'flow') return legs;
  for (const [i, step] of flow.steps.entries()) {
    const hit = model.screenOfStep(graph, step);
    if (hit === null) continue;
    const last = legs.at(-1);
    const leg =
      last?.screen === hit.screen
        ? last
        : { screen: hit.screen, steps: [], stepIds: [], regions: [] };
    if (leg !== last) legs.push(leg);
    leg.steps.push(i);
    leg.stepIds.push(step.id);
    if (hit.region !== null && !leg.regions.includes(hit.region)) leg.regions.push(hit.region);
  }
  return legs;
}
