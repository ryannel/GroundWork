import { describe, expect, it, vi } from 'vitest';

import { derive } from '@/application/plan/derive';
import type { Component, Workspace } from '@/domain/workspace';
import type { Attribution } from '@/domain/workspace-model';

import { thingAt } from './plan-pages-things';
import { todayReaderOf } from './today-reader';
import { codeEvidenceOf, originWord, todayPlaceOf, todayScreensOf } from './today-thing';

vi.mock('server-only', () => ({}));

const { loadFixture } = await import('@/infrastructure/plan-fixture');
const model = derive(await loadFixture('mini.yaml'), { status: {} });

const component = (id: string, name: string): Component => ({
  id,
  name,
  type: 'service',
  tech: null,
  does: null,
  talksTo: [],
});

const shop: Workspace = {
  id: 'shop',
  name: 'Shop',
  description: null,
  isPrivate: false,
  teams: [],
  actors: [],
  domains: [
    {
      id: 'members',
      name: 'Members',
      purpose: null,
      systems: [
        {
          id: 'subs',
          name: 'Subscriptions',
          team: null,
          repos: [],
          components: [component('svc:subs', 'Subscriptions API')],
        },
      ],
    },
  ],
};

describe('todayPlaceOf', () => {
  it('places a system, a component and a thing a component holds', () => {
    const system = { label: 'Subscriptions', href: '/shop/members/subs/' };
    expect(todayPlaceOf(shop, model, 'sys:subs')).toMatchObject({ system, component: null });
    expect(todayPlaceOf(shop, model, 'svc:subs')).toMatchObject({
      domain: { label: 'Members', href: '/shop/members/' },
      system,
      component: null,
    });
    expect(todayPlaceOf(shop, model, 'st:subs-db')).toMatchObject({
      system,
      component: { id: 'svc:subs', name: 'Subscriptions API' },
    });
  });

  it('gives nothing for a thing no component holds', () => {
    expect(todayPlaceOf(shop, model, 'svc:billing')).toBeNull();
  });
});

describe('codeEvidenceOf', () => {
  const at = { repo: 'shop/subs', path: 'src/Api.kt', commit: '0123456789abcdef' };
  const attribution: Record<string, Attribution> = {
    'if:subs-rest#cancel': { origin: 'extracted', sources: [{ ...at, lines: [9, 9] }] },
    'if:subs-rest': {
      origin: 'curated',
      sources: [{ ...at, lines: [3, 20], symbol: 'SubsApi', note: 'The routes' }],
    },
    'if:other': { origin: 'seeded', sources: [at] },
  };

  it('lists the thing’s own code first, then its parts, with permalinks', () => {
    const lines = codeEvidenceOf(attribution, 'if:subs-rest');
    expect(lines.map((l) => l.about)).toEqual(['if:subs-rest', 'if:subs-rest#cancel']);
    expect(lines[0]).toMatchObject({
      origin: 'curated',
      href: 'https://github.com/shop/subs/blob/0123456789abcdef/src/Api.kt#L3-L20',
      where: 'src/Api.kt:3–20',
      commit: '0123456',
      symbol: 'SubsApi',
      note: 'The routes',
    });
    expect(lines[1]?.where).toBe('src/Api.kt:9');
    expect(originWord('extracted')).toBe('Read from the code');
  });

  it('gives nothing when no code is cited', () => {
    expect(codeEvidenceOf(attribution, 'svc:subs')).toEqual([]);
  });
});

describe('today’s pages', () => {
  it('links things under the workspace and offers its pages in the palette', () => {
    expect(thingAt(todayReaderOf('shop', 2).thingBase, 'svc:subs')).toBe('/shop/things/svc-subs/');
    expect(todayScreensOf(shop).map((s) => s.label)).toEqual([
      'Landscape',
      'Members',
      'Subscriptions',
      'Journeys',
      'Reference',
    ]);
  });
});
