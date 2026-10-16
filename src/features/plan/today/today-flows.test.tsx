// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { derive } from '@/application/plan/derive';

import { TodayFlows } from './today-flows';

vi.mock('server-only', () => ({}));

const { loadFixture } = await import('@/infrastructure/plan-fixture');

const shop = derive(await loadFixture('shop.yaml'));
const flows = ['flow:price-purge', 'flow:browse', 'flow:missing'];

afterEach(cleanup);

const pressed = (name: string) => screen.getByRole('button', { name }).getAttribute('aria-pressed');

describe('TodayFlows', () => {
  it('draws nothing when no flow is known', () => {
    const { container } = render(<TodayFlows base="/w/" flows={['flow:missing']} model={shop} />);
    expect(container.textContent).toBe('');
  });

  it('shows one flow at a time, and keeps the view the reader picked', () => {
    render(<TodayFlows base="/w/" flows={flows} model={shop} />);
    const tabs = screen.getAllByRole('tab');
    expect(tabs).toHaveLength(2);
    expect(tabs[0]?.getAttribute('aria-selected')).toBe('true');
    expect(screen.getAllByRole('tabpanel')).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: 'Sequence' }));
    fireEvent.click(tabs[1]!);
    expect(tabs[1]?.getAttribute('aria-selected')).toBe('true');
    expect(pressed('Sequence')).toBe('true');
    expect(pressed('Flow diagram')).toBe('false');
  });
});
