import type { Compat, Person } from '@/application/plan/compat-judge';
import type { Verdict } from '@/application/plan/compat-rules';
import type { Model } from '@/application/plan/derive';

// What the compatibility verdict says in the plan's words: does this plan break anyone, and who moves.

const WORD: Readonly<Record<Verdict, string>> = {
  breaking: 'breaking',
  migration: 'needs migration',
  safe: 'safe',
};
const ROLE: Readonly<Record<string, readonly [string, string]>> = {
  caller: ['caller', 'callers'],
  consumer: ['consumer', 'consumers'],
  reader: ['reader', 'readers'],
  writer: ['writer', 'writers'],
};
export const WHO_SHOWN = 6;

/** "3 readers", "one service": a count with the role's word, "services" when the roles are mixed. */
function rolePlural(n: number, role: string | null): string {
  const words = role === null ? undefined : ROLE[role];
  return `${String(n)} ${words?.[n === 1 ? 0 : 1] ?? (n === 1 ? 'service' : 'services')}`;
}

const uniq = <T>(xs: readonly T[]): T[] => [...new Set(xs)];
const noReader = (c: Compat): boolean => c.reasons.some((r) => r.rule === 'no-reader');

/** "Search indexer" for one, "3 readers" for several of one role, "4 services" for a mix. */
function whoWords(model: Model, list: readonly Person[]): string {
  const [only] = list;
  if (list.length === 1 && only !== undefined) return model.label(only.svc);
  const roles = uniq(list.map((w) => w.role));
  return rolePlural(list.length, roles.length === 1 ? (roles[0] ?? null) : null);
}

/** The compat of an entity as the reader meets it, or null (unchanged, or not a thing with a verdict). */
export const compatOf = (model: Model, id: string): Compat | null => model.compat(id);

export interface CompatBadgeView {
  readonly verdict: Verdict;
  readonly word: string;
  /** Who it touches: "Search indexer", "2 consumers". */
  readonly tail: string;
  /** The reasons, one a line, for the tooltip. */
  readonly why: string;
}

function tailOf(model: Model, c: Compat): string {
  if (c.verdict === 'breaking') {
    const unmoved = c.who.filter((w) => w.movedBy === null);
    if (unmoved.length > 0) return whoWords(model, unmoved);
    return noReader(c) ? 'no service reader recorded' : '';
  }
  return c.verdict === 'migration' && c.who.length > 0 ? whoWords(model, c.who) : '';
}

/** The badge: breaking · Search indexer, needs migration · 2 consumers, safe. `quiet` leaves a safe verdict out. */
export function compatBadgeView(
  model: Model,
  id: string,
  { quiet = false }: { readonly quiet?: boolean } = {},
): CompatBadgeView | null {
  const c = compatOf(model, id);
  if (c === null || (quiet && c.verdict === 'safe')) return null;
  const why = uniq(
    c.reasons
      .map((r) =>
        r.rule === 'no-reader' ? r.text.replace(/^no reader\b/u, 'no service reader') : r.text,
      )
      .filter(Boolean),
  )
    .slice(0, 8)
    .join('\n');
  return { verdict: c.verdict, word: WORD[c.verdict], tail: tailOf(model, c), why };
}

export interface WhoEntry {
  readonly svc: string;
  readonly where: { readonly word: 'in' | 'to' | 'through'; readonly id: string } | null;
}

export interface WhoView {
  readonly breaks: readonly WhoEntry[];
  readonly moves: readonly WhoEntry[];
  /** No service is recorded reading a breaking change: check before changing it. */
  readonly noReader: boolean;
}

const isStep = (id: string): boolean => /^flow:[^#]+#/u.test(id);

function placeOf(w: Person): WhoEntry['where'] {
  if (w.via === '') return null;
  return { word: isStep(w.via) ? 'in' : 'through', id: w.via };
}

function movedPlace(w: Person): WhoEntry['where'] {
  const by = w.movedBy;
  if (by?.step !== null && by?.step !== undefined) return { word: 'in', id: by.step };
  return by?.rung === undefined ? placeOf(w) : { word: 'to', id: by.rung };
}

/** The key of a who entry: a service and where it is proved, unique within a list. */
export const whoKey = (e: WhoEntry): string => `${e.svc} ${e.where?.id ?? ''}`;

// Two readings by one service can be moved by the same step; say it once.
const once = (entries: readonly WhoEntry[]): WhoEntry[] => [
  ...new Map(entries.map((e) => [whoKey(e), e])).values(),
];

/** Who breaks (not moved by this plan) and who moves, each service with the step that proves it, once each. */
export function whoView(model: Model, id: string): WhoView | null {
  const c = compatOf(model, id);
  if (c === null) return null;
  return {
    breaks: once(
      c.who.filter((w) => w.movedBy === null).map((w) => ({ svc: w.svc, where: placeOf(w) })),
    ),
    moves: once(
      c.who.filter((w) => w.movedBy !== null).map((w) => ({ svc: w.svc, where: movedPlace(w) })),
    ),
    noReader: c.verdict === 'breaking' && noReader(c),
  };
}
