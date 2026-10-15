// @vitest-environment happy-dom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { domainViewOf } from '@/application/workspace-domain';
import { landscapeOf } from '@/application/workspace-landscape';
import { systemViewOf } from '@/application/workspace-system';
import type { Workspace } from '@/domain/workspace';

import { DomainPage, LandscapePage, SystemPage } from './index';

afterEach(cleanup);

const shop: Workspace = {
  id: 'shop',
  name: 'Shop',
  description: 'Everything we sell.',
  isPrivate: false,
  teams: [{ id: 'team:a', name: 'Alpha', colour: 3 }],
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
            {
              id: 'api',
              name: 'API',
              type: 'service',
              tech: 'Go',
              does: 'Prices',
              talksTo: [{ to: 'idx', via: 'api' }],
            },
            { id: 'db', name: 'DB', type: 'database', tech: null, does: null, talksTo: [] },
          ],
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
            { id: 'idx', name: 'Index', type: 'job', tech: null, does: null, talksTo: [] },
          ],
        },
      ],
    },
  ],
};

describe('LandscapePage', () => {
  it('draws the domains and links each system', () => {
    render(<LandscapePage folder="shop" landscape={landscapeOf(shop)} />);
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Shop');
    expect(screen.getByRole('img').getAttribute('aria-label')).toContain('systems in each domain');
    expect(screen.getAllByText('Price to Search (api)')).toHaveLength(2);
    expect(screen.getAllByRole('link', { name: /Sales/ })[0]!.getAttribute('href')).toMatch(
      /^\/shop\/sales\/?$/,
    );
  });

  it('says how to add a domain when there are none', () => {
    render(<LandscapePage folder="shop" landscape={landscapeOf({ ...shop, domains: [] })} />);
    expect(screen.getByText('No domains yet')).toBeTruthy();
    expect(screen.getByText('workspaces/shop/domains/')).toBeTruthy();
  });
});

describe('DomainPage', () => {
  it('lists who runs each system', () => {
    render(<DomainPage view={domainViewOf(shop, 'sales')!} />);
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Sales');
    expect(screen.getByRole('link', { name: 'Shop' }).getAttribute('href')).toMatch(/^\/shop\/?$/);
    expect(screen.getAllByText('Alpha').length).toBeGreaterThan(0);
  });
});

describe('SystemPage', () => {
  const view = systemViewOf(shop, { domain: 'sales', system: 'price' })!;

  it('names the owner and links the systems it talks to', () => {
    render(<SystemPage view={view} />);
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Price');
    expect(screen.getByText('Run by Alpha')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Index (Search)' }).getAttribute('href')).toMatch(
      /^\/shop\/find\/search\/?$/,
    );
    expect(screen.getByText('Nothing')).toBeTruthy();
    expect(screen.queryByText('Plans')).toBeNull();
  });

  it('shows the plans landing on it, or says none do', () => {
    const { rerender } = render(<SystemPage parts={[]} view={view} />);
    expect(screen.getByText('No plan changes this system.')).toBeTruthy();
    rerender(
      <SystemPage
        parts={[{ id: 'p', title: 'New prices', href: '/shop/plans/p/', workItems: 4, done: 2 }]}
        view={view}
      />,
    );
    expect(screen.getByText('2 of 4 work items done')).toBeTruthy();
  });
});
