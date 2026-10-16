import { describe, expect, it } from 'vitest';

import type { Workspace } from '@/domain/workspace';

import { workspaceNavOf } from './workspace-nav';

const system = (id: string, name: string) => ({
  id,
  name,
  team: null,
  repos: [],
  components: [],
});

const shop: Workspace = {
  id: 'shop',
  name: 'Shop',
  description: null,
  isPrivate: false,
  teams: [],
  domains: [
    { id: 'sales', name: 'Sales', purpose: null, systems: [system('price', 'Price')] },
    {
      id: 'find',
      name: 'Find',
      purpose: null,
      systems: [system('search', 'Search'), system('index', 'Index')],
    },
  ],
};

describe('workspaceNavOf', () => {
  it('opens the domain being read and marks the system', () => {
    const nav = workspaceNavOf(shop, [], { domain: 'find', system: 'index' });
    expect(nav.map((group) => group.title)).toEqual([
      'Landscape',
      'Sales',
      'Find',
      'Journeys',
      'Reference',
    ]);
    const find = nav[2]!;
    expect(find).toMatchObject({
      marker: '2',
      count: '2',
      current: true,
      open: true,
      href: '/shop/find/',
    });
    expect(find.items.filter((item) => item.current).map((item) => item.title)).toEqual(['Index']);
    expect(nav[1]!.open).toBe(false);
  });

  it('marks the landscape on the workspace page and sets the plans apart', () => {
    const plans = [{ id: 'p', title: 'New prices', href: '/shop/plans/p/' }];
    const nav = workspaceNavOf(shop, plans, {});
    expect(nav[0]!.current).toBe(true);
    expect(nav.at(-1)).toMatchObject({ title: 'Plans', side: true, open: true, count: '1' });
  });

  it('marks the journeys or reference being read, not the landscape', () => {
    const nav = workspaceNavOf(shop, [], { section: 'reference', key: 'stores' });
    expect(nav.find((group) => group.title === 'Reference')).toMatchObject({
      current: true,
      open: true,
      href: '/shop/reference/',
    });
    expect(nav[0]!.current).toBe(false);
    expect(nav.find((group) => group.title === 'Journeys')).toMatchObject({
      current: false,
      href: '/shop/journeys/',
    });
  });
});
