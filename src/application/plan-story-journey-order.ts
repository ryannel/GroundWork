import type { Model } from '@/application/plan/derive';
import { opPlan } from '@/application/plan-viz-waterfall-facts';

/** The operations that run today and have a query plan, in the order of the screens that send them; the ones no screen sends come last. */
export function behindOperations(model: Model): Model['asIs']['operations'][number][] {
  const screens = model.asIs.screens.map((s) => s.id);
  const rank = (screenRefs: readonly string[] | undefined): number => {
    const at = screens.indexOf((screenRefs?.[0] ?? '').split('#')[0] ?? '');
    return at === -1 ? screens.length : at;
  };
  return model.asIs.operations
    .filter((op) => opPlan(model, op.id, 'asIs') !== null)
    .toSorted((a, b) => rank(a.screens) - rank(b.screens));
}
