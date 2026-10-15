import { expect, it } from 'vitest';

import { citedIn, staleCitations } from './scan-mark';

const OLD = 'a'.repeat(40);
const NEW = 'b'.repeat(40);

it('lists the files a repo’s facts cite', () => {
  const index = [
    {
      id: 'api:price',
      sources: [{ repo: 'org/pricing', path: 'a.ts', commit: OLD }, { repo: 'org/x' }],
    },
  ];
  expect(citedIn(index, 'org/pricing')).toEqual([{ id: 'api:price', path: 'a.ts', commit: OLD }]);
});

it('calls a citation stale when the file at its commit differs from HEAD', () => {
  const blobs = new Map([
    [`HEAD:a.ts`, '1'],
    [`${OLD}:a.ts`, '1'],
    [`HEAD:b.ts`, '2'],
    [`${OLD}:b.ts`, '3'],
    [`${NEW}:c.ts`, '4'],
  ]);
  const cited = [
    { id: 'same', path: 'a.ts', commit: OLD },
    { id: 'edited', path: 'b.ts', commit: OLD },
    { id: 'deleted', path: 'c.ts', commit: NEW },
  ];
  expect(staleCitations(cited, (spec) => blobs.get(spec))).toEqual([
    `edited: b.ts@aaaaaaa differs from HEAD`,
    `deleted: c.ts@bbbbbbb differs from HEAD`,
  ]);
});
