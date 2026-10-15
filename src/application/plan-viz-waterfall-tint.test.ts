import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const { loadFixture } = await import('@/infrastructure/plan-fixture');
const { derive } = await import('@/application/plan/derive');
const { tintedDocument } = await import('@/application/plan-viz-waterfall-tint');

const shop = derive(await loadFixture('shop.yaml'));

describe('the product page document, tinted by who answers', () => {
  const tokens = tintedDocument(shop, 'gql:product-page');
  const tinted = tokens.filter((t) => t.title !== undefined);

  it('copies the document exactly as written', () => {
    const written = shop.toBe.get('gql:product-page');
    expect(tokens.map((t) => t.text).join('')).toBe(
      typeof written === 'object' && 'document' in written ? written.document : '',
    );
  });

  it('tints a field name with its team and says who answers it', () => {
    const price = tinted.find((t) => t.text === 'price');
    expect(price).toMatchObject({ slot: 4, title: 'Pricing v2 · Pricing' });
    expect(tinted.find((t) => t.text === 'product')?.title).toBe('Product · Catalog');
  });

  it('leaves the operation, variables and arguments plain', () => {
    const names = tinted.map((t) => t.text);
    expect(names).not.toContain('query');
    expect(names).not.toContain('ProductPage');
    expect(names).not.toContain('sku');
    expect(names).not.toContain('ID');
  });

  it('is one plain run when there is no plan, and nothing when there is no document', () => {
    expect(tintedDocument(shop, 'svc:web')).toEqual([]);
    expect(tintedDocument(shop, 'gql:nowhere')).toEqual([]);
  });
});

describe('the tint on other documents', () => {
  it('follows an alias, strings, comments and inline fragments', () => {
    const doc = tintedDocument(shop, 'gql:cart-summary', 'toBe');
    expect(doc.map((t) => t.text).join('')).toContain('cart(id: $id)');
    expect(doc.some((t) => t.title !== undefined)).toBe(true);
  });

  it('copies a mutation as written', () => {
    const doc = tintedDocument(shop, 'gql:add-to-cart', 'asIs');
    expect(doc.map((t) => t.text).join('')).toContain('mutation');
  });
});
