// @vitest-environment node
import { describe, expect, it } from 'vitest';

import { shop } from '@/../test/federation-kit';
import { contractsPlans } from '@/../test/fixtures/acme/plans/contracts-plans';
import { reworkCheckout } from '@/../test/fixtures/acme/plans/contracts-rework-checkout';
import { modelOf } from '@/../test/plan-kit';
import { screenCatalogue, screenCatalogueHeadline } from '@/application/plan-viz-screen-catalogue';

const byName = (a: string, b: string) => a.localeCompare(b);

describe('screen catalogue', () => {
  it.each(contractsPlans())(
    'draws every current screen of %s once, with its lines inside the drawing',
    (_, plan) => {
      const model = modelOf(plan);
      const view = screenCatalogue(model);
      if (view === null) throw new Error('no catalogue');
      const boxes = view.groups.flatMap((g) => g.clusters.flatMap((c) => c.screens));
      expect(boxes.map((b) => b.id).toSorted(byName)).toEqual(
        model.asIs.screens.map((s) => s.id).toSorted(byName),
      );
      for (const cluster of view.groups.flatMap((g) => g.clusters)) {
        for (const line of cluster.lines) {
          expect(line.path.startsWith('M')).toBe(true);
          expect(line.label).not.toBe('');
        }
        for (const box of cluster.screens) expect(box.x + box.w).toBeLessThanOrEqual(cluster.width);
      }
      const cards = view.sections.flatMap((s) => s.cards);
      expect(cards).toHaveLength(boxes.length);
      expect(view.headline).toMatch(/^(Follow what people|These screens)/u);
      expect(screenCatalogueHeadline(model)).toBe(view.headline);
      expect(view.key).not.toBe('');
    },
  );

  it('follows the journey through the screens it shows', () => {
    const view = screenCatalogue(modelOf(reworkCheckout()));
    expect(view?.journeys.map((j) => j.id)).toEqual(['uj:buy']);
    const boxes = view?.groups.flatMap((g) => g.clusters.flatMap((c) => c.screens)) ?? [];
    expect(boxes.map((b) => b.id).toSorted(byName)).toEqual([
      'scr:basket',
      'scr:confirmation',
      'scr:product-page',
    ]);
  });

  it('draws nothing, and says so, when no screens are recorded', () => {
    const plan = shop();
    plan.screens = [];
    for (const flow of plan.flows ?? []) for (const step of flow.steps) delete step.screen;
    const model = modelOf(plan);
    expect(screenCatalogue(model)).toBeNull();
    expect(screenCatalogueHeadline(model)).toBe('No screens are recorded in this version.');
  });
});
