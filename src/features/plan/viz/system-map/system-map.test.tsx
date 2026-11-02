// @vitest-environment happy-dom
import { cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { contractsPlans, stagedDeliveryTime } from '@/../test/fixtures/acme/plans/contracts-plans';
import { modelOf } from '@/../test/plan-kit';
import { systemMapInput } from '@/application/plan-viz-system-map-input';

import { SystemMap } from './system-map';
import { SystemMapView } from './system-map.client';

const pressed = (root: HTMLElement, label: string) =>
  [...root.querySelectorAll('button')].find((b) => b.textContent === label);

function press(root: HTMLElement, label: string) {
  const button = pressed(root, label);
  if (button === undefined) throw new Error(`no ${label} button`);
  fireEvent.click(button);
}

afterEach(cleanup);

describe('SystemMap', () => {
  it('opens a large system as an overview and expands every component on request', () => {
    const input = systemMapInput(modelOf(stagedDeliveryTime()));
    const service = input.services[0];
    if (service === undefined) throw new Error('fixture has no service');
    const services = Array.from({ length: 13 }, (_, index) => ({
      ...service,
      id: `svc:large-${String(index)}`,
      name: `Component ${String(index)}`,
    }));
    const { container } = render(<SystemMapView input={{ ...input, services }} />);
    expect(pressed(container, 'Systems')?.getAttribute('aria-pressed')).toBe('true');
    const folded = container.querySelectorAll('[data-node]').length;
    press(container, 'Components');
    expect(pressed(container, 'Components')?.getAttribute('aria-pressed')).toBe('true');
    expect(container.querySelectorAll('[data-node]').length).toBeGreaterThan(folded);
    for (const each of services) {
      expect(container.querySelector(`[data-inspect="${each.id}"]`)).not.toBeNull();
    }
  });

  it.each([...contractsPlans(), ['staged delivery-time', stagedDeliveryTime()] as const])(
    'draws every service of %s as a card that opens it',
    (_, plan) => {
      const model = modelOf(plan);
      const { container } = render(<SystemMap model={model} />);
      const svg = container.querySelector('svg[aria-label^="System map"]');
      expect(svg).not.toBeNull();
      press(container, 'Components');
      const cards = container.querySelectorAll('[data-node] button[data-inspect]');
      expect(cards.length).toBeGreaterThanOrEqual(model.asIs.services.length);
    },
  );

  it('switches between systems and components', () => {
    const model = modelOf(stagedDeliveryTime());
    const { container } = render(<SystemMap model={model} />);
    press(container, 'Components');
    expect(pressed(container, 'Components')?.getAttribute('aria-pressed')).toBe('true');
    const full = container.querySelectorAll('[data-node]').length;
    press(container, 'Systems');
    expect(pressed(container, 'Systems')?.getAttribute('aria-pressed')).toBe('true');
    expect(container.querySelectorAll('[data-node]').length).toBeLessThan(full);
    press(container, 'Components');
    expect(container.querySelector('[data-kind="store"]')).not.toBeNull();
  });

  it('fades the other kinds of line when one is picked', () => {
    const model = modelOf(stagedDeliveryTime());
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

  it('traces a card under the pointer and clears when it leaves', () => {
    const model = modelOf(stagedDeliveryTime());
    const { container } = render(<SystemMap model={model} />);
    const line = container.querySelector('g[data-line]');
    const from = container.querySelector('[data-node] button');
    if (from === null || line === null) throw new Error('nothing drawn');
    fireEvent.pointerOver(from);
    expect(container.querySelector('[data-trace="hot"]')).not.toBeNull();
    fireEvent.pointerLeave(container.querySelector('svg[aria-label^="System map"]') ?? from);
    expect(container.querySelector('[data-trace]')).toBeNull();
  });

  it('folds and unfolds a system', () => {
    const model = modelOf(stagedDeliveryTime());
    const { container } = render(<SystemMap model={model} />);
    press(container, 'Components');
    const fold = container.querySelector('button[aria-expanded="true"]');
    if (fold === null) throw new Error('no system to fold');
    const before = container.querySelectorAll('[data-node]').length;
    fireEvent.click(fold);
    expect(container.querySelectorAll('[data-node]').length).toBeLessThan(before);
    expect(container.querySelector('button[aria-expanded="false"]')).not.toBeNull();
  });

  it('expands a system from its name and keeps Details as a separate action', () => {
    const { container } = render(<SystemMap model={modelOf(stagedDeliveryTime())} />);
    press(container, 'Systems');
    const system = container.querySelector<SVGGElement>('[data-kind="system"]');
    const heading = system?.querySelector<HTMLButtonElement>('button[aria-expanded="false"]');
    const id = system?.dataset.node;
    if (heading === null || heading === undefined || id === undefined) {
      throw new Error('No collapsed system in the fixture');
    }
    const name = heading.getAttribute('aria-label');
    expect(heading.dataset.inspect).toBeUndefined();
    expect(system?.querySelector<HTMLButtonElement>('[data-inspect]')?.dataset.inspect).toBe(id);
    fireEvent.click(heading);
    const expanded = container.querySelector(`[data-node="${id}"]`);
    expect(expanded?.querySelector('h3')?.textContent).toBe(`System · ${name ?? ''}`);
    const collapse = expanded?.querySelector('button[aria-expanded="true"]');
    if (collapse === null || collapse === undefined) throw new Error('No Collapse control');
    expect(collapse.getAttribute('aria-label')).toBe(`Collapse ${name ?? ''}`);
    fireEvent.click(collapse);
    expect(container.querySelector(`[data-node="${id}"] [data-inspect]`)).not.toBeNull();
  });
});
