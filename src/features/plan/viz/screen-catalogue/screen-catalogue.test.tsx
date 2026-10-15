// @vitest-environment happy-dom
import { cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { screenCatalogue } from '@/application/plan-viz-screen-catalogue';
import { PLANS } from '@/features/plan/chapters/chapter-kit';

import { ScreenCatalogue } from './screen-catalogue';

vi.mock('server-only', () => ({}));
const { planData } = await import('@/infrastructure/plan-data');

async function modelOf(plan: string) {
  const data = await planData({ workspace: 'alder-finch', plan });
  if (data === null) throw new Error(`no plan ${plan}`);
  return data.model;
}

afterEach(cleanup);

describe('ScreenCatalogue', () => {
  it('draws the screens of each plan once, or nothing when none are recorded', async () => {
    let drawn = 0;
    for (const plan of PLANS) {
      const model = await modelOf(plan);
      const view = screenCatalogue(model);
      const { container } = render(<ScreenCatalogue base="/x/" model={model} />);
      if (view === null) {
        expect(container.textContent).toBe('');
        continue;
      }
      drawn += 1;
      const boxes = container.querySelectorAll('[data-journeys]');
      expect(boxes.length).toBeGreaterThan(0);
      const ids = view.groups.flatMap((g) => g.clusters.flatMap((c) => c.screens.map((s) => s.id)));
      expect(new Set(ids).size).toBe(ids.length);
      expect(container.querySelector('details')?.textContent).toContain('Screens and documents');
      cleanup();
    }
    expect(drawn).toBeGreaterThan(0);
  });

  it('lights the picked journey and dims the rest', async () => {
    for (const plan of PLANS) {
      const model = await modelOf(plan);
      const view = screenCatalogue(model);
      const journey = view?.journeys[0];
      if (view === null || journey === undefined) continue;
      const { container } = render(<ScreenCatalogue base="/x/" model={model} />);
      const select = container.querySelector('select');
      expect(select).not.toBeNull();
      if (select === null) return;
      fireEvent.change(select, { target: { value: journey.id } });
      expect(container.querySelector('[data-lit]')).not.toBeNull();
      fireEvent.change(select, { target: { value: '' } });
      expect(container.querySelector('[data-lit]')).toBeNull();
      expect(container.querySelector('[data-dim]')).toBeNull();
      return;
    }
  });
});
