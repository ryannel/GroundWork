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
  actors: [],
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
      'Plans',
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
    expect(nav[0]!.items.map((item) => [item.title, item.current])).toEqual([
      ['Map', true],
      ['Language', false],
      ['People', false],
    ]);
    expect(nav.at(-1)).toMatchObject({
      title: 'Plans',
      href: '/shop/plans/',
      side: true,
      current: false,
      count: '1',
      items: [],
    });
  });

  it('marks the plans on their index, and keeps them in the rail when there are none', () => {
    expect(workspaceNavOf(shop, [], { section: 'plans' }).at(-1)).toMatchObject({
      title: 'Plans',
      current: true,
    });
    expect(workspaceNavOf(shop, [], {}).at(-1)).not.toHaveProperty('count');
  });

  it('opens the landscape on its language and people pages', () => {
    const nav = workspaceNavOf(shop, [], { section: 'people' });
    expect(nav[0]).toMatchObject({ current: false, open: true });
    expect(nav[0]!.items.find((item) => item.current)).toMatchObject({
      title: 'People',
      href: '/shop/people/',
    });
    expect(workspaceNavOf(shop, [], { section: 'language' })[0]!.items[1]).toMatchObject({
      href: '/shop/language/',
      current: true,
    });
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
