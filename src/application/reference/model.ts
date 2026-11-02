import type { Model } from '@/application/plan/derive';
import { plainLine } from '@/application/plan-viz-text';

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
