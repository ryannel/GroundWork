import { describe, expect, it, vi } from 'vitest';

import { derive } from '@/application/plan/derive';

import { outlineOf } from './plan-pages';
import { entityView } from './plan-pages-entity';
import { entityCard } from './plan-pages-entity-card';
import { readEntries } from './plan-pages-entity-read';
import { mentionsOf, placesOf } from './plan-pages-entity-where';

vi.mock(import('server-only'), () => ({}));

const { loadFixture } = await import('@/infrastructure/plan-fixture');

const plan = await loadFixture('mini.yaml');
const model = derive(plan, { status: {} });
const outline = outlineOf(model, { workspace: 'shop', slug: 'mini' });

describe('readEntries', () => {
  it('says levels and handling in words, not codes', () => {
    const read = readEntries({ likelihood: 'med', impact: 'high', roam: 'mitigated' });
    const facts = Object.fromEntries(read.facts.map((f) => [f.label, f.value]));
    expect(facts.Likelihood).toBe('medium');
    expect(facts.Handling).toMatch(/^mitigated: /u);
    expect(read.facts.some((f) => f.label.toLowerCase() === 'roam')).toBe(false);
  });

  it('keeps the picture and sources out of the facts and names a Figma link', () => {
    const read = readEntries({
      image: 'screens/a.png',
      figma: 'https://www.figma.com/file/x',
      sources: [{ url: 'https://github.com/o/shop/blob/main/src/a.ts#L3' }],
    });
    expect(read.image).toBe('screens/a.png');
    expect(read.facts).toEqual([
      { label: 'Design', value: 'Open in Figma', href: 'https://www.figma.com/file/x' },
    ]);
    expect(read.sources).toEqual([
      { label: 'shop · src/a.ts#L3', href: 'https://github.com/o/shop/blob/main/src/a.ts#L3' },
    ]);
  });

  it('gives long prose a heading of its own', () => {
    const mitigation =
      'Search every consumer of the v1 topic and ask each team to confirm before the switch.';
    const read = readEntries({ statement: 'A v1 consumer is missed.', mitigation });
    expect(read.text).toBe('A v1 consumer is missed.');
    expect(read.sections).toEqual([{ label: 'Mitigation', text: mitigation }]);
  });
});

describe('entityView', () => {
  it('names the owner once, not again among what it uses', () => {
    const view = entityView(model, 'svc:subs');
    const used = view?.uses.flatMap((g) => g.refs.map((r) => r.id)) ?? [];
    expect(view?.owner.map((r) => r.id)).toContain('team:subs');
    expect(used).not.toContain('team:subs');
  });

  it('marks plan-level things, which have no today', () => {
    expect(entityView(model, 'risk:v1-consumer')?.planLevel).toBe(true);
    expect(entityView(model, 'svc:subs')?.planLevel).toBe(false);
  });
});

describe('where a thing appears', () => {
  it('lists the chapters that tell it by number and title, with a page to go to', () => {
    const places = placesOf(model, outline, 'svc:subs');
    expect(places.length).toBeGreaterThan(0);
    for (const place of places) {
      expect(place.label).toMatch(/^(?:\d+|R) · \S/u);
      expect(place.href).toMatch(/^\/shop\/plans\/mini\//u);
    }
  });

  it('finds the things whose prose cites it', () => {
    const { ids } = mentionsOf(model, 'flow:pause');
    expect(ids.every((id) => id !== 'flow:pause')).toBe(true);
  });
});

describe('entityCard', () => {
  it('says what a thing is at a glance', () => {
    const card = entityCard(model, 'svc:subs');
    expect(card?.name).toBe('Subscriptions');
    expect(card?.team).not.toBeNull();
    expect(entityCard(model, 'svc:nope')).toBeNull();
  });
});
