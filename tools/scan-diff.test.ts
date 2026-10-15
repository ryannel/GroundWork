import { describe, expect, it } from 'vitest';

import { changesBetween, indexedFacts, parseNameStatus, workList } from './scan-diff';

describe('parseNameStatus', () => {
  it('reads changes, including renames, from git diff -z', () => {
    expect(parseNameStatus('M\0a.ts\0R087\0old.ts\0new.ts\0D\0gone.ts\0')).toEqual([
      { status: 'M', path: 'a.ts' },
      { status: 'R087', from: 'old.ts', path: 'new.ts' },
      { status: 'D', path: 'gone.ts' },
    ]);
  });
});

it('compares blob shas when the old head is no longer in history', () => {
  const then = new Map([
    ['a.ts', '1'],
    ['b.ts', '2'],
  ]);
  const now = new Map([
    ['a.ts', '9'],
    ['c.ts', '3'],
  ]);
  expect(changesBetween(then, now)).toEqual([
    { status: 'M', path: 'a.ts' },
    { status: 'A', path: 'c.ts' },
    { status: 'D', path: 'b.ts' },
  ]);
});

describe('workList', () => {
  const facts = [
    { id: 'api:price', paths: ['src/price.ts'] },
    { id: 'h:price', paths: ['src/price.ts', 'src/store.ts'] },
    { id: 'msg:changed', paths: ['src/events.ts'] },
    { id: 'st:prices', paths: ['src/store.ts'] },
    { id: 'api:stock', paths: ['src/stock.ts'] },
  ];

  it('re-explores facts in changed files, explores new ones and proposes vanished ones', () => {
    const work = workList(
      [
        { status: 'M', path: 'src/price.ts' },
        { status: 'A', path: 'src/discount.ts' },
        { status: 'A', path: 'package-lock.json' },
        { status: 'D', path: 'src/store.ts' },
        { status: 'R100', from: 'src/events.ts', path: 'src/messages/events.ts' },
      ],
      facts,
    );
    expect(work.reexplore.map((fact) => fact.id)).toEqual(['api:price', 'h:price']);
    expect(work.explore).toEqual([{ path: 'src/discount.ts', why: 'added' }]);
    expect(work.vanished).toEqual([{ id: 'st:prices', paths: ['src/store.ts'] }]);
    expect(work.renamed).toEqual([
      {
        from: 'src/events.ts',
        to: 'src/messages/events.ts',
        changed: false,
        facts: ['msg:changed'],
      },
    ]);
    expect(work.unchanged).toBe(2);
  });

  it('re-explores a fact whose file was renamed and edited', () => {
    const work = workList(
      [{ status: 'R080', from: 'src/stock.ts', path: 'src/stock/api.ts' }],
      facts,
    );
    expect(work.reexplore).toEqual([{ id: 'api:stock', paths: ['src/stock.ts'] }]);
  });
});

it('keeps only the paths each fact cites in the repo being scanned', () => {
  const index = [
    {
      id: 'h:price',
      sources: [
        { repo: 'org/pricing', path: 'a.ts' },
        { repo: 'org/pricing', path: 'a.ts' },
        { repo: 'org/stock', path: 'b.ts' },
      ],
    },
  ];
  expect(indexedFacts(index, 'org/pricing')).toEqual([{ id: 'h:price', paths: ['a.ts'] }]);
});
