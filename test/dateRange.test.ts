import test from 'node:test';
import assert from 'node:assert/strict';
import { parseRange, dayCount, eachDay, contains } from '../src/dateRange.ts';

test('parseRange reads both ends', () => {
  assert.deepEqual(parseRange('2024-01-05..2024-01-09'), {
    start: '2024-01-05',
    end: '2024-01-09',
  });
});

test('parseRange treats a single date as one day', () => {
  assert.deepEqual(parseRange('2024-01-05'), { start: '2024-01-05', end: '2024-01-05' });
});

test('parseRange rejects bad input', () => {
  assert.throws(() => parseRange('2024-01-09..2024-01-05'), /ends before it starts/);
  assert.throws(() => parseRange('05/01/2024'), /not a date/);
  assert.throws(() => parseRange('2024-01-05..2024-01-09..2024-02-01'), /not a range/);
});

test('dayCount includes both ends', () => {
  assert.equal(dayCount({ start: '2024-01-05', end: '2024-01-09' }), 5);
  assert.equal(dayCount({ start: '2024-01-05', end: '2024-01-05' }), 1);
  assert.equal(dayCount({ start: '2024-02-01', end: '2024-03-01' }), 30);
});

test('eachDay lists the days in order', () => {
  assert.deepEqual(eachDay({ start: '2024-01-30', end: '2024-02-02' }), [
    '2024-01-30',
    '2024-01-31',
    '2024-02-01',
    '2024-02-02',
  ]);
});

test('eachDay crosses a leap day', () => {
  const days = eachDay({ start: '2024-02-28', end: '2024-03-01' });
  assert.deepEqual(days, ['2024-02-28', '2024-02-29', '2024-03-01']);
  assert.equal(days.length, dayCount({ start: '2024-02-28', end: '2024-03-01' }));
});

test('contains checks the ends too', () => {
  const range = { start: '2024-01-05', end: '2024-01-09' };
  assert.equal(contains(range, '2024-01-05'), true);
  assert.equal(contains(range, '2024-01-07'), true);
  assert.equal(contains(range, '2024-01-09'), true);
  assert.equal(contains(range, '2024-01-04'), false);
  assert.equal(contains(range, '2024-01-10'), false);
});
