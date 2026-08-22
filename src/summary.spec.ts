import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { totalByCategory, largest, byDate, type Entry } from './summary.ts';

const entries: Entry[] = [
  { date: '2024-01-07', description: 'Coffee with the Bell team', amountMinor: 480 },
  { date: '2024-01-05', description: 'Return train to Leeds', amountMinor: 6250 },
  { date: '2024-01-09', description: 'Taxi from the station', amountMinor: 1420 },
  { date: '2024-01-05', description: 'A4 paper, 5 reams', amountMinor: 1799, category: 'office' },
];

describe('summary', () => {
  it('totals each category', () => {
    assert.deepEqual(totalByCategory(entries), {
      meals: 480,
      travel: 7670,
      office: 1799,
    });
  });

  it('totals nothing for an empty list', () => {
    assert.deepEqual(totalByCategory([]), {});
  });

  it('honours a category already on the entry', () => {
    const totals = totalByCategory([
      { date: '2024-01-05', description: 'Return train to Leeds', amountMinor: 100, category: 'meals' },
    ]);
    assert.deepEqual(totals, { meals: 100 });
  });

  it('finds the largest entry', () => {
    assert.equal(largest(entries)?.description, 'Return train to Leeds');
    assert.equal(largest([]), undefined);
  });

  it('sorts by date without touching the input', () => {
    const sorted = byDate(entries);
    assert.deepEqual(
      sorted.map((entry) => entry.date),
      ['2024-01-05', '2024-01-05', '2024-01-07', '2024-01-09'],
    );
    assert.equal(sorted[0]?.description, 'Return train to Leeds');
    assert.equal(entries[0]?.date, '2024-01-07');
  });
});
