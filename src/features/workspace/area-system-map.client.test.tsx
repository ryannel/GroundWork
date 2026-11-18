// @vitest-environment happy-dom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import type { AreaView } from '@/application/workspace-area';

import { AreaSystemMap } from './area-system-map.client';

beforeAll(() => {
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe = vi.fn<() => void>();
      disconnect = vi.fn<() => void>();
    },
  );
});

afterEach(cleanup);

const view: AreaView = {
  workspace: { id: 'cars', name: 'Cars', href: '/cars/' },
  area: {
    id: 'commercial',
    name: 'Set prices and offers',
    purpose: 'Prepare what each market sells.',
    activities: ['Set prices'],
    boundary: 'A partial view.',
    confidence: 'medium',
    evidenceCount: 3,
  },
  scope: 'Scanned systems.',
  reviewed: '',
  limitation: '',
  collaborations: [],
  systems: [
    {
      id: 'offers',
      name: 'Offers',
      purpose: 'Combines products and terms.',
      href: '/cars/commercial/offers/',
      resources: ['2 stores'],
      components: [
        {
          id: 'svc:offers',
          name: 'Offer service',
          kind: 'service',
          summary: 'Keeps offers.',
          repository: null,
          endpoints: [],
          resources: [],
          dependencies: [],
        },
      ],
    },
    {
      id: 'price',
      name: 'Price',
      purpose: 'Calculates what a customer pays.',
      href: '/cars/commercial/price/',
      resources: ['1 store'],
      components: [
        {
          id: 'svc:pretax',
          name: 'Pre-tax prices',
          kind: 'service',
          summary: 'Returns prices before tax.',
          repository: {
            name: 'volvo-cars/gpe-pretax',
            href: 'https://github.com/volvo-cars/gpe-pretax',
          },
          endpoints: [
            {
              id: 'api:calculate-cart',
              signature: 'POST /api/v6/CalculateCart',
              summary: 'Prices every line in a cart.',
              explorer: '/cars/entries?id=api-calculate-cart',
              request: 'sch:cart-request',
              response: 'sch:cart-response',
              callers: [
                {
                  id: 'svc:checkout',
                  name: 'Checkout',
                  system: 'offers',
                  systemName: 'Offers',
                },
              ],
            },
          ],
          resources: [{ id: 'st:prices', name: 'Price cache', kind: 'store', use: 'Reads' }],
          dependencies: [
            {
              id: 'svc:tax',
              name: 'Tax calculator',
              system: 'tax',
              systemName: 'Tax',
              endpointId: 'api:tax-calculate',
              endpoint: 'POST /calculate',
            },
          ],
        },
      ],
    },
  ],
  relationships: [
    {
      id: 'offers-to-price',
      from: 'offers',
      to: 'price',
      label: 'Offer items',
      kind: 'api',
      detail: 'Price checks every item.',
    },
  ],
  technicalRelationships: [
    {
      id: 'technical:checkout-to-pretax',
      from: 'svc:offers',
      to: 'svc:pretax',
      fromSystem: 'offers',
      toSystem: 'price',
      via: 'api:calculate-cart',
      label: 'POST /api/v6/CalculateCart',
      kind: 'api',
      detail: 'Offer service calls Pre-tax prices.',
      evidenced: true,
    },
  ],
};

describe('AreaSystemMap', () => {
  it('puts the recorded repository link in the service inspector header', () => {
    const { container } = render(<AreaSystemMap view={view} />);
    fireEvent.click(screen.getByRole('button', { name: 'Expand Price' }));
    fireEvent.click(screen.getByRole('button', { name: 'Details of Pre-tax prices' }));
    const link = screen.getByRole('link', { name: 'volvo-cars/gpe-pretax' });
    expect(link.getAttribute('href')).toBe('https://github.com/volvo-cars/gpe-pretax');
    expect(link.closest('section')?.firstElementChild?.contains(link)).toBe(true);
    expect(link.querySelector('svg[data-filled]')).not.toBeNull();
    expect(screen.getAllByRole('link', { name: 'volvo-cars/gpe-pretax' })).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: 'Close Pre-tax prices' }));
    fireEvent.click(screen.getByRole('button', { name: 'Expand Offers' }));
    fireEvent.click(screen.getByRole('button', { name: 'Details of Offer service' }));
    expect(container.querySelector('svg[data-filled]')).toBeNull();
  });

  it('reveals a shared resource inside its containing service in another system', () => {
    const offers = view.systems[0]!;
    const price = view.systems[1]!;
    const service = price.components[0]!;
    const cache = {
      ...service,
      id: 'st:prices',
      name: 'Price cache',
      kind: 'database' as const,
      parentComponent: service.id,
      endpoints: [],
      resources: [],
      dependencies: [],
    };
    const { container } = render(
      <AreaSystemMap
        view={{
          ...view,
          systems: [
            {
              ...offers,
              components: offers.components.map((item) => ({
                ...item,
                resources: [
                  { id: cache.id, name: cache.name, kind: 'store', use: 'Reads' },
                  { id: 'missing', name: 'Unplaced topic', kind: 'topic', use: 'Consumes' },
                ],
              })),
            },
            { ...price, components: [service, cache] },
          ],
        }}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Expand Offers' }));
    fireEvent.click(screen.getByRole('button', { name: /Show what Offer service holds/u }));
    expect(screen.getByText('Price · System collapsed')).toBeTruthy();
    expect(screen.getByRole('button', { name: /Unplaced topic/u })).toHaveProperty(
      'disabled',
      true,
    );
    fireEvent.click(screen.getByRole('button', { name: /Price cache.*expands system/u }));
    expect(screen.getByRole('button', { name: 'Collapse Price' })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Hide what Pre-tax prices holds/u })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Price cache' })).toBeTruthy();
    expect(container.querySelector('foreignObject[data-component="st:prices"]')).toBeNull();
    expect(screen.getByText('Price · Show on map')).toBeTruthy();
  });

  it('selects an embedded store without creating another card or moving the service', () => {
    const first = view.systems[0]!;
    const service = first.components[0]!;
    const store = {
      ...service,
      id: 'st:private',
      name: 'Offer database',
      kind: 'database' as const,
      category: 'database',
      technology: 'PostgreSQL',
      parentComponent: service.id,
    };
    const { container } = render(
      <AreaSystemMap view={{ ...view, systems: [{ ...first, components: [service, store] }] }} />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Expand Offers' }));
    const card = container.querySelector('foreignObject[data-component="svc:offers"]')!;
    expect(screen.queryByRole('button', { name: /Offer database PostgreSQL/u })).toBeNull();
    const contents = screen.getByRole('button', {
      name: /^Show what Offer service holds: 1 stores/u,
    });
    expect(contents.getAttribute('aria-expanded')).toBe('false');
    fireEvent.click(contents);
    expect(contents.getAttribute('aria-expanded')).toBe('true');
    const geometry = card.outerHTML.split('>')[0];
    expect(container.querySelector('foreignObject[data-component="st:private"]')).toBeNull();
    const row = screen.getByRole('button', { name: /Offer database PostgreSQL/u });
    fireEvent.click(row);
    expect(screen.getByRole('heading', { name: 'Offer database' })).toBeTruthy();
    expect(row.getAttribute('aria-pressed')).toBe('true');
    expect(card.outerHTML.split('>')[0]).toBe(geometry);
  });
  it('keeps row-level labels quiet, raises the pointed line alone and focuses a rested card', () => {
    vi.useFakeTimers();
    const { container } = render(<AreaSystemMap view={view} />);
    const overview = container.querySelector<SVGElement>('[data-edge]')!;
    expect(overview.dataset.quiet).toBeUndefined();
    fireEvent.click(screen.getByRole('button', { name: 'Expand Price' }));
    const line = container.querySelector<SVGElement>('[data-edge]')!;
    expect(line.dataset.quiet).toBeDefined();
    const svg = container.querySelector('svg')!;
    const rest = (ms: number): void => {
      act(() => {
        vi.advanceTimersByTime(ms);
      });
    };
    const hit = line.querySelector('path:last-of-type')!;
    fireEvent.pointerOver(hit);
    const raised = (): Element | null => svg.querySelector('[data-raised-edge]');
    expect(raised()?.querySelector('path')?.getAttribute('d')).toBe(
      line.querySelector('path')?.getAttribute('d'),
    );
    rest(400);
    expect(svg.querySelectorAll('[data-muted]')).toHaveLength(0);
    fireEvent.pointerOut(hit, { relatedTarget: svg });
    rest(100);
    expect(raised()).not.toBeNull();
    rest(100);
    expect(raised()).toBeNull();
    const card = svg.querySelector('[data-component]')!;
    fireEvent.pointerOver(card);
    rest(50);
    expect(line.dataset.lit).toBeUndefined();
    rest(100);
    expect(line.dataset.lit).toBeDefined();
    fireEvent.pointerOver(hit);
    rest(400);
    expect(line.dataset.lit).toBeDefined();
    fireEvent.pointerOver(svg);
    rest(400);
    expect(line.dataset.lit).toBeUndefined();
    vi.useRealTimers();
  });

  it('filters a selected component by callers or dependencies and resets cleanly', () => {
    render(<AreaSystemMap view={view} />);
    expect(screen.queryByText('Faint: context')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Expand Price' }));
    expect(screen.getByText('Faint: context')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Details of Pre-tax prices' }));
    const incoming = 'Offer service calls Pre-tax prices.';
    expect(screen.getByRole('button', { name: incoming })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Depends on' }));
    expect(screen.queryByRole('button', { name: incoming })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Used by' }));
    expect(screen.getByRole('button', { name: incoming })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Reset canvas view' }));
    expect(screen.getByRole('button', { name: 'Expand Price' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Depends on' })).toBeNull();
  });

  it('keeps several systems open and links a scanned service to its deeper view', () => {
    render(<AreaSystemMap view={view} />);
    fireEvent.click(screen.getByRole('button', { name: 'Expand Offers' }));
    fireEvent.click(screen.getByRole('button', { name: 'Expand Price' }));

    expect(screen.getByRole('button', { name: 'Collapse Offers' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Collapse Price' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Offer service' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Pre-tax prices' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Details of Pre-tax prices' }));

    expect(screen.queryByRole('button', { name: /POST \/api\/v6\/CalculateCart/u })).toBeNull();
    const apiGroup = screen.getByRole('button', {
      name: /REST \/CalculateCart · v6.*1 operations/u,
    });
    expect(apiGroup.dataset.inspect).toBe('api:calculate-cart');
    fireEvent.click(apiGroup);
    const operation = screen.getByRole('button', { name: /POST \/api\/v6\/CalculateCart/u });
    expect(operation.dataset.inspect).toBe('api:calculate-cart');
    fireEvent.click(operation);
    expect(screen.getByRole('link', { name: /Open API logic/u }).getAttribute('href')).toBe(
      '/cars/entries?id=api-calculate-cart',
    );
    expect(screen.getByRole('button', { name: 'Offers · Checkout' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Price cache' })).toBeTruthy();
  });
});
