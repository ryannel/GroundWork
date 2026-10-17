// @vitest-environment happy-dom
import { cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { shop } from '@/../test/federation-kit';
import { contractsPlans } from '@/../test/fixtures/acme/plans/contracts-plans';
import { reworkCheckout } from '@/../test/fixtures/acme/plans/contracts-rework-checkout';
import { modelOf } from '@/../test/plan-kit';
import { screenCatalogue } from '@/application/plan-viz-screen-catalogue';

import { ScreenCatalogue } from './screen-catalogue';

afterEach(cleanup);

describe('ScreenCatalogue', () => {
  it.each(contractsPlans())('draws the screens of %s once', (_, plan) => {
    const model = modelOf(plan);
    const view = screenCatalogue(model);
    const { container } = render(<ScreenCatalogue base="/x/" model={model} />);
    const ids =
      view?.groups.flatMap((g) => g.clusters.flatMap((c) => c.screens.map((s) => s.id))) ?? [];
    expect(ids.length).toBeGreaterThan(0);
    expect(new Set(ids).size).toBe(ids.length);
    expect(container.querySelectorAll('[data-journeys]').length).toBeGreaterThan(0);
    expect(container.querySelector('details')?.textContent).toContain('Screens and documents');
  });

  it('draws nothing when no screens are recorded', () => {
    const plan = shop();
    plan.screens = [];
    for (const flow of plan.flows ?? []) for (const step of flow.steps) delete step.screen;
    const { container } = render(<ScreenCatalogue base="/x/" model={modelOf(plan)} />);
    expect(container.textContent).toBe('');
  });

  it('lights the picked journey and dims the rest', () => {
    const model = modelOf(reworkCheckout());
    const journey = screenCatalogue(model)?.journeys[0];
    expect(journey?.id).toBe('uj:buy');
    const { container } = render(<ScreenCatalogue base="/x/" model={model} />);
    const select = container.querySelector('select');
    if (select === null) throw new Error('no journey picker');
    fireEvent.change(select, { target: { value: 'uj:buy' } });
    expect(container.querySelector('[data-lit]')).not.toBeNull();
    fireEvent.change(select, { target: { value: '' } });
    expect(container.querySelector('[data-lit]')).toBeNull();
    expect(container.querySelector('[data-dim]')).toBeNull();
  });
});
