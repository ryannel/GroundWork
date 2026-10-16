// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import type { LandscapeMapInput } from '@/application/landscape-map-input';

import { LandscapeMap } from './landscape-map.client';

afterEach(cleanup);

const system = (id: string, name: string) => ({
  id,
  name,
  does: `${name} work`,
  href: `/w/${id}/`,
  team: null,
  teamSlot: 1,
  parts: 2,
});

const input: LandscapeMapInput = {
  actors: [{ id: 'actor:shopper', name: 'Shopper', summary: 'Buys things.' }],
  domains: [
    {
      id: 'domain:shop',
      name: 'Shop',
      purpose: 'Sells.',
      href: '/w/shop/',
      systems: [system('sys:cart', 'Cart')],
    },
    {
      id: 'domain:ship',
      name: 'Ship',
      purpose: null,
      href: '/w/ship/',
      systems: [system('sys:wms', 'WMS')],
    },
  ],
  externals: [{ id: 'svc:carrier', name: 'Carrier', does: 'Delivers.', system: 'sys:wms' }],
  links: [
    { from: 'actor:shopper', to: 'svc:cart', kind: 'use', via: '' },
    { from: 'svc:cart', to: 'svc:wms', kind: 'api', via: 'WMS API' },
    { from: 'svc:wms', to: 'svc:carrier', kind: 'api', via: 'Carrier API' },
  ],
  homes: { 'svc:cart': 'sys:cart', 'svc:wms': 'sys:wms', 'svc:carrier': 'sys:wms' },
  paths: [
    {
      key: 'buy',
      title: 'Buy',
      kind: 'journey',
      href: '/w/journeys/buy/',
      actor: 'actor:shopper',
      pairs: [['svc:cart', 'svc:wms']],
    },
  ],
};

const lit = (container: HTMLElement, value: string) =>
  [...container.querySelectorAll(`[data-lit="${value}"]`)].length;

describe('LandscapeMap', () => {
  it('opens and folds a domain, and lights what a box connects to', () => {
    const { container } = render(<LandscapeMap input={input} />);
    expect(screen.queryByRole('link', { name: /Cart/ })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Show the systems in Shop' }));
    expect(screen.getByRole('link', { name: /Cart/ }).getAttribute('href')).toBe('/w/sys:cart');
    fireEvent.pointerOver(screen.getByText('Shopper'));
    expect(lit(container, 'hot')).toBeGreaterThan(0);
    expect(screen.getByText('Carrier').closest<HTMLElement>('[data-lit]')?.dataset.lit).toBe('dim');
    fireEvent.pointerLeave(screen.getByRole('img').parentElement!);
    expect(lit(container, 'hot')).toBe(0);
    fireEvent.click(screen.getByRole('button', { name: 'Fold' }));
    expect(screen.queryByRole('link', { name: /Cart/ })).toBeNull();
  });

  it('opens every domain at once, and lights the way a journey takes', () => {
    const { container } = render(<LandscapeMap input={input} />);
    fireEvent.click(screen.getByRole('button', { name: 'Open every domain' }));
    expect(screen.getByRole('link', { name: /WMS/ })).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Light up'), { target: { value: 'buy' } });
    expect(screen.getByRole('link', { name: 'Walk it' }).getAttribute('href')).toBe(
      '/w/journeys/buy',
    );
    expect(screen.queryByText('WMS API')).toBeNull();
    expect(
      [...container.querySelectorAll('title')].some((t) => t.textContent.includes('WMS API')),
    ).toBe(true);
    expect(screen.getByText('Carrier').closest<HTMLElement>('[data-lit]')?.dataset.lit).toBe('dim');
    expect(lit(container, 'hot')).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole('button', { name: 'Fold every domain' }));
    expect(screen.queryByRole('link', { name: /WMS/ })).toBeNull();
  });
});
