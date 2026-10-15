import { describe, expect, it } from 'vitest';

import type { Component, Workspace } from '@/domain/workspace';

import { layoutDiagram } from './workspace-diagram';
import { domainViewOf } from './workspace-domain';
import { landscapeOf } from './workspace-landscape';
import { domainPaths, findWorkspace, systemPaths } from './workspace-paths';
import { systemViewOf } from './workspace-system';

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
    { id: 'team:a', name: 'Alpha', colour: 1 },
    { id: 'team:b', name: 'Beta', colour: null },
  ],
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

const box = (id: string) => ({
  id,
  label: id,
  detail: null,
  href: null,
  team: null,
  quiet: false,
});

describe('landscapeOf', () => {
  it('draws every domain with its systems and the links between them', () => {
    const view = landscapeOf(shop);
    expect(view.description).toBe('Everything we sell.');
    expect(view.facts).toEqual(['3 domains', '3 systems', '4 connections, 3 across domains']);
    expect(view.diagram.groups.map((group) => group.href)).toEqual([
      '/shop/sales/',
      '/shop/find/',
      '/shop/misc/',
    ]);
    expect(view.diagram.nodes.find((node) => node.id === 'price')).toMatchObject({
      href: '/shop/sales/price/',
      detail: 'Alpha',
      team: 1,
    });
    expect(view.diagram.edges).toHaveLength(4);
    expect(view.domains[2]?.size).toBe('0 systems');
  });

  it('leaves the description out when the workspace has none', () => {
    expect(landscapeOf({ ...shop, description: null }).description).toBeNull();
  });
});

describe('domainViewOf', () => {
  it('shows the domain and, drawn quiet, the systems outside it', () => {
    const view = domainViewOf(shop, 'sales');
    expect(view?.description).toBe('Taking money.');
    expect(view?.facts).toEqual(['2 systems', '2 teams', '1 connected system in other domains']);
    expect(view?.systems.map((row) => row.team)).toEqual(['Alpha', 'Beta']);
    expect(view?.diagram.groups.map((group) => group.id)).toEqual(['sales', 'callees']);
    expect(view?.diagram.nodes.find((node) => node.id === 'search')).toMatchObject({
      quiet: true,
      detail: 'Find',
    });
  });

  it('puts systems that only call in on the left, and names a domain without a purpose', () => {
    const view = domainViewOf(shop, 'find');
    expect(view?.description).toBeNull();
    expect(view?.systems[0]?.team).toBe('No team');
    expect(view?.diagram.groups.map((group) => group.id)).toEqual(['find', 'callees']);
    const empty = domainViewOf(
      {
        ...shop,
        domains: [
          shop.domains[0]!,
          {
            ...shop.domains[1]!,
            systems: [{ ...shop.domains[1]!.systems[0]!, components: [component('queue')] }],
          },
        ],
      },
      'find',
    );
    expect(empty?.diagram.groups.map((group) => group.id)).toEqual(['callers', 'find']);
  });

  it('returns null for an unknown domain', () => {
    expect(domainViewOf(shop, 'nope')).toBeNull();
  });
});

describe('systemViewOf', () => {
  it('names the owner and links each connection to the other system', () => {
    const view = systemViewOf(shop, { domain: 'sales', system: 'price' });
    expect(view?.description).toBe('Run by Alpha');
    expect(view?.facts).toEqual(['2 components', '1 repo']);
    expect(view?.trail.map((step) => step.href)).toEqual(['/shop/', '/shop/sales/']);
    expect(view?.components[0]?.talksTo).toEqual([
      { label: 'DB', href: null, via: 'data' },
      { label: 'QUEUE (Search)', href: '/shop/find/search/', via: 'message' },
      { label: 'QUEUE (Search)', href: '/shop/find/search/', via: 'api' },
    ]);
    expect(view?.diagram.groups.map((group) => group.id)).toEqual(['callers', 'price', 'callees']);
    expect(view?.diagram.nodes.find((node) => node.id === 'c:db')?.detail).toBe('service');
    expect(view?.diagram.edges.find((edge) => edge.id === 'c:api>s:search')?.via).toEqual([
      'message',
      'api',
    ]);
  });

  it('says when no team owns it, and keeps unknown targets as plain text', () => {
    const lost: Workspace = {
      ...shop,
      domains: [
        {
          ...shop.domains[1]!,
          systems: [
            {
              ...shop.domains[1]!.systems[0]!,
              components: [component('queue', [{ to: 'gone', via: 'api' }])],
            },
          ],
        },
      ],
    };
    const view = systemViewOf(lost, { domain: 'find', system: 'search' });
    expect(view?.description).toBe('No team runs this yet');
    expect(view?.components[0]?.talksTo).toEqual([{ label: 'gone', href: null, via: 'api' }]);
  });

  it('returns null for an unknown system or domain', () => {
    expect(systemViewOf(shop, { domain: 'find', system: 'price' })).toBeNull();
    expect(systemViewOf(shop, { domain: 'nope', system: 'price' })).toBeNull();
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

describe('layoutDiagram', () => {
  it('curves forwards, backwards and round a loop, and skips unknown ends', () => {
    const diagram = layoutDiagram(
      [
        { id: 'one', label: 'One', href: null, quiet: false, nodes: [box('a'), box('b')] },
        { id: 'two', label: 'Two', href: null, quiet: false, nodes: [box('c')] },
      ],
      [
        { from: 'a', to: 'c', via: ['api'] },
        { from: 'c', to: 'a', via: ['api'] },
        { from: 'a', to: 'b', via: ['data'] },
        { from: 'a', to: 'x', via: ['data'] },
      ],
    );
    expect(diagram.edges.map((edge) => edge.path)).toEqual([
      'M 200 66 C 252 66, 252 66, 304 66',
      'M 304 66 C 252 66, 252 66, 200 66',
      'M 200 66 C 240 66, 240 122, 200 122',
    ]);
    expect(diagram.edges[0]?.description).toBe('a to c (api)');
    expect(diagram.width).toBe(544);
  });

  it('runs an arrow that would cross a column in a lane under the columns', () => {
    const diagram = layoutDiagram(
      [
        { id: 'one', label: 'One', href: null, quiet: false, nodes: [box('a')] },
        { id: 'two', label: 'Two', href: null, quiet: false, nodes: [box('b')] },
        { id: 'three', label: 'Three', href: null, quiet: false, nodes: [box('c')] },
      ],
      [
        { from: 'a', to: 'c', via: ['api'] },
        { from: 'c', to: 'a', via: ['message'] },
      ],
    );
    expect(diagram.edges.map((edge) => edge.path)).toEqual([
      'M 200 66 H 228 V 114 H 556 V 66 H 584',
      'M 584 66 H 550 V 124 H 234 V 66 H 200',
    ]);
    expect(diagram.height).toBe(132);
  });

  it('shortens a long name, keeps it whole as the title, and drops a detail that repeats it', () => {
    const [node, repeat] = layoutDiagram(
      [
        {
          id: 'one',
          label: 'One',
          href: null,
          quiet: false,
          nodes: [{ ...box('a'), label: 'A very long system name indeed', detail: 'x' }],
        },
        {
          id: 'two',
          label: 'Two',
          href: null,
          quiet: false,
          nodes: [{ ...box('b'), detail: 'b' }],
        },
      ],
      [],
    ).nodes;
    expect(node?.label).toBe('A very long system…');
    expect(node?.title).toBe('A very long system name indeed');
    expect(repeat?.detail).toBeNull();
  });

  it('draws nothing for no columns', () => {
    expect(layoutDiagram([], []).width).toBe(0);
  });
});

describe('findWorkspace', () => {
  it('finds a workspace by id, or null', () => {
    expect(findWorkspace([shop], 'shop')).toBe(shop);
    expect(findWorkspace([shop], 'nope')).toBeNull();
  });
});
