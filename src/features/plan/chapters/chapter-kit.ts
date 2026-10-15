import type { Model } from '@/application/plan/derive';
import type { ChapterKey, Outline } from '@/application/plan-pages';
import type { VersionsData } from '@/application/plan-story-versions-data';
import type { BodyProps } from '@/features/plan/screen-bodies';

export const PLANS = [
  'delivery-promise',
  'invoice-vat-number',
  'stock-reservation',
  'storefront-graph',
] as const;

/** For tests: every screen of one chapter of a loaded plan, as the body gets it. */
export function bodiesIn(
  data: { readonly model: Model; readonly outline: Outline } | null,
  chapter: ChapterKey,
  versions: VersionsData | null = null,
): BodyProps[] {
  if (data === null) throw new Error('no such plan');
  return data.outline.pages
    .filter((page) => page.chapter === chapter)
    .map((page) => ({ model: data.model, outline: data.outline, page, versions }));
}
