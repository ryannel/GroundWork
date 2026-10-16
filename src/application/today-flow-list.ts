import type { Model } from '@/application/plan/derive';

/** One flow in a system's list: what it is called, how long it is, and where it comes into the system. */
export interface FlowEntry {
  readonly id: string;
  readonly name: string;
  readonly href: string;
  readonly steps: number;
  /** Steps that touch the system. */
  readonly here: number;
  /** The first part of the system the flow touches; the list groups flows under it. */
  readonly entry: string;
  /** The flow's name, its steps and everything they touch or go through, in lower case, for searching. */
  readonly terms: string;
}

/** The flows with a step in the focus, most steps there first, each with where it comes in. */
export function flowEntriesOf(
  model: Model,
  focus: ReadonlySet<string>,
  hrefOf: (id: string) => string,
): FlowEntry[] {
  return model.asIs.flows
    .flatMap((flow) => {
      const touched = [...new Set(flow.steps.flatMap((s) => [s.from, s.to]))];
      const first = touched.find((t) => focus.has(t));
      if (first === undefined) return [];
      return [
        {
          id: flow.id,
          name: flow.name,
          href: hrefOf(flow.id),
          steps: flow.steps.length,
          here: flow.steps.filter((s) => focus.has(s.from) || focus.has(s.to)).length,
          entry: model.label(first),
          terms: [
            flow.name,
            ...touched.map((t) => model.label(t)),
            ...flow.steps.flatMap((s) => [s.action, model.label(s.via)]),
          ]
            .join(' ')
            .toLowerCase(),
        },
      ];
    })
    .toSorted((a, b) => b.here - a.here);
}
