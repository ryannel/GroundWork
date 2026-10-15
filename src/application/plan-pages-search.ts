import type { Model } from '@/application/plan/derive';
import { typeOf } from '@/application/plan/ids';

import type { Outline } from './plan-pages';
import { glyphOf, typeWord } from './plan-pages-entity';

// What the palette can find: every screen of the plan, and every thing in it that the inspector can open.

export interface PaletteEntry {
  readonly kind: 'screen' | 'thing';
  /** A screen's address, or a thing's id. */
  readonly target: string;
  readonly label: string;
  readonly hint: string;
  readonly glyph: string;
  readonly haystack: string;
}

const CHILD_TYPES = new Set(['field', 'step', 'region']);

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

const thingEntry = (model: Model, id: string): PaletteEntry => {
  const type = typeOf(id);
  const word = type === null ? '' : typeWord(type, model.get(id));
  const label = model.label(id);
  return {
    kind: 'thing',
    target: id,
    label,
    hint: word,
    glyph: glyphOf(id),
    haystack: `${label} ${id} ${word}`.toLowerCase(),
  };
};

export function paletteEntries(model: Model, outline: Outline): PaletteEntry[] {
  const screens = outline.pages.map((page): PaletteEntry => ({
    kind: 'screen',
    target: page.href,
    label: page.title,
    hint: outline.chapters.find((c) => c.key === page.chapter)?.title ?? '',
    glyph: '§',
    haystack: `${page.title} ${page.chapter}`.toLowerCase(),
  }));
  const ids = new Set([
    ...model.asIs.byId.keys(),
    ...model.toBe.byId.keys(),
    ...planLevelIds(model),
  ]);
  const things = [...ids]
    .filter((id) => {
      const type = typeOf(id);
      return type !== null && !CHILD_TYPES.has(type) && model.get(id) !== undefined;
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

const kindOrder = (entry: PaletteEntry): number => (entry.kind === 'screen' ? 0 : 1);

/** Entries whose words all appear in the query, best match first; with no query, the screens. */
export function searchPalette(entries: readonly PaletteEntry[], query: string): PaletteEntry[] {
  const q = query.trim().toLowerCase();
  if (q === '') return entries.filter((e) => e.kind === 'screen').slice(0, PRE_SEARCH);
  const words = q.split(/\s+/);
  return entries
    .filter((e) => words.every((w) => e.haystack.includes(w)))
    .toSorted((a, b) => rank(a, q) * 2 + kindOrder(a) - (rank(b, q) * 2 + kindOrder(b)))
    .slice(0, LIMIT);
}
