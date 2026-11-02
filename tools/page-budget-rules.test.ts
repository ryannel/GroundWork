import { describe, expect, it } from 'vitest';

import { judge, kilobytes, pageLinks } from './page-budget-rules';

const pages = [
  { page: 'a/', bytes: 100 },
  { page: 'b/', bytes: 900 },
  { page: 'c/', bytes: 500 },
  { page: 'd/', bytes: 500 },
];

describe('page budget rules', () => {
  it('names the pages over the limit, heaviest first', () => {
    expect(judge(pages, 499, 2).over.map((p) => p.page)).toStrictEqual(['b/', 'c/', 'd/']);
    expect(judge(pages, 500, 2).over.map((p) => p.page)).toStrictEqual(['b/']);
    expect(judge(pages, 900, 2).over).toStrictEqual([]);
  });

  it('lists the heaviest pages whether over or not', () => {
    expect(judge(pages, 10_000, 3).heaviest.map((p) => p.page)).toStrictEqual(['b/', 'c/', 'd/']);
  });

  it('follows links to the site’s own pages, once each, and says a size', () => {
    const html = [
      '<a href="/shop/">',
      '<a href="/shop/?team=a#x">',
      '<a href="things/?id=1&amp;b=2">',
      '<a href="https://example.com/">',
      '<link href="/_next/static/a.css">',
      '<a href="/shop/model.json">',
    ].join('');
    expect(pageLinks(html, new URL('http://localhost:3000/shop/plans/p/'))).toStrictEqual([
      '/shop/',
      '/shop/plans/p/things/',
    ]);
    expect(kilobytes(1_536_000)).toBe('1,500 KB');
  });
});
