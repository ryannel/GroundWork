import { describe, expect, it } from 'vitest';

import { judge, kilobytes, pageOf } from './page-budget-rules';

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

  it('reads a page from its file and says its size', () => {
    expect(pageOf('volvo-cars/reference/apis/index.html')).toBe('volvo-cars/reference/apis/');
    expect(pageOf('index.html')).toBe('/');
    expect(kilobytes(1_536_000)).toBe('1,500 KB');
  });
});
