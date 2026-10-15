// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';

import { derive } from '@/application/plan/derive';
import { screenCatalogue, screenCatalogueHeadline } from '@/application/plan-viz-screen-catalogue';

vi.mock('server-only', () => ({}));

const PLANS = ['delivery-promise', 'invoice-vat-number', 'stock-reservation', 'storefront-graph'];

async function load(plan: string) {
  const { readPlan } = await import('@/infrastructure/plan-store');
  const loaded = await readPlan('alder-finch', plan);
  if (loaded.plan === null) throw new Error(`no plan ${plan}`);
  return derive(loaded.plan);
}

describe('screen catalogue', () => {
  it.each(PLANS)(
    'draws every current screen of %s once, with its lines inside the drawing',
    async (plan) => {
      const model = await load(plan);
      const view = screenCatalogue(model);
      const headline = screenCatalogueHeadline(model);
      if (view === null) {
        expect(headline).toBe('No screens are recorded in this version.');
        return;
      }
      const boxes = view.groups.flatMap((g) => g.clusters.flatMap((c) => c.screens));
      expect(boxes.map((b) => b.id).toSorted((a, b) => a.localeCompare(b))).toEqual(
        model.asIs.screens.map((s) => s.id).toSorted((a, b) => a.localeCompare(b)),
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
      expect(view.headline).toMatch(/^(Follow what people|These screens)/);
      expect(view.key).not.toBe('');
    },
  );
});
