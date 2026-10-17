import { describe, expect, it, vi } from 'vitest';

import { derive } from '@/application/plan/derive';

import { nodeType, viaLabel } from './plan-viz-map';

vi.mock(import('server-only'), () => ({}));

const { loadFixture } = await import('@/infrastructure/plan-fixture');

const model = derive(await loadFixture('shop.yaml'));

describe('nodeType', () => {
  it('gives each kind of service its glyph and word', () => {
    expect(nodeType('svc:web', model.get('svc:web'))).toEqual(['◧', 'UI']);
    expect(nodeType('svc:gateway', model.get('svc:gateway'))).toEqual(['▣', 'SERVICE']);
    expect(nodeType('svc:x', { kind: 'job' })).toEqual(['⏱', 'JOB']);
    expect(nodeType('svc:x', { kind: 'external' })).toEqual(['◇', 'EXTERNAL']);
  });

  it('gives stores their own glyphs, and a plain store when the kind is unknown', () => {
    expect(nodeType('st:catalog-db', model.get('st:catalog-db'))).toEqual(['⛁', 'DATABASE']);
    expect(nodeType('st:price-topic', model.get('st:price-topic'))).toEqual(['⇶', 'TOPIC']);
    expect(nodeType('st:edge-cache', { kind: 'cache' })).toEqual(['◍', 'CACHE']);
    expect(nodeType('st:x', { kind: 'odd' })).toEqual(['⛁', 'STORE']);
  });

  it('calls an unknown thing an item', () => {
    expect(nodeType('svc:nope', model.get('svc:nope'))).toEqual(['·', 'ITEM']);
  });
});

describe('viaLabel', () => {
  it('says internal for no link', () => {
    expect(viaLabel(model, null)).toBe('internal');
    expect(viaLabel(model, 'internal')).toBe('internal');
    expect(viaLabel(model, '')).toBe('internal');
  });

  it('keeps an unknown id as it is', () => {
    expect(viaLabel(model, 'api:nope')).toBe('api:nope');
  });

  it('names a message and an endpoint', () => {
    expect(viaLabel(model, 'msg:price-published')).toBe('price.published');
    expect(viaLabel(model, 'api:pricing-price')).toBe('GET /prices/{sku}');
  });

  it('shortens a long path to its last segment, and any long label with an ellipsis', () => {
    expect(viaLabel(model, 'api:pricing-price', 12)).toBe('GET …/{sku}');
    expect(viaLabel(model, 'msg:price-published', 6)).toBe('price…');
  });

  it('shows an operation as a call', () => {
    expect(viaLabel(model, 'gql:add-to-cart')).toBe('AddToCart');
    expect(viaLabel(model, 'gql:add-to-cart', 5)).toBe('AddT…');
  });
});
