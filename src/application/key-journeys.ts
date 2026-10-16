import type { Model } from '@/application/plan/derive';
import { type TodayJourney, todayJourneysOf } from '@/application/today-journeys';
import type { Workspace } from '@/domain/workspace';
import { plural } from '@/shared/text';

/** The most journeys the workspace leads with; the rest live in their domains and systems. */
export const MOST_KEY_JOURNEYS = 6;

export interface KeyJourney {
  readonly journey: TodayJourney;
  /** Why the code suggests it; null when a person picked it. */
  readonly why: string | null;
}

export interface KeyJourneys {
  /** 'hand' when the workspace names its key journeys, 'code' when they are suggested from the model. */
  readonly source: 'hand' | 'code';
  readonly picked: readonly KeyJourney[];
  /** Names in workspace.yaml that match no journey or flow. */
  readonly unknown: readonly string[];
}

const isPerson = (workspace: Workspace, j: TodayJourney): boolean =>
  (j.kind === 'journey' && j.actor.toLowerCase() !== 'system') ||
  workspace.actors.some((a) => a.name.toLowerCase() === j.actor.toLowerCase() || a.id === j.actor);

function domainsOf(workspace: Workspace): Map<string, string> {
  return new Map(
    workspace.domains.flatMap((d) => d.systems.map((s) => [`sys:${s.id}`, d.id] as const)),
  );
}

const article = (words: string): string => (/^[aeiou]/iu.test(words) ? 'an' : 'a');

/** "a shopper", "the scheduler", or null when nobody in particular starts it. */
function whoStarts(workspace: Workspace, j: TodayJourney): string | null {
  if (j.actor === '' || j.actor.toLowerCase() === 'system') return null;
  const who = j.actor.toLowerCase();
  return isPerson(workspace, j) ? `${article(who)} ${who}` : `the ${who}`;
}

function whyOf(workspace: Workspace, j: TodayJourney, domains: number): string {
  const across = `across ${plural(domains, 'domain')}`;
  const who = whoStarts(workspace, j);
  return who === null ? `Runs on its own, ${across}.` : `Started by ${who}, ${across}.`;
}

/**
 * The journeys a newcomer should walk first, picked from the code: each next pick is the one that reaches the most
 * systems not yet reached, then the one a person starts, then the one crossing the most domains. A flow already
 * walked inside a picked user journey is not picked again. Picking stops when nothing reaches anywhere new.
 */
export function suggestedJourneys(
  workspace: Workspace,
  journeys: readonly TodayJourney[],
): KeyJourney[] {
  const home = domainsOf(workspace);
  const domainCount = (j: TodayJourney): number =>
    new Set(j.systems.flatMap((s) => home.get(s) ?? [])).size;
  const reached = new Set<string>();
  const walked = new Set<string>();
  const picked: KeyJourney[] = [];
  let left = [...journeys];
  while (picked.length < MOST_KEY_JOURNEYS) {
    const score = (j: TodayJourney): number =>
      j.systems.filter((s) => !reached.has(s)).length * 1000 +
      (isPerson(workspace, j) ? 100 : 0) +
      domainCount(j) * 10 +
      Math.min(j.steps, 9);
    const best = left
      .filter((j) => j.kind === 'journey' || !walked.has(j.id))
      .toSorted((a, b) => score(b) - score(a))[0];
    if (best === undefined || best.systems.every((s) => reached.has(s))) break;
    picked.push({ journey: best, why: whyOf(workspace, best, domainCount(best)) });
    for (const s of best.systems) reached.add(s);
    for (const f of best.flows) walked.add(f);
    left = left.filter((j) => j !== best);
  }
  return picked;
}

/** The workspace's key journeys: the ones named under `key_journeys`, or else the ones the code suggests. */
export function keyJourneysOf(workspace: Workspace, model: Model): KeyJourneys {
  const journeys = todayJourneysOf(model);
  const named = workspace.keyJourneys ?? [];
  if (named.length === 0)
    return { source: 'code', picked: suggestedJourneys(workspace, journeys), unknown: [] };
  const find = (name: string) => journeys.find((j) => j.id === name || j.key === name);
  return {
    source: 'hand',
    picked: named.flatMap((name) => {
      const journey = find(name);
      return journey === undefined ? [] : [{ journey, why: null }];
    }),
    unknown: named.filter((name) => find(name) === undefined),
  };
}
