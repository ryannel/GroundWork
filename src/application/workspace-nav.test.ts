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
  it('puts the overview, then the domains, then the reference, each under its heading', () => {
    const nav = workspaceNavOf(shop, [], {});
    expect(nav.map((group) => [group.title, group.heading])).toEqual([
      ['Landscape', 'Overview'],
      ['Plans', undefined],
      ['Sales', 'Domains'],
      ['Find', undefined],
      ['Journeys', 'Look up'],
      ['Services', undefined],
      ['Reference', undefined],
    ]);
  });

  it('links each domain without listing its systems, marking the one being read', () => {
    const nav = workspaceNavOf(shop, [], { domain: 'find', system: 'index' });
    const find = nav.find((group) => group.title === 'Find')!;
    expect(find).toMatchObject({
      count: '2',
      current: true,
      href: '/shop/find/',
      items: [],
    });
    expect(nav.find((group) => group.title === 'Sales')!.current).toBe(false);
  });

  it('marks the landscape on the workspace page and counts the plans', () => {
    const plans = [{ id: 'p', title: 'New prices', href: '/shop/plans/p/' }];
    const nav = workspaceNavOf(shop, plans, {});
    expect(nav[0]!.current).toBe(true);
    expect(nav[0]!.items.map((item) => [item.title, item.current])).toEqual([
      ['Map', true],
      ['Value Flows', false],
      ['Language', false],
      ['People', false],
    ]);
    expect(nav[1]).toMatchObject({
      title: 'Plans',
      href: '/shop/plans/',
      current: false,
      count: '1',
      items: [],
    });
  });

  it('adds the programmes and the partners to the overview only when the workspace has some', () => {
    const partnered: Workspace = {
      ...shop,
      teams: [
        { id: 'team:ours', name: 'Ours', colour: null, channel: null },
        { id: 'team:ziklo', name: 'Ziklo', colour: null, channel: null, partner: true },
      ],
    };
    const nav = workspaceNavOf(partnered, [], { section: 'partners' }, ['care', 'after-sales']);
    expect(nav.slice(0, 5).map((group) => [group.title, group.heading])).toEqual([
      ['Landscape', 'Overview'],
      ['Plans', undefined],
      ['Programmes', undefined],
      ['Partners', undefined],
      ['Sales', 'Domains'],
    ]);
    expect(nav[2]).toEqual({
      key: 'programmes',
      title: 'Programmes',
      href: '/shop/programmes/',
      count: '2',
      current: false,
      open: false,
      items: [],
    });
    expect(nav[3]).toEqual({
      key: 'partners',
      title: 'Partners',
      href: '/shop/partners/',
      count: '1',
      current: true,
      open: false,
      items: [],
    });
    expect(workspaceNavOf(partnered, [], { section: 'programmes' }, ['care'])[2]?.current).toBe(
      true,
    );
    const quiet = workspaceNavOf(shop, [], {}).map((group) => group.title);
    expect(quiet).not.toContain('Programmes');
    expect(quiet).not.toContain('Partners');
  });

  it('marks the plans on their index, and keeps them in the rail when there are none', () => {
    expect(workspaceNavOf(shop, [], { section: 'plans' })[1]).toMatchObject({
      title: 'Plans',
      current: true,
    });
    expect(workspaceNavOf(shop, [], {})[1]).not.toHaveProperty('count');
  });

  it('opens the landscape on its language and people pages', () => {
    const nav = workspaceNavOf(shop, [], { section: 'people' });
    expect(nav[0]).toMatchObject({ current: false, open: true });
    expect(nav[0]!.items.find((item) => item.current)).toMatchObject({
      title: 'People',
      href: '/shop/people/',
    });
    expect(
      workspaceNavOf(shop, [], { section: 'language' })[0]!.items.find(
        (item) => item.title === 'Language',
      ),
    ).toMatchObject({
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

  it('places Value Flows directly below Map and marks its page without selecting Map', () => {
    const group = workspaceNavOf(shop, [], { section: 'value-flows' })[0]!;
    expect(group.open).toBe(true);
    expect(group.items.slice(0, 2)).toEqual([
      { title: 'Map', href: '/shop/', current: false },
      { title: 'Value Flows', href: '/shop/value-flows/', current: true },
    ]);
  });
});
