import path from 'node:path';

import { describe, expect, it, vi } from 'vitest';

import { type Component, type Workspace, systemDoes } from '@/domain/workspace';
import { readWorkspaceModel } from '@/infrastructure/workspace-model';
import { readWorkspaces } from '@/infrastructure/workspace-store';

import { neighboursOf } from './today-neighbours';
import { domainViewOf } from './workspace-domain';
import { landscapeOf } from './workspace-landscape';
import { systemModelOf } from './workspace-model';
import { domainPaths, findWorkspace, systemPaths } from './workspace-paths';
import { systemViewOf } from './workspace-system';

vi.mock('server-only', () => ({}));

const root = path.resolve(import.meta.dirname, '../../workspaces');

async function alder() {
  const workspace = findWorkspace(await readWorkspaces(root), 'alder-finch')!;
  const today = systemModelOf(workspace, await readWorkspaceModel(workspace, root));
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
  it('says what the workspace runs, draws its domains in order of the work, and names who runs what', async () => {
    const { workspace, model } = await alder();
    const view = landscapeOf(workspace, model);
    expect(view.headline).toMatch(/^Alder & Finch runs 14 systems in 3 domains/);
    expect(view.facts).toEqual([
      '3 domains',
      '14 systems',
      '61 components',
      '2 user journeys',
      '19 flows',
    ]);
    expect(view.journeys.slice(0, 2).map((j) => j.kind)).toEqual(['journey', 'journey']);
    expect(view.journeys.every((j) => j.href.startsWith('/alder-finch/journeys/'))).toBe(true);
    expect(view.map.domains.map((d) => d.id)).toEqual([
      'domain:commercial-backbone',
      'domain:website',
      'domain:order-to-delivery',
    ]);
    const website = view.map.domains.find((d) => d.id === 'domain:website')!;
    expect(website.href).toBe('/alder-finch/website/');
    expect(website.systems.find((s) => s.id === 'sys:checkout')?.does).toBe(
      'Turns a cart into a paid order',
    );
    const checkout = view.teams.find((t) => t.id === 'team:checkout')!;
    expect(checkout.slot).toBe(1);
    expect(checkout.systems.map((s) => s.href)).toContain('/alder-finch/website/checkout/');
  });

  it('says only what it runs when the workspace says nothing of itself', async () => {
    const { workspace, model } = await alder();
    expect(landscapeOf({ ...workspace, description: null }, model).headline).toBe(
      'Alder & Finch runs 14 systems in 3 domains.',
    );
  });
});

describe('domainViewOf', () => {
  it('teaches the domain: its edges, journeys through it, systems and what it offers', async () => {
    const { workspace, model } = await alder();
    const view = domainViewOf(workspace, model, 'order-to-delivery')!;
    expect(view.headline).toMatch(/^Order to delivery’s 6 systems take part in /);
    expect(view.purpose).toMatch(/^From a paid order/);
    expect(view.journeys.every((j) => j.here !== null)).toBe(true);
    expect(view.systems.map((s) => s.href)).toContain('/alder-finch/order-to-delivery/payments/');
    expect(view.neighbours.reachedBy.map((n) => n.id)).toContain('checkout');
    expect(view.catalogue.apis.length).toBeGreaterThan(0);
    expect(view.catalogue.events.map((e) => e.head.id)).toContain('msg:order-placed');
    expect(view.counts.systems).toBe(6);
    expect(view.counts.flows).toBe(view.flows.length);
    expect(view.counts.events).toBe(view.catalogue.events.length);
    expect(view.teams.every((t) => t.slot > 0)).toBe(true);
    expect(view.systems.every((s) => s.components > 0)).toBe(true);
  });

  it('returns null for an unknown domain', async () => {
    const { workspace, model } = await alder();
    expect(domainViewOf(workspace, model, 'nope')).toBeNull();
  });
});

describe('systemViewOf', () => {
  it('teaches the system: its job, owner, code, flows and components', async () => {
    const { workspace, today } = await alder();
    const view = systemViewOf(workspace, today, { domain: 'website', system: 'checkout' })!;
    expect(view.headline).toBe('Checkout turns a cart into a paid order.');
    expect(view.about).toMatch(/^Run by the .+ team, in the Website domain$/);
    expect(view.trail.map((step) => step.href)).toEqual(['/alder-finch/', '/alder-finch/website/']);
    expect(view.repos).toEqual([
      expect.objectContaining({ repo: 'alder-finch/checkout', scanned: false }),
    ]);
    expect(view.repos[0]?.read).toMatch(/^Not scanned yet/);
    expect(view.flows.length).toBeGreaterThan(0);
    expect(view.components.map((c) => c.chip.id)).toContain('svc:checkout');
    const checkout = view.components.find((c) => c.chip.id === 'svc:checkout')!;
    expect(checkout.calls.length).toBeGreaterThan(0);
    expect(checkout.offers.every((o) => o.calls.length === 0)).toBe(true);
    expect(view.data.map((d) => d.head.id)).toContain('st:cart-cache');
  });

  it('returns null for an unknown system or domain', async () => {
    const { workspace, today } = await alder();
    expect(systemViewOf(workspace, today, { domain: 'website', system: 'payments' })).toBeNull();
    expect(systemViewOf(workspace, today, { domain: 'nope', system: 'checkout' })).toBeNull();
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
