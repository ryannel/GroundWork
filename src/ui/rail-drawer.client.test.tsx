// @vitest-environment happy-dom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import Link from 'next/link';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { RailDrawer, RailToggle } from './rail-drawer.client';

let path = '/a/';
vi.mock('next/navigation', () => ({ usePathname: () => path }));

let narrow = true;
beforeEach(() => {
  narrow = true;
  path = '/a/';
  vi.stubGlobal('matchMedia', () => ({
    matches: narrow,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const frame = () =>
  render(
    <>
      <RailToggle label="Show the chapters" />
      <RailDrawer>
        <nav>
          <Link href="/a/">One</Link>
          <Link aria-current="page" href="/b/">
            Two
          </Link>
        </nav>
      </RailDrawer>
    </>,
  );

const drawer = (): HTMLElement | null => document.querySelector('#rail-drawer');

describe('the rail drawer', () => {
  it('opens from the toggle and puts focus on the page being read', () => {
    frame();
    const toggle = screen.getByRole('button', { name: 'Show the chapters' });
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    fireEvent.click(toggle);
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    expect(drawer()?.hasAttribute('data-open')).toBe(true);
    expect(document.activeElement?.textContent).toBe('Two');
  });

  it('closes on Esc and gives focus back to the toggle', () => {
    frame();
    const toggle = screen.getByRole('button', { name: 'Show the chapters' });
    fireEvent.click(toggle);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(drawer()?.hasAttribute('data-open')).toBe(false);
    expect(document.activeElement).toBe(toggle);
  });

  it('closes on a tap outside', () => {
    frame();
    fireEvent.click(screen.getByRole('button', { name: 'Show the chapters' }));
    fireEvent.click(screen.getByRole('button', { name: 'Close the menu' }));
    expect(drawer()?.hasAttribute('data-open')).toBe(false);
  });

  it('closes when a link is followed', () => {
    const view = frame();
    fireEvent.click(screen.getByRole('button', { name: 'Show the chapters' }));
    path = '/b/';
    act(() => {
      view.rerender(
        <>
          <RailToggle label="Show the chapters" />
          <RailDrawer>
            <nav />
          </RailDrawer>
        </>,
      );
    });
    expect(drawer()?.hasAttribute('data-open')).toBe(false);
  });

  it('stays a rail on a wide window', () => {
    narrow = false;
    frame();
    fireEvent.click(screen.getByRole('button', { name: 'Show the chapters' }));
    expect(drawer()?.hasAttribute('data-open')).toBe(false);
  });
});
