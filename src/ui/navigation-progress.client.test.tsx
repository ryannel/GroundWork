// @vitest-environment happy-dom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import Link from 'next/link';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { NavigationProgress, navigationTarget } from './navigation-progress.client';

let path = '/a';
vi.mock(import('next/navigation'), async (original) => ({
  ...(await original()),
  usePathname: () => path,
  useSearchParams: () => new URLSearchParams() as never,
}));

// happy-dom follows a plain anchor itself; the browser would leave that to the router or another tab.
const stay = (event: MouseEvent): void => {
  event.preventDefault();
};
beforeEach(() => {
  path = '/a';
  globalThis.history.replaceState(null, '', '/a');
  document.addEventListener('click', stay);
});
afterEach(() => {
  cleanup();
  document.removeEventListener('click', stay);
  vi.useRealTimers();
});

const bar = (): HTMLElement => screen.getByRole('progressbar', { hidden: true });

const page = () =>
  render(
    <>
      <NavigationProgress />
      <Link href="/b/">Elsewhere</Link>
      <Link href="/a#part">Here</Link>
      <a href="https://example.com/">Away</a>
      <Link href="/c/" target="_blank">
        New tab
      </Link>
    </>,
  );

describe('NavigationProgress', () => {
  it('shows from a click on a link to another page until that page arrives', () => {
    const { rerender } = page();
    expect(bar().dataset.pending).toBeUndefined();
    fireEvent.click(screen.getByText('Elsewhere'));
    expect(bar().dataset.pending).toBe('');
    path = '/b/';
    rerender(<NavigationProgress />);
    expect(bar().dataset.pending).toBeUndefined();
  });

  it('gives up on a navigation that never arrives', () => {
    vi.useFakeTimers();
    page();
    fireEvent.click(screen.getByText('Elsewhere'));
    expect(bar().dataset.pending).toBe('');
    act(() => {
      vi.advanceTimersByTime(60_000);
    });
    expect(bar().dataset.pending).toBeUndefined();
  });

  it('ignores the same page, other sites, new tabs and modified clicks', () => {
    page();
    for (const text of ['Here', 'Away', 'New tab']) fireEvent.click(screen.getByText(text));
    fireEvent.click(screen.getByText('Elsewhere'), { metaKey: true });
    expect(bar().dataset.pending).toBeUndefined();
  });
});

describe('navigationTarget', () => {
  it('names the page a plain click opens, with its query', () => {
    const anchor = document.createElement('a');
    anchor.href = '/b/?flow=x';
    const event = new MouseEvent('click', { button: 0 });
    Object.defineProperty(event, 'target', { value: anchor });
    expect(navigationTarget(event, new URL(globalThis.location.href))).toBe('/b/?flow=x');
  });
});
