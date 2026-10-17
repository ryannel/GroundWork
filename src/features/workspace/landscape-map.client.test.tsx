// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import type { DomainMap } from '@/application/landscape-domains';
import { drawDomainMap } from '@/application/landscape-domains-layout';

import { LandscapeMap } from './landscape-map.client';

afterEach(cleanup);

const map: DomainMap = {
  people: [
    {
      id: 'actor:shopper',
      name: 'Shopper',
      summary: 'Buys things.',
      customer: true,
      domains: ['domain:shop'],
    },
    {
      id: 'actor:picker',
      name: 'Picker',
      summary: null,
      customer: false,
      domains: ['domain:ship'],
    },
  ],
  domains: [
    {
      id: 'domain:shop',
      name: 'Shop',
      purpose: 'Sells.',
      href: '/w/shop/',
      systems: 1,
      people: [],
    },
    {
      id: 'domain:ship',
      name: 'Ship',
      purpose: null,
      href: '/w/ship/',
      systems: 2,
      people: ['actor:picker'],
    },
    { id: 'domain:pay', name: 'Pay', purpose: null, href: '/w/pay/', systems: 1, people: [] },
  ],
  links: [
    {
      id: 'actor:shopper|domain:shop',
      a: 'actor:shopper',
      b: 'domain:shop',
      kinds: ['use'],
      forward: true,
      back: false,
      vias: [],
      leans: 'a',
    },
    {
      id: 'domain:ship|domain:shop',
      a: 'domain:ship',
      b: 'domain:shop',
      kinds: ['api'],
      forward: false,
      back: true,
      vias: ['WMS API'],
      leans: 'b',
    },
  ],
  journeys: [
    {
      key: 'buy',
      title: 'Buy',
      kind: 'journey',
      href: '/w/journeys/buy/',
      actor: 'actor:shopper',
      domains: ['domain:shop', 'domain:ship'],
      lines: ['actor:shopper|domain:shop', 'domain:ship|domain:shop'],
    },
  ],
};

const litOf = (text: string): string | undefined =>
  screen.getAllByText(text)[0]!.closest<HTMLElement>('[data-lit]')?.dataset.lit;

describe('LandscapeMap', () => {
  it('draws each domain with its people, the customer apart, and lights what a box connects to', () => {
    const { container } = render(<LandscapeMap drawing={drawDomainMap(map)} map={map} />);
    expect(screen.getByRole('link', { name: 'Shop' }).getAttribute('href')).toMatch(
      /^\/w\/shop\/?$/u,
    );
    expect(screen.getByText('Domain · 2 systems')).toBeTruthy();
    const ship = screen.getByRole('list', { name: 'People in Ship' });
    expect(within(ship).getByRole('button', { name: 'Picker' })).toBeTruthy();
    fireEvent.pointerOver(screen.getByText('Shop'));
    expect(litOf('Shop')).toBe('hot');
    expect(litOf('Pay')).toBe('dim');
    expect(screen.getByText('WMS API')).toBeTruthy();
    expect(
      [...container.querySelectorAll('title')].some(
        (t) => t.textContent === 'Shop to Ship: calls. WMS API',
      ),
    ).toBe(true);
    fireEvent.pointerLeave(screen.getByRole('img').parentElement!.parentElement!);
    expect(container.querySelectorAll('[data-lit="hot"]')).toHaveLength(0);
  });

  it('opens a person to list their journeys, lights one and links to its explorer', () => {
    render(<LandscapeMap drawing={drawDomainMap(map)} map={map} />);
    fireEvent.click(screen.getByRole('button', { name: /Shopper/u }));
    const panel = screen.getByRole('region', { name: "Shopper's journeys" });
    expect(within(panel).getByText('Uses Shop')).toBeTruthy();
    expect(litOf('Pay')).toBe('dim');
    fireEvent.click(within(panel).getByRole('button', { name: /^Buy/u }));
    expect(
      within(panel)
        .getByRole('link', { name: /Explore this journey/u })
        .getAttribute('href'),
    ).toMatch(/^\/w\/journeys\/buy\/?$/u);
    expect(litOf('Ship')).toBe('hot');
    fireEvent.change(within(panel).getByRole('searchbox'), { target: { value: 'nothing' } });
    expect(within(panel).getByText('Nothing matches.')).toBeTruthy();
    fireEvent.click(within(panel).getByRole('button', { name: 'Close' }));
    expect(screen.queryByRole('region', { name: "Shopper's journeys" })).toBeNull();
  });

  it('says how to name a journey for a person who starts none', () => {
    render(<LandscapeMap drawing={drawDomainMap(map)} map={map} />);
    fireEvent.click(screen.getByRole('button', { name: 'Picker' }));
    expect(screen.getByText(/No journey names Picker yet/u)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Picker' }));
    expect(screen.queryByText(/No journey names Picker yet/u)).toBeNull();
  });
});
