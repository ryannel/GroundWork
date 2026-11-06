import { describe, expect, it } from 'vitest';

import { acme } from '@/../test/workspace-kit';
import type { Workspace } from '@/domain/workspace';

import { domainViewOf, systemCataloguesOf } from './workspace-domain';

describe('the domain reader', () => {
  it('shows Catalogue facts, its two systems, one shared team and the route into its flow', () => {
    const { workspace, today } = acme();
    const view = domainViewOf(workspace, today.model, 'catalogue');
    expect(view).toMatchObject({
      workspace: { name: 'Acme', href: '/acme/' },
      name: 'Catalogue',
      href: '/acme/catalogue/',
      purpose: null,
      headline:
        'Catalogue’s 2 systems take part in 1 flow, and work with 1 system in other domains.',
      counts: { systems: 2, components: 7, flows: 1, calls: 3, events: 1, stores: 2 },
      teams: [{ name: 'Catalogue', slot: 5 }],
      allJourneys: '/acme/journeys/',
      systems: [
        {
          id: 'products',
          name: 'Products',
          href: '/acme/catalogue/products/',
          does: 'Keeps every product and its details.',
          team: { name: 'Catalogue', slot: 5 },
          components: 4,
          repos: ['acme/products'],
        },
        {
          id: 'search',
          name: 'Search',
          href: '/acme/catalogue/search/',
          does: 'Finds products by words',
          team: { name: 'Catalogue', slot: 5 },
          components: 3,
          repos: ['acme/search'],
        },
      ],
      neighbours: {
        reaches: [],
        reachedBy: [
          {
            id: 'shop',
            name: 'Shop',
            href: '/acme/storefront/shop/',
            place: 'Storefront domain',
            how: 'calls',
          },
        ],
      },
    });
    expect(view?.flows.map(({ id, href, entry }) => ({ id, href, entry }))).toEqual([
      {
        id: 'flow:publish-product',
        href: '/acme/catalogue/flows/publish-product/',
        entry: 'Products',
      },
    ]);
    expect(view?.journeys.map((journey) => journey.key)).toEqual(['flow-publish-product']);
    expect(view?.catalogue.apis).toHaveLength(2);
    expect(view?.catalogue.events).toHaveLength(1);
    expect(view?.catalogue.data).toHaveLength(2);
  });
  it('counts endpoint items rather than interface groups and retains an authored purpose and distinct teams', () => {
    const { workspace, today } = acme();
    expect(domainViewOf(workspace, today.model, 'orders')).toMatchObject({
      name: 'Orders',
      purpose: 'Takes an order from placed to paid.',
      counts: { systems: 2, components: 7, flows: 2, calls: 4, events: 1, stores: 1 },
      teams: [
        { name: 'Orders', slot: 3 },
        { name: 'Payments', slot: 4 },
      ],
      headline:
        'Orders’s 2 systems take part in 1 user journey and 2 flows, and work with 1 system in other domains.',
    });
  });
  it('keeps an empty domain visible, with no invented journeys, teams or neighbours', () => {
    const { workspace, today } = acme();
    const empty: Workspace = {
      ...workspace,
      domains: [{ id: 'empty', name: 'Empty', purpose: null, systems: [] }],
    };
    expect(domainViewOf(empty, today.model, 'empty')).toEqual({
      workspace: { name: 'Acme', href: '/acme/' },
      name: 'Empty',
      href: '/acme/empty/',
      purpose: null,
      headline: 'Empty’s 0 systems take part in no journey yet.',
      counts: { systems: 0, components: 0, flows: 0, calls: 0, events: 0, stores: 0 },
      teams: [],
      journeys: [],
      allJourneys: '/acme/journeys/',
      flows: [],
      systems: [],
      neighbours: { reaches: [], reachedBy: [] },
      catalogue: { apis: [], events: [], data: [] },
    });
    expect(domainViewOf(workspace, today.model, 'missing')).toBeNull();
    expect(systemCataloguesOf(workspace, today.model, 'missing')).toEqual([]);
  });
  it('leaves unknown teams as gaps and retains a repository subfolder label', () => {
    const { workspace, today } = acme();
    const unowned: Workspace = {
      ...workspace,
      teams: [],
      domains: workspace.domains.map((domain) => ({
        ...domain,
        systems: domain.systems.map((system) => ({
          ...system,
          team: null,
          repos: [{ repo: 'acme/mono', path: 'apps/catalogue' }],
        })),
      })),
    };
    const view = domainViewOf(unowned, today.model, 'catalogue');
    expect(view?.teams).toEqual([]);
    expect(view?.systems.map(({ team, repos }) => ({ team, repos }))).toEqual([
      { team: null, repos: ['acme/mono/apps/catalogue'] },
      { team: null, repos: ['acme/mono/apps/catalogue'] },
    ]);
  });
  it('lists only systems that offer calls, events or data, with their own routes', () => {
    const { workspace, today } = acme();
    const catalogue = systemCataloguesOf(workspace, today.model, 'catalogue');
    expect(
      catalogue.map(({ id, name, href, catalogue: value }) => ({
        id,
        name,
        href,
        counts: [value.apis.length, value.events.length, value.data.length],
      })),
    ).toEqual([
      { id: 'products', name: 'Products', href: '/acme/catalogue/products/', counts: [1, 1, 1] },
      { id: 'search', name: 'Search', href: '/acme/catalogue/search/', counts: [1, 0, 1] },
    ]);
    expect(
      systemCataloguesOf(workspace, today.model, 'storefront').map((system) => system.id),
    ).toEqual(['shop']);
  });
});
