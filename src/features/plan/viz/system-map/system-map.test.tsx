// @vitest-environment happy-dom
import { cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { PLANS } from '@/features/plan/chapters/chapter-kit';

import { SystemMap } from './system-map';

vi.mock('server-only', () => ({}));

const { planData } = await import('@/infrastructure/plan-data');

async function modelOf(plan: string) {
  const data = await planData({ workspace: 'alder-finch', plan });
  if (data === null) throw new Error(`no plan ${plan}`);
  return data.model;
}

const pressed = (root: HTMLElement, label: string) =>
  [...root.querySelectorAll('button')].find((b) => b.textContent === label);

function press(root: HTMLElement, label: string) {
  const button = pressed(root, label);
  if (button === undefined) throw new Error(`no ${label} button`);
  fireEvent.click(button);
}

afterEach(cleanup);

describe('SystemMap', () => {
  it.each(PLANS)('draws every service of %s as a card that opens it', async (plan) => {
    const model = await modelOf(plan);
    const { container } = render(<SystemMap model={model} />);
    const svg = container.querySelector('svg[aria-label^="System map"]');
    expect(svg).not.toBeNull();
    press(container, 'Full');
    const cards = container.querySelectorAll('[data-node] button[data-inspect]');
    expect(cards.length).toBeGreaterThanOrEqual(model.asIs.services.length);
  });

  it('switches between overview and full, and toggles the layers', async () => {
    const model = await modelOf('storefront-graph');
    const { container } = render(<SystemMap model={model} />);
    press(container, 'Full');
    expect(pressed(container, 'Full')?.getAttribute('aria-pressed')).toBe('true');
    const full = container.querySelectorAll('[data-node]').length;
    press(container, 'Overview');
    expect(pressed(container, 'Overview')?.getAttribute('aria-pressed')).toBe('true');
    expect(container.querySelectorAll('[data-node]').length).toBeLessThan(full);
    press(container, 'Stores');
    expect(pressed(container, 'Stores')?.getAttribute('aria-pressed')).toBe('true');
    expect(container.querySelector('[data-kind="store"]')).not.toBeNull();
  });

  it('fades the other kinds of line when one is picked', async () => {
    const model = await modelOf('delivery-promise');
    const { container } = render(<SystemMap model={model} />);
    press(container, 'Events');
    const all = container.querySelectorAll('g[data-line]').length;
    const events = container.querySelectorAll('g[data-line][data-kind="msg"]').length;
    const muted = container.querySelectorAll('g[data-line][data-muted="true"]').length;
    expect(all).toBeGreaterThan(0);
    expect(muted).toBe(all - events);
    expect(
      container.querySelectorAll('g[data-line][data-kind="msg"][data-muted="true"]'),
    ).toHaveLength(0);
  });

  it('traces a card under the pointer and clears when it leaves', async () => {
    const model = await modelOf('delivery-promise');
    const { container } = render(<SystemMap model={model} />);
    const line = container.querySelector('g[data-line]');
    const from = container.querySelector('[data-node] button');
    if (from === null || line === null) throw new Error('nothing drawn');
    fireEvent.pointerOver(from);
    expect(container.querySelector('[data-trace="hot"]')).not.toBeNull();
    fireEvent.pointerLeave(container.querySelector('svg[aria-label^="System map"]') ?? from);
    expect(container.querySelector('[data-trace]')).toBeNull();
  });

  it('folds and unfolds a system', async () => {
    const model = await modelOf('storefront-graph');
    const { container } = render(<SystemMap model={model} />);
    press(container, 'Full');
    const fold = container.querySelector('button[aria-expanded="true"]');
    if (fold === null) return;
    const before = container.querySelectorAll('[data-node]').length;
    fireEvent.click(fold);
    expect(container.querySelectorAll('[data-node]').length).toBeLessThan(before);
    expect(container.querySelector('button[aria-expanded="false"]')).not.toBeNull();
  });
});
