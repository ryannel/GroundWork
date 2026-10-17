// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';

import { reworkCheckout } from '@/../test/fixtures/acme/plans/contracts-rework-checkout';
import { modelOf } from '@/../test/plan-kit';
import { journeyComparison } from '@/application/plan/journey';

import { Journey } from './journey';

const plan = modelOf(reworkCheckout());
const base = '/plans/x/';

beforeAll(() => {
  Object.defineProperty(HTMLElement.prototype, 'clientWidth', { configurable: true, value: 600 });
  Object.defineProperty(HTMLElement.prototype, 'clientHeight', { configurable: true, value: 400 });
});
afterEach(cleanup);

const hold = 'flow:publish-product#check';
const outline = () => screen.getByText('Steps in this flow').closest('details') as HTMLElement;
const mode = (name: string) => screen.getByRole('button', { name });

describe('Journey', () => {
  it('says so when the flow has no steps', () => {
    render(<Journey base={base} flowId="flow:none" model={plan} />);
    expect(screen.getByText('No steps are recorded in this flow.')).toBeTruthy();
  });

  it('opens on today, with the steps in recorded order', () => {
    render(<Journey base={base} flowId="flow:publish-product" model={plan} />);
    expect(mode('Today').getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByText('Today is the system recorded before this plan.')).toBeTruthy();
    expect(within(outline()).getAllByRole('listitem').length).toBeGreaterThan(1);
  });

  it('shows a step the plan adds as a gap in today’s outline', () => {
    render(<Journey base={base} flowId="flow:publish-product" model={plan} />);
    expect(within(outline()).getAllByText('Added here with this plan').length).toBeGreaterThan(0);
  });

  it('gives an added step seen today its own card, with the steps that survive', () => {
    render(<Journey base={base} flowId="flow:publish-product" model={plan} stepId={hold} />);
    const card = document.querySelector<HTMLElement>(`[data-absent-step="${hold}"]`);
    expect(card?.textContent).toContain('This step is added with this plan.');
    expect(within(card!).getAllByRole('button').length).toBeGreaterThan(1);
    expect(screen.queryByRole('navigation', { name: 'Stops in this flow' })).toBeNull();
  });

  it('opens a step the plan adds when the reader turns to the plan', () => {
    render(<Journey base={base} flowId="flow:publish-product" model={plan} stepId={hold} />);
    fireEvent.click(mode('With this plan'));
    expect(document.querySelector('[data-absent-step]')).toBeNull();
    expect(screen.getByRole('navigation', { name: 'Stops in this flow' })).toBeTruthy();
    expect(screen.getAllByText(/Compare|Changes and decisions/u).length).toBeGreaterThan(0);
  });

  it('keeps the chosen step when the view changes', () => {
    render(<Journey base={base} flowId="flow:publish-product" model={plan} stepId={hold} />);
    fireEvent.click(mode('With this plan'));
    fireEvent.click(mode('Today'));
    expect(document.querySelector(`[data-absent-step="${hold}"]`)).not.toBeNull();
  });

  it('says a step it does not know is not recorded, and does not pick the first', () => {
    render(
      <Journey
        base={base}
        flowId="flow:publish-product"
        model={plan}
        stepId="flow:publish-product#nope"
      />,
    );
    expect(screen.getByText('This step is not recorded in this flow.')).toBeTruthy();
    expect(screen.queryByRole('navigation', { name: 'Stops in this flow' })).toBeNull();
  });

  it('says a new flow does not exist today, with no flow drawn', () => {
    render(<Journey base={base} flowId="flow:pause-order" model={plan} mode="asIs" />);
    expect(screen.getByText('This flow does not exist today.')).toBeTruthy();
    expect(screen.queryByRole('navigation', { name: 'Stops in this flow' })).toBeNull();
  });

  it('says a removed flow is removed with this plan', () => {
    render(<Journey base={base} flowId="flow:cancel-order" model={plan} mode="toBe" />);
    expect(screen.getByText('This flow is removed with this plan.')).toBeTruthy();
  });

  it('goes from an absent step to a step that survives', () => {
    render(<Journey base={base} flowId="flow:publish-product" model={plan} stepId={hold} />);
    const card = document.querySelector<HTMLElement>('[data-absent-step]')!;
    fireEvent.click(within(card).getAllByRole('button', { name: /surviving step/u })[0]!);
    expect(document.querySelector('[data-absent-step]')).toBeNull();
    expect(screen.getByRole('navigation', { name: 'Stops in this flow' })).toBeTruthy();
  });

  it('shows the other view from an absent step', () => {
    render(<Journey base={base} flowId="flow:publish-product" model={plan} stepId={hold} />);
    fireEvent.click(screen.getByRole('button', { name: 'Show with this plan' }));
    expect(mode('With this plan').getAttribute('aria-pressed')).toBe('true');
    expect(document.querySelector('[data-absent-step]')).toBeNull();
  });

  it('says a deprecated step still works', () => {
    render(<Journey base={base} flowId="flow:place-order" model={plan} mode="toBe" />);
    expect(screen.getAllByText('Deprecated · still works').length).toBeGreaterThan(0);
  });

  it('says a layout-only change is the screen, not different behaviour', () => {
    const id = 'flow:place-order#submit';
    render(<Journey base={base} flowId="flow:place-order" model={plan} stepId={id} />);
    const current = outline().querySelector<HTMLElement>('[data-current]');
    expect(current?.textContent).toContain('Screen layout changes');
    expect(current?.textContent).not.toContain('Works differently');
  });

  it('leaves out the change that is already the page’s headline', () => {
    const id = 'flow:place-order#email';
    const [change] =
      journeyComparison(plan, 'flow:place-order').rows.find((r) => r.id === id)?.changes ?? [];
    if (change === undefined) throw new Error('no change');
    const chips = () => document.querySelectorAll(`[data-inspect="${change}"]`).length;
    const props = {
      base,
      flowId: 'flow:place-order',
      mode: 'toBe',
      model: plan,
      stepId: id,
    } as const;
    render(<Journey {...props} />);
    const shown = chips();
    cleanup();
    render(<Journey {...props} omitChange={change} />);
    expect(shown).toBeGreaterThan(0);
    expect(chips()).toBeLessThan(shown);
  });

  it('folds the drawing away, with the step and its screen under it', () => {
    const id = 'flow:place-order#submit';
    render(<Journey base={base} flowId="flow:place-order" model={plan} stepId={id} />);
    const fold = screen.getByText('System diagram').closest('details');
    expect(fold?.open).toBe(false);
    expect(within(fold!).getByRole('button', { name: 'Next →' })).toBeTruthy();
    expect(screen.getByRole('article', { name: 'This step' })).toBeTruthy();
    expect(screen.getByText(/^Screen: /u).closest('details')?.dataset.keep).toBe('screen');
  });

  it('moves to a step picked in the outline', () => {
    render(<Journey base={base} flowId="flow:publish-product" model={plan} />);
    const steps = [...outline().querySelectorAll<HTMLElement>('li:not([class]) > button')];
    const second = steps[1];
    if (second === undefined) throw new Error('no second step');
    fireEvent.click(second);
    expect(second.getAttribute('aria-current')).toBe('step');
    expect(steps[0]?.getAttribute('aria-current')).toBeNull();
  });
});
