// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import { derive } from '@/application/plan/derive';

import { FlowDiagram } from './flow-diagram';
import { FlowPane } from './flow-pane';
import { RestNote } from './flow-rest';

vi.mock('server-only', () => ({}));

const { loadFixture } = await import('@/infrastructure/plan-fixture');

const model = derive(await loadFixture('shop.yaml'));

beforeAll(() => {
  Object.defineProperty(HTMLElement.prototype, 'clientWidth', { configurable: true, value: 800 });
  Object.defineProperty(HTMLElement.prototype, 'clientHeight', { configurable: true, value: 500 });
});

afterEach(cleanup);

describe('FlowDiagram', () => {
  it('draws a system for each end of the flow, with a name and a way to open it', () => {
    const { container } = render(
      <FlowDiagram flowId="flow:price-purge" mode="toBe" model={model} />,
    );
    const nodes = container.querySelectorAll('[data-node]');
    expect(nodes.length).toBeGreaterThan(2);
    for (const node of nodes) {
      const open = node.querySelector('button[data-inspect]');
      expect(open?.getAttribute('aria-label')).toBeTruthy();
    }
    expect(container.querySelector('svg')?.getAttribute('aria-label')).toMatch(
      /^Flow diagram: .+, \d+ systems$/,
    );
  });

  it('draws the three kinds of system', () => {
    const { container } = render(
      <FlowDiagram flowId="flow:price-purge" mode="toBe" model={model} />,
    );
    const kinds = new Set(
      [...container.querySelectorAll<HTMLElement>('[data-node]')].map((n) => n.dataset.kind),
    );
    expect(kinds.has('service')).toBe(true);
    expect(kinds.has('topic')).toBe(true);
  });

  it('draws an arrow for each hop and a numbered row for each step', () => {
    const { container } = render(
      <FlowDiagram flowId="flow:price-purge" mode="toBe" model={model} />,
    );
    expect(container.querySelectorAll('[data-kind][data-steps][data-from]').length).toBeGreaterThan(
      2,
    );
    const edge = container.querySelector('[data-walk][data-from][data-to] path');
    expect(edge).not.toBeNull();
    expect(screen.getAllByRole('button', { name: /^Step 1/ }).length).toBeGreaterThan(0);
  });

  it('opens a step in the inspector by default', () => {
    render(<FlowDiagram flowId="flow:price-purge" mode="toBe" model={model} />);
    const row = screen.getAllByRole('button', { name: /^Step 2/ })[0];
    expect(row?.dataset.inspect).toBe('flow:price-purge#consume');
    expect(row?.hasAttribute('data-step')).toBe(false);
  });

  it('hands the step number to a viewer when asked to go', () => {
    render(<FlowDiagram action="go" flowId="flow:price-purge" mode="toBe" model={model} />);
    const row = screen.getAllByRole('button', { name: /^Step 2/ })[0];
    expect(row?.dataset.step).toBe('1');
    expect(row?.hasAttribute('data-inspect')).toBe(false);
  });

  it('says which step is current and which are still to come', () => {
    const { container } = render(
      <FlowDiagram flowId="flow:price-purge" mode="toBe" model={model} step={1} />,
    );
    const walks = new Set(
      [...container.querySelectorAll<HTMLElement>('[data-walk]')].map((n) => n.dataset.walk),
    );
    expect(walks.has('current')).toBe(true);
    expect(walks.has('walked')).toBe(true);
    expect(walks.has('tocome')).toBe(true);
  });

  it('draws nothing for a flow that is not there', () => {
    const { container } = render(<FlowDiagram flowId="flow:nope" model={model} />);
    expect(container.textContent).toBe('');
  });

  it('leaves out the steps not asked for', () => {
    const { container } = render(
      <FlowDiagram flowId="flow:price-purge" mode="toBe" model={model} only={new Set([1])} />,
    );
    expect(screen.queryAllByRole('button', { name: /^Step 1:/ })).toHaveLength(0);
    expect(container.querySelectorAll('[data-node]').length).toBeGreaterThan(0);
  });
});

describe('FlowPane', () => {
  it('puts the drawing in a zoom pane with its key', () => {
    render(<FlowPane flowId="flow:price-purge" mode="toBe" model={model} />);
    expect(screen.getByRole('button', { name: /expand the flow/i })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /expand the flow/i }));
    expect(screen.getByRole('note').textContent).toContain('event');
  });

  it('draws nothing for a flow that is not there', () => {
    const { container } = render(<FlowPane flowId="flow:nope" model={model} />);
    expect(container.textContent).toBe('');
  });
});

describe('RestNote', () => {
  it('says nothing when every team is in the flow', () => {
    const { container } = render(<RestNote teams={[]} />);
    expect(container.textContent).toBe('');
  });

  it('names the teams that are not', () => {
    render(<RestNote teams={['Billing', 'Search']} />);
    expect(screen.getByText('Not in this flow · Billing · Search')).toBeTruthy();
  });

  it('folds a long list to its count when asked', () => {
    render(<RestNote fold teams={['A', 'B', 'C']} />);
    expect(screen.getByText('3 teams not in this flow')).toBeTruthy();
  });
});
