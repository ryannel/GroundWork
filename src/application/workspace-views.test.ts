import { describe, expect, it } from 'vitest';

import { acme as acmeKit } from '@/../test/workspace-kit';
import { type Component, type Workspace, systemDoes } from '@/domain/workspace';

import { neighboursOf } from './today-neighbours';
import { domainViewOf } from './workspace-domain';
import { landscapeOf } from './workspace-landscape';
import { domainPaths, systemPaths } from './workspace-paths';
import { systemViewOf } from './workspace-system';

function acme() {
  const { workspace, today } = acmeKit();
  return { workspace, today, model: today.model };
}

const component = (
  id: string,
  talksTo: Component['talksTo'] = [],
  tech: string | null = 'Go',
): Component => ({
  id,
  name: id.toUpperCase(),
  type: 'service',
  tech,
  does: null,
  talksTo,
});

const shop: Workspace = {
  id: 'shop',
  name: 'Shop',
  description: 'Everything we sell.',
  isPrivate: false,
  teams: [
    { id: 'team:a', name: 'Alpha', colour: 1, channel: null },
    { id: 'team:b', name: 'Beta', colour: null, channel: null },
  ],
  actors: [],
  domains: [
    {
      id: 'sales',
      name: 'Sales',
      purpose: 'Taking money.',
      systems: [
        {
          id: 'price',
          name: 'Price',
          team: 'team:a',
          repos: ['shop/price'],
          components: [
            component('api', [
              { to: 'db', via: 'data' },
              { to: 'queue', via: 'message' },
              { to: 'queue', via: 'api' },
            ]),
            component('db', [], null),
          ],
        },
        {
          id: 'cart',
          name: 'Cart',
          team: 'team:b',
          repos: [],
          components: [component('web', [{ to: 'api', via: 'api' }])],
        },
      ],
    },
    {
      id: 'find',
      name: 'Find',
      purpose: null,
      systems: [
        {
          id: 'search',
          name: 'Search',
          team: null,
          repos: [],
          components: [
            component('queue', [{ to: 'api', via: 'message' }]),
            component('idx', [{ to: 'web', via: 'api' }]),
          ],
        },
      ],
    },
    { id: 'misc', name: 'Misc', purpose: null, systems: [] },
  ],
};

describe('landscapeOf', () => {
  it('says what the workspace runs, and maps its domains and the people in them', () => {
    const { workspace, model } = acme();
    const view = landscapeOf(workspace, model);
    expect(view.headline).toBe(
      'Acme runs 6 systems in 3 domains: a small shop: a catalogue, a storefront and the orders between them.',
    );
    expect(view.facts).toEqual([
      '3 domains',
      '6 systems',
      '4 people',
      '19 components',
      '4 journeys and flows',
    ]);
    expect(view.map.domains.map((d) => d.id)).toEqual([
      'domain:catalogue',
      'domain:orders',
      'domain:storefront',
    ]);
    const storefront = view.map.domains.find((d) => d.id === 'domain:storefront')!;
    expect(storefront.href).toBe('/acme/storefront/');
    expect(storefront.systems).toBe(2);
    expect(view.drawing.boxes.map((b) => b.id)).toContain('actor:customer');
  });

  it('says only what it runs when the workspace says nothing of itself', () => {
    const { workspace, model } = acme();
    expect(landscapeOf({ ...workspace, description: null }, model).headline).toBe(
      'Acme runs 6 systems in 3 domains.',
    );
  });
});

describe('domainViewOf', () => {
  it('teaches the domain: its edges, journeys through it, systems and what it offers', () => {
    const { workspace, model } = acme();
    const view = domainViewOf(workspace, model, 'orders')!;
    expect(view.headline).toBe(
      'Orders’s 2 systems take part in 1 user journey and 2 flows, and work with 1 system in other domains.',
    );
    expect(view.purpose).toBe('Takes an order from placed to paid.');
    expect(view.journeys.every((j) => j.here !== null)).toBe(true);
    expect(view.journeys.map((j) => j.here)).toContain('1 of its 1 steps run in Orders');
    expect(view.systems.map((s) => s.href)).toEqual([
      '/acme/orders/ordering/',
      '/acme/orders/payments/',
    ]);
    expect(view.neighbours.reachedBy.map((n) => n.id)).toEqual(['shop']);
    expect(view.catalogue.apis.length).toBeGreaterThan(0);
    expect(view.catalogue.events.map((e) => e.head.id)).toEqual(['msg:order-placed']);
    expect(view.counts).toMatchObject({ systems: 2, components: 7, calls: 4, stores: 1 });
    expect(view.counts.flows).toBe(view.flows.length);
    expect(view.counts.events).toBe(view.catalogue.events.length);
    expect(view.teams.every((t) => t.slot > 0)).toBe(true);
    expect(view.systems.every((s) => s.components > 0)).toBe(true);
  });

  it('returns null for an unknown domain', () => {
    const { workspace, model } = acme();
    expect(domainViewOf(workspace, model, 'nope')).toBeNull();
  });
});

describe('systemViewOf', () => {
  it('teaches the system: its job, owner, code, flows and components', () => {
    const { workspace, today } = acme();
    const view = systemViewOf(workspace, today, { domain: 'storefront', system: 'shop' })!;
    expect(view.headline).toBe('Shop: The website the customer shops on.');
    expect(view.about).toBe('Run by the Web team, in the Storefront domain');
    expect(view.trail.map((step) => step.href)).toEqual(['/acme/', '/acme/storefront/']);
    expect(view.repos).toEqual([expect.objectContaining({ repo: 'acme/shop', scanned: false })]);
    expect(view.repos[0]?.read).toMatch(/^Not scanned yet/u);
    expect(view.flows).toHaveLength(1);
    expect(view.components.map((c) => c.chip.id)).toEqual(['svc:shop-bff', 'svc:shop-web']);
    const bff = view.components.find((c) => c.chip.id === 'svc:shop-bff')!;
    expect(bff.calls.length).toBeGreaterThan(0);
    expect(bff.offers.map((o) => o.chip.id)).toEqual(['api:bff-place-order']);
    expect(bff.offers.every((o) => o.calls.length === 0)).toBe(true);
    expect(view.data.map((d) => d.head.id)).toEqual(['st:basket-cache']);
    expect(systemViewOf(workspace, today, { domain: 'orders', system: 'ordering' })?.headline).toBe(
      'Ordering records orders and tells people about them.',
    );
  });

  it('returns null for an unknown system or domain', () => {
    const { workspace, today } = acme();
    expect(systemViewOf(workspace, today, { domain: 'storefront', system: 'payments' })).toBeNull();
    expect(systemViewOf(workspace, today, { domain: 'nope', system: 'shop' })).toBeNull();
  });
});

describe('a small workspace', () => {
  it('names a system by its namesake component and finds its neighbours each way', () => {
    expect(systemDoes(shop.domains[0]!.systems[0]!)).toBe('');
    const named = { ...shop.domains[0]!.systems[1]!, name: 'WEB' };
    expect(systemDoes({ ...named, components: [{ ...named.components[0]!, does: 'Sells' }] })).toBe(
      'Sells',
    );
    expect(systemDoes({ ...named, purpose: 'Takes orders' })).toBe('Takes orders');
    const near = neighboursOf(shop, new Set(['price']));
    expect(near.reaches).toEqual([
      expect.objectContaining({ id: 'search', place: 'Find domain', how: 'messages and calls' }),
    ]);
    expect(near.reachedBy.map((n) => [n.id, n.how])).toEqual([
      ['cart', 'calls'],
      ['search', 'messages'],
    ]);
  });
});

describe('paths', () => {
  it('lists every domain and system for the static routes', () => {
    expect(domainPaths([shop])).toHaveLength(3);
    expect(systemPaths([shop])).toContainEqual({
      workspace: 'shop',
      domain: 'find',
      system: 'search',
    });
  });
});
