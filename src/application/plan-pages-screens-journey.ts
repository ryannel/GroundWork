import type { Model } from '@/application/plan/derive';
import { journeyGroups } from '@/application/plan-story-journey-groups';
import { behindOperations } from '@/application/plan-story-journey-order';

// Chapter 3 as screens: a page for each planned scenario with flows and for each flow no scenario covers, then how
// the plan plays out, then what happens behind the button today.

export interface JourneyScreen {
  readonly key: string;
  readonly title: string;
}

export function journeyScreens(model: Model): JourneyScreen[] {
  const pages = journeyGroups(model).map((g) => ({ key: g.key, title: g.title }));
  if (model.plan.execution !== undefined) {
    pages.push({ key: 'execution', title: 'How it plays out' });
  }
  if (behindOperations(model).length > 0) pages.push({ key: 'behind', title: 'Behind the button' });
  return pages.length > 0 ? pages : [{ key: 'empty', title: 'Journey' }];
}
