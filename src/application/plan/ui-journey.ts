import type { Model } from '@/application/plan/derive';

/** One stretch of a flow on a single screen. */
export interface JourneyLeg {
  readonly screen: string;
  /** Indices of the flow's steps on this screen. */
  readonly steps: readonly number[];
  readonly stepIds: readonly string[];
  /** The regions of the screen those steps touch. */
  readonly regions: readonly string[];
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
  if (flow?.$type !== 'flow') return [];
  const hits = [...flow.steps.entries()].flatMap(([i, step]) => {
    const hit = model.screenOfStep(graph, step);
    return hit === null ? [] : [{ i, step, hit }];
  });
  return hits.reduce<JourneyLeg[]>((legs, { i, step, hit }) => {
    const last = legs.at(-1);
    const same = last?.screen === hit.screen;
    const leg = same ? last : { screen: hit.screen, steps: [], stepIds: [], regions: [] };
    const regions =
      hit.region !== null && !leg.regions.includes(hit.region)
        ? [...leg.regions, hit.region]
        : leg.regions;
    const next = {
      ...leg,
      steps: [...leg.steps, i],
      stepIds: [...leg.stepIds, step.id],
      regions,
    };
    return same ? [...legs.slice(0, -1), next] : [...legs, next];
  }, []);
}
