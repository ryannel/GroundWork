import { describe, expect, it, vi } from 'vitest';

import { derive } from '@/application/plan/derive';
import type { Workspace } from '@/domain/workspace';

import { planCardOf, partsFor } from './plan-footprint';
import { findPage, neighboursOf, outlineOf, pageHref, planHref, screenParams } from './plan-pages';
import { entityView, glyphOf, typeWord } from './plan-pages-entity';
import { hashFor, idToToken, inspectedIn, tokenToId } from './plan-pages-hash';
import { keyOf } from './plan-pages-screens';
import { outlineScreens, paletteEntries, paletteGroups, searchPalette } from './plan-pages-search';

vi.mock('server-only', () => ({}));

const { loadFixture } = await import('@/infrastructure/plan-fixture');

const plan = await loadFixture('mini.yaml');
const model = derive(plan, { status: { 'wi:pause-endpoint': { state: 'closed' } } });
const at = { workspace: 'shop', slug: 'mini' };
const outline = outlineOf(model, at);

describe('addresses', () => {
  it('puts the cover at the plan and every screen under its chapter', () => {
    expect(planHref(at)).toBe('/shop/plans/mini/');
    expect(pageHref(at, 'cover', 'cover')).toBe('/shop/plans/mini/');
    expect(pageHref(at, 'cover', 'part')).toBe('/shop/plans/mini/cover/part/');
    expect(pageHref(at, 'why', 'problem')).toBe('/shop/plans/mini/why/problem/');
  });

  it('turns ids into URL-safe keys', () => {
    expect(keyOf('flow:cancel#publish')).toBe('flow-cancel-publish');
  });
});

describe('the outline', () => {
  it('lists the story in order, with reference and versions beside it', () => {
    const keys = outline.chapters.map((chapter) => chapter.key);
    expect(keys.slice(0, 3)).toEqual(['cover', 'why', 'today']);
    expect(keys).toContain('ref');
    expect(
      outline.chapters.filter((chapter) => chapter.side).map((chapter) => chapter.key),
    ).toEqual(keys.filter((key) => key === 'ref' || key === 'versions'));
  });

  it('gives each screen a unique address', () => {
    const hrefs = outline.pages.map((page) => page.href);
    expect(new Set(hrefs).size).toBe(hrefs.length);
  });

  it('draws a journey screen for the plan’s scenario and a page for its other flows', () => {
    const journey = outline.chapters.find((chapter) => chapter.key === 'journey');
    expect(journey?.pages[0]?.screen).toBe('sc-trip');
    expect(journey?.pages.map((page) => page.screen)).toContain('flow-cancel');
  });

  it('keeps every chapter reachable and never empty', () => {
    for (const chapter of outline.chapters) expect(chapter.pages.length).toBeGreaterThan(0);
  });

  it('finds a page and its neighbours', () => {
    const page = findPage(outline, 'why', 'problem');
    expect(page?.title).toBe('The problem');
    if (page === null) throw new Error('no page');
    const around = neighboursOf(outline, page);
    expect(around.previous?.screen).toBe('cover');
    expect(around.next).not.toBeNull();
    expect(around.previousChapter?.chapter).toBe('cover');
    expect(around.nextChapter?.chapter).toBe('today');
    expect(findPage(outline, 'why', 'nope')).toBeNull();
  });

  it('has no neighbour before the cover or after the last screen', () => {
    const first = outline.pages[0];
    const last = outline.pages.at(-1);
    if (first === undefined || last === undefined) throw new Error('empty outline');
    expect(neighboursOf(outline, first).previous).toBeNull();
    expect(neighboursOf(outline, last).next).toBeNull();
  });

  it("names the chapter the next screen opens, and closes the plan on the story's last screen", () => {
    const cover = outline.pages[0];
    if (cover === undefined) throw new Error('empty outline');
    expect(neighboursOf(outline, cover).opens?.number).toBe('1');
    expect(neighboursOf(outline, cover).end).toBeNull();
    const story = outline.pages.filter((p) => p.chapter !== 'ref' && p.chapter !== 'versions');
    const last = story.at(-1);
    if (last === undefined) throw new Error('no story');
    const around = neighboursOf(outline, last);
    expect(around.end).toBe('/shop/');
    expect(around.opens).toBeNull();
    const ref = outline.pages.find((p) => p.chapter === 'ref');
    if (ref !== undefined) expect(neighboursOf(outline, ref).end).toBeNull();
  });

  it('leaves the cover out of the static screen params', () => {
    const params = screenParams(outline);
    expect(params.some((p) => p.chapter === 'cover' && p.screen === 'cover')).toBe(false);
    expect(params).toHaveLength(outline.pages.length - 1);
  });
});

describe('the inspector address', () => {
  it('round-trips ids through the hash', () => {
    for (const id of ['svc:subs', 'flow:cancel#publish', 'sch:status-changed-v1']) {
      expect(inspectedIn(hashFor(id))).toBe(id);
    }
    expect(hashFor('flow:cancel#publish')).toBe('#i-flow-cancel.publish');
  });

  it('ignores anything that is not a known id', () => {
    expect(inspectedIn('')).toBeNull();
    expect(inspectedIn('#other')).toBeNull();
    expect(tokenToId('nope-x')).toBeNull();
    expect(tokenToId('svc-')).toBeNull();
    expect(tokenToId('svc')).toBeNull();
    expect(idToToken('svc:a b')).toBe('svc-ab');
  });
});

describe('entityView', () => {
  it('describes a service with its owner and what uses it', () => {
    const view = entityView(model, 'svc:subs');
    expect(view?.type).toBe('service');
    expect(view?.glyph).toBe('▣');
    expect(view?.owner.map((o) => o.id)).toContain('team:subs');
    expect(view?.usedBy.length).toBeGreaterThan(0);
  });

  it('says what the plan does to a changed thing', () => {
    const view = entityView(model, 'flow:cancel');
    expect(view?.changes.length).toBeGreaterThan(0);
    expect(view?.status).not.toBe('added');
  });

  it('knows a thing the plan adds', () => {
    expect(entityView(model, 'sch:pause-request')?.status).toBe('added');
  });

  it('is null for an id the plan does not have', () => {
    expect(entityView(model, 'svc:nope')).toBeNull();
    expect(entityView(model, 'nonsense')).toBeNull();
    expect(glyphOf('nonsense')).toBe('·');
  });

  it('lists the ids a thing points at as groups of chips', () => {
    const view = entityView(model, 'wi:pause-endpoint');
    expect(view?.uses.some((group) => group.refs.length > 0)).toBe(true);
  });
});

describe('searchPalette', () => {
  const entries = paletteEntries(model, outlineScreens(outline));

  it('offers screens before anything is typed', () => {
    const found = searchPalette(entries, '');
    expect(found.length).toBeGreaterThan(0);
    expect(found.every((entry) => entry.kind === 'screen')).toBe(true);
  });

  it('finds things and screens by words in their names', () => {
    const found = searchPalette(entries, 'subscriptions');
    expect(found.some((entry) => entry.target === 'svc:subs')).toBe(true);
    expect(searchPalette(entries, 'the problem')[0]?.kind).toBe('screen');
  });

  it('puts the exact name first and says when nothing matches', () => {
    expect(searchPalette(entries, 'billing')[0]?.label.toLowerCase()).toBe('billing');
    expect(searchPalette(entries, 'zzzzzz')).toEqual([]);
  });

  it('finds steps and fields by name, saying whose they are', () => {
    const step = entries.find((entry) => entry.target === 'flow:cancel#request');
    expect(step?.kind).toBe('part');
    expect(step?.hint).toMatch(/^step 1 of /);
    expect(
      entries.some((entry) => entry.kind === 'part' && entry.hint.startsWith('field of ')),
    ).toBe(true);
  });

  it('filters by type, and offers a filter for each type but not for parts', () => {
    const groups = paletteGroups(entries);
    expect(groups[0]?.key).toBe('screen');
    expect(groups.some((g) => g.key === 'service' && g.label === 'Services')).toBe(true);
    expect(groups.some((g) => g.key === 'step' || g.key === 'field')).toBe(false);
    const services = searchPalette(entries, '', 'service');
    expect(services.length).toBeGreaterThan(0);
    expect(services.every((entry) => entry.group === 'service')).toBe(true);
  });
});

describe('footprints', () => {
  const workspace: Workspace = {
    id: 'shop',
    name: 'Shop',
    description: '',
    isPrivate: false,
    teams: [],
    domains: [
      {
        id: 'sales',
        name: 'Sales',
        purpose: null,
        systems: [
          {
            id: 'subscriptions',
            name: 'Subscriptions',
            team: null,
            repos: ['acme/subs'],
            components: [
              {
                id: 'svc:subs',
                name: 'Subs',
                type: 'service',
                tech: null,
                does: null,
                talksTo: [],
              },
            ],
          },
          {
            id: 'quiet',
            name: 'Quiet',
            team: null,
            repos: ['acme/quiet'],
            components: [],
          },
        ],
      },
    ],
  };
  const input = {
    slug: 'mini',
    plan,
    status: { 'wi:pause-endpoint': { state: 'closed' as const } },
  };
  const here = { domain: 'sales', system: 'subscriptions' };

  it('finds the plans whose changes land on a system’s components', () => {
    const parts = partsFor(workspace, here, [input]);
    expect(parts).toHaveLength(1);
    expect(parts[0]?.href).toBe('/shop/plans/mini/');
  });

  it('counts work items sent to the system’s repos', () => {
    const withRepo = {
      ...input,
      plan: {
        ...plan,
        work_items: (plan.work_items ?? []).map((item) => ({ ...item, repo: 'acme/quiet' })),
      },
    };
    const parts = partsFor(workspace, { domain: 'sales', system: 'quiet' }, [withRepo]);
    expect(parts[0]?.workItems).toBe((plan.work_items ?? []).length);
    expect(parts[0]?.done).toBe(1);
  });

  it('leaves out plans that do not reach the system', () => {
    expect(partsFor(workspace, { domain: 'sales', system: 'quiet' }, [input])).toEqual([]);
    expect(partsFor(workspace, { domain: 'sales', system: 'missing' }, [input])).toEqual([]);
  });

  it('shows a plan on the landscape with its stage', () => {
    const card = planCardOf('shop', input);
    expect(card.href).toBe('/shop/plans/mini/');
    expect(card.stage).toMatch(/^In delivery · 1 of \d+ work items? done$/);
    const draft = planCardOf('shop', { ...input, status: {} });
    expect(draft.stage).toMatch(/^(Draft|In review|Approved|Committed)$/);
  });
});

describe('kind words', () => {
  it('names a component by its kind and a topic as a topic', () => {
    expect(typeWord('service', { kind: 'ui' })).toBe('app');
    expect(typeWord('service', { kind: 'external' })).toBe('external system');
    expect(typeWord('service', { kind: 'job' })).toBe('job');
    expect(typeWord('service', { kind: 'odd' })).toBe('service');
    expect(typeWord('service', {})).toBe('service');
    expect(typeWord('store', { kind: 'topic' })).toBe('topic');
    expect(typeWord('store', { kind: 'queue' })).toBe('queue');
    expect(typeWord('store', { kind: 'database' })).toBe('store');
  });
});
