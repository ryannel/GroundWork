import type { Model } from '@/application/plan/derive';
import { keyOf } from '@/application/plan-pages-key';

// The pages of the journey chapter: one for each planned scenario that has flows, then one for each flow no
// scenario covers. A page holds the flows of its scenario, one at a time.

export interface JourneyGroup {
  /** The page's address within the chapter. */
  readonly key: string;
  readonly title: string;
  /** The scenario the page is about; flows no scenario covers have none. */
  readonly scenario: string | null;
  readonly flows: readonly string[];
}

const flowsOf = (model: Model): { id: string; name: string }[] => [
  ...new Map([...model.asIs.flows, ...model.toBe.flows].map((f) => [f.id, f])).values(),
];

export function journeyGroups(model: Model): JourneyGroup[] {
  const all = flowsOf(model);
  const known = new Set(all.map((f) => f.id));
  const covered = new Set<string>();
  const groups: JourneyGroup[] = [];
  for (const scenario of model.plan.problem.scenarios ?? []) {
    const flows = [...new Set(scenario.flows)].filter((id) => known.has(id));
    for (const id of flows) covered.add(id);
    if (flows.length > 0) {
      groups.push({
        key: keyOf(scenario.id),
        title: `Planned scenario: ${scenario.title}`,
        scenario: scenario.id,
        flows,
      });
    }
  }
  for (const flow of all) {
    if (!covered.has(flow.id))
      groups.push({ key: keyOf(flow.id), title: flow.name, scenario: null, flows: [flow.id] });
  }
  return groups;
}
