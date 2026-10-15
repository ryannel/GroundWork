import { describe, expect, it, vi } from 'vitest';

import { derive } from '@/application/plan/derive';

import { outlineOf } from './plan-pages';
import { crumbOf, teamHidden, teamPages, teamPlaces } from './plan-pages-team';

vi.mock('server-only', () => ({}));

const { loadFixture } = await import('@/infrastructure/plan-fixture');

const plan = await loadFixture('mini.yaml');
const model = derive(plan, { status: {} });
const outline = outlineOf(model, { workspace: 'shop', slug: 'mini' });
const all = outline.pages.map((p) => p.href);

describe('team pages', () => {
  const teams = teamPages(model, outline);

  it('lists every team, keeping the reading order', () => {
    expect(teams.map((t) => t.id)).toEqual(model.plan.teams.map((t) => t.id));
    for (const team of teams) {
      const order = team.hrefs.map((href) => all.indexOf(href));
      expect(order).toEqual(order.toSorted((a, b) => a - b));
    }
  });

  it('keeps the cover, the why and the reference for every team', () => {
    for (const team of teams)
      for (const page of outline.pages.filter((p) => ['cover', 'why', 'ref'].includes(p.chapter)))
        expect(team.hrefs).toContain(page.href);
  });

  it('leaves no chapter empty', () => {
    for (const team of teams)
      for (const chapter of outline.chapters) {
        const pages = outline.pages.filter((p) => p.chapter === chapter.key);
        if (pages.length > 0) expect(pages.some((p) => team.hrefs.includes(p.href))).toBe(true);
      }
  });

  it('drops the changes ledger, which no team reads by itself', () => {
    const ledger = outline.pages.find((p) => p.chapter === 'changes' && p.screen === 'ledger');
    for (const team of teams)
      if (ledger !== undefined && outline.pages.filter((p) => p.chapter === 'changes').length > 1)
        expect(team.hrefs).not.toContain(ledger.href);
  });

  it('cuts a team that touches little to fewer pages than the whole plan', () => {
    expect(Math.min(...teams.map((t) => t.hrefs.length))).toBeLessThan(all.length);
  });

  it('places a screen among a team’s pages, or says it is not one of them', () => {
    const [team] = teams;
    if (team === undefined) throw new Error('mini.yaml has teams');
    const hidden = teamHidden(outline, teams)[team.id] ?? [];
    expect(hidden.length + team.hrefs.length).toBe(all.length);
    const first = teamPlaces(teams, team.hrefs[0] ?? '')[0];
    expect(first).toMatchObject({ id: team.id, at: 1, of: team.hrefs.length });
    if (hidden[0] !== undefined) expect(teamPlaces(teams, hidden[0])[0]?.at).toBeNull();
  });

  it('names the chapter, then the screen', () => {
    const page = outline.pages.find((p) => p.chapter === 'why');
    if (page === undefined) throw new Error('mini.yaml has a why');
    expect(crumbOf(outline, page)).toEqual(['1 · Why', page.title]);
  });
});
