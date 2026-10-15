import type { Model } from '@/application/plan/derive';
import type { GraphMode, Mode } from '@/application/plan/derive-core';
import { typeOf } from '@/application/plan/ids';
import { teamOf } from '@/application/plan-viz-teams';
import { countOf, plainLine } from '@/application/plan-viz-text';
import type { EntityType } from '@/domain/plan/plan-ids';

// What every reference catalogue shares: which system it shows, who a row belongs to for the team lens, and the
// words a search box matches.

export const SHOWS = ['asis', 'tobe', 'diff'] as const;
export type Show = (typeof SHOWS)[number];

/** The catalogue's switch, in the words a reader uses. */
export const SHOW_WORD: Readonly<Record<Show, string>> = {
  asis: 'Today',
  tobe: 'With this plan',
  diff: 'What changes',
};

/** The mode a catalogue opens in. */
export const DEFAULT_SHOW: Show = 'diff';

/** The `?show=` value as a mode; anything else is the default. */
export const showOf = (value: string | null): Show =>
  SHOWS.find((s) => s === value) ?? DEFAULT_SHOW;

const GRAPH: Readonly<Record<Show, GraphMode>> = { asis: 'asIs', tobe: 'toBe', diff: 'toBe' };
const VIEW: Readonly<Record<Show, Mode>> = { asis: 'asIs', tobe: 'toBe', diff: 'diff' };

/** The graph a mode reads: the diff reads the to-be graph. */
export const graphOf = (show: Show): GraphMode => GRAPH[show];

/** The mode the viz components take. */
export const viewOf = (show: Show): Mode => VIEW[show];

/** Entities of one kind for a mode: today's, the plan's, or the plan's plus what it removes. */
export function poolOf<T extends { readonly id: string }>(
  asIs: readonly T[],
  toBe: readonly T[],
  show: Show,
): readonly T[] {
  if (show === 'asis') return asIs;
  if (show === 'tobe') return toBe;
  const have = new Set(toBe.map((e) => e.id));
  return [...toBe, ...asIs.filter((e) => !have.has(e.id))];
}

export type Cut = ReturnType<Model['teamCut']>;

/** Whether a team's cut holds the thing: named in it, or owned by the team. */
export const inCut = (model: Model, cut: Cut, id: string | undefined): boolean =>
  id !== undefined && (cut.has(id) || teamOf(model, id) === cut.team);

/** The teams whose cut a row belongs to, as the space-separated ids the lens reads. */
export function teamsWhere(model: Model, test: (cut: Cut) => boolean): string {
  return model.plan.teams
    .map((t) => model.teamCut(t.id))
    .filter(test)
    .map((cut) => cut.team)
    .join(' ');
}

/** Every team's name, by id: what the lens note says. */
export const teamNames = (model: Model): Readonly<Record<string, string>> =>
  Object.fromEntries(model.plan.teams.map((t) => [t.id, t.name]));

const flat = (part: unknown): string[] => {
  if (Array.isArray(part)) return part.flatMap(flat);
  if (typeof part === 'string') return [plainLine(part)];
  return typeof part === 'number' ? [String(part)] : [];
};

/** The lower-case words a catalogue's search box matches a row against. */
export const searchText = (...parts: readonly unknown[]): string =>
  parts
    .flatMap(flat)
    .filter((p) => p !== '')
    .join(' ')
    .toLowerCase();

/** Items under the key each gives, in first-seen order. */
export function groupBy<T>(items: readonly T[], key: (item: T) => string): Map<string, T[]> {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const k = key(item);
    groups.set(k, [...(groups.get(k) ?? []), item]);
  }
  return groups;
}

const ASKED = new Set<EntityType>([
  'service',
  'system',
  'store',
  'schema',
  'message',
  'endpoint',
  'interface',
  'flow',
  'screen',
  'team',
  'graph',
  'subgraph',
  'operation',
]);

/** "3 changes · 2 work items": what the plan asks of a thing, or '' when it leaves it alone. */
export function inPlanWords(model: Model, id: string): string {
  const type = typeOf(id);
  if (type === null || !ASKED.has(type) || id.includes('#')) return '';
  const inv = model.inverse(id);
  const changes = new Set(inv.changes).size;
  const items = new Set(inv.workItems).size;
  return [
    changes > 0 ? countOf(changes, 'change') : '',
    items > 0 ? countOf(items, 'work item') : '',
  ]
    .filter((w) => w !== '')
    .join(' · ');
}

/** Whether a row shows quietly: in the diff, a thing the plan neither changes nor changes anything inside. */
export const fadesIn = (model: Model, show: Show, id: string): boolean =>
  show === 'diff' && model.status(id) === 'existing' && model.rollup(id).total === 0;
