// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import { sequencePlan } from '@/../test/sequence-kit';
import { derive } from '@/application/plan/derive';
import { flowSteps } from '@/application/plan/flow-steps';
import { narrate } from '@/application/plan-viz-flow-narration';
import { stepStops } from '@/application/plan-viz-flow-stops';

import { FlowViewer } from './flow-viewer';
import { StepCard } from './step-card';

vi.mock(import('server-only'), () => ({}));

const { loadFixture } = await import('@/infrastructure/plan-fixture');

const shop = derive(await loadFixture('shop.yaml'));
const rich = derive(sequencePlan());
const base = '/plans/x/';

beforeAll(() => {
  Object.defineProperty(HTMLElement.prototype, 'clientWidth', { configurable: true, value: 600 });
  Object.defineProperty(HTMLElement.prototype, 'clientHeight', { configurable: true, value: 400 });
});
afterEach(cleanup);

const dots = () => within(screen.getByRole('navigation', { name: 'Stops in this flow' }));

const card = () => screen.getByRole('article', { name: 'This step' }).textContent;
const back = () => dots().getByRole<HTMLButtonElement>('button', { name: /Back/u });

describe('FlowViewer', () => {
  it('says so when the flow has no steps', () => {
    render(<FlowViewer base={base} flowId="flow:none" model={shop} />);
    expect(screen.getByText('This flow has no steps.')).toBeTruthy();
  });

  it('draws the first stop, with a dot for each stop and the step card', () => {
    render(<FlowViewer base={base} flowId="flow:price-purge" model={shop} />);
    const buttons = dots().getAllByRole('button', { name: /^Stop /u });
    expect(buttons.length).toBeGreaterThan(1);
    expect(buttons[0]?.getAttribute('aria-current')).toBe('step');
    expect(screen.getByRole('article', { name: 'This step' })).toBeTruthy();
  });

  it('draws the flow once and lights the stop the reader walks to, in both views', () => {
    const { container } = render(<FlowViewer base={base} flowId="flow:price-purge" model={shop} />);
    const stops = stepStops(shop, 'flow:price-purge', { mode: 'toBe', singleSteps: false });
    const lit = (selector: string, attr: 'walkSteps' | 'walkAt') =>
      new Set(
        [...container.querySelectorAll<HTMLElement | SVGElement>(selector)].flatMap((el) =>
          (el.dataset[attr] ?? '').split(' ').map(Number),
        ),
      );
    const onDiagram = () => lit('[data-walk-steps][data-walk="current"]', 'walkSteps');
    expect(onDiagram()).toEqual(new Set(stops[0]?.indices));
    fireEvent.click(dots().getByRole('button', { name: /Next/u }));
    for (const i of stops[1]?.indices ?? []) expect(onDiagram().has(i)).toBe(true);
    for (const i of stops[0]?.indices ?? []) expect(onDiagram().has(i)).toBe(false);
    fireEvent.click(screen.getByRole('button', { name: 'Sequence' }));
    expect(lit('[data-walk-at][data-walk="current"]', 'walkAt')).toEqual(
      new Set(stops[1]?.indices),
    );
  });

  it('goes to the next stop from the stepper, and back', () => {
    render(<FlowViewer base={base} flowId="flow:price-purge" model={shop} />);
    const first = card();
    fireEvent.click(dots().getByRole('button', { name: /Next/u }));
    expect(card()).not.toBe(first);
    expect(back().disabled).toBe(false);
    fireEvent.click(back());
    expect(card()).toBe(first);
    expect(back().disabled).toBe(true);
  });

  it('follows the arrow keys, but not with a modifier held', () => {
    const { container } = render(<FlowViewer base={base} flowId="flow:price-purge" model={shop} />);
    const second = dots().getAllByRole('button', { name: /^Stop /u })[1];
    fireEvent.keyDown(container.firstElementChild ?? container, { key: 'ArrowRight' });
    expect(second?.getAttribute('aria-current')).toBe('step');
    fireEvent.keyDown(container.firstElementChild ?? container, { key: 'ArrowLeft', altKey: true });
    expect(second?.getAttribute('aria-current')).toBe('step');
    fireEvent.keyDown(container.firstElementChild ?? container, { key: 'ArrowLeft' });
    expect(second?.getAttribute('aria-current')).toBeNull();
  });

  it('goes to the stop a drawn step asks for, but leaves inspector clicks alone', () => {
    const { container } = render(
      <FlowViewer
        base={base}
        flowId="flow:price-purge"
        model={shop}
        stepId="flow:price-purge#publish"
      />,
    );
    const hits = container.querySelectorAll<HTMLElement>('[data-step]');
    expect(hits.length).toBeGreaterThan(0);
    const target = [...hits].find((h) => h.dataset.step === '2');
    if (target === undefined) throw new Error('no hit for the second stop');
    fireEvent.click(target);
    const stops = dots().getAllByRole('button', { name: /^Stop /u });
    expect(stops[1]?.getAttribute('aria-current')).toBe('step');
    const open = container.querySelector<HTMLElement>('[data-inspect]');
    if (open === null) throw new Error('nothing to inspect');
    fireEvent.click(open);
    expect(stops[1]?.getAttribute('aria-current')).toBe('step');
  });

  it('switches to the sequence, and copies the flow as Mermaid', () => {
    const write = vi.fn<(text: string) => Promise<boolean>>().mockResolvedValue(true);
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: write },
    });
    const { container } = render(<FlowViewer base={base} flowId="flow:price-purge" model={shop} />);
    expect(container.querySelector('[aria-label^="Sequence of"]')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Sequence' }));
    expect(container.querySelector('[aria-label^="Sequence of"]')).not.toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Copy as Mermaid' }));
    expect(write).toHaveBeenCalledOnce();
  });

  it('tells a flow with screens as the experience, with the screens strip', () => {
    render(<FlowViewer base={base} flowId="flow:rich" model={rich} />);
    expect(screen.getByRole('navigation', { name: 'Moments in this flow' })).toBeTruthy();
    expect(screen.getByText('The planned experience')).toBeTruthy();
  });

  it('opens on the stop that holds the step and takes one stop for each step', () => {
    render(
      <FlowViewer
        base={base}
        flowId="flow:price-purge"
        model={shop}
        singleSteps
        stepId="flow:price-purge#consume"
      />,
    );
    const stops = dots().getAllByRole('button', { name: /^Stop /u });
    expect(stops).toHaveLength(3);
    expect(stops[1]?.getAttribute('aria-current')).toBe('step');
  });
});

describe('StepCard', () => {
  const steps = flowSteps(shop, 'flow:price-purge', 'toBe');
  const single = stepStops(shop, 'flow:price-purge')[2];
  if (single === undefined) throw new Error('no stops');
  const group = { ...single, indices: [0, 1, 2], stepIds: steps.map((s) => s.id) };
  const grouped = narrate(steps, group);
  const lone = narrate(steps, single);
  if (grouped === null || lone === null) throw new Error('no narration');

  it('lists the steps of a group and says where each goes', () => {
    render(<StepCard mode="toBe" model={shop} narration={grouped} />);
    expect(screen.getByText(/Steps/u)).toBeTruthy();
    expect(screen.getAllByRole('listitem').length).toBeGreaterThan(1);
  });

  it('shows the changes behind a step with their decisions, but not for today', () => {
    const props = {
      model: shop,
      narration: lone,
      changes: ['chg:price-expand', 'chg:promise'],
      decisions: ['dec:x'],
    };
    const { rerender } = render(<StepCard {...props} mode="toBe" />);
    expect(screen.getByText('Change')).toBeTruthy();
    expect(screen.getByText('+1')).toBeTruthy();
    expect(screen.getByText('Decision')).toBeTruthy();
    rerender(<StepCard {...props} mode="asIs" />);
    expect(screen.queryByText('Change')).toBeNull();
  });

  it('marks a step the plan changes, with the reason as its title', () => {
    render(
      <StepCard
        marks={{ [lone.first.id]: '◇' }}
        mode="toBe"
        model={shop}
        narration={lone}
        reasons={{ [lone.first.id]: ['Adds a field'] }}
      />,
    );
    expect(screen.getByTitle('Adds a field').textContent).toBe('◇');
  });

  it('offers to open the step, and what it goes through', () => {
    render(<StepCard mode="toBe" model={shop} narration={lone} />);
    expect(screen.getByRole('button', { name: 'Step details' }).dataset.inspect).toBe(
      lone.first.id,
    );
  });
});
