import type { Model } from '@/application/plan/derive';
import { type Outline, pageHref } from '@/application/plan-pages';
import { journeyKeyOf } from '@/application/plan-story-changes-links';

/** Where chapter 3 walks a flow, or null when it has no page there. */
export function journeyHref(model: Model, outline: Outline, flowId: string): string | null {
  const key = journeyKeyOf(model, flowId);
  if (key === null) return null;
  const has = outline.pages.some((p) => p.chapter === 'journey' && p.screen === key);
  return has ? pageHref(outline, 'journey', key) : null;
}
