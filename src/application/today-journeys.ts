import type { Model } from '@/application/plan/derive';
import { keyOf } from '@/application/plan-pages-key';
import { journeyGroups } from '@/application/plan-story-journey-groups';
import { countWord } from '@/application/plan-viz-text';
import { plain } from '@/shared/plain-text';

// The major journeys of a workspace as it runs today: each user journey, walked across the flows its
// interactions rely on, then every flow on its own. A flow's key is its journey group's key, so a card
// anywhere links to the same walk.

export interface TodayJourney {
  /** The walk's address under journeys/. */
  readonly key: string;
  readonly kind: 'journey' | 'flow';
  /** The user journey's or flow's id. */
  readonly id: string;
  readonly title: string;
  readonly actor: string;
  readonly trigger: string;
  readonly outcome: string;
  /** The flows walked, in order. */
  readonly flows: readonly string[];
  /** The `sys:` ids of the systems the steps run through, in the order they are first reached. */
  readonly systems: readonly string[];
  readonly steps: number;
}

interface StageJourneys {
  /** The stage's id, or '' for flows no stage names. */
  readonly stage: string;
  readonly title: string;
  readonly journeys: readonly TodayJourney[];
}

const text = (model: Model, words: string | undefined): string =>
  plain(words, (id) => model.label(id));

function flowOf(model: Model, id: string) {
  const node = model.asIs.get(id);
  return node?.$type === 'flow' ? node : null;
}

/** The system a component belongs to: a service's own, a store's through the service that owns it. */
function systemOf(model: Model, id: string): string | null {
  const node = model.asIs.get(id);
  if (node?.$type === 'service') return node.system ?? null;
  if (node?.$type === 'store') return systemOf(model, node.owner);
  return null;
}

function crossed(
  model: Model,
  flows: readonly string[],
): { readonly systems: readonly string[]; readonly steps: number } {
  const systems = new Set<string>();
  const steps = flows.flatMap((id) => flowOf(model, id)?.steps ?? []);
  for (const step of steps) {
    for (const end of [step.from, step.to]) {
      const system = systemOf(model, end);
      if (system !== null) systems.add(system);
    }
  }
  return { systems: [...systems], steps: steps.length };
}

function flowJourney(
  model: Model,
  group: { readonly key: string; readonly flows: readonly string[] },
): TodayJourney {
  const first = flowOf(model, group.flows[0] ?? '');
  const last = flowOf(model, group.flows.at(-1) ?? '');
  return {
    key: group.key,
    kind: 'flow',
    id: group.flows[0] ?? group.key,
    title: first?.name ?? group.key,
    actor: first?.actor ?? '',
    trigger: text(model, first?.trigger),
    outcome: text(model, last?.outcome),
    flows: group.flows,
    ...crossed(model, group.flows),
  };
}

function interactionOf(model: Model, id: string) {
  const node = model.asIs.get(id);
  return node?.$type === 'interaction' ? node : null;
}

function userJourneys(model: Model): TodayJourney[] {
  return model.asIs.userJourneys.flatMap((journey) => {
    const moves = journey.interactions.map((id) => interactionOf(model, id));
    const flows = [
      ...new Set(
        moves.flatMap((move) => (move?.supporting_steps ?? []).map((s) => s.split('#')[0] ?? s)),
      ),
    ].filter((id) => flowOf(model, id) !== null);
    if (flows.length === 0) return [];
    const last = moves.at(-1);
    return [
      {
        key: keyOf(journey.id),
        kind: 'journey' as const,
        id: journey.id,
        title: journey.name,
        actor: journey.actor ?? '',
        trigger: moves[0]?.name ?? '',
        outcome: text(model, last?.result ?? last?.name),
        flows,
        ...crossed(model, flows),
      },
    ];
  });
}

/** User journeys first, then each flow as its own walk. */
export function todayJourneysOf(model: Model): TodayJourney[] {
  return [
    ...userJourneys(model),
    ...journeyGroups(model).map((group) => flowJourney(model, group)),
  ];
}

/** The flows, grouped by the first stage that names them; flows no stage names come last. */
export function flowsByStage(model: Model, journeys: readonly TodayJourney[]): StageJourneys[] {
  const flows = journeys.filter((j) => j.kind === 'flow');
  const placed = new Set<string>();
  const groups: StageJourneys[] = [];
  for (const stage of model.plan.domain?.stages ?? []) {
    const named = new Set<string>(stage.flows);
    const here = flows.filter((j) => !placed.has(j.key) && named.has(j.id));
    for (const j of here) placed.add(j.key);
    if (here.length > 0) groups.push({ stage: stage.id, title: stage.name, journeys: here });
  }
  const rest = flows.filter((j) => !placed.has(j.key));
  if (rest.length > 0) groups.push({ stage: '', title: 'Other flows', journeys: rest });
  return groups;
}

const capital = (words: string): string => `${words.charAt(0).toUpperCase()}${words.slice(1)}`;

/** What is true of the journeys as a whole, as the index's headline. */
export function journeysHeadline(journeys: readonly TodayJourney[]): string {
  const users = journeys.filter((j) => j.kind === 'journey').length;
  const flows = journeys.length - users;
  const systems = new Set<string>();
  for (const j of journeys) for (const id of j.systems) systems.add(id);
  const people = users === 0 ? '' : `${countWord(users, 'user journey')} and `;
  return capital(
    `${people}${countWord(flows, 'flow')} carry work across ${countWord(systems.size, 'system')}.`,
  );
}

/** What is true of one journey, as its card's line or its walk's headline. */
export function journeyClaim(journey: TodayJourney): string {
  const flows = journey.kind === 'journey' ? `${countWord(journey.flows.length, 'flow')}, ` : '';
  return capital(
    `${flows}${countWord(journey.steps, 'step')} across ${countWord(journey.systems.length, 'system')}.`,
  );
}
