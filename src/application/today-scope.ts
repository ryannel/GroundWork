import type { ModelScope } from '@/application/model-scope';
import type { Model } from '@/application/plan/derive';
import { chipInfo } from '@/application/plan-chips';
import { andList } from '@/application/plan-viz-ladder-order';
import type { MapScope } from '@/application/plan-viz-system-map-scope';
import { journeyClaim, todayJourneysOf, type TodayJourney } from '@/application/today-journeys';
import { journeyHref } from '@/application/today-reader';
import type { Workspace } from '@/domain/workspace';

// What every today page needs from its scope: where each system lives, what the map keeps, which journeys run
// through it, and each thing named as a chip the inspector opens.

/** One thing to name and open in the inspector. */
export interface ChipRef {
  readonly id: string;
  readonly label: string;
  readonly glyph: string;
  readonly mono: boolean;
}

export function chipRefOf(model: Model, id: string): ChipRef {
  const { label, glyph, mono } = chipInfo(model, id);
  return { id, label, glyph, mono };
}

/** The domain name ("Website") under each `sys:` id, for the cards of a map. */
function placesOf(workspace: Workspace): Record<string, string> {
  return Object.fromEntries(
    workspace.domains.flatMap((domain) =>
      domain.systems.map((system) => [`sys:${system.id}`, domain.name]),
    ),
  );
}

/** What the map keeps for a scope: everything on the landscape, the focus and its neighbours below it. */
export function mapScopeOf(workspace: Workspace, scope: ModelScope): MapScope {
  return {
    focus: scope.kind === 'workspace' ? null : [...scope.focus],
    places: placesOf(workspace),
  };
}

/** What the dotted cards of a scoped map are, for its key; null on the landscape. */
export function outsideOf(scope: ModelScope): string | null {
  return scope.kind === 'workspace' ? null : `outside this ${scope.kind}, one step away`;
}

export interface JourneyCard {
  readonly key: string;
  readonly href: string;
  readonly kind: TodayJourney['kind'];
  readonly title: string;
  /** "2 flows, 18 steps across 9 systems." */
  readonly claim: string;
  readonly actor: string;
  readonly trigger: string;
  readonly outcome: string;
  /** The systems it crosses, by name, in the order it reaches them. */
  readonly through: string;
  /** Their `sys:` ids. */
  readonly systems: readonly string[];
  /** How much of it runs in the scope, when the scope is not the whole workspace. */
  readonly here: string | null;
}

function stepsIn(model: Model, flows: readonly string[], scope: ModelScope): number {
  const steps = model.asIs.flows.filter((f) => flows.includes(f.id)).flatMap((f) => f.steps);
  return steps.filter((s) => scope.focus.has(s.from) || scope.focus.has(s.to)).length;
}

function cardOf(model: Model, workspace: string, at: { j: TodayJourney; scope: ModelScope }) {
  const { j, scope } = at;
  const here = stepsIn(model, j.flows, scope);
  return {
    key: j.key,
    href: journeyHref(workspace, j.key),
    kind: j.kind,
    title: j.title,
    claim: journeyClaim(j),
    actor: j.actor,
    trigger: j.trigger,
    outcome: j.outcome,
    through: andList(j.systems.map((id) => model.label(id))),
    systems: j.systems,
    here:
      scope.kind === 'workspace'
        ? null
        : `${String(here)} of its ${String(j.steps)} steps run in ${scope.name}`,
  };
}

const KIND_ORDER = { journey: 0, flow: 1 } as const;

/** The journeys and flows that pass through the scope: user journeys first, then flows with the most steps here. */
export function journeyCardsOf(model: Model, workspace: string, scope: ModelScope): JourneyCard[] {
  const whole = scope.kind === 'workspace';
  const cards = todayJourneysOf(model)
    .filter((j) => whole || j.systems.some((id) => scope.focus.has(id)))
    .map((j) => ({
      card: cardOf(model, workspace, { j, scope }),
      here: stepsIn(model, j.flows, scope),
    }));
  const rank = (c: (typeof cards)[number]): number =>
    KIND_ORDER[c.card.kind] * 1000 - (whole ? 0 : c.here);
  return cards.toSorted((a, b) => rank(a) - rank(b)).map((c) => c.card);
}
