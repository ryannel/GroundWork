import type { Model } from '@/application/plan/derive';
import { keyOf } from '@/application/plan-pages-screens';
import { topOf } from '@/application/plan-story-changes-touched';

// Where chapter 3 shows a flow: its scenario's screen when a planned scenario covers it, else its own.

/** The journey screen that draws a flow, or null when the flow is not in the plan. */
export function journeyKeyOf(model: Model, flowId: string): string | null {
  const known = [...model.asIs.flows, ...model.toBe.flows].some((f) => f.id === flowId);
  if (!known) return null;
  const scenario = (model.plan.problem.scenarios ?? []).find((s) =>
    (s.flows ?? []).includes(flowId),
  );
  return keyOf(scenario?.id ?? flowId);
}

/** The first flow whose steps happen on a screen, to-be before as-is. */
export function flowShowing(model: Model, screenId: string): string | null {
  for (const graph of [model.toBe, model.asIs]) {
    const step = graph.flows.flatMap((f) => f.steps).find((s) => topOf(s.screen) === screenId);
    if (step !== undefined) return topOf(step.id);
  }
  return null;
}
