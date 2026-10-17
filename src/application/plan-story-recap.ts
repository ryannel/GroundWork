import type { Model } from '@/application/plan/derive';

// The "What to remember" panel that closes a story chapter: the plan's own recap points, at most three. The journey
// is walked rather than read, and the commit chapter ends with the ask, so neither carries one.

const RECAPPED = new Set(['why', 'today', 'changes', 'prove', 'build']);

const MAX_POINTS = 3;

/** A list of bare nouns ("Address, order, order.placed, PDF.") is a label, not something to remember. */
export function isFragment(text: string): boolean {
  const items = text
    .replaceAll(/[`*_]/gu, '')
    .replaceAll(/[.!]/gu, '')
    .split(',')
    .map((x) => x.trim());
  return items.length >= 3 && items.every((x) => x.split(' ').filter(Boolean).length <= 2);
}

/** The points to remember from a chapter, or none when the chapter has no recap. */
export function recapOf(model: Model, chapter: string): readonly string[] {
  if (!RECAPPED.has(chapter)) return [];
  const chapters = model.plan.story?.chapters;
  const recap =
    chapters === undefined
      ? undefined
      : Object.entries(chapters).find(([k]) => k === chapter)?.[1]?.recap;
  return (recap ?? []).filter((p) => p.trim() !== '' && !isFragment(p)).slice(0, MAX_POINTS);
}
