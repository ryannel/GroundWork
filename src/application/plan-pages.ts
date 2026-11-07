import type { Model } from '@/application/plan/derive';

import { planOutline, type Outline, type PlanAddress } from './plan-navigation';
import { screensFor } from './plan-pages-screens';

export { findPage, neighboursOf, pageHref, planHref } from './plan-navigation';
export type {
  Chapter,
  ChapterKey,
  Neighbours,
  Outline,
  Page,
  PlanAddress,
} from './plan-navigation';

/** Legacy screen selection stays at its named model boundary; navigation itself is model-free. */
export function outlineOf(model: Model, at: PlanAddress): Outline {
  return planOutline(model.plan.meta.title, at, (chapter) => screensFor(model, chapter));
}
