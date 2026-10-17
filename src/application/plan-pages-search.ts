import type { Model } from '@/application/plan/derive';
import { parentOf, typeOf } from '@/application/plan/ids';
import { TYPE_WORDS } from '@/domain/plan/plan-vocab';

import type { Outline } from './plan-pages';
import { glyphOf, typeWord } from './plan-pages-entity';

// What the palette can find: every screen of the plan (or page of the workspace), and every thing the inspector
// can open.

export interface PaletteEntry {
  /** A field or step is a part: it is found by name but ranks after the things themselves. */
  readonly kind: 'screen' | 'thing' | 'part';
  /** What the type filters sort by: "screen", or the thing's type. */
  readonly group: string;
  /** A screen's address, or a thing's id. */
  readonly target: string;
  readonly label: string;
  readonly hint: string;
  readonly glyph: string;
  readonly haystack: string;
}

const PART_TYPES = new Set(['field', 'step']);
const HIDDEN_TYPES = new Set(['region']);

function planLevelIds(model: Model): string[] {
  const { plan } = model;
  return [
    ...(plan.changes ?? []),
    ...(plan.tests ?? []),
    ...(plan.work_items ?? []),
    ...(plan.milestones ?? []),
    ...(plan.decisions ?? []),
    ...(plan.risks ?? []),
    ...(plan.questions ?? []),
    ...(plan.problem.scenarios ?? []),
    ...(plan.domain?.concepts ?? []),
  ].map((e) => e.id);
}

/** "step 2 of Cancel", "field of Subscription": what a part belongs to. */
function partHint(model: Model, id: string, word: string): string {
  const owner = parentOf(id) ?? id;
  const node = model.get(owner);
  const steps: readonly unknown[] =
    typeof node === 'object' && 'steps' in node && Array.isArray(node.steps) ? node.steps : [];
  const at = steps.findIndex(
    (s) => typeof s === 'object' && s !== null && 'id' in s && s.id === id,
  );
  const which = word === 'step' && at !== -1 ? `step ${String(at + 1)}` : word;
  return `${which} of ${model.label(owner)}`;
}

const thingEntry = (model: Model, id: string): PaletteEntry => {
  const type = typeOf(id);
  const word = type === null ? '' : typeWord(type, model.get(id));
  const part = type !== null && PART_TYPES.has(type);
  const label = model.label(id);
  const hint = part ? partHint(model, id, word) : word;
  return {
    kind: part ? 'part' : 'thing',
    group: type ?? '',
    target: id,
    label,
    hint,
    glyph: glyphOf(id),
    haystack: `${label} ${id} ${hint}`.toLowerCase(),
  };
};

/** The screens of a plan, as the palette lists them before anything is typed. */
export function outlineScreens(outline: Outline): PaletteEntry[] {
  return outline.pages.map((page) =>
    screenEntry({
      href: page.href,
      title: page.title,
      hint: outline.chapters.find((c) => c.key === page.chapter)?.title ?? '',
      key: page.chapter,
    }),
  );
}

/** A page the palette can go to: its address, its title, and the words beside it. */
export function screenEntry(page: {
  readonly href: string;
  readonly title: string;
  readonly hint: string;
  readonly key?: string;
}): PaletteEntry {
  return {
    kind: 'screen',
    group: 'screen',
    target: page.href,
    label: page.title,
    hint: page.hint,
    glyph: '§',
    haystack: `${page.title} ${page.key ?? page.hint}`.toLowerCase(),
  };
}

/** The pages given, then every thing in the model the inspector can open. */
export function paletteEntries(model: Model, screens: readonly PaletteEntry[]): PaletteEntry[] {
  const ids = new Set([
    ...model.asIs.byId.keys(),
    ...model.toBe.byId.keys(),
    ...planLevelIds(model),
  ]);
  const things = [...ids]
    .filter((id) => {
      const type = typeOf(id);
      return type !== null && !HIDDEN_TYPES.has(type) && model.get(id) !== undefined;
    })
    .map((id) => thingEntry(model, id));
  return [...screens, ...things];
}

const LIMIT = 30;
const PRE_SEARCH = 12;

const rank = (entry: PaletteEntry, query: string): number => {
  const label = entry.label.toLowerCase();
  if (label === query) return 0;
  if (label.startsWith(query)) return 1;
  return label.includes(query) ? 2 : 3;
};

const KIND_ORDER = { screen: 0, thing: 1, part: 2 } as const;

const score = (entry: PaletteEntry, query: string): number =>
  rank(entry, query) * 3 + KIND_ORDER[entry.kind];

/**
 * Entries whose words all appear in the query, best match first; with no query, the screens. A filter keeps one group,
 * and with no query lists it whole.
 */
export function searchPalette(
  entries: readonly PaletteEntry[],
  query: string,
  filter: string | null = null,
): PaletteEntry[] {
  const pool = filter === null ? entries : entries.filter((e) => e.group === filter);
  const q = query.trim().toLowerCase();
  if (q === '' && filter !== null) return pool.slice(0, LIMIT);
  if (q === '') return pool.filter((e) => e.kind === 'screen').slice(0, PRE_SEARCH);
  const words = q.split(/\s+/u);
  return pool
    .filter((e) => words.every((w) => e.haystack.includes(w)))
    .toSorted((a, b) => score(a, q) - score(b, q))
    .slice(0, LIMIT);
}

export interface PaletteGroup {
  readonly key: string;
  readonly label: string;
  readonly glyph: string;
  readonly count: number;
}

const WORDS = new Map<string, string>([['screen', 'screen'], ...Object.entries(TYPE_WORDS)]);

const groupLabel = (key: string): string => {
  const word = WORDS.get(key) ?? key;
  return `${word.charAt(0).toUpperCase()}${word.slice(1)}s`;
};

/** The type filters: one per group the plan has, screens first, parts left out since they are found by name. */
export function paletteGroups(entries: readonly PaletteEntry[]): PaletteGroup[] {
  const counts = new Map<string, PaletteEntry[]>();
  for (const e of entries) {
    if (e.kind === 'part') continue;
    counts.set(e.group, [...(counts.get(e.group) ?? []), e]);
  }
  return [...counts].map(([key, members]) => ({
    key,
    label: groupLabel(key),
    glyph: members[0]?.glyph ?? '·',
    count: members.length,
  }));
}
