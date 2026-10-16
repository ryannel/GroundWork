// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { referenceOf } from '@/application/today-reference';

import { TodayJourneys } from './journey-index';
import { TodayCatalogue, TodayReference } from './reference-pages';

vi.mock('server-only', () => ({}));
vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(globalThis.location.search),
  usePathname: () => globalThis.location.pathname,
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

const { todayData } = await import('@/infrastructure/today-data');
const data = await todayData('alder-finch');
if (data === null) throw new Error('no alder-finch');
const { model } = data.today;

afterEach(cleanup);

describe('journeys of today', () => {
  it('links every journey to its walk, user journeys first', () => {
    const { container } = render(<TodayJourneys model={model} workspace={data.workspace} />);
    const links = [
      ...container.querySelectorAll<HTMLAnchorElement>('a[href^="/alder-finch/journeys/"]'),
    ];
    expect(links.length).toBeGreaterThan(1);
    expect(container.textContent).not.toMatch(/\bplan\b/i);
  });

  it('narrows the list by words and by domain', () => {
    const { container } = render(<TodayJourneys model={model} workspace={data.workspace} />);
    const count = () => container.querySelectorAll('a[href^="/alder-finch/journeys/"]').length;
    const all = count();
    fireEvent.change(screen.getByLabelText('Find a journey or flow'), {
      target: { value: 'invoice' },
    });
    expect(count()).toBeGreaterThan(0);
    expect(count()).toBeLessThan(all);
    fireEvent.change(screen.getByLabelText('Find a journey or flow'), {
      target: { value: 'zzz-nothing' },
    });
    expect(screen.getByText('Nothing matches that.')).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Find a journey or flow'), { target: { value: '' } });
    fireEvent.change(screen.getByLabelText('Only in a domain'), {
      target: { value: 'commercial-backbone' },
    });
    expect(count()).toBeGreaterThan(0);
    expect(count()).toBeLessThan(all);
  });
});

describe('reference of today', () => {
  it('shows a card for every kind it holds', () => {
    const { container } = render(<TodayReference model={model} workspace="alder-finch" />);
    for (const entry of referenceOf(model)) expect(container.textContent).toContain(entry.title);
  });

  it.each(referenceOf(model).map((entry) => entry.kind))(
    'draws the %s catalogue with no modes and no status',
    (kind) => {
      const { container } = render(
        <TodayCatalogue kind={kind} model={model} workspace="alder-finch" />,
      );
      expect(container.querySelectorAll('[data-search]').length).toBeGreaterThan(0);
      expect(container.querySelector('input[type="radio"]')).toBeNull();
      expect(container.textContent).not.toMatch(/\badded\b|\bremoved\b/i);
    },
  );
});
