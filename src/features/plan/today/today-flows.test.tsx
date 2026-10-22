// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { derive } from '@/application/plan/derive';

import { TodayFlow } from './today-flows';

vi.mock(import('server-only'), () => ({}));

const { loadFixture } = await import('@/infrastructure/plan-fixture');

const shop = derive(await loadFixture('shop.yaml'));

afterEach(cleanup);

const pressed = (name: string) => screen.getByRole('button', { name }).getAttribute('aria-pressed');

describe('TodayFlow', () => {
  it('draws nothing for a flow the model does not hold', () => {
    const { container } = render(<TodayFlow base="/w/" id="flow:missing" model={shop} />);
    expect(container.textContent).toBe('');
  });

  it('names the flow above its drawing', () => {
    render(<TodayFlow base="/w/" id="flow:browse" model={shop} />);
    expect(screen.getAllByRole('heading', { level: 3 })[0]?.textContent).toBe(
      shop.label('flow:browse'),
    );
  });

  it('keeps the view the reader picked for the next flow', () => {
    const first = render(<TodayFlow base="/w/" id="flow:price-purge" model={shop} />);
    fireEvent.click(screen.getByRole('button', { name: 'Sequence' }));
    first.unmount();
    render(<TodayFlow base="/w/" id="flow:browse" model={shop} />);
    expect(pressed('Sequence')).toBe('true');
    expect(pressed('Flow diagram')).toBe('false');
  });
});
