import { describe, expect, it } from 'vitest';

import { acme as acmeKit } from '@/../test/workspace-kit';

import {
  type DomainMap,
  domainMapOf,
  lineIdOf,
  lineWordsOf,
  type MapLink,
} from './landscape-domains';
import { chipRows, columnsOf, drawDomainMap } from './landscape-domains-layout';
import { linesOf } from './landscape-domains-lines';

function acme() {
  const { workspace, today } = acmeKit();
  return { workspace, model: today.model };
}

const link = (a: string, b: string, more: Partial<MapLink> = {}): MapLink => ({
  id: lineIdOf(a, b),
  a: lineIdOf(a, b).split('|')[0] ?? a,
  b: lineIdOf(a, b).split('|')[1] ?? b,
  kinds: ['api'],
  forward: true,
  back: false,
  vias: [],
  leans: 'a',
  ...more,
});

const domain = (id: string, people: string[] = []) => ({
  id,
  name: id.replace('domain:', ''),
  purpose: null,
  href: `/w/${id}/`,
  systems: 1,
  people,
});

describe('domainMapOf', () => {
  it('puts each person in the domains they use, the customer apart, and one line per pair', () => {
    const { workspace, model } = acme();
    const map = domainMapOf(workspace, model);
    const customer = map.people.find((p) => p.id === 'actor:customer')!;
    expect(customer.customer).toBe(true);
    expect(customer.domains).toEqual(['domain:storefront']);
    expect(map.people.find((p) => p.id === 'actor:support-agent')?.domains).toEqual([]);
    expect(map.domains.map((d) => [d.id, d.people])).toEqual([
      ['domain:catalogue', ['actor:merchandiser']],
      ['domain:orders', ['actor:order-clerk']],
      ['domain:storefront', []],
    ]);
    expect(map.domains.every((d) => !d.people.includes('actor:customer'))).toBe(true);
    const ids = map.links.map((l) => l.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toContain('actor:customer|domain:storefront');
    const orders = map.links.find((l) => l.id === 'domain:orders|domain:storefront')!;
    expect(orders).toMatchObject({
      kinds: ['api'],
      forward: false,
      back: true,
      leans: 'b',
      vias: ['Order API REST'],
    });
  });

  it('follows each journey from the person who starts it along the lines it runs', () => {
    const { workspace, model } = acme();
    const journeys = domainMapOf(workspace, model).journeys;
    const buy = journeys.find((j) => j.key === 'uj-buy')!;
    expect(buy.actor).toBe('actor:customer');
    expect(buy.href).toBe('/acme/journeys/uj-buy/');
    expect(buy.domains).toEqual(['domain:storefront', 'domain:orders']);
    expect(buy.lines).toEqual([
      'actor:customer|domain:storefront',
      'domain:orders|domain:storefront',
    ]);
    const cancel = journeys.find((j) => j.key === 'flow-cancel-order')!;
    expect(cancel).toMatchObject({
      actor: 'actor:order-clerk',
      domains: ['domain:orders'],
      lines: [],
    });
  });
});

const name = (id: string) => id.replace(/^\w+:/u, '');

describe('lineWordsOf', () => {
  it('names the first two things a line carries, and everything in its tip', () => {
    const words = lineWordsOf(
      link('domain:a', 'domain:b', { vias: ['X', 'Y', 'Z'], kinds: ['api', 'msg'] }),
      name,
    );
    expect(words).toEqual({ short: 'X, Y and 1 more', full: 'a to b: calls, events. X, Y, Z' });
  });

  it('reads the way things go', () => {
    expect(
      lineWordsOf(link('domain:a', 'domain:b', { forward: false, back: true, vias: ['X'] }), name),
    ).toEqual({
      short: 'X',
      full: 'b to a: calls. X',
    });
    expect(
      lineWordsOf(link('domain:a', 'domain:b', { back: true, kinds: ['data'] }), name).full,
    ).toBe('a and b: reads and writes');
  });
});

describe('drawDomainMap', () => {
  it('reads left to right: the customer, the domains they use, then what those rely on', () => {
    const { workspace, model } = acme();
    const map = domainMapOf(workspace, model);
    const columns = columnsOf(map);
    expect(columns.get('domain:storefront')).toBe(0);
    expect(columns.get('domain:orders')).toBe(1);
    const drawing = drawDomainMap(map);
    const x = (id: string) => drawing.boxes.find((b) => b.id === id)!.x;
    expect(x('actor:customer')).toBeLessThan(x('domain:storefront'));
    expect(x('domain:storefront')).toBeLessThan(x('domain:orders'));
    expect(drawing.lines).toHaveLength(map.links.length);
    for (const box of drawing.boxes) {
      expect(box.x + box.w).toBeLessThanOrEqual(drawing.width);
      expect(box.y + box.h).toBeLessThanOrEqual(drawing.height);
    }
  });

  it('breaks a loop between domains, and loops a line between two in one column', () => {
    const map: DomainMap = {
      people: [],
      domains: [domain('domain:a'), domain('domain:b'), domain('domain:c'), domain('domain:d')],
      links: [
        link('domain:a', 'domain:b'),
        link('domain:b', 'domain:c', { leans: 'a' }),
        link('domain:a', 'domain:c', { leans: 'b' }),
        link('domain:a', 'domain:d', { kinds: ['msg'], back: true, leans: 'both' }),
      ],
      journeys: [],
    };
    const columns = columnsOf(map);
    expect(new Set(columns.keys())).toEqual(
      new Set(['domain:a', 'domain:b', 'domain:c', 'domain:d']),
    );
    const drawing = drawDomainMap(map);
    expect(drawing.boxes.every((b) => b.kind === 'domain')).toBe(true);
    expect(drawing.lines.find((l) => l.id === 'domain:a|domain:d')).toMatchObject({
      kind: 'msg',
      arrows: { start: true, end: true },
    });
  });

  it('draws nothing to nothing, and leaves out a line whose ends are not drawn', () => {
    const empty = drawDomainMap({ people: [], domains: [], links: [], journeys: [] });
    expect(empty.boxes).toEqual([]);
    expect(linesOf([link('domain:a', 'domain:b')], [])).toEqual([]);
  });

  it('wraps a domain’s people onto more rows as their names grow', () => {
    expect(chipRows([])).toBe(0);
    expect(chipRows(['Ann'])).toBe(1);
    expect(chipRows(Array.from({ length: 12 }, () => 'A rather long job title'))).toBeGreaterThan(
      4,
    );
  });
});
