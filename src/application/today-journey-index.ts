import type { Model } from '@/application/plan/derive';
import {
  flowsByStage,
  journeyClaim,
  type TodayJourney,
  todayJourneysOf,
} from '@/application/today-journeys';
import { journeyHref } from '@/application/today-reader';
import type { Workspace } from '@/domain/workspace';

/** One journey or flow as a line in the index. */
export interface JourneyRow {
  readonly key: string;
  readonly href: string;
  readonly kind: TodayJourney['kind'];
  readonly title: string;
  readonly claim: string;
  /** Who starts it, when a person does. */
  readonly actor: string;
  /** The systems it crosses, by name, in the order it reaches them. */
  readonly through: string;
  /** The ids of the domains it has steps in. */
  readonly domains: readonly string[];
  /** Lower-case words to find it by. */
  readonly terms: string;
}

export interface JourneyGroup {
  readonly id: string;
  readonly title: string;
  readonly rows: readonly JourneyRow[];
}

export interface JourneyIndex {
  readonly total: number;
  readonly groups: readonly JourneyGroup[];
  /** The domains some journey has steps in, in the workspace's order. */
  readonly domains: readonly { readonly id: string; readonly name: string }[];
}

// Every journey and flow as a short line, user journeys first and flows by the stage they serve, each with the
// domains it touches so a long list can be narrowed to one.
export function journeyIndexOf(workspace: Workspace, model: Model): JourneyIndex {
  const domainOf = new Map<string, string>(
    workspace.domains.flatMap((d) => d.systems.map((s) => [`sys:${s.id}`, d.id] as const)),
  );
  const rowOf = (j: TodayJourney): JourneyRow => {
    const through = j.systems.map((id) => model.label(id));
    const domains = [...new Set(j.systems.flatMap((id) => domainOf.get(id) ?? []))];
    const names = domains.map((id) => workspace.domains.find((d) => d.id === id)?.name ?? id);
    return {
      key: j.key,
      href: journeyHref(workspace.id, j.key),
      kind: j.kind,
      title: j.title,
      claim: journeyClaim(j),
      actor: j.kind === 'journey' ? j.actor : '',
      through: through.join(', '),
      domains,
      terms: [j.title, j.actor, j.trigger, j.outcome, ...through, ...names].join(' ').toLowerCase(),
    };
  };
  const journeys = todayJourneysOf(model);
  const people = journeys.filter((j) => j.kind === 'journey');
  const groups: JourneyGroup[] = [
    ...(people.length === 0
      ? []
      : [{ id: 'people', title: 'User journeys', rows: people.map(rowOf) }]),
    ...flowsByStage(model, journeys).map((stage) => ({
      id: `stage:${stage.stage}`,
      title: stage.title,
      rows: stage.journeys.map(rowOf),
    })),
  ];
  const touched = new Set(groups.flatMap((g) => g.rows.flatMap((r) => r.domains)));
  return {
    total: journeys.length,
    groups,
    domains: workspace.domains
      .filter((d) => touched.has(d.id))
      .map((d) => ({ id: d.id, name: d.name })),
  };
}
