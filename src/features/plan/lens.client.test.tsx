// @vitest-environment happy-dom
import { act, cleanup, fireEvent, render } from '@testing-library/react';
import Link from 'next/link';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ByLens, DimByLens, LensCarry, carried, dimTo, setParam } from './lens.client';

const push = vi.fn();
vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(globalThis.location.search),
  useRouter: () => ({ push }),
}));

beforeEach(() => {
  push.mockReset();
  globalThis.history.replaceState(null, '', '/');
});
afterEach(cleanup);

const link = (href: string, target = ''): HTMLAnchorElement => {
  const a = document.createElement('a');
  a.setAttribute('href', href);
  a.target = target;
  return a;
};

describe('setParam', () => {
  it('sets and clears a parameter without a navigation', () => {
    setParam('team', 'x');
    expect(globalThis.location.search).toBe('?team=x');
    setParam('team', null);
    expect(globalThis.location.search).toBe('');
  });
});

describe('ByLens', () => {
  const teams = { 'team:a': <p>for a</p> };

  it('shows everyone with no lens or an unknown one', () => {
    expect(render(<ByLens everyone={<p>all</p>} teams={teams} />).container.textContent).toBe(
      'all',
    );
    cleanup();
    globalThis.history.replaceState(null, '', '/?team=zzz');
    expect(render(<ByLens everyone={<p>all</p>} teams={teams} />).container.textContent).toBe(
      'all',
    );
  });

  it('shows the lens team’s page, with or without the prefix', () => {
    globalThis.history.replaceState(null, '', '/?team=a');
    const { container } = render(<ByLens everyone={<p>all</p>} teams={teams} />);
    expect(container.textContent).toBe('for a');
    expect(container.querySelector<HTMLElement>('[data-lens]')?.dataset.lens).toBe('a');
  });
});

const dimmed = (root: HTMLElement) =>
  [...root.querySelectorAll('[data-facts-of], article, span')].map((e) => e.matches('[data-dim]'));

const click = async (a: HTMLElement, init: MouseEventInit = {}) =>
  act(async () => {
    fireEvent.click(a, init);
    await Promise.resolve();
  });

describe('dimming', () => {
  const rows = (
    <div>
      <div data-facts-of="own:team:a" />
      <div data-facts-of="own:team:b" />
      <article data-slot="1" />
      <article data-slot="2" />
      <span data-slot="2" />
    </div>
  );
  const slots = { 'team:a': 1, 'team:b': 2 };

  it('dims the other teams by owner and by slot, and only rows and cards', () => {
    const { container } = render(rows);
    dimTo(container, 'a', slots);
    expect(dimmed(container)).toEqual([false, true, false, true, false]);
    dimTo(container, null, slots);
    expect(dimmed(container).some(Boolean)).toBe(false);
  });

  it('follows the address', () => {
    globalThis.history.replaceState(null, '', '/?team=team:b');
    const { container } = render(<DimByLens slots={slots}>{rows}</DimByLens>);
    expect(dimmed(container)).toEqual([true, false, true, false, false]);
  });
});

describe('carried', () => {
  it('adds the lens to a link to a plan screen, keeping the hash', () => {
    expect(carried(link('/w/plans/p/cover/part#x'), 'team:a')).toBe(
      '/w/plans/p/cover/part?team=team%3Aa#x',
    );
  });

  it('leaves alone other links, a link with a lens, and a new tab', () => {
    expect(carried(link('https://example.com'), 'a')).toBeNull();
    expect(carried(link('/w/other'), 'a')).toBeNull();
    expect(carried(link('/w/plans/p?team=b'), 'a')).toBeNull();
    expect(carried(link('/w/plans/p', '_blank'), 'a')).toBeNull();
    expect(carried(document.createElement('a'), 'a')).toBeNull();
  });
});

describe('LensCarry', () => {
  it('keeps the lens on a plain click on a plan link', async () => {
    globalThis.history.replaceState(null, '', '/?team=a');
    const { getByText } = render(
      <>
        <LensCarry />
        <Link href="/w/plans/p/why/problem">go</Link>
      </>,
    );
    await click(getByText('go'));
    expect(push).toHaveBeenCalledWith('/w/plans/p/why/problem?team=a');
  });

  it('does nothing without a lens, or with a modifier key', async () => {
    const { getByText } = render(
      <>
        <LensCarry />
        <Link href="/w/plans/p/why/problem">go</Link>
      </>,
    );
    await click(getByText('go'));
    cleanup();
    globalThis.history.replaceState(null, '', '/?team=a');
    const again = render(
      <>
        <LensCarry />
        <Link href="/w/plans/p/why/problem">go</Link>
      </>,
    );
    await click(again.getByText('go'), { metaKey: true });
    expect(push).not.toHaveBeenCalled();
  });
});
