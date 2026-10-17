import { describe, expect, it } from 'vitest';

import { acme as acmeKit } from '@/../test/workspace-kit';
import { findIn, ownedBy, systemMapOf, unscanned } from '@/application/system-map';
import { callersOf, shownIn } from '@/application/system-map-links';
import { mapMarkdownOf } from '@/application/system-map-md';

function acme() {
  const { workspace, today } = acmeKit();
  return systemMapOf(workspace, today);
}

describe('the system map', () => {
  it('places every fact in its domain, system and component', () => {
    const map = acme();
    expect(map.facts.get('api:orders-create')).toMatchObject({
      type: 'endpoint',
      name: 'POST /orders',
      domain: 'orders',
      system: 'ordering',
      component: 'svc:order-api',
    });
    expect(map.facts.get('st:search-index')).toMatchObject({
      domain: 'catalogue',
      system: 'search',
    });
  });

  it('cites the parent when a fact has no sources of its own', () => {
    const map = acme();
    const get = map.facts.get('api:products-get')!;
    expect(get.sourcesOf).toBe('svc:products');
    expect(get.sources[0]?.url).toMatch(/^https:\/\/github\.com\/acme\/products\/blob\//u);
    const create = map.facts.get('api:orders-create')!;
    expect(create.sourcesOf).toBeNull();
    expect(create.sources.map((s) => s.lines)).toEqual([[34, 61]]);
  });

  it('finds facts by words, best match first', () => {
    const found = findIn(acme(), 'order mailer');
    expect(found[0]?.id).toBe('svc:order-mailer');
  });

  it('says who calls an endpoint', () => {
    const map = acme();
    const shown = shownIn(map, 'api:orders-create')!;
    expect(shown.in.map(({ from }) => from)).toContain('svc:shop-bff');
    expect(callersOf(map, 'api:orders-create').length).toBeGreaterThanOrEqual(shown.in.length);
    expect(shownIn(map, 'api:nothing')).toBeUndefined();
  });

  it('finds the facts read from a file', () => {
    const owned = ownedBy(acme(), 'OrderController.kt');
    expect(owned.map(({ id }) => id)).toEqual(
      expect.arrayContaining(['if:orders-rest', 'api:orders-create']),
    );
    expect(owned.map(({ id }) => id)).not.toContain('svc:products');
  });

  it('lists repos never scanned', () => {
    const map = acme();
    const repos = unscanned(map).map(({ repo }) => repo);
    expect(repos).toContain('acme/products');
    expect(repos).not.toContain('acme/ordering');
  });

  it('writes one line per component in MAP.md', () => {
    const text = mapMarkdownOf(acme());
    expect(text).toContain('## Orders (`orders`)');
    expect(text).toContain('- `svc:order-api` Order API');
  });
});
