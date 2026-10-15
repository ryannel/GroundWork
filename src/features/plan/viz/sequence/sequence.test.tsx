// @vitest-environment happy-dom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import { sequencePlan } from '@/../test/sequence-kit';
import { derive } from '@/application/plan/derive';

import { Sequence } from './sequence';

vi.mock('server-only', () => ({}));

const model = derive(sequencePlan());

beforeAll(() => {
  Object.defineProperty(HTMLElement.prototype, 'clientWidth', { configurable: true, value: 800 });
});

afterEach(cleanup);

describe('Sequence', () => {
  it('says so when the flow has no steps', () => {
    render(<Sequence flowId="flow:nothing" model={model} />);
    expect(screen.getByText('This flow has no steps.')).toBeTruthy();
  });

  it('heads a column for the person and for each system, and opens a system when picked', () => {
    const { container } = render(<Sequence flowId="flow:rich" mode="asIs" model={model} />);
    expect(container.textContent).toContain('Shopper');
    const heads = container.querySelectorAll<HTMLElement>(
      'button[data-inspect^="svc:"], button[data-inspect^="st:"]',
    );
    const ids = [...heads].map((b) => b.dataset.inspect);
    expect(ids).toContain('svc:pricing-api');
    expect(ids).toContain('st:price-topic');
    expect(container.querySelector('[role="group"]')?.getAttribute('aria-label')).toBe(
      'Sequence of Price a product',
    );
  });

  it('draws a row for each step, numbered from one, with the call on its arrow', () => {
    const { container } = render(<Sequence flowId="flow:rich" mode="asIs" model={model} />);
    const rows = container.querySelectorAll<HTMLElement>('[data-kind="step"]');
    expect(rows).toHaveLength(4);
    const first = rows[0];
    expect(first?.textContent).toContain('1');
    expect(first?.querySelector('button[data-inspect="api:pricing-price"]')).not.toBeNull();
  });

  it('opens a step in the inspector, or gives its number to a viewer', () => {
    const inspect = render(<Sequence flowId="flow:rich" mode="asIs" model={model} />);
    expect(inspect.container.querySelector('button[data-inspect="flow:rich#ask"]')).not.toBeNull();
    expect(inspect.container.querySelector('[data-step]')).toBeNull();
    cleanup();
    const go = render(<Sequence action="go" flowId="flow:rich" mode="asIs" model={model} />);
    const rows = go.container.querySelectorAll<HTMLElement>('[data-kind="step"][data-step]');
    expect([...rows].map((r) => r.dataset.step)).toEqual(['0', '1', '2', '3']);
  });

  it('marks the current step and the ones before it', () => {
    const { container } = render(
      <Sequence flowId="flow:rich" mode="asIs" model={model} step={2} />,
    );
    const walks = [...container.querySelectorAll<HTMLElement>('[data-kind="step"]')].map(
      (r) => r.dataset.walk ?? '',
    );
    expect(walks).toEqual(['walked', 'walked', 'current', '']);
  });

  it('encloses what can fail in a frame and what happens together in another', () => {
    const { container } = render(<Sequence flowId="flow:rich" mode="asIs" model={model} />);
    expect(container.querySelector('[data-frame="fails"]')).not.toBeNull();
    expect(container.querySelector('[data-frame="group"]')).not.toBeNull();
    expect(container.textContent).toContain('if it fails');
    expect(container.textContent).toContain('On publish');
  });

  it('shows the tests that walk the flow as brackets with a numbered key', () => {
    const { container } = render(<Sequence flowId="flow:rich" mode="asIs" model={model} spans />);
    expect(container.querySelector('[data-pos="first"]')).not.toBeNull();
    const key = screen.getByRole('list', { name: 'Tests that walk this flow' });
    expect(key.querySelectorAll('li')).toHaveLength(2);
    expect(container.querySelector('[data-gut="2"]')).not.toBeNull();
  });

  it('draws no key when no tests are asked for', () => {
    render(<Sequence flowId="flow:rich" mode="asIs" model={model} />);
    expect(screen.queryByRole('list', { name: 'Tests that walk this flow' })).toBeNull();
  });

  it('puts a mark and a note beside the step they belong to', () => {
    const { container } = render(
      <Sequence
        flowId="flow:rich"
        markers={{ 'flow:rich#ask': '◇' }}
        markerTitle="Planned"
        model={model}
        notes={{ 'flow:rich#keep': <em>noted</em> }}
      />,
    );
    expect(container.querySelector('button[data-pin="flow:rich#ask"]')?.getAttribute('title')).toBe(
      'Planned',
    );
    expect(container.querySelector('em')?.textContent).toBe('noted');
  });

  it('shows the records a step reads and the screen the person sees after it', () => {
    const { container } = render(<Sequence flowId="flow:rich" mode="asIs" model={model} />);
    expect(container.querySelector('button[data-inspect="sch:price"]')).not.toBeNull();
    expect(container.querySelector('button[data-inspect="scr:cart"]')).not.toBeNull();
  });

  it('draws a step inside one service as a box with the store it writes to', () => {
    const { container } = render(<Sequence flowId="flow:rich" mode="asIs" model={model} />);
    expect(container.querySelector('[title="Happens inside one service"]')).not.toBeNull();
    expect(container.querySelector('button[data-inspect="st:pricing-db"]')).not.toBeNull();
  });
});
