// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { acme } from '@/../test/workspace-kit';
import { referenceOf } from '@/application/today-reference';

import { TodayJourneys } from './journey-index';
import { TodayCatalogue, TodayReference } from './reference-pages';

vi.mock(import('next/navigation'), async (original) => {
  const actual = await original();
  return {
    ...actual,
    useSearchParams: () => new actual.ReadonlyURLSearchParams(globalThis.location.search),
    usePathname: () => globalThis.location.pathname,
    useRouter: () =>
      ({
        push: vi.fn<(href: string) => void>(),
        replace: vi.fn<(href: string) => void>(),
      }) as unknown as ReturnType<typeof actual.useRouter>,
  };
});

const data = acme();
const { model } = data.today;

afterEach(cleanup);

describe('journeys of today', () => {
  it('links every journey to its walk, user journeys first', () => {
    const { container } = render(<TodayJourneys model={model} workspace={data.workspace} />);
    const links = [...container.querySelectorAll<HTMLAnchorElement>('a[href^="/acme/journeys/"]')];
    expect(links.map((a) => a.getAttribute('href')?.replace(/\/$/u, ''))).toEqual([
      '/acme/journeys/uj-buy',
      '/acme/journeys/flow-publish-product',
      '/acme/journeys/flow-cancel-order',
      '/acme/journeys/flow-place-order',
    ]);
    expect(container.textContent).not.toMatch(/\bplan\b/iu);
  });

  it('narrows the list by words and by domain', () => {
    const { container } = render(<TodayJourneys model={model} workspace={data.workspace} />);
    const count = () => container.querySelectorAll('a[href^="/acme/journeys/"]').length;
    const all = count();
    fireEvent.change(screen.getByLabelText('Find a journey or flow'), {
      target: { value: 'cancel' },
    });
    expect(count()).toBe(1);
    expect(count()).toBeLessThan(all);
    fireEvent.change(screen.getByLabelText('Find a journey or flow'), {
      target: { value: 'zzz-nothing' },
    });
    expect(screen.getByText('Nothing matches that.')).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Find a journey or flow'), { target: { value: '' } });
    fireEvent.change(screen.getByLabelText('Only in a domain'), {
      target: { value: 'catalogue' },
    });
    expect(count()).toBe(1);
    expect(count()).toBeLessThan(all);
  });
});

describe('reference of today', () => {
  it('shows a card for every kind it holds', () => {
    const { container } = render(<TodayReference model={model} workspace="acme" />);
    for (const entry of referenceOf(model)) expect(container.textContent).toContain(entry.title);
  });

  it.each(referenceOf(model).map((entry) => entry.kind))(
    'draws the %s catalogue with no modes and no status',
    (kind) => {
      const { container } = render(<TodayCatalogue kind={kind} model={model} workspace="acme" />);
      expect(container.querySelectorAll('[data-search]').length).toBeGreaterThan(0);
      expect(container.querySelector('input[type="radio"]')).toBeNull();
      expect(container.textContent).not.toMatch(/\badded\b|\bremoved\b/iu);
    },
  );
});
